import { Router } from "express";
import { z } from "zod";
import { authenticate, requireRole } from "../auth.js";
import { audit } from "../util.js";
import { asyncHandler, parseBody } from "./helpers.js";
import {
  encoderTargets,
  ensureWhipSession,
  listDestinationRows,
  publicDestinations,
  readyOutputs,
  restreamConfigured,
  restreamDetail,
  restreamHealth,
  saveDestinations,
  syncLiveRestream,
  whipExchange,
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
      restreamDetail: restreamDetail(),
      destinations: publicDestinations(rows),
    });
  }),
);

studioRouter.put(
  "/live",
  asyncHandler(async (req, res) => {
    const input = parseBody(saveSchema, req.body);
    const rows = await saveDestinations(input.destinations);
    const platforms = await syncLiveRestream();
    audit("update", "studio_live", "destinations", req.user, {
      enabled: rows.filter((r) => r.enabled).map((r) => r.platform),
    });
    res.json({
      restream: restreamConfigured(),
      restreamDetail: restreamDetail(),
      destinations: publicDestinations(rows),
      platforms,
    });
  }),
);

studioRouter.get(
  "/live/encoder",
  asyncHandler(async (req, res) => {
    const rows = await listDestinationRows();
    const targets = encoderTargets(rows);
    audit("read", "studio_live", "encoder", req.user, {
      platforms: targets.map((row) => row.platform),
    });
    res.json({
      targets,
      ffmpeg: "https://www.gyan.dev/ffmpeg/builds/",
      winget: "winget install Gyan.FFmpeg",
    });
  }),
);

studioRouter.get(
  "/live/health",
  asyncHandler(async (_req, res) => {
    res.json(await restreamHealth());
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
      iceServers: session.iceServers,
      platforms: outputs.map((o) => o.platform),
    });
  }),
);

studioRouter.post(
  "/live/whip",
  asyncHandler(async (req, res) => {
    const { sdp, whipUrl } = parseBody(
      z.object({ sdp: z.string().min(8), whipUrl: z.string().optional() }),
      req.body,
    );
    res.json({ sdp: await whipExchange(sdp, whipUrl) });
  }),
);
