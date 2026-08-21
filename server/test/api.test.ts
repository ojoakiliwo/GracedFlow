import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";

// Use an isolated in-memory-ish database file for tests.
process.env.DB_PATH = ":memory:";
process.env.SCHEDULER_ENABLED = "false";

let app: Express;
let token: string;

beforeAll(async () => {
  const { initSchema } = await import("../src/db.js");
  const { seed } = await import("../src/seed.js");
  const { createApp } = await import("../src/app.js");
  initSchema();
  seed();
  app = createApp();

  const login = await request(app)
    .post("/api/auth/login")
    .send({ email: "admin@igc.church", password: "Grace@2024" });
  token = login.body.token;
});

function auth(req: request.Test) {
  return req.set("Authorization", `Bearer ${token}`);
}

describe("Infinitely Graced Church API", () => {
  it("is healthy", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.church).toContain("Infinitely Graced");
  });

  it("logs in the seeded admin and rejects bad passwords", async () => {
    expect(token).toBeTruthy();
    const bad = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@igc.church", password: "wrong" });
    expect(bad.status).toBe(401);
  });

  it("requires authentication for protected routes", async () => {
    const res = await request(app).get("/api/members");
    expect(res.status).toBe(401);
  });

  it("lists seeded members and departments", async () => {
    const members = await auth(request(app).get("/api/members"));
    expect(members.status).toBe(200);
    expect(members.body.length).toBeGreaterThan(5);

    const depts = await auth(request(app).get("/api/departments"));
    expect(depts.body.some((d: { type: string }) => d.type === "general")).toBe(true);
  });

  it("creates a member and tracks growth", async () => {
    const create = await auth(request(app).post("/api/members")).send({
      firstName: "Test",
      lastName: "Convert",
      email: "test.convert@example.com",
      phone: "+2348099999999",
      spiritualClass: "new_convert",
    });
    expect(create.status).toBe(201);
    const id = create.body.id;

    const growth = await auth(request(app).post(`/api/members/${id}/growth`)).send({
      type: "salvation",
      title: "Gave life to Christ",
    });
    expect(growth.status).toBe(201);

    const detail = await auth(request(app).get(`/api/members/${id}`));
    expect(detail.body.growth).toHaveLength(1);
  });

  it("previews and sends a segmented message to new converts", async () => {
    const preview = await auth(request(app).post("/api/messages/preview")).send({
      audienceType: "class",
      audienceValue: "new_convert",
    });
    expect(preview.status).toBe(200);
    expect(preview.body.count).toBeGreaterThan(0);

    const send = await auth(request(app).post("/api/messages")).send({
      channel: "both",
      subject: "Welcome",
      body: "Hello {{first_name}}, welcome to the family!",
      audienceType: "class",
      audienceValue: "new_convert",
    });
    expect(send.status).toBe(201);
    expect(send.body.recipients).toBeGreaterThan(0);
    expect(send.body.sent).toBeGreaterThan(0);
  });

  it("runs the Sunday reminder automation to all members", async () => {
    const res = await auth(request(app).post("/api/automations/run")).send({
      job: "sunday_reminder",
    });
    expect(res.status).toBe(200);
    expect(res.body.recipients).toBeGreaterThan(0);
  });

  it("sends birthday/anniversary greetings for today's celebrants", async () => {
    const res = await auth(request(app).post("/api/automations/run")).send({
      job: "celebrations",
    });
    expect(res.status).toBe(200);
    expect(res.body.birthdays + res.body.anniversaries).toBeGreaterThan(0);
  });

  it("distributes a social post to multiple platforms", async () => {
    const res = await auth(request(app).post("/api/social")).send({
      content: "Join us this Sunday for a time of grace!",
      platforms: ["facebook", "twitter", "instagram"],
    });
    expect(res.status).toBe(201);
    expect(res.body.published).toBe(3);
  });

  it("accepts a public giving intent and lists it as pending", async () => {
    const give = await request(app).post("/api/public/give").send({
      donorName: "Anonymous Giver",
      type: "tithe",
      amount: 15000,
    });
    expect(give.status).toBe(201);
    expect(give.body.reference).toMatch(/^IGC-/);

    const pending = await auth(request(app).get("/api/donations?status=pending"));
    expect(pending.body.donations.length).toBeGreaterThan(0);
  });

  it("records a public prayer request", async () => {
    const res = await request(app).post("/api/public/prayer-requests").send({
      name: "Visitor",
      request: "Please pray for my family.",
    });
    expect(res.status).toBe(201);
  });

  it("returns dashboard analytics", async () => {
    const res = await auth(request(app).get("/api/dashboard"));
    expect(res.status).toBe(200);
    expect(res.body.stats.totalMembers).toBeGreaterThan(0);
    expect(Array.isArray(res.body.membersByClass)).toBe(true);
  });
});
