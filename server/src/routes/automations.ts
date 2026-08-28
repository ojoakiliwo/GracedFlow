import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { authenticate, requireRole } from "../auth.js";
import { HttpError } from "../util.js";
import { asyncHandler, parseBody } from "./helpers.js";
import {
  runCelebrations,
  runPrayerReminder,
  runSundayReminder,
} from "../scheduler.js";

export const automationsRouter = Router();
automationsRouter.use(authenticate);

automationsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const runs = await db.prepare("SELECT * FROM automation_runs ORDER BY created_at DESC LIMIT 50")
      .all();
    res.json({
      schedules: [
        {
          job: "sunday_reminder",
          label: "Sunday Service Reminder",
          cadence: "Every Saturday, 6:00 PM",
          description: "Reminds every active member about Sunday service.",
        },
        {
          job: "prayer_reminder",
          label: "Wednesday Prayer Reminder",
          cadence: "Every Wednesday, 6:00 AM",
          description: "Reminds every active member about the prayer meeting.",
        },
        {
          job: "celebrations",
          label: "Birthday & Anniversary Greetings",
          cadence: "Daily, 7:00 AM",
          description: "Sends private greetings to members celebrating that day.",
        },
      ],
      runs,
    });
  }),
);

const triggerSchema = z.object({
  job: z.enum(["sunday_reminder", "prayer_reminder", "celebrations"]),
  date: z.string().optional(),
});

// Manual trigger (for testing / ad-hoc broadcasts).
automationsRouter.post(
  "/run",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const { job, date } = parseBody(triggerSchema, req.body);
    if (job === "sunday_reminder") return void res.json(await runSundayReminder());
    if (job === "prayer_reminder") return void res.json(await runPrayerReminder());
    if (job === "celebrations") return void res.json(await runCelebrations(date));
    throw new HttpError(400, "Unknown job");
  }),
);
