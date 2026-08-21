import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { authenticate, requireRole } from "../auth.js";
import { HttpError, audit, newId } from "../util.js";
import { asyncHandler, parseBody } from "./helpers.js";

export const meetingsRouter = Router();
meetingsRouter.use(authenticate);

meetingsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { department } = req.query as Record<string, string>;
    const rows = department
      ? db
          .prepare(
            `SELECT mt.*, d.name AS department_name FROM meetings mt
             LEFT JOIN departments d ON d.id = mt.department_id
             WHERE mt.department_id = ? ORDER BY mt.scheduled_at DESC`,
          )
          .all(department)
      : db
          .prepare(
            `SELECT mt.*, d.name AS department_name FROM meetings mt
             LEFT JOIN departments d ON d.id = mt.department_id
             ORDER BY mt.scheduled_at DESC`,
          )
          .all();
    res.json(rows);
  }),
);

meetingsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const meeting = db.prepare("SELECT * FROM meetings WHERE id = ?").get(req.params.id);
    if (!meeting) throw new HttpError(404, "Meeting not found");
    const attendees = db
      .prepare(
        `SELECT ma.status, m.id, m.first_name, m.last_name FROM meeting_attendees ma
         JOIN members m ON m.id = ma.member_id WHERE ma.meeting_id = ?`,
      )
      .all(req.params.id);
    res.json({ ...(meeting as object), attendees });
  }),
);

const meetingSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  departmentId: z.string().optional().nullable(),
  scheduledAt: z.string().min(1),
  durationMins: z.number().optional().nullable(),
  location: z.string().optional().nullable(),
  link: z.string().optional().nullable(),
});

meetingsRouter.post(
  "/",
  requireRole("worker"),
  asyncHandler(async (req, res) => {
    const input = parseBody(meetingSchema, req.body);
    const id = newId("mtg");
    db.prepare(
      `INSERT INTO meetings (id, title, description, department_id, scheduled_at, duration_mins, location, link, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      input.title,
      input.description ?? null,
      input.departmentId || null,
      input.scheduledAt,
      input.durationMins ?? 60,
      input.location ?? null,
      input.link ?? null,
      req.user!.id,
    );
    audit("create", "meeting", id, req.user);
    res.status(201).json(db.prepare("SELECT * FROM meetings WHERE id = ?").get(id));
  }),
);

const rsvpSchema = z.object({ status: z.enum(["attending", "attended", "absent", "invited"]) });
meetingsRouter.post(
  "/:id/rsvp",
  asyncHandler(async (req, res) => {
    const input = parseBody(rsvpSchema, req.body);
    const existing = db
      .prepare("SELECT id FROM meeting_attendees WHERE meeting_id = ? AND member_id = ?")
      .get(req.params.id, req.user!.id);
    if (existing) {
      db.prepare("UPDATE meeting_attendees SET status = ? WHERE id = ?").run(
        input.status,
        (existing as { id: string }).id,
      );
    } else {
      db.prepare(
        "INSERT INTO meeting_attendees (id, meeting_id, member_id, status) VALUES (?, ?, ?, ?)",
      ).run(newId("att"), req.params.id, req.user!.id, input.status);
    }
    res.json({ ok: true });
  }),
);

meetingsRouter.delete(
  "/:id",
  requireRole("worker"),
  asyncHandler(async (req, res) => {
    db.prepare("DELETE FROM meetings WHERE id = ?").run(req.params.id);
    res.status(204).end();
  }),
);
