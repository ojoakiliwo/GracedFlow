import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { config } from "../config.js";
import { newId, nowIso } from "../util.js";
import { asyncHandler, parseBody } from "./helpers.js";
import { createPrayerRequest } from "./prayer.js";

export const publicRouter = Router();

// Church profile + service info for the public site.
publicRouter.get(
  "/info",
  asyncHandler(async (_req, res) => {
    res.json({
      church: config.church,
      giving: {
        bankName: config.giving.bankName,
        accountName: config.giving.accountName,
        accountNumber: config.giving.accountNumber,
        onlineUrl: config.giving.onlineUrl,
      },
      services: [
        { name: "Sunday Service", time: "Sundays, 9:00 AM" },
        { name: "Wednesday Prayer Meeting", time: "Wednesdays, 5:30 PM" },
      ],
    });
  }),
);

publicRouter.get(
  "/events",
  asyncHandler(async (_req, res) => {
    res.json(
      db
        .prepare(
          "SELECT id, title, description, type, starts_at, ends_at, location FROM events WHERE is_public = 1 ORDER BY starts_at ASC",
        )
        .all(),
    );
  }),
);

publicRouter.get(
  "/projects",
  asyncHandler(async (_req, res) => {
    res.json(
      db
        .prepare(
          "SELECT id, title, description, category, status, progress FROM projects WHERE visibility = 'public' ORDER BY updated_at DESC",
        )
        .all(),
    );
  }),
);

const prayerSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  request: z.string().min(3),
  isPublic: z.boolean().optional(),
});

publicRouter.post(
  "/prayer-requests",
  asyncHandler(async (req, res) => {
    const input = parseBody(prayerSchema, req.body);
    const id = createPrayerRequest({
      name: input.name,
      email: input.email || undefined,
      phone: input.phone,
      request: input.request,
      isPublic: input.isPublic,
    });
    res.status(201).json({ id, message: "Your prayer request has been received." });
  }),
);

// Public giving intent — records a pending donation an admin later confirms.
const giveSchema = z.object({
  donorName: z.string().optional(),
  donorEmail: z.string().email().optional().or(z.literal("")),
  donorPhone: z.string().optional(),
  type: z.string().default("offering"),
  amount: z.number().positive(),
  method: z.string().default("online"),
  note: z.string().optional(),
});

publicRouter.post(
  "/give",
  asyncHandler(async (req, res) => {
    const input = parseBody(giveSchema, req.body);
    const id = newId("don");
    const reference = `IGC-${Date.now().toString(36).toUpperCase()}`;
    db.prepare(
      `INSERT INTO donations (id, donor_name, donor_email, donor_phone, type, amount, method, reference, status, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
    ).run(
      id,
      input.donorName ?? null,
      input.donorEmail || null,
      input.donorPhone ?? null,
      input.type,
      input.amount,
      input.method,
      reference,
      input.note ?? null,
      nowIso(),
    );
    res.status(201).json({
      id,
      reference,
      giving: config.giving,
      message:
        "Thank you for your generosity! Use the reference and account details to complete your gift.",
    });
  }),
);
