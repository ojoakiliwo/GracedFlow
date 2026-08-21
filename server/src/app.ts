import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { NotFoundError, TaskStore, ValidationError } from "./tasks.js";

export function createApp(store: TaskStore = new TaskStore()) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "gracedflow-server", time: new Date().toISOString() });
  });

  app.get("/api/tasks", (_req, res) => {
    res.json(store.list());
  });

  app.post("/api/tasks", (req, res) => {
    const task = store.create({ title: req.body?.title, status: req.body?.status });
    res.status(201).json(task);
  });

  app.patch("/api/tasks/:id", (req, res) => {
    const task = store.update(req.params.id, req.body?.status);
    res.json(task);
  });

  app.delete("/api/tasks/:id", (req, res) => {
    store.remove(req.params.id);
    res.status(204).end();
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ValidationError) {
      return res.status(400).json({ error: err.message });
    }
    if (err instanceof NotFoundError) {
      return res.status(404).json({ error: err.message });
    }
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ error: "internal server error" });
  });

  return app;
}
