import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";

process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://igc:igc@127.0.0.1:5432/gracedflow_test";
process.env.SCHEDULER_ENABLED = "false";
process.env.SEED_DEMO = "true";

let app: Express;
let superAdminToken: string;

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
  superAdminToken = login.body.token;
});

function auth(token: string, req: request.Test) {
  return req.set("Authorization", `Bearer ${token}`);
}

describe("Project edits", () => {
  it("lets the super admin correct a project title and description", async () => {
    const created = await auth(
      superAdminToken,
      request(app).post("/api/projects"),
    ).send({
      title: "Chruch building",
      description: "A vison for the new sanctuary.",
      category: "Bilding",
      status: "vision",
      visibility: "public",
      progress: 10,
    });
    expect(created.status).toBe(201);
    expect(created.body.title).toBe("Chruch building");

    const updated = await auth(
      superAdminToken,
      request(app).put(`/api/projects/${created.body.id}`),
    ).send({
      title: "Church building",
      description: "A vision for the new sanctuary.",
      category: "Building",
      status: "ongoing",
      visibility: "public",
      progress: 10,
    });
    expect(updated.status).toBe(200);
    expect(updated.body.title).toBe("Church building");
    expect(updated.body.description).toBe("A vision for the new sanctuary.");
    expect(updated.body.category).toBe("Building");
    expect(updated.body.status).toBe("ongoing");

    const listed = await auth(superAdminToken, request(app).get("/api/projects"));
    const row = listed.body.find((p: { id: string }) => p.id === created.body.id);
    expect(row.title).toBe("Church building");
  });

  it("blocks a worker from editing projects", async () => {
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "worker@igc.church", password: "Grace@2024" });
    expect(login.status).toBe(200);

    const created = await auth(
      superAdminToken,
      request(app).post("/api/projects"),
    ).send({
      title: "Keep this title",
      status: "vision",
      visibility: "private",
    });
    expect(created.status).toBe(201);

    const denied = await auth(
      login.body.token,
      request(app).put(`/api/projects/${created.body.id}`),
    ).send({
      title: "Worker rewrite",
      status: "vision",
      visibility: "private",
    });
    expect(denied.status).toBe(403);
  });
});
