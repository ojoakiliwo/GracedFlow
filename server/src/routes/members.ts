import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { authenticate, hashPassword, requireRole } from "../auth.js";
import { HttpError, audit, newId, nowIso } from "../util.js";
import { asyncHandler, parseBody } from "./helpers.js";

export const membersRouter = Router();
membersRouter.use(authenticate);

const memberSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  gender: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  phone: z.string().optional().nullable(),
  role: z.enum(["super_admin", "admin", "pastor", "worker", "member"]).default("member"),
  spiritualClass: z.string().default("new_convert"),
  membershipStatus: z.string().default("active"),
  dateOfBirth: z.string().optional().nullable(),
  weddingAnniversary: z.string().optional().nullable(),
  maritalStatus: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  occupation: z.string().optional().nullable(),
  joinDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  password: z.string().min(6).optional(),
});

membersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { q, spiritualClass, role, department, status } = req.query as Record<
      string,
      string
    >;
    const clauses: string[] = [];
    const params: unknown[] = [];
    let from = "SELECT DISTINCT m.* FROM members m";
    if (department) {
      from += " JOIN department_members dm ON dm.member_id = m.id";
      clauses.push("dm.department_id = ?");
      params.push(department);
    }
    if (q) {
      clauses.push(
        "(m.first_name LIKE ? OR m.last_name LIKE ? OR m.email LIKE ? OR m.phone LIKE ?)",
      );
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (spiritualClass) {
      clauses.push("m.spiritual_class = ?");
      params.push(spiritualClass);
    }
    if (role) {
      clauses.push("m.role = ?");
      params.push(role);
    }
    if (status) {
      clauses.push("m.membership_status = ?");
      params.push(status);
    }
    const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
    const rows = await db.prepare(`${from}${where} ORDER BY m.first_name, m.last_name`)
      .all(...params);
    res.json(rows);
  }),
);

membersRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const member = await db.prepare("SELECT * FROM members WHERE id = ?").get(req.params.id);
    if (!member) throw new HttpError(404, "Member not found");
    const growth = await db.prepare("SELECT * FROM growth_records WHERE member_id = ? ORDER BY date DESC, created_at DESC")
      .all(req.params.id);
    const support = await db.prepare("SELECT * FROM support_records WHERE member_id = ? ORDER BY date DESC, created_at DESC")
      .all(req.params.id);
    const departments = await db.prepare(
        `SELECT d.id, d.name, dm.position FROM departments d
         JOIN department_members dm ON dm.department_id = d.id WHERE dm.member_id = ?`,
      )
      .all(req.params.id);
    const donations = await db.prepare("SELECT * FROM donations WHERE member_id = ? ORDER BY created_at DESC LIMIT 20")
      .all(req.params.id);
    res.json({ ...(member as object), growth, support, departments, donations });
  }),
);

membersRouter.post(
  "/",
  requireRole("worker"),
  asyncHandler(async (req, res) => {
    const input = parseBody(memberSchema, req.body);
    const id = newId("mbr");
    const email = input.email ? input.email.toLowerCase() : null;
    if (email) {
      const dupe = await db.prepare("SELECT id FROM members WHERE email = ?").get(email);
      if (dupe) throw new HttpError(409, "A member with this email already exists");
    }
    await db.prepare(
      `INSERT INTO members (id, first_name, last_name, gender, email, phone, password_hash, role,
        spiritual_class, membership_status, date_of_birth, wedding_anniversary, marital_status,
        address, city, state, country, occupation, join_date, notes)
       VALUES (@id, @firstName, @lastName, @gender, @email, @phone, @passwordHash, @role,
        @spiritualClass, @membershipStatus, @dateOfBirth, @weddingAnniversary, @maritalStatus,
        @address, @city, @state, @country, @occupation, @joinDate, @notes)`,
    ).run({
      id,
      firstName: input.firstName,
      lastName: input.lastName,
      gender: input.gender ?? null,
      email,
      phone: input.phone ?? null,
      passwordHash: input.password ? await hashPassword(input.password) : null,
      role: input.role,
      spiritualClass: input.spiritualClass,
      membershipStatus: input.membershipStatus,
      dateOfBirth: input.dateOfBirth || null,
      weddingAnniversary: input.weddingAnniversary || null,
      maritalStatus: input.maritalStatus ?? null,
      address: input.address ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      country: input.country ?? "Nigeria",
      occupation: input.occupation ?? null,
      joinDate: input.joinDate || nowIso().slice(0, 10),
      notes: input.notes ?? null,
    });
    audit("create", "member", id, req.user);
    res.status(201).json(await db.prepare("SELECT * FROM members WHERE id = ?").get(id));
  }),
);

