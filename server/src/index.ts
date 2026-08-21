import { createApp } from "./app.js";
import { TaskStore } from "./tasks.js";

const PORT = Number(process.env.PORT ?? 3001);

const store = new TaskStore();
// Seed a couple of tasks so the UI is not empty on first boot.
store.create({ title: "Welcome to GracedFlow", status: "done" });
store.create({ title: "Create your first task", status: "todo" });

const app = createApp(store);

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`GracedFlow API listening on http://localhost:${PORT}`);
});
