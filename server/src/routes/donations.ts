import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { authenticate, requireRole } from "../auth.js";
import { HttpError, audit, newId, nowIso } from "../util.js";
import { asyncHandler, parseBody } from "./helpers.js";
import { normalizeGivingCurrency } from "../currencies.js";

export const donationsRouter = Router();
donationsRouter.use(authenticate);

donationsRouter.get(
  "/",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const { status, type } = req.query as Record<string, string>;
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (status) {
      clauses.push("d.status = ?");
      params.push(status);
    }
    if (type) {
      clauses.push("d.type = ?");
      params.push(type);
    }
    const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
    const rows = await db.prepare(
        `SELECT d.*, m.first_name AS member_first, m.last_name AS member_last, p.title AS project_title
         FROM donations d
         LEFT JOIN members m ON m.id = d.member_id
         LEFT JOIN projects p ON p.id = d.project_id
         ${where} ORDER BY d.created_at DESC LIMIT 200`,
      )
      .all(...params);

    const totals = await db.prepare(
        `SELECT type, currency, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total
         FROM donations WHERE status = 'confirmed' GROUP BY type, currency`,
      )
      .all();
    res.json({ donations: rows, totals });
  }),
);

const recordSchema = z.object({
  memberId: z.string().optional().nullable(),
  donorName: z.string().optional().nullable(),
  donorEmail: z.string().optional().nullable(),
  donorPhone: z.string().optional().nullable(),
  type: z.string().default("offering"),
  amount: z.number().positive(),
  currency: z.string().default("NGN"),
  method: z.string().default("cash"),
  projectId: z.string().optional().nullable(),
  reference: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  status: z.enum(["pending", "confirmed"]).default("confirmed"),
});

donationsRouter.post(
  "/",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const input = parseBody(recordSchema, req.body);
    const currency = normalizeGivingCurrency(input.currency);
    const id = newId("don");
    await db.prepare(
      `INSERT INTO donations (id, member_id, donor_name, donor_email, donor_phone, type, amount, currency, method, project_id, reference, status, note, recorded_by, confirmed_at)
       VALUES (@id, @memberId, @donorName, @donorEmail, @donorPhone, @type, @amount, @currency, @method, @projectId, @reference, @status, @note, @recordedBy, @confirmedAt)`,
    ).run({
      id,
      memberId: input.memberId || null,
      donorName: input.donorName ?? null,
      donorEmail: input.donorEmail ?? null,
      donorPhone: input.donorPhone ?? null,
      type: input.type,
      amount: input.amount,
      currency,
      method: input.method,
      projectId: input.projectId || null,
      reference: input.reference ?? null,
      status: input.status,
      note: input.note ?? null,
      recordedBy: req.user!.id,
      confirmedAt: input.status === "confirmed" ? nowIso() : null,
    });
    audit("record", "donation", id, req.user, { amount: input.amount, type: input.type });
    res.status(201).json(await db.prepare("SELECT * FROM donations WHERE id = ?").get(id));
  }),
);

donationsRouter.post(
  "/:id/confirm",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const existing = await db.prepare("SELECT id FROM donations WHERE id = ?").get(req.params.id);
    if (!existing) throw new HttpError(404, "Donation not found");
    await db.prepare(
      "UPDATE donations SET status = 'confirmed', confirmed_at = ? WHERE id = ?",
    ).run(nowIso(), req.params.id);
    audit("confirm", "donation", req.params.id, req.user);
    res.json(await db.prepare("SELECT * FROM donations WHERE id = ?").get(req.params.id));
  }),
);
