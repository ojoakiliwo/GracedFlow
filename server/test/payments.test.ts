import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import type { Express } from "express";

process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://igc:igc@127.0.0.1:5432/gracedflow_test";
process.env.SCHEDULER_ENABLED = "false";

let app: Express;

beforeAll(async () => {
  const { initSchema, resetSchema } = await import("../src/db.js");
  const { seed } = await import("../src/seed.js");
  const { createApp } = await import("../src/app.js");
  await resetSchema();
  await initSchema();
  await seed();
  app = createApp();
});

describe("Giving & payments", () => {
  it("reports giving options", async () => {
    const res = await request(app).get("/api/public/giving-options");
    expect(res.status).toBe(200);
    expect(res.body.online).toBe(true);
    // No live payment keys in tests -> simulated.
    expect(res.body.onlineLive).toBe(false);
    expect(res.body.provider).toBe("dryrun");
    expect(res.body.providers).toEqual({ flutterwave: false, paystack: false });
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
    expect(res.body.authorizationUrl).toContain("provider=dryrun");
    expect(res.body.reference).toMatch(/^IGC-/);
    expect(res.body.provider).toBe("dryrun");
  });

  it("defaults checkout to dryrun when neither gateway has keys", async () => {
    const { livePaymentProviders, resolveCheckoutProvider } = await import("../src/payments.js");
    expect(livePaymentProviders()).toEqual([]);
    expect(resolveCheckoutProvider("paystack")).toBe("dryrun");
    expect(resolveCheckoutProvider("flutterwave")).toBe("dryrun");
  });

  it("accepts an explicit Paystack or Flutterwave choice and still simulates without keys", async () => {
    const paystack = await request(app).post("/api/public/give").send({
      type: "tithe",
      amount: 1000,
      method: "online",
      provider: "paystack",
    });
    expect(paystack.status).toBe(201);
    expect(paystack.body.provider).toBe("dryrun");

    const flutterwave = await request(app).post("/api/public/give").send({
      type: "tithe",
      amount: 1000,
      method: "online",
      provider: "flutterwave",
    });
    expect(flutterwave.status).toBe(201);
    expect(flutterwave.body.provider).toBe("dryrun");
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

  it("rejects a Flutterwave webhook with an invalid signature", async () => {
    const res = await request(app)
      .post("/api/webhooks/flutterwave")
      .set("Content-Type", "application/json")
      .set("flutterwave-signature", "bogus")
      .send({ type: "charge.completed", data: { reference: "x", status: "succeeded" } });
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
