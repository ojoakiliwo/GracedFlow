import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { authenticate, requireRole } from "../auth.js";
import { HttpError, audit, newId, nowIso } from "../util.js";
import { asyncHandler, parseBody } from "./helpers.js";

export const projectsRouter = Router();
projectsRouter.use(authenticate);

projectsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { status } = req.query as Record<string, string>;
    const rows = status
      ? await db.prepare(
            `SELECT p.*, m.first_name AS lead_first, m.last_name AS lead_last
             FROM projects p LEFT JOIN members m ON m.id = p.lead_id
             WHERE p.status = ? ORDER BY p.updated_at DESC`,
          )
          .all(status)
      : await db.prepare(
            `SELECT p.*, m.first_name AS lead_first, m.last_name AS lead_last
             FROM projects p LEFT JOIN members m ON m.id = p.lead_id
             ORDER BY p.updated_at DESC`,
          )
          .all();
    res.json(rows);
  }),
);

const projectSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  status: z.enum(["vision", "ongoing", "done"]).default("vision"),
  visibility: z.enum(["public", "private"]).default("private"),
  progress: z.number().min(0).max(100).default(0),
  budget: z.number().optional().nullable(),
  amountRaised: z.number().optional().nullable(),
  leadId: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  targetDate: z.string().optional().nullable(),
  completedDate: z.string().optional().nullable(),
});

projectsRouter.post(
  "/",
  requireRole("pastor"),
  asyncHandler(async (req, res) => {
    const input = parseBody(projectSchema, req.body);
    const id = newId("prj");
    await db.prepare(
      `INSERT INTO projects (id, title, description, category, status, visibility, progress, budget, amount_raised, lead_id, start_date, target_date, completed_date)
       VALUES (@id, @title, @description, @category, @status, @visibility, @progress, @budget, @amountRaised, @leadId, @startDate, @targetDate, @completedDate)`,
    ).run({
      id,
      title: input.title,
      description: input.description ?? null,
      category: input.category ?? null,
      status: input.status,
      visibility: input.visibility,
      progress: input.progress,
      budget: input.budget ?? null,
      amountRaised: input.amountRaised ?? 0,
      leadId: input.leadId || null,
      startDate: input.startDate || null,
      targetDate: input.targetDate || null,
      completedDate: input.completedDate || null,
    });
    audit("create", "project", id, req.user);
    res.status(201).json(await db.prepare("SELECT * FROM projects WHERE id = ?").get(id));
  }),
);

projectsRouter.put(
  "/:id",
  requireRole("pastor"),
  asyncHandler(async (req, res) => {
    const existing = await db.prepare("SELECT id FROM projects WHERE id = ?").get(req.params.id);
    if (!existing) throw new HttpError(404, "Project not found");
    const input = parseBody(projectSchema.partial(), req.body);
    const map: Record<string, string> = {
      title: "title",
      description: "description",
      category: "category",
      status: "status",
      visibility: "visibility",
      progress: "progress",
      budget: "budget",
      amountRaised: "amount_raised",
      leadId: "lead_id",
      startDate: "start_date",
      targetDate: "target_date",
      completedDate: "completed_date",
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
    await db.prepare(`UPDATE projects SET ${sets.join(", ")} WHERE id = @id`).run(params);
    audit("update", "project", req.params.id, req.user);
    res.json(await db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id));
  }),
);

projectsRouter.delete(
  "/:id",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    await db.prepare("DELETE FROM projects WHERE id = ?").run(req.params.id);
    audit("delete", "project", req.params.id, req.user);
    res.status(204).end();
  }),
);
