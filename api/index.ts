import type { VercelRequest, VercelResponse } from "@vercel/node";

export const config = { maxDuration: 30 };

let appPromise: Promise<(req: VercelRequest, res: VercelResponse) => void> | null = null;

async function getApp() {
  if (!appPromise) {
    appPromise = (async () => {
      const { createApp } = await import("../server/dist/app.js");
      const { ensureReady } = await import("../server/dist/bootstrap.js");
      await ensureReady();
      return createApp() as unknown as (req: VercelRequest, res: VercelResponse) => void;
    })().catch((e) => {
      appPromise = null;
      throw e;
    });
  }
  return appPromise;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const app = await getApp();
    // The Express app mounts routes under /api; ensure it sees that prefix.
    if (req.url && !req.url.startsWith("/api")) {
      req.url = "/api" + (req.url.startsWith("/") ? req.url : `/${req.url}`);
    }
    return app(req, res);
  } catch (e) {
    const err = e as Error;
    // eslint-disable-next-line no-console
    console.error("[api] initialization failed:", err);
    res.status(503).json({
      error: "The service is starting up or the database is unavailable. Please retry.",
    });
  }
}
