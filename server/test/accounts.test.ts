import { beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";
import * as comms from "../src/comms.js";

process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://igc:igc@127.0.0.1:5432/gracedflow_test";
process.env.SCHEDULER_ENABLED = "false";
process.env.SEED_DEMO = "true";
process.env.APP_URL = "https://infinitelygracedchurch.com";

let app: Express;
let token: string;

beforeAll(async () => {
  const { initSchema, resetSchema } = await import("../src/db.js");
  const { seed } = await import("../src/seed.js");
  const { createApp } = await import("../src/app.js");
  await resetSchema();
  await initSchema();
  await seed();
  app = createApp();
  const login = await request(app)
    .post("/api/auth/login")
    .send({ email: "admin@igc.church", password: "Grace@2024" });
  token = login.body.token;
});

describe("Member records vs portal accounts", () => {
  it("lets a pastor-added member claim the same record on register", async () => {
    const created = await request(app)
      .post("/api/members")
      .set("Authorization", `Bearer ${token}`)
      .send({
        firstName: "Joy",
        lastName: "Ada",
        email: "joy.ada@igc.test",
        phone: "+2348091112233",
        role: "member",
        spiritualClass: "new_convert",
      });
    expect(created.status).toBe(201);
    expect(created.body.password_hash).toBeFalsy();

    const claimed = await request(app).post("/api/auth/register").send({
      firstName: "Joy",
      lastName: "Ada",
      email: "joy.ada@igc.test",
      phone: "08091112233",
      password: "JoyPass1",
    });
    expect(claimed.status).toBe(201);
    expect(claimed.body.claimed).toBe(true);
    expect(claimed.body.user.id).toBe(created.body.id);
    expect(claimed.body.user.role).toBe("member");

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "joy.ada@igc.test", password: "JoyPass1" });
    expect(login.status).toBe(200);
    expect(login.body.user.id).toBe(created.body.id);

    const again = await request(app).post("/api/auth/register").send({
      firstName: "Joy",
      lastName: "Ada",
      email: "joy.ada@igc.test",
      password: "OtherPass1",
    });
    expect(again.status).toBe(409);
  });

  it("notifies the assignee by SMS and email when a task is given", async () => {
    const sms = vi.spyOn(comms, "sendSms").mockResolvedValue({ ok: true, provider: "test" });
    const email = vi.spyOn(comms, "sendEmail").mockResolvedValue({ ok: true, provider: "test" });
    const created = await request(app)
      .post("/api/members")
      .set("Authorization", `Bearer ${token}`)
      .send({
        firstName: "Caleb",
        lastName: "Task",
        email: "caleb.task@igc.test",
        phone: "+2348092223344",
        role: "worker",
      });
    expect(created.status).toBe(201);
    await new Promise((r) => setTimeout(r, 30));

    const task = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Prepare Sunday ushering",
        assignedTo: created.body.id,
        dueDate: "2026-08-30",
      });
    expect(task.status).toBe(201);
    const smsBody = sms.mock.calls.map((c) => String(c[1])).find((b) => b.includes("Prepare Sunday ushering"));
    expect(smsBody).toBeTruthy();
    expect(smsBody).toContain("/login");
    expect(email.mock.calls.some((c) => String(c[1]).includes("New task"))).toBe(true);
    sms.mockRestore();
    email.mockRestore();
  });
});
