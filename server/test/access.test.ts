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

  it("does not give a pastor church-wide access, even if they also lead a department", async () => {
    const { db } = await import("../src/db.js");
    const { hashPassword } = await import("../src/auth.js");
    const { newId } = await import("../src/util.js");
    const pastorId = newId("mbr");
    await db
      .prepare(
        `INSERT INTO members (id, first_name, last_name, email, password_hash, role, spiritual_class, membership_status, account_status, join_date)
         VALUES (?, 'Paul', 'Shepherd', 'pastor.leader@igc.test', ?, 'pastor', 'leader', 'active', 'active', ?)`,
      )
      .run(pastorId, await hashPassword("PastorPass1"), "2026-08-22");
    const choir = (await db.prepare("SELECT id FROM departments WHERE slug = 'choir'").get()) as {
      id: string;
    };
    const ushering = (await db.prepare("SELECT id FROM departments WHERE slug = 'ushering'").get()) as {
      id: string;
    };
    await db
      .prepare("INSERT INTO department_members (id, department_id, member_id, position) VALUES (?, ?, ?, ?)")
      .run(newId("dmb"), choir.id, pastorId, "leader");

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "pastor.leader@igc.test", password: "PastorPass1" });
    const token = login.body.token;

    const promote = await request(app)
      .post("/api/members")
      .set("Authorization", `Bearer ${token}`)
      .send({ firstName: "Elevated", lastName: "Person", role: "pastor" });
    expect(promote.status).toBe(403);

    const workerOk = await request(app)
      .post("/api/members")
      .set("Authorization", `Bearer ${token}`)
      .send({
        firstName: "New",
        lastName: "Convert",
        email: "new.convert.access@igc.test",
        role: "worker",
      });
    expect(workerOk.status).toBe(201);

    const otherDept = await request(app)
      .post("/api/meetings")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Usher briefing",
        scheduledAt: new Date().toISOString(),
        departmentId: ushering.id,
      });
    expect(otherDept.status).toBe(403);

    const ownDept = await request(app)
      .post("/api/meetings")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Choir pastoral check-in",
        scheduledAt: new Date().toISOString(),
        departmentId: choir.id,
      });
    expect(ownDept.status).toBe(201);

    const giving = await request(app)
      .get("/api/donations")
      .set("Authorization", `Bearer ${token}`);
    expect(giving.status).toBe(403);

    const settings = await request(app)
      .get("/api/settings/integrations")
      .set("Authorization", `Bearer ${token}`);
    expect(settings.status).toBe(403);

    const appoint = await request(app)
      .post(`/api/departments/${ushering.id}/members`)
      .set("Authorization", `Bearer ${token}`)
      .send({ memberId: workerOk.body.id, position: "leader" });
    expect(appoint.status).toBe(403);
  });

  it("lets only the super admin change office, and the new position attaches access immediately", async () => {
    const { db } = await import("../src/db.js");
    const { hashPassword } = await import("../src/auth.js");
    const { newId } = await import("../src/util.js");
    const workerId = newId("mbr");
    await db
      .prepare(
        `INSERT INTO members (id, first_name, last_name, email, password_hash, role, spiritual_class, membership_status, account_status, join_date)
         VALUES (?, 'Ruth', 'Worker', 'ruth.office@igc.test', ?, 'worker', 'worker', 'active', 'active', ?)`,
      )
      .run(workerId, await hashPassword("WorkerPass1"), "2026-08-22");
    const choir = (await db.prepare("SELECT id FROM departments WHERE slug = 'choir'").get()) as {
      id: string;
    };

    const workerLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "ruth.office@igc.test", password: "WorkerPass1" });
    const before = await request(app)
      .post("/api/meetings")
      .set("Authorization", `Bearer ${workerLogin.body.token}`)
      .send({
        title: "Should fail before promotion",
        scheduledAt: new Date().toISOString(),
        departmentId: choir.id,
      });
    expect(before.status).toBe(403);

    const pastorLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "pastor.leader@igc.test", password: "PastorPass1" });
    const pastorDenied = await request(app)
      .put(`/api/members/${workerId}/office`)
      .set("Authorization", `Bearer ${pastorLogin.body.token}`)
      .send({ role: "pastor" });
    expect(pastorDenied.status).toBe(403);

    const adminLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "ugbede39@gmail.com", password: "TestAdmin-2026" });
    const upgraded = await request(app)
      .put(`/api/members/${workerId}/office`)
      .set("Authorization", `Bearer ${adminLogin.body.token}`)
      .send({
        role: "worker",
        departments: [{ departmentId: choir.id, position: "leader" }],
      });
    expect(upgraded.status).toBe(200);
    expect(upgraded.body.office.value).toBe("worker");
    expect(upgraded.body.departments.some((d: { position: string }) => d.position === "leader")).toBe(
      true,
    );

    const afterLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "ruth.office@igc.test", password: "WorkerPass1" });
    const after = await request(app)
      .post("/api/meetings")
      .set("Authorization", `Bearer ${afterLogin.body.token}`)
      .send({
        title: "Choir after promotion",
        scheduledAt: new Date().toISOString(),
        departmentId: choir.id,
      });
    expect(after.status).toBe(201);

    const toPastor = await request(app)
      .put(`/api/members/${workerId}/office`)
      .set("Authorization", `Bearer ${adminLogin.body.token}`)
      .send({ role: "pastor" });
    expect(toPastor.status).toBe(200);
    expect(toPastor.body.role).toBe("pastor");
    expect(toPastor.body.office.grants.length).toBeGreaterThan(0);
  });
});
