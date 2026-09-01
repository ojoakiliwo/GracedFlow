import { Router } from "express";
import { z } from "zod";
import { authenticate, requireRole } from "../auth.js";
import { audit } from "../util.js";
import { asyncHandler, parseBody } from "./helpers.js";
import {
  ensureWhipSession,
  listDestinationRows,
  publicDestinations,
  readyOutputs,
  restreamConfigured,
  saveDestinations,
} from "../studioLive.js";

export const studioRouter = Router();
studioRouter.use(authenticate);
studioRouter.use(requireRole("worker"));

const destinationSchema = z.object({
  platform: z.string().min(2),
  enabled: z.boolean(),
  ingestUrl: z.string(),
  streamKey: z.string().optional(),
});

const saveSchema = z.object({
  destinations: z.array(destinationSchema).min(1),
});

studioRouter.get(
  "/live",
  asyncHandler(async (_req, res) => {
    const rows = await listDestinationRows();
    res.json({
      restream: restreamConfigured(),
      restreamDetail: restreamConfigured()
        ? "Live from this browser via Cloudflare Stream"
        : "Keys save here. Add CF_ACCOUNT_ID and CF_STREAM_API_TOKEN to go live from this desk, or capture Program with OBS.",
      destinations: publicDestinations(rows),
    });
  }),
);

studioRouter.put(
  "/live",
  asyncHandler(async (req, res) => {
    const input = parseBody(saveSchema, req.body);
    const rows = await saveDestinations(input.destinations);
    audit("update", "studio_live", "destinations", req.user, {
      enabled: rows.filter((r) => r.enabled).map((r) => r.platform),
    });
    res.json({
      restream: restreamConfigured(),
      restreamDetail: restreamConfigured()
        ? "Live from this browser via Cloudflare Stream"
        : "Keys save here. Add CF_ACCOUNT_ID and CF_STREAM_API_TOKEN to go live from this desk, or capture Program with OBS.",
      destinations: publicDestinations(rows),
    });
  }),
);

studioRouter.post(
  "/live/session",
  asyncHandler(async (req, res) => {
    const rows = await listDestinationRows();
    const outputs = readyOutputs(rows);
    const session = await ensureWhipSession(outputs);
    audit("start", "studio_live", session.liveInputId, req.user, {
      platforms: outputs.map((o) => o.platform),
    });
    res.json({
      mode: "whip",
      whipUrl: session.whipUrl,
      platforms: outputs.map((o) => o.platform),
    });
  }),
);
