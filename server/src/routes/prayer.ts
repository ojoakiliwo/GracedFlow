import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { authenticate, requireRole } from "../auth.js";
import { HttpError, newId } from "../util.js";
import { asyncHandler, parseBody } from "./helpers.js";

export const prayerRouter = Router();
prayerRouter.use(authenticate);

prayerRouter.get(
  "/",
  requireRole("pastor"),
  asyncHandler(async (_req, res) => {
    res.json(
      await db.prepare("SELECT * FROM prayer_requests ORDER BY created_at DESC LIMIT 200").all(),
    );
  }),
);

const statusSchema = z.object({ status: z.enum(["new", "praying", "answered"]) });
prayerRouter.put(
  "/:id",
  requireRole("pastor"),
  asyncHandler(async (req, res) => {
    const input = parseBody(statusSchema, req.body);
    const existing = await db
      .prepare("SELECT id FROM prayer_requests WHERE id = ?")
      .get(req.params.id);
    if (!existing) throw new HttpError(404, "Prayer request not found");
    await db.prepare("UPDATE prayer_requests SET status = ? WHERE id = ?").run(
      input.status,
      req.params.id,
    );
    res.json(await db.prepare("SELECT * FROM prayer_requests WHERE id = ?").get(req.params.id));
  }),
);

// Exposed as a helper for the public router.
export async function createPrayerRequest(input: {
  name?: string;
  email?: string;
  phone?: string;
  request: string;
  isPublic?: boolean;
}): Promise<string> {
  const id = newId("pray");
  await db.prepare(
    `INSERT INTO prayer_requests (id, name, email, phone, request, is_public)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.name ?? null,
    input.email ?? null,
    input.phone ?? null,
    input.request,
    input.isPublic ? 1 : 0,
  );
  return id;
}
