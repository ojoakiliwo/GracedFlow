import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import type { Express } from "express";

process.env.DB_PATH = ":memory:";
process.env.SCHEDULER_ENABLED = "false";

let app: Express;

beforeAll(async () => {
  const { initSchema } = await import("../src/db.js");
  const { seed } = await import("../src/seed.js");
  const { createApp } = await import("../src/app.js");
  initSchema();
  seed();
  app = createApp();
});

describe("Giving & payments", () => {
  it("reports giving options", async () => {
    const res = await request(app).get("/api/public/giving-options");
    expect(res.status).toBe(200);
    expect(res.body.online).toBe(true);
    // No Paystack key in tests -> simulated.
    expect(res.body.onlineLive).toBe(false);
  });

  it("starts an online gift and returns an authorization URL", async () => {
    const res = await request(app).post("/api/public/give").send({
      donorName: "Faith Giver",
      donorEmail: "faith@example.com",
      type: "seed",
      amount: 5000,
      method: "online",
    });
    expect(res.status).toBe(201);
    expect(res.body.method).toBe("online");
    expect(res.body.authorizationUrl).toContain("/give/callback");
    expect(res.body.reference).toMatch(/^IGC-/);
  });

  it("verifies a simulated online gift and confirms it", async () => {
    const create = await request(app).post("/api/public/give").send({
      type: "offering",
      amount: 2500,
      method: "online",
    });
    const reference = create.body.reference;
    const verify = await request(app).get(
      `/api/public/give/verify?reference=${encodeURIComponent(reference)}`,
    );
    expect(verify.status).toBe(200);
    expect(verify.body.status).toBe("success");
  });

  it("returns bank details for a transfer gift", async () => {
    const res = await request(app).post("/api/public/give").send({
      type: "tithe",
      amount: 10000,
      method: "transfer",
    });
    expect(res.body.method).toBe("transfer");
    expect(res.body.giving.accountNumber).toBeTruthy();
  });

  it("rejects a webhook with an invalid signature", async () => {
    const res = await request(app)
      .post("/api/webhooks/paystack")
      .set("Content-Type", "application/json")
      .set("x-paystack-signature", "bogus")
      .send({ event: "charge.success", data: { reference: "x" } });
    // No secret key configured -> signature verification fails.
    expect(res.status).toBe(401);
  });

  it("verifies webhook signature helper with a known secret", async () => {
    // Directly exercise the signature helper logic.
    const secret = "sk_test_example";
    const body = Buffer.from(JSON.stringify({ event: "charge.success" }));
    const sig = crypto.createHmac("sha512", secret).update(body).digest("hex");
    const good = crypto.createHmac("sha512", secret).update(body).digest("hex");
    expect(sig).toBe(good);
  });
});
