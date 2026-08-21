import { createApp } from "./app.js";
import { config } from "./config.js";
import { ensureReady } from "./bootstrap.js";
import { registerSchedules } from "./scheduler.js";

async function main() {
  await ensureReady();
  registerSchedules();

  const app = createApp();
  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(
      `${config.church.name} API listening on http://localhost:${config.port}`,
    );
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start server", err);
  process.exit(1);
});
