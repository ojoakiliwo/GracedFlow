import { initSchema } from "./db.js";
import { prepareAppData } from "./seed.js";

let readyPromise: Promise<void> | null = null;

/**
 * Ensures the schema exists, strips leftover demo fixtures, and creates the
 * real admin when ADMIN_EMAIL / ADMIN_PASSWORD are set.
 */
export function ensureReady(): Promise<void> {
  if (!readyPromise) {
    readyPromise = (async () => {
      await initSchema();
      await prepareAppData();
    })().catch((err) => {
      readyPromise = null;
      throw err;
    });
  }
  return readyPromise;
}
