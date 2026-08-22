import app from "./app.js";
import { config } from "./config.js";
import { ensureReady } from "./bootstrap.js";
import { registerSchedules } from "./scheduler.js";

export default app;

async function main() {
  await ensureReady();
  registerSchedules();

  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(
      `${config.church.name} API listening on http://localhost:${config.port}`,
    );
  });
}

// Do not listen (or exit) when Vercel imports this file as a serverless function.
if (!process.env.VERCEL) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Failed to start server", err);
    process.exit(1);
  });
}
