import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import { config } from "./config.js";
import { ensureReady } from "./bootstrap.js";
import { ensureDemoDataRemoved } from "./seed.js";
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
import { settingsRouter } from "./routes/settings.js";
import { webhooksRouter } from "./routes/webhooks.js";
import { cronRouter } from "./routes/cron.js";

export function createApp() {
  const app = express();
  app.use(cors());

  // Any Vercel/Express entry (default export or api handler) must init schema
  // before routes run — not only the Node `listen()` boot path.
  app.use((_req, _res, next) => {
    ensureReady()
      .then(() => next())
      .catch(next);
  });

  // Webhooks need the raw body for signature verification, so mount before json.
  app.use("/api/webhooks", webhooksRouter);

  app.use(express.json({ limit: "2mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "gracedflow-api",
      church: config.church.name,
      time: new Date().toISOString(),
    });
  });

  // Opening the site (or any API route) strips leftover sample-church rows so
  // production never keeps Choir Rehearsal / fake members after a deploy.
  app.use((req, _res, next) => {
    if (req.path === "/api/health" || req.path.startsWith("/api/webhooks")) {
      next();
      return;
    }
    ensureDemoDataRemoved()
      .then(() => next())
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error("[prepare] demo purge failed", err);
        next();
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
  app.use("/api/settings", settingsRouter);
  app.use("/api/cron", cronRouter);

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

const app = createApp();
export default app;
