import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import {
  authenticate,
  hashPassword,
  signToken,
  verifyPassword,
  type AuthUser,
} from "../auth.js";
import { HttpError, audit, newId, nowIso } from "../util.js";
import { asyncHandler, parseBody } from "./helpers.js";
import { configuredAdminEmail, getLedDepartments } from "../access.js";
import { DEMO_MEMBER_EMAILS } from "../seed.js";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = parseBody(loginSchema, req.body);
    const row = await db.prepare("SELECT * FROM members WHERE email = ?")
      .get(email.toLowerCase()) as
      | { id: string; email: string; role: string; first_name: string; last_name: string; password_hash: string | null; account_status: string }
      | undefined;
    if (!row || !row.password_hash) {
      throw new HttpError(401, "Invalid email or password");
    }
    if (row.account_status !== "active") {
      throw new HttpError(403, "Your account is not active. Contact an administrator.");
    }
    const ok = await verifyPassword(password, row.password_hash);
    if (!ok) throw new HttpError(401, "Invalid email or password");

    await db.prepare("UPDATE members SET last_login_at = ? WHERE id = ?").run(nowIso(), row.id);
    const user: AuthUser = {
      id: row.id,
      email: row.email,
      role: row.role,
      first_name: row.first_name,
      last_name: row.last_name,
    };
    audit("login", "member", row.id, user);
    res.json({ token: signToken(user), user });
  }),
);

const registerSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(6),
});

// Self-service signup. The configured ADMIN_EMAIL (and the first real account)
// become super_admin; everyone else starts as a worker.
authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const input = parseBody(registerSchema, req.body);
    const email = input.email.toLowerCase();
    const existing = await db.prepare("SELECT id FROM members WHERE email = ?")
      .get(email);
    if (existing) throw new HttpError(409, "An account with this email already exists");

    const configuredAdmin = configuredAdminEmail();
    const demoPh = DEMO_MEMBER_EMAILS.map(() => "?").join(", ");
    const admins = (await db
      .prepare(
        `SELECT COUNT(*)::int AS c FROM members
         WHERE role IN ('admin', 'super_admin')
           AND (email IS NULL OR lower(email) NOT IN (${demoPh}))`,
      )
      .get(...DEMO_MEMBER_EMAILS)) as { c: number };
    const isConfiguredAdmin = !!configuredAdmin && email === configuredAdmin;
    const isFirstAdmin = admins.c === 0 || isConfiguredAdmin;
    const role = isFirstAdmin ? "super_admin" : "worker";
    const spiritualClass = isFirstAdmin ? "leader" : "worker";
    const membershipStatus = isFirstAdmin ? "active" : "new";

    const id = newId("mbr");
    await db.prepare(
      `INSERT INTO members (id, first_name, last_name, email, phone, password_hash, role, spiritual_class, membership_status, account_status, join_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
    ).run(
      id,
      input.firstName,
      input.lastName,
      email,
      input.phone ?? null,
      await hashPassword(input.password),
      role,
      spiritualClass,
      membershipStatus,
      nowIso().slice(0, 10),
    );
    const user: AuthUser = {
      id,
      email: email,
      role,
      first_name: input.firstName,
      last_name: input.lastName,
    };
    audit("register", "member", id, user);
    res.status(201).json({ token: signToken(user), user });
  }),
);

authRouter.get(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    const row = await db.prepare(
        "SELECT id, first_name, last_name, email, phone, role, spiritual_class, photo_url, last_login_at FROM members WHERE id = ?",
      )
      .get(req.user!.id);
    const ledDepartments = await getLedDepartments(req.user!.id);
    res.json({ ...(row as object), ledDepartments });
  }),
);
