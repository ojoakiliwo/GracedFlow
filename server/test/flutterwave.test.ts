import { afterEach, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import {
  createFlutterwaveCheckoutSession,
  encryptFlutterwaveField,
  generateFlutterwaveNonce,
  getFlutterwaveAccessToken,
  resetFlutterwaveTokenCache,
  verifyFlutterwaveCharge,
  verifyFlutterwaveWebhookSignature,
  type FlutterwaveCredentials,
} from "../src/flutterwave.js";

const creds: FlutterwaveCredentials = {
  clientId: "test-client-id",
  clientSecret: "test-client-secret",
  encryptionKey: Buffer.alloc(32, 7).toString("base64"),
  secretHash: "dashboard-secret-hash",
  env: "sandbox",
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  resetFlutterwaveTokenCache();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Flutterwave v4 helpers", () => {
  it("verifies a webhook signature with HMAC-SHA256 base64", () => {
    const raw = Buffer.from(JSON.stringify({ type: "charge.completed" }));
    const signature = crypto
      .createHmac("sha256", creds.secretHash)
      .update(raw)
      .digest("base64");
    expect(verifyFlutterwaveWebhookSignature(raw, signature, creds.secretHash)).toBe(true);
    expect(verifyFlutterwaveWebhookSignature(raw, "bogus", creds.secretHash)).toBe(false);
    expect(verifyFlutterwaveWebhookSignature(raw, signature, "")).toBe(false);
  });

  it("encrypts a field with the v4 encryption key (AES-256-GCM)", () => {
    const nonce = "a1b2c3d4e5f6";
    const cipher = encryptFlutterwaveField("4111111111111111", creds.encryptionKey, nonce);
    expect(cipher).toMatch(/^[A-Za-z0-9+/=]+$/);

    const key = Buffer.from(creds.encryptionKey, "base64");
    const raw = Buffer.from(cipher, "base64");
    const tag = raw.subarray(raw.length - 16);
    const encrypted = raw.subarray(0, raw.length - 16);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(nonce, "utf8"));
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
    expect(plain).toBe("4111111111111111");
    expect(generateFlutterwaveNonce()).toHaveLength(12);
  });

  it("caches the OAuth access token until it is close to expiry", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { access_token: "tok_abc", expires_in: 600 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const first = await getFlutterwaveAccessToken(creds);
    const second = await getFlutterwaveAccessToken(creds);
    expect(first).toBe("tok_abc");
    expect(second).toBe("tok_abc");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("creates a customer then a hosted checkout session", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("openid-connect/token")) {
        return jsonResponse(200, { access_token: "tok_live", expires_in: 600 });
      }
      if (url.endsWith("/customers") && init?.method === "POST") {
        return jsonResponse(201, { status: "success", data: { id: "cus_donor1" } });
      }
      if (url.endsWith("/checkout/sessions")) {
        const body = JSON.parse(String(init?.body));
        expect(body.customer_id).toBe("cus_donor1");
        expect(body.reference).toBe("IGC-GIFT-1");
        expect(body.amount).toBe(5000);
        return jsonResponse(200, {
          status: "success",
          data: {
            id: "chs_abc",
            checkout_url: "https://checkout.flutterwave.com/pay/abc",
            reference: "IGC-GIFT-1",
          },
        });
      }
      return jsonResponse(404, { message: `unexpected ${url}` });
    });
    vi.stubGlobal("fetch", fetchMock);

    const session = await createFlutterwaveCheckoutSession(creds, {
      email: "faith@example.com",
      name: "Faith Giver",
      amountMajor: 5000,
      currency: "NGN",
      reference: "IGC-GIFT-1",
      redirectUrl: "https://church.example/give/callback?reference=IGC-GIFT-1",
      metadata: { donationId: "don_1", type: "tithe" },
    });
    expect(session.checkoutUrl).toBe("https://checkout.flutterwave.com/pay/abc");
    expect(session.reference).toBe("IGC-GIFT-1");
  });

  it("reuses an existing customer when create returns 409", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("openid-connect/token")) {
        return jsonResponse(200, { access_token: "tok_live", expires_in: 600 });
      }
      if (url.endsWith("/customers") && init?.method === "POST") {
        return jsonResponse(409, { status: "failed", message: "Customer exists" });
      }
      if (url.endsWith("/customers/search")) {
        return jsonResponse(200, {
          status: "success",
          data: [{ id: "cus_existing", email: "repeat@example.com" }],
        });
      }
      if (url.endsWith("/checkout/sessions")) {
        const body = JSON.parse(String(init?.body));
        expect(body.customer_id).toBe("cus_existing");
        return jsonResponse(200, {
          data: { checkout_url: "https://checkout.flutterwave.com/pay/repeat", reference: "IGC-2" },
        });
      }
      return jsonResponse(404, { message: `unexpected ${url}` });
    });
    vi.stubGlobal("fetch", fetchMock);

    const session = await createFlutterwaveCheckoutSession(creds, {
      email: "repeat@example.com",
      amountMajor: 1000,
      currency: "NGN",
      reference: "IGC-2",
      redirectUrl: "https://church.example/give/callback?reference=IGC-2",
    });
    expect(session.checkoutUrl).toContain("/pay/repeat");
  });

  it("maps a succeeded charge to a successful verification", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("openid-connect/token")) {
        return jsonResponse(200, { access_token: "tok_live", expires_in: 600 });
      }
      if (url.includes("/charges?reference=")) {
        return jsonResponse(200, {
          status: "success",
          data: [
            {
              id: "chg_1",
              reference: "IGC-GIFT-1",
              status: "succeeded",
              amount: 5000,
              payment_method: { type: "card" },
            },
          ],
        });
      }
      return jsonResponse(404, { message: `unexpected ${url}` });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await verifyFlutterwaveCharge(creds, "IGC-GIFT-1");
    expect(result.status).toBe("success");
    expect(result.amountMajor).toBe(5000);
    expect(result.channel).toBe("card");
  });
});
