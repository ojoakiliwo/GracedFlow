import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { authenticate, requireRole } from "../auth.js";
import { assertCanManageDepartment, isChurchManager, isLeaderPosition } from "../access.js";
import { HttpError, audit, newId } from "../util.js";
import { asyncHandler, parseBody } from "./helpers.js";

export const departmentsRouter = Router();
departmentsRouter.use(authenticate);

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

departmentsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const rows = await db.prepare(
        `SELECT d.*,
            (SELECT COUNT(*) FROM department_members dm WHERE dm.department_id = d.id) AS member_count,
            (SELECT m.first_name || ' ' || m.last_name FROM department_members dm
              JOIN members m ON m.id = dm.member_id
              WHERE dm.department_id = d.id
                AND lower(dm.position) IN ('leader','hod','head','chairman')
              LIMIT 1) AS leader_name
         FROM departments d ORDER BY d.type DESC, d.name`,
      )
      .all();
    res.json(rows);
  }),
);

departmentsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const dept = await db.prepare("SELECT * FROM departments WHERE id = ?").get(req.params.id);
    if (!dept) throw new HttpError(404, "Department not found");
    const members = await db.prepare(
        `SELECT m.id, m.first_name, m.last_name, m.email, m.phone, m.role, dm.position
         FROM members m JOIN department_members dm ON dm.member_id = m.id
         WHERE dm.department_id = ? ORDER BY dm.position, m.first_name`,
      )
      .all(req.params.id);
    res.json({ ...(dept as object), members });
  }),
);

const deptSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  type: z.enum(["department", "general"]).default("department"),
});

departmentsRouter.post(
  "/",
  requireRole("pastor"),
  asyncHandler(async (req, res) => {
    const input = parseBody(deptSchema, req.body);
    const id = newId("dpt");
    await db.prepare(
      "INSERT INTO departments (id, name, slug, description, type) VALUES (?, ?, ?, ?, ?)",
    ).run(id, input.name, slugify(input.name), input.description ?? null, input.type);
    audit("create", "department", id, req.user);
    res.status(201).json(await db.prepare("SELECT * FROM departments WHERE id = ?").get(id));
  }),
);

const memberSchema = z.object({
  memberId: z.string().min(1),
  position: z.string().default("member"),
});

departmentsRouter.post(
  "/:id/members",
  asyncHandler(async (req, res) => {
    const input = parseBody(memberSchema, req.body);
    const makingLeader = isLeaderPosition(input.position);
    if (makingLeader && !isChurchManager(req.user!.role)) {
      throw new HttpError(403, "Only pastors and administrators can appoint a department leader");
    }
    await assertCanManageDepartment(req.user!, req.params.id);
    if (makingLeader) {
      await db
        .prepare(
          `UPDATE department_members SET position = 'member'
           WHERE department_id = ? AND lower(position) IN ('leader','hod','head','chairman')`,
        )
        .run(req.params.id);
    }
    const existing = await db.prepare("SELECT id FROM department_members WHERE department_id = ? AND member_id = ?")
      .get(req.params.id, input.memberId);
    if (existing) {
      await db.prepare("UPDATE department_members SET position = ? WHERE id = ?").run(
        input.position,
        (existing as { id: string }).id,
      );
    } else {
      await db.prepare(
        "INSERT INTO department_members (id, department_id, member_id, position) VALUES (?, ?, ?, ?)",
      ).run(newId("dmb"), req.params.id, input.memberId, input.position);
    }
    res.status(201).json({ ok: true });
  }),
);

departmentsRouter.delete(
  "/:id/members/:memberId",
  asyncHandler(async (req, res) => {
    await assertCanManageDepartment(req.user!, req.params.id);
    await db.prepare(
      "DELETE FROM department_members WHERE department_id = ? AND member_id = ?",
    ).run(req.params.id, req.params.memberId);
    res.status(204).end();
  }),
);

// Room chat / discussion board for each department
departmentsRouter.get(
  "/:id/room",
  asyncHandler(async (req, res) => {
    const rows = await db.prepare(
        `SELECT rm.*, m.first_name, m.last_name FROM room_messages rm
         LEFT JOIN members m ON m.id = rm.member_id
         WHERE rm.department_id = ? ORDER BY rm.created_at ASC LIMIT 200`,
      )
      .all(req.params.id);
    res.json(rows);
  }),
);

const roomMsgSchema = z.object({ body: z.string().min(1) });
departmentsRouter.post(
  "/:id/room",
  asyncHandler(async (req, res) => {
    const input = parseBody(roomMsgSchema, req.body);
    const id = newId("rmsg");
    await db.prepare(
      `INSERT INTO room_messages (id, department_id, member_id, author_name, body)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(
      id,
      req.params.id,
      req.user!.id,
      `${req.user!.first_name} ${req.user!.last_name}`,
      input.body,
    );
    res.status(201).json(await db.prepare("SELECT * FROM room_messages WHERE id = ?").get(id));
  }),
);
