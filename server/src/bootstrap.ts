import { initSchema } from "./db.js";
import { ensureSeed } from "./seed.js";

let readyPromise: Promise<void> | null = null;

/**
 * Idempotently ensures the schema exists (and demo data is seeded when empty).
 * Cached so it runs once per process — used on serverless cold starts and by
 * the long-running server entry point.
 */
export function ensureReady(): Promise<void> {
  if (!readyPromise) {
    readyPromise = (async () => {
      await initSchema();
      await ensureSeed();
    })();
  }
  return readyPromise;
}
