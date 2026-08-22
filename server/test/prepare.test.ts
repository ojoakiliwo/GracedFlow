import { beforeAll, describe, expect, it } from "vitest";

process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://igc:igc@127.0.0.1:5432/gracedflow_test";
process.env.SCHEDULER_ENABLED = "false";
process.env.SEED_DEMO = "false";
process.env.ADMIN_EMAIL = "pastor@infinitelygraced.church";
process.env.ADMIN_PASSWORD = "RealAdmin-2026";
process.env.ADMIN_FIRST_NAME = "Real";
process.env.ADMIN_LAST_NAME = "Pastor";

beforeAll(async () => {
  const { initSchema, resetSchema } = await import("../src/db.js");
  const { seed, prepareAppData, purgeDemoFixtures } = await import("../src/seed.js");
  await resetSchema();
  await initSchema();
  await seed();
  const purged = await purgeDemoFixtures();
  expect(purged.members).toBeGreaterThan(5);
  await prepareAppData();
});

describe("Production-ready data", () => {
  it("removes demo members, projects, events and meetings", async () => {
    const { db } = await import("../src/db.js");
    const members = (await db.prepare("SELECT email FROM members").all()) as { email: string }[];
    expect(members.every((m) => !m.email.endsWith("@example.com"))).toBe(true);
    expect(members.every((m) => m.email !== "admin@igc.church")).toBe(true);

    const projects = (await db.prepare("SELECT title FROM projects").all()) as { title: string }[];
    expect(projects).toHaveLength(0);

    const events = (await db.prepare("SELECT title FROM events").all()) as { title: string }[];
    expect(events).toHaveLength(0);

    const meetings = (await db.prepare("SELECT title FROM meetings").all()) as { title: string }[];
    expect(meetings).toHaveLength(0);
  });

  it("keeps ministry rooms and creates the real admin", async () => {
    const { db } = await import("../src/db.js");
    const depts = (await db.prepare("SELECT slug FROM departments").all()) as { slug: string }[];
    expect(depts.some((d) => d.slug === "all-workers")).toBe(true);
    expect(depts.length).toBeGreaterThanOrEqual(7);

    const admin = (await db
      .prepare("SELECT email, role, first_name FROM members WHERE email = ?")
      .get("pastor@infinitelygraced.church")) as
      | { email: string; role: string; first_name: string }
      | undefined;
    expect(admin?.role).toBe("super_admin");
    expect(admin?.first_name).toBe("Real");
  });

  it("strips choir rehearsal and fake members when the site is opened", async () => {
    const { db, initSchema, resetSchema } = await import("../src/db.js");
    const { seed } = await import("../src/seed.js");
    const { createApp } = await import("../src/app.js");
    await resetSchema();
    await initSchema();
    await seed();
    process.env.SEED_DEMO = "false";
    delete process.env.ALLOW_DEMO_DATA;

    const meetingsBefore = (await db.prepare("SELECT title FROM meetings").all()) as { title: string }[];
    expect(meetingsBefore.map((m) => m.title)).toEqual(
      expect.arrayContaining(["Choir Rehearsal", "Monthly Workers Meeting"]),
    );
    const memberCountBefore = (await db.prepare("SELECT COUNT(*)::int AS c FROM members").get()) as { c: number };
    expect(memberCountBefore.c).toBe(11);

    const request = (await import("supertest")).default;
    const app = createApp();
    const res = await request(app).get("/api/public/events");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);

    const meetings = (await db.prepare("SELECT title FROM meetings").all()) as { title: string }[];
    expect(meetings).toHaveLength(0);
    const members = (await db.prepare("SELECT email FROM members").all()) as { email: string }[];
    expect(members.every((m) => !m.email.endsWith("@example.com"))).toBe(true);
    expect(members.some((m) => m.email === "pastor@infinitelygraced.church")).toBe(true);
  });

  it("ignores leftover SEED_DEMO on Vercel production", async () => {
    const { demoFixturesAllowed } = await import("../src/seed.js");
    const prev = {
      seed: process.env.SEED_DEMO,
      allow: process.env.ALLOW_DEMO_DATA,
      vercel: process.env.VERCEL,
      node: process.env.NODE_ENV,
    };
    try {
      process.env.SEED_DEMO = "true";
      delete process.env.ALLOW_DEMO_DATA;
      process.env.VERCEL = "1";
      process.env.NODE_ENV = "production";
      expect(demoFixturesAllowed()).toBe(false);

      process.env.ALLOW_DEMO_DATA = "true";
      expect(demoFixturesAllowed()).toBe(true);
    } finally {
      process.env.SEED_DEMO = prev.seed;
      if (prev.allow === undefined) delete process.env.ALLOW_DEMO_DATA;
      else process.env.ALLOW_DEMO_DATA = prev.allow;
      if (prev.vercel === undefined) delete process.env.VERCEL;
      else process.env.VERCEL = prev.vercel;
      process.env.NODE_ENV = prev.node;
    }
  });

  it("lets the first registrant become super_admin when no admin exists", async () => {
    const { db } = await import("../src/db.js");
    const { createApp } = await import("../src/app.js");
    await db.prepare("DELETE FROM members WHERE email = ?").run("pastor@infinitelygraced.church");
    const request = (await import("supertest")).default;
    const app = createApp();
    const res = await request(app).post("/api/auth/register").send({
      firstName: "First",
      lastName: "Elder",
      email: "elder@infinitelygraced.church",
      password: "ElderPass1",
    });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("super_admin");
  });
});
