import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";

process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://igc:igc@127.0.0.1:5432/gracedflow_test";
process.env.SCHEDULER_ENABLED = "false";
process.env.SEED_DEMO = "false";
process.env.ADMIN_EMAIL = "ugbede39@gmail.com";
process.env.ADMIN_PASSWORD = "TestAdmin-2026";
process.env.ADMIN_FIRST_NAME = "Michael";
process.env.ADMIN_LAST_NAME = "Ugbede";

let app: Express;

beforeAll(async () => {
  process.env.SEED_DEMO = "false";
  process.env.ADMIN_EMAIL = "ugbede39@gmail.com";
  process.env.ADMIN_PASSWORD = "TestAdmin-2026";
  process.env.ADMIN_FIRST_NAME = "Michael";
  process.env.ADMIN_LAST_NAME = "Ugbede";
  const { initSchema, resetSchema } = await import("../src/db.js");
  const { seed, ensureProductionData } = await import("../src/seed.js");
  const { createApp } = await import("../src/app.js");
  await resetSchema();
  await initSchema();
  await seed();

  const { hashPassword } = await import("../src/auth.js");
  const { newId } = await import("../src/util.js");
  const realId = newId("mbr");
  await (await import("../src/db.js")).db
    .prepare(
      `INSERT INTO members (id, first_name, last_name, email, password_hash, role, spiritual_class, membership_status, account_status, join_date)
       VALUES (?, 'Michael', 'Ugbede', 'ugbede39@gmail.com', ?, 'worker', 'worker', 'new', 'active', ?)`,
    )
    .run(realId, await hashPassword("TestAdmin-2026"), "2026-08-22");

  await ensureProductionData();
  app = createApp();
});

describe("Roles, admin promotion and department leaders", () => {
  it("promotes ADMIN_EMAIL from worker to super_admin and strips sample members", async () => {
    const { db } = await import("../src/db.js");
    const admin = (await db
      .prepare("SELECT email, role, first_name FROM members WHERE email = ?")
      .get("ugbede39@gmail.com")) as { role: string; first_name: string };
    expect(admin.role).toBe("super_admin");
    expect(admin.first_name).toBe("Michael");

    const demo = await db.prepare("SELECT id FROM members WHERE email = ?").get("admin@igc.church");
    expect(demo).toBeUndefined();
  });

  it("lets that admin sign in as super_admin", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "ugbede39@gmail.com", password: "TestAdmin-2026" });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("super_admin");
    const me = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${res.body.token}`);
    expect(me.body.role).toBe("super_admin");
    expect(me.body.ledDepartments.some((d: { slug: string }) => d.slug === "pastoral")).toBe(true);
  });

  it("blocks a worker from adding members or sending church-wide messages", async () => {
    const { db } = await import("../src/db.js");
    const { hashPassword } = await import("../src/auth.js");
    const { newId } = await import("../src/util.js");
    const id = newId("mbr");
    await db
      .prepare(
        `INSERT INTO members (id, first_name, last_name, email, password_hash, role, spiritual_class, membership_status, account_status, join_date)
         VALUES (?, 'Plain', 'Worker', 'plain.worker@igc.test', ?, 'worker', 'worker', 'active', 'active', ?)`,
      )
      .run(id, await hashPassword("WorkerPass1"), "2026-08-22");
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "plain.worker@igc.test", password: "WorkerPass1" });
    const token = login.body.token;
    const create = await request(app)
      .post("/api/members")
      .set("Authorization", `Bearer ${token}`)
      .send({ firstName: "Nope", lastName: "Edit" });
    expect(create.status).toBe(403);

    const choir = (await db.prepare("SELECT id FROM departments WHERE slug = 'choir'").get()) as {
      id: string;
    };
    const meeting = await request(app)
      .post("/api/meetings")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Should fail",
        scheduledAt: new Date().toISOString(),
        departmentId: choir.id,
      });
    expect(meeting.status).toBe(403);
  });

  it("lets a department leader schedule a meeting and write a review pastors can read", async () => {
    const { db } = await import("../src/db.js");
    const { hashPassword } = await import("../src/auth.js");
    const { newId } = await import("../src/util.js");
    const leaderId = newId("mbr");
    await db
      .prepare(
        `INSERT INTO members (id, first_name, last_name, email, password_hash, role, spiritual_class, membership_status, account_status, join_date)
         VALUES (?, 'Choir', 'Lead', 'choir.lead@igc.test', ?, 'worker', 'choir', 'active', 'active', ?)`,
      )
      .run(leaderId, await hashPassword("LeaderPass1"), "2026-08-22");
    const choir = (await db.prepare("SELECT id FROM departments WHERE slug = 'choir'").get()) as {
      id: string;
    };
    await db
      .prepare("INSERT INTO department_members (id, department_id, member_id, position) VALUES (?, ?, ?, ?)")
      .run(newId("dmb"), choir.id, leaderId, "leader");

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "choir.lead@igc.test", password: "LeaderPass1" });
    const token = login.body.token;
    const created = await request(app)
      .post("/api/meetings")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Choir practice",
        scheduledAt: new Date().toISOString(),
        departmentId: choir.id,
      });
    expect(created.status).toBe(201);

    const ushering = (await db.prepare("SELECT id FROM departments WHERE slug = 'ushering'").get()) as {
      id: string;
    };
    const other = await request(app)
      .post("/api/meetings")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Usher meeting",
        scheduledAt: new Date().toISOString(),
        departmentId: ushering.id,
      });
    expect(other.status).toBe(403);

    const review = await request(app)
      .post(`/api/meetings/${created.body.id}/reviews`)
      .set("Authorization", `Bearer ${token}`)
      .send({ review: "Rehearsal was strong. Two late.", attendancePresent: 8, attendanceAbsent: 2 });
    expect(review.status).toBe(201);

    const workerLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "plain.worker@igc.test", password: "WorkerPass1" });
    const hidden = await request(app)
      .get("/api/meetings/reviews")
      .set("Authorization", `Bearer ${workerLogin.body.token}`);
    expect(hidden.status).toBe(403);

    const adminLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "ugbede39@gmail.com", password: "TestAdmin-2026" });
    const visible = await request(app)
      .get("/api/meetings/reviews")
      .set("Authorization", `Bearer ${adminLogin.body.token}`);
    expect(visible.status).toBe(200);
    expect(visible.body.some((r: { review: string }) => r.review.includes("Rehearsal was strong"))).toBe(
      true,
    );
  });
});
