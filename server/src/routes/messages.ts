import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { authenticate, requireRole } from "../auth.js";
import { HttpError } from "../util.js";
import { asyncHandler, parseBody } from "./helpers.js";
import {
  createAndSendMessage,
  resolveAudience,
  type AudienceType,
} from "../messaging.js";

export const messagesRouter = Router();
messagesRouter.use(authenticate);
messagesRouter.use(requireRole("pastor"));

messagesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const rows = await db.prepare(
        `SELECT m.*,
          (SELECT COUNT(*) FROM message_recipients r WHERE r.message_id = m.id AND r.status = 'sent') AS delivered,
          (SELECT COUNT(*) FROM message_recipients r WHERE r.message_id = m.id AND r.status = 'failed') AS failed
         FROM messages m ORDER BY m.created_at DESC LIMIT 100`,
      )
      .all();
    res.json(rows);
  }),
);

messagesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const message = await db.prepare("SELECT * FROM messages WHERE id = ?").get(req.params.id);
    if (!message) throw new HttpError(404, "Message not found");
    const recipients = await db.prepare(
        "SELECT * FROM message_recipients WHERE message_id = ? ORDER BY created_at",
      )
      .all(req.params.id);
    res.json({ ...(message as object), recipients });
  }),
);

const audienceSchema = z.object({
  audienceType: z.enum(["all", "class", "department", "role", "individual", "custom"]),
  audienceValue: z.string().optional().nullable(),
});

// Preview how many members a given audience resolves to.
messagesRouter.post(
  "/preview",
  asyncHandler(async (req, res) => {
    const input = parseBody(audienceSchema, req.body);
    const members = await resolveAudience(
      input.audienceType as AudienceType,
      input.audienceValue,
    );
    res.json({
      count: members.length,
      withPhone: members.filter((m) => m.phone).length,
      withEmail: members.filter((m) => m.email).length,
      sample: members.slice(0, 5).map((m) => `${m.first_name} ${m.last_name}`),
    });
  }),
);

const sendSchema = audienceSchema.extend({
  channel: z.enum(["sms", "email", "both"]),
  subject: z.string().optional().nullable(),
  body: z.string().min(1),
});

messagesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = parseBody(sendSchema, req.body);
    const summary = await createAndSendMessage({
      channel: input.channel,
      subject: input.subject,
      body: input.body,
      audienceType: input.audienceType as AudienceType,
      audienceValue: input.audienceValue,
      createdBy: req.user!.id,
    });
    res.status(201).json(summary);
  }),
);
