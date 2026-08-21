import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { authenticate, requireRole } from "../auth.js";
import { HttpError, audit, newId, nowIso } from "../util.js";
import { asyncHandler, parseBody } from "./helpers.js";

export const tasksRouter = Router();
tasksRouter.use(authenticate);

tasksRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { department, assignedTo, status, mine } = req.query as Record<string, string>;
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (department) {
      clauses.push("t.department_id = ?");
      params.push(department);
    }
    if (assignedTo) {
      clauses.push("t.assigned_to = ?");
      params.push(assignedTo);
    }
    if (mine === "true") {
      clauses.push("t.assigned_to = ?");
      params.push(req.user!.id);
    }
    if (status) {
      clauses.push("t.status = ?");
      params.push(status);
    }
    const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
    const rows = await db.prepare(
        `SELECT t.*, d.name AS department_name,
          m.first_name AS assignee_first, m.last_name AS assignee_last
         FROM tasks t
         LEFT JOIN departments d ON d.id = t.department_id
         LEFT JOIN members m ON m.id = t.assigned_to
         ${where} ORDER BY
           CASE t.status WHEN 'todo' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
           t.due_date IS NULL, t.due_date ASC`,
      )
      .all(...params);
    res.json(rows);
  }),
);

const taskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  departmentId: z.string().optional().nullable(),
  assignedTo: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  status: z.enum(["todo", "in_progress", "done"]).default("todo"),
});

tasksRouter.post(
  "/",
  requireRole("worker"),
  asyncHandler(async (req, res) => {
    const input = parseBody(taskSchema, req.body);
    const id = newId("tsk");
    await db.prepare(
      `INSERT INTO tasks (id, title, description, department_id, assigned_to, created_by, due_date, priority, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      input.title,
      input.description ?? null,
      input.departmentId || null,
      input.assignedTo || null,
      req.user!.id,
      input.dueDate || null,
      input.priority,
      input.status,
    );
    audit("create", "task", id, req.user);
    res.status(201).json(await db.prepare("SELECT * FROM tasks WHERE id = ?").get(id));
  }),
);

tasksRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const existing = await db.prepare("SELECT * FROM tasks WHERE id = ?").get(req.params.id);
    if (!existing) throw new HttpError(404, "Task not found");
    const input = parseBody(taskSchema.partial(), req.body);
    const map: Record<string, string> = {
      title: "title",
      description: "description",
      departmentId: "department_id",
      assignedTo: "assigned_to",
      dueDate: "due_date",
      priority: "priority",
      status: "status",
    };
    const sets: string[] = [];
    const params: Record<string, unknown> = { id: req.params.id };
    for (const [key, col] of Object.entries(map)) {
      if (key in input) {
        sets.push(`${col} = @${key}`);
        params[key] = (input as Record<string, unknown>)[key] ?? null;
      }
    }
    sets.push("updated_at = @updatedAt");
    params.updatedAt = nowIso();
    await db.prepare(`UPDATE tasks SET ${sets.join(", ")} WHERE id = @id`).run(params);
    res.json(await db.prepare("SELECT * FROM tasks WHERE id = ?").get(req.params.id));
  }),
);

tasksRouter.delete(
  "/:id",
  requireRole("worker"),
  asyncHandler(async (req, res) => {
    await db.prepare("DELETE FROM tasks WHERE id = ?").run(req.params.id);
    res.status(204).end();
  }),
);
