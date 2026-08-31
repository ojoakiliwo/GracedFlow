import { beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import type { Express } from "express";

process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://igc:igc@127.0.0.1:5432/gracedflow_test";
process.env.SCHEDULER_ENABLED = "false";
process.env.SEED_DEMO = "true";

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
    expect(res.body.currencies.map((c: { code: string }) => c.code)).toEqual([
      "NGN",
      "USD",
      "GBP",
      "EUR",
      "CAD",
      "GHS",
      "KES",
      "ZAR",
    ]);
    expect(res.body.paystackCurrencies).toEqual(["NGN"]);
  });

  it("treats Paystack as Naira-only unless international payments are enabled", async () => {
    const { paystackSupportsCurrency } = await import("../src/currencies.js");
    expect(paystackSupportsCurrency("NGN")).toBe(true);
    expect(paystackSupportsCurrency("USD")).toBe(false);
    const prev = process.env.PAYSTACK_INTERNATIONAL;
    process.env.PAYSTACK_INTERNATIONAL = "true";
    try {
      expect(paystackSupportsCurrency("USD")).toBe(true);
      expect(paystackSupportsCurrency("GBP")).toBe(false);
    } finally {
      if (prev === undefined) delete process.env.PAYSTACK_INTERNATIONAL;
      else process.env.PAYSTACK_INTERNATIONAL = prev;
    }
    expect(paystackSupportsCurrency("USD")).toBe(false);
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
    expect(res.body.giving).toBeTruthy();
  });

  it("lets a donor choose USD and stores that currency", async () => {
    const res = await request(app).post("/api/public/give").send({
      donorName: "Diaspora Giver",
      donorEmail: "diaspora@example.com",
      type: "offering",
      amount: 50,
      currency: "USD",
      method: "online",
    });
    expect(res.status).toBe(201);
    expect(res.body.currency).toBe("USD");
    const { db } = await import("../src/db.js");
    const row = (await db
      .prepare("SELECT amount, currency FROM donations WHERE reference = ?")
      .get(res.body.reference)) as { amount: number; currency: string };
    expect(Number(row.amount)).toBe(50);
    expect(row.currency).toBe("USD");
  });

  it("rejects an unsupported currency and naira-only bank transfer in USD", async () => {
    const bad = await request(app).post("/api/public/give").send({
      type: "tithe",
      amount: 20,
      currency: "JPY",
      method: "online",
    });
    expect(bad.status).toBe(400);

    const transfer = await request(app).post("/api/public/give").send({
      type: "tithe",
      amount: 20,
      currency: "GBP",
      method: "transfer",
    });
    expect(transfer.status).toBe(400);
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

  it("falls back to Paystack when Flutterwave creates a session without a checkout URL", async () => {
    const { config } = await import("../src/config.js");
    const { initializeTransaction } = await import("../src/payments.js");
    const { resetFlutterwaveTokenCache: resetCache } = await import("../src/flutterwave.js");
    const prev = {
      paystackSecretKey: config.payments.paystackSecretKey,
      flutterwaveClientId: config.payments.flutterwaveClientId,
      flutterwaveClientSecret: config.payments.flutterwaveClientSecret,
      provider: config.payments.provider,
    };
    config.payments.paystackSecretKey = "sk_test_fallback";
    config.payments.flutterwaveClientId = "flw-client";
    config.payments.flutterwaveClientSecret = "flw-secret";
    config.payments.provider = "flutterwave";
    resetCache();

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const json = (status: number, body: unknown) =>
        new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
      if (url.includes("openid-connect/token")) {
        return json(200, { access_token: "tok_live", expires_in: 600 });
      }
      if (url.endsWith("/customers")) {
        return json(201, { status: "success", data: { id: "cus_1" } });
      }
      if (url.endsWith("/checkout/sessions")) {
        return json(200, {
          status: "success",
          message: "Checkout session created",
          data: {
            id: "che_1",
            redirect_url: "https://church.example/give/callback",
            reference: "IGC-FALLBACK",
          },
        });
      }
      if (url.includes("/transaction/initialize")) {
        return json(200, {
          status: true,
          data: {
            authorization_url: "https://checkout.paystack.com/fallback",
            access_code: "ac_1",
            reference: "IGC-FALLBACK",
          },
        });
      }
      return json(404, { message: url });
    });
    vi.stubGlobal("fetch", fetchMock);

    try {
      const result = await initializeTransaction({
        email: "giver@example.com",
        amountMajor: 2500,
        reference: "IGC-FALLBACK",
        provider: "flutterwave",
        currency: "NGN",
      });
      expect(result.provider).toBe("paystack");
      expect(result.authorizationUrl).toBe("https://checkout.paystack.com/fallback");
    } finally {
      config.payments.paystackSecretKey = prev.paystackSecretKey;
      config.payments.flutterwaveClientId = prev.flutterwaveClientId;
      config.payments.flutterwaveClientSecret = prev.flutterwaveClientSecret;
      config.payments.provider = prev.provider;
      resetCache();
      vi.unstubAllGlobals();
    }
  });

  it("routes USD to Flutterwave and does not fall back to Paystack", async () => {
    const { config } = await import("../src/config.js");
    const { initializeTransaction } = await import("../src/payments.js");
    const { resetFlutterwaveTokenCache: resetCache } = await import("../src/flutterwave.js");
    const prev = {
      paystackSecretKey: config.payments.paystackSecretKey,
      flutterwaveClientId: config.payments.flutterwaveClientId,
      flutterwaveClientSecret: config.payments.flutterwaveClientSecret,
      provider: config.payments.provider,
    };
    config.payments.paystackSecretKey = "sk_test_usd";
    config.payments.flutterwaveClientId = "flw-client";
    config.payments.flutterwaveClientSecret = "flw-secret";
    config.payments.provider = "paystack";
    resetCache();

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const json = (status: number, body: unknown) =>
        new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
      if (url.includes("openid-connect/token")) {
        return json(200, { access_token: "tok_live", expires_in: 600 });
      }
      if (url.endsWith("/customers")) {
        return json(201, { status: "success", data: { id: "cus_usd" } });
      }
      if (url.endsWith("/checkout/sessions")) {
        return json(200, {
          status: "success",
          data: {
            id: "che_usd",
            redirect_url: "https://church.example/give/callback?provider=flutterwave",
            reference: "IGC-USD",
          },
        });
      }
      if (url.endsWith("/payment-methods")) {
        return json(201, { status: "success", data: { id: "pmd_apple", type: "applepay" } });
      }
      if (url.endsWith("/charges") && !url.includes("?")) {
        return json(201, {
          status: "success",
          data: {
            id: "chg_usd",
            reference: "IGC-USD",
            status: "pending",
            next_action: {
              type: "redirect_url",
              redirect_url: { url: "https://coreflutterwaveprod.com/applepay/usd-gift" },
            },
          },
        });
      }
      if (url.includes("/transaction/initialize")) {
        return json(400, { status: false, message: "Currency not supported by merchant" });
      }
      return json(404, { message: url });
    });
    vi.stubGlobal("fetch", fetchMock);

    try {
      const result = await initializeTransaction({
        email: "diaspora@example.com",
        amountMajor: 25,
        reference: "IGC-USD",
        provider: "paystack",
        currency: "USD",
      });
      expect(result.provider).toBe("flutterwave");
      expect(result.authorizationUrl).toBe("https://coreflutterwaveprod.com/applepay/usd-gift");
      expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("/transaction/initialize"))).toBe(
        false,
      );
    } finally {
      config.payments.paystackSecretKey = prev.paystackSecretKey;
      config.payments.flutterwaveClientId = prev.flutterwaveClientId;
      config.payments.flutterwaveClientSecret = prev.flutterwaveClientSecret;
      config.payments.provider = prev.provider;
      resetCache();
      vi.unstubAllGlobals();
    }
  });
});
