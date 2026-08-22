import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { authenticate, requireRole } from "../auth.js";
import { audit, newId } from "../util.js";
import { asyncHandler, parseBody } from "./helpers.js";

export const eventsRouter = Router();
eventsRouter.use(authenticate);

eventsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json(await db.prepare("SELECT * FROM events ORDER BY starts_at DESC").all());
  }),
);

const eventSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  type: z.string().default("service"),
  startsAt: z.string().min(1),
  endsAt: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  isPublic: z.boolean().default(true),
  recurrence: z.string().default("none"),
});

eventsRouter.post(
  "/",
  requireRole("pastor"),
  asyncHandler(async (req, res) => {
    const input = parseBody(eventSchema, req.body);
    const id = newId("evt");
    await db.prepare(
      `INSERT INTO events (id, title, description, type, starts_at, ends_at, location, is_public, recurrence)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      input.title,
      input.description ?? null,
      input.type,
      input.startsAt,
      input.endsAt ?? null,
      input.location ?? null,
      input.isPublic ? 1 : 0,
      input.recurrence,
    );
    audit("create", "event", id, req.user);
    res.status(201).json(await db.prepare("SELECT * FROM events WHERE id = ?").get(id));
  }),
);

eventsRouter.delete(
  "/:id",
  requireRole("pastor"),
  asyncHandler(async (req, res) => {
    await db.prepare("DELETE FROM events WHERE id = ?").run(req.params.id);
    res.status(204).end();
  }),
);
