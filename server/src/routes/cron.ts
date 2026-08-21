import { Router } from "express";
import type { Request } from "express";
import { config } from "../config.js";
import {
  runCelebrations,
  runPrayerReminder,
  runSundayReminder,
} from "../scheduler.js";
import { HttpError } from "../util.js";
import { asyncHandler } from "./helpers.js";

export const cronRouter = Router();

// Vercel Cron (and any external scheduler) authenticates with
// `Authorization: Bearer <CRON_SECRET>`.
function assertCron(req: Request): void {
  if (!config.cronSecret) {
    throw new HttpError(500, "CRON_SECRET is not configured");
  }
  const header = req.headers.authorization;
  if (header !== `Bearer ${config.cronSecret}`) {
    throw new HttpError(401, "Unauthorized cron request");
  }
}

const runners: Record<string, () => Promise<unknown>> = {
  sunday_reminder: runSundayReminder,
  prayer_reminder: runPrayerReminder,
  celebrations: () => runCelebrations(),
};

const handler = asyncHandler(async (req, res) => {
  assertCron(req);
  const runner = runners[req.params.job];
  if (!runner) throw new HttpError(404, "Unknown cron job");
  const result = await runner();
  res.json({ ok: true, job: req.params.job, result });
});

// Support both GET (Vercel Cron uses GET) and POST.
cronRouter.get("/:job", handler);
cronRouter.post("/:job", handler);
