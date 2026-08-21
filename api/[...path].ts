import type { VercelRequest, VercelResponse } from "@vercel/node";
// Import the compiled Express app + one-time bootstrap from the server workspace.
// `npm run vercel-build` compiles the server to server/dist before functions are bundled.
import { createApp } from "../server/dist/app.js";
import { ensureReady } from "../server/dist/bootstrap.js";

const app = createApp();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = req.url ?? "";
  const isHealth = url.startsWith("/api/health") || url === "/health";

  try {
    // Idempotently create schema + seed on cold start. ensureReady does not
    // cache failures, so a transient DB issue is retried on the next request.
    await ensureReady();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[bootstrap] failed:", e);
    if (!isHealth) {
      res.status(503).json({
        error: "The service is starting up or the database is unavailable. Please retry.",
        detail: (e as Error).message,
      });
      return;
    }
  }

  // Ensure the Express app (which mounts routes under /api) sees the /api prefix.
  if (req.url && !req.url.startsWith("/api")) {
    req.url = "/api" + (req.url.startsWith("/") ? req.url : `/${req.url}`);
  }
  // An Express app is itself a (req, res) request handler.
  return (app as unknown as (req: VercelRequest, res: VercelResponse) => void)(req, res);
}
