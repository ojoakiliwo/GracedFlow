import type { VercelRequest, VercelResponse } from "@vercel/node";
// Import the compiled Express app + one-time bootstrap from the server workspace.
// `npm run vercel-build` compiles the server to server/dist before functions are bundled.
import { createApp } from "../server/dist/app.js";
import { ensureReady } from "../server/dist/bootstrap.js";

const app = createApp();
let ready: Promise<void> | null = null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!ready) ready = ensureReady();
  await ready;
  // Ensure the Express app (which mounts routes under /api) sees the /api prefix.
  if (req.url && !req.url.startsWith("/api")) {
    req.url = "/api" + (req.url.startsWith("/") ? req.url : `/${req.url}`);
  }
  // An Express app is itself a (req, res) request handler.
  return (app as unknown as (req: VercelRequest, res: VercelResponse) => void)(req, res);
}
