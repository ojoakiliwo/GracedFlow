import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { authenticate, requireRole } from "../auth.js";
import { assertCanManageDepartment, isShepherd } from "../access.js";
import { HttpError, audit, newId } from "../util.js";
import { asyncHandler, parseBody } from "./helpers.js";

export const meetingsRouter = Router();
meetingsRouter.use(authenticate);

meetingsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { department } = req.query as Record<string, string>;
    const rows = department
      ? await db.prepare(
            `SELECT mt.*, d.name AS department_name FROM meetings mt
             LEFT JOIN departments d ON d.id = mt.department_id
             WHERE mt.department_id = ? ORDER BY mt.scheduled_at DESC`,
          )
          .all(department)
      : await db.prepare(
            `SELECT mt.*, d.name AS department_name FROM meetings mt
             LEFT JOIN departments d ON d.id = mt.department_id
             ORDER BY mt.scheduled_at DESC`,
          )
          .all();
    res.json(rows);
  }),
);

meetingsRouter.get(
  "/reviews",
  requireRole("pastor"),
  asyncHandler(async (_req, res) => {
    const rows = await db.prepare(
        `SELECT r.*, mt.title AS meeting_title, mt.scheduled_at, d.name AS department_name,
                m.first_name AS author_first, m.last_name AS author_last
         FROM meeting_reviews r
         JOIN meetings mt ON mt.id = r.meeting_id
         LEFT JOIN departments d ON d.id = r.department_id
         LEFT JOIN members m ON m.id = r.author_id
         ORDER BY r.created_at DESC LIMIT 100`,
      )
      .all();
    res.json(rows);
  }),
);

meetingsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const meeting = (await db
      .prepare(
        `SELECT mt.*, d.name AS department_name FROM meetings mt
         LEFT JOIN departments d ON d.id = mt.department_id WHERE mt.id = ?`,
      )
      .get(req.params.id)) as { id: string; department_id: string | null } | undefined;
    if (!meeting) throw new HttpError(404, "Meeting not found");
    const attendees = await db.prepare(
        `SELECT ma.status, m.id, m.first_name, m.last_name FROM meeting_attendees ma
         JOIN members m ON m.id = ma.member_id WHERE ma.meeting_id = ?`,
      )
      .all(req.params.id);
    const reviews = isShepherd(req.user!.role)
      ? await db.prepare(
            `SELECT r.*, m.first_name AS author_first, m.last_name AS author_last
             FROM meeting_reviews r
             LEFT JOIN members m ON m.id = r.author_id
             WHERE r.meeting_id = ? ORDER BY r.created_at DESC`,
          )
          .all(req.params.id)
      : [];
    res.json({ ...meeting, attendees, reviews });
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
  asyncHandler(async (req, res) => {
    const input = parseBody(meetingSchema, req.body);
    await assertCanManageDepartment(req.user!, input.departmentId || null);
    const id = newId("mtg");
    await db.prepare(
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
    res.status(201).json(await db.prepare("SELECT * FROM meetings WHERE id = ?").get(id));
  }),
);

const rsvpSchema = z.object({ status: z.enum(["attending", "attended", "absent", "invited"]) });
meetingsRouter.post(
  "/:id/rsvp",
  asyncHandler(async (req, res) => {
    const input = parseBody(rsvpSchema, req.body);
    const existing = await db.prepare("SELECT id FROM meeting_attendees WHERE meeting_id = ? AND member_id = ?")
      .get(req.params.id, req.user!.id);
    if (existing) {
      await db.prepare("UPDATE meeting_attendees SET status = ? WHERE id = ?").run(
        input.status,
        (existing as { id: string }).id,
      );
    } else {
      await db.prepare(
        "INSERT INTO meeting_attendees (id, meeting_id, member_id, status) VALUES (?, ?, ?, ?)",
      ).run(newId("att"), req.params.id, req.user!.id, input.status);
    }
    res.json({ ok: true });
  }),
);

const attendanceSchema = z.object({
  memberId: z.string().min(1),
  status: z.enum(["attending", "attended", "absent", "invited"]),
});
meetingsRouter.post(
  "/:id/attendance",
  asyncHandler(async (req, res) => {
    const meeting = (await db.prepare("SELECT department_id FROM meetings WHERE id = ?").get(req.params.id)) as
      | { department_id: string | null }
      | undefined;
    if (!meeting) throw new HttpError(404, "Meeting not found");
    await assertCanManageDepartment(req.user!, meeting.department_id);
    const input = parseBody(attendanceSchema, req.body);
    const existing = await db.prepare("SELECT id FROM meeting_attendees WHERE meeting_id = ? AND member_id = ?")
      .get(req.params.id, input.memberId);
    if (existing) {
      await db.prepare("UPDATE meeting_attendees SET status = ? WHERE id = ?").run(
        input.status,
        (existing as { id: string }).id,
      );
    } else {
      await db.prepare(
        "INSERT INTO meeting_attendees (id, meeting_id, member_id, status) VALUES (?, ?, ?, ?)",
      ).run(newId("att"), req.params.id, input.memberId, input.status);
    }
    res.json({ ok: true });
  }),
);

const reviewSchema = z.object({
  review: z.string().min(3),
  attendancePresent: z.number().int().min(0).optional(),
  attendanceAbsent: z.number().int().min(0).optional(),
});
meetingsRouter.post(
  "/:id/reviews",
  asyncHandler(async (req, res) => {
    const meeting = (await db.prepare("SELECT id, department_id FROM meetings WHERE id = ?").get(req.params.id)) as
      | { id: string; department_id: string | null }
      | undefined;
    if (!meeting) throw new HttpError(404, "Meeting not found");
    await assertCanManageDepartment(req.user!, meeting.department_id);
    const input = parseBody(reviewSchema, req.body);
    const id = newId("rev");
    await db.prepare(
      `INSERT INTO meeting_reviews (id, meeting_id, department_id, author_id, attendance_present, attendance_absent, review)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      meeting.id,
      meeting.department_id,
      req.user!.id,
      input.attendancePresent ?? 0,
      input.attendanceAbsent ?? 0,
      input.review,
    );
    audit("create", "meeting_review", id, req.user);
    res.status(201).json(await db.prepare("SELECT * FROM meeting_reviews WHERE id = ?").get(id));
  }),
);

meetingsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const meeting = (await db.prepare("SELECT department_id FROM meetings WHERE id = ?").get(req.params.id)) as
      | { department_id: string | null }
      | undefined;
    if (!meeting) throw new HttpError(404, "Meeting not found");
    await assertCanManageDepartment(req.user!, meeting.department_id);
    await db.prepare("DELETE FROM meetings WHERE id = ?").run(req.params.id);
    res.status(204).end();
  }),
);