membersRouter.put(
  "/:id",
  requireRole("worker"),
  asyncHandler(async (req, res) => {
    const existing = await db.prepare("SELECT * FROM members WHERE id = ?").get(req.params.id);
    if (!existing) throw new HttpError(404, "Member not found");
    const input = parseBody(memberSchema.partial(), req.body);
    const map: Record<string, string> = {
      firstName: "first_name",
      lastName: "last_name",
      gender: "gender",
      phone: "phone",
      role: "role",
      spiritualClass: "spiritual_class",
      membershipStatus: "membership_status",
      dateOfBirth: "date_of_birth",
      weddingAnniversary: "wedding_anniversary",
      maritalStatus: "marital_status",
      address: "address",
      city: "city",
      state: "state",
      country: "country",
      occupation: "occupation",
      joinDate: "join_date",
      notes: "notes",
    };
    const sets: string[] = [];
    const params: Record<string, unknown> = { id: req.params.id };
    for (const [key, col] of Object.entries(map)) {
      if (key in input) {
        sets.push(`${col} = @${key}`);
        params[key] = (input as Record<string, unknown>)[key] ?? null;
      }
    }
    if (input.email !== undefined) {
      sets.push("email = @email");
      params.email = input.email ? input.email.toLowerCase() : null;
    }
    if (input.password) {
      sets.push("password_hash = @passwordHash");
      params.passwordHash = await hashPassword(input.password);
    }
    sets.push("updated_at = @updatedAt");
    params.updatedAt = nowIso();
    await db.prepare(`UPDATE members SET ${sets.join(", ")} WHERE id = @id`).run(params);
    audit("update", "member", req.params.id, req.user);
    res.json(await db.prepare("SELECT * FROM members WHERE id = ?").get(req.params.id));
  }),
);

membersRouter.delete(
  "/:id",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    await db.prepare("DELETE FROM members WHERE id = ?").run(req.params.id);
    audit("delete", "member", req.params.id, req.user);
    res.status(204).end();
  }),
);

// Growth records
const growthSchema = z.object({
  type: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  date: z.string().optional().nullable(),
});
membersRouter.post(
  "/:id/growth",
  requireRole("worker"),
  asyncHandler(async (req, res) => {
    const input = parseBody(growthSchema, req.body);
    const id = newId("grw");
    await db.prepare(
      `INSERT INTO growth_records (id, member_id, type, title, description, date, recorded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      req.params.id,
      input.type,
      input.title,
      input.description ?? null,
      input.date || nowIso().slice(0, 10),
      `${req.user!.first_name} ${req.user!.last_name}`,
    );
    res.status(201).json(await db.prepare("SELECT * FROM growth_records WHERE id = ?").get(id));
  }),
);

// Support records
const supportSchema = z.object({
  type: z.string().min(1),
  description: z.string().optional().nullable(),
  amount: z.number().optional().nullable(),
  date: z.string().optional().nullable(),
});
membersRouter.post(
  "/:id/support",
  requireRole("worker"),
  asyncHandler(async (req, res) => {
    const input = parseBody(supportSchema, req.body);
    const id = newId("sup");
    await db.prepare(
      `INSERT INTO support_records (id, member_id, type, description, amount, date, recorded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      req.params.id,
      input.type,
      input.description ?? null,
      input.amount ?? null,
      input.date || nowIso().slice(0, 10),
      `${req.user!.first_name} ${req.user!.last_name}`,
    );
    res.status(201).json(await db.prepare("SELECT * FROM support_records WHERE id = ?").get(id));
  }),
);
