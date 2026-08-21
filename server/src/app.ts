import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import { config } from "./config.js";
import { HttpError } from "./util.js";
import { authRouter } from "./routes/auth.js";
import { membersRouter } from "./routes/members.js";
import { departmentsRouter } from "./routes/departments.js";
import { projectsRouter } from "./routes/projects.js";
import { meetingsRouter } from "./routes/meetings.js";
import { tasksRouter } from "./routes/tasks.js";
import { messagesRouter } from "./routes/messages.js";
import { automationsRouter } from "./routes/automations.js";
import { socialRouter } from "./routes/social.js";
import { donationsRouter } from "./routes/donations.js";
import { eventsRouter } from "./routes/events.js";
import { prayerRouter } from "./routes/prayer.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { publicRouter } from "./routes/public.js";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "2mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "gracedflow-api",
      church: config.church.name,
      time: new Date().toISOString(),
    });
  });

  app.use("/api/public", publicRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/members", membersRouter);
  app.use("/api/departments", departmentsRouter);
  app.use("/api/projects", projectsRouter);
  app.use("/api/meetings", meetingsRouter);
  app.use("/api/tasks", tasksRouter);
  app.use("/api/messages", messagesRouter);
  app.use("/api/automations", automationsRouter);
  app.use("/api/social", socialRouter);
  app.use("/api/donations", donationsRouter);
  app.use("/api/events", eventsRouter);
  app.use("/api/prayer-requests", prayerRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message });
    }
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
