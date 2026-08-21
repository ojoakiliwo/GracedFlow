import { createApp } from "./app.js";
import { config } from "./config.js";
import { initSchema } from "./db.js";
import { ensureSeed } from "./seed.js";
import { registerSchedules } from "./scheduler.js";

initSchema();
ensureSeed();
registerSchedules();

const app = createApp();
app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(
    `${config.church.name} API listening on http://localhost:${config.port}`,
  );
});
