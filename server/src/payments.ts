import crypto from "node:crypto";
import { config } from "./config.js";

export function isPaystackLive(): boolean {
  return config.payments.provider === "paystack" && !!config.payments.paystackSecretKey;
}

export interface InitResult {
  provider: "paystack" | "dryrun";
  authorizationUrl: string;
  reference: string;
  accessCode?: string;
}

const PAYSTACK_BASE = "https://api.paystack.co";

/**
 * Initializes an online transaction. With a Paystack secret key, this creates a
 * real hosted-checkout session and returns its authorization URL. Without one,
 * it returns a URL back to our own callback so the giving flow is fully testable
 * end-to-end in simulated mode.
 */
export async function initializeTransaction(params: {
  email: string;
  amountMajor: number; // in Naira (major units)
  reference: string;
  metadata?: Record<string, unknown>;
}): Promise<InitResult> {
  const callbackUrl = `${config.appUrl}/give/callback`;

  if (isPaystackLive()) {
    const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.payments.paystackSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: params.email,
        amount: Math.round(params.amountMajor * 100), // kobo
        currency: config.payments.currency,
        reference: params.reference,
        callback_url: callbackUrl,
        metadata: params.metadata ?? {},
      }),
    });
    const data = (await res.json()) as {
      status: boolean;
      message: string;
      data?: { authorization_url: string; access_code: string; reference: string };
    };
    if (!res.ok || !data.status || !data.data) {
      throw new Error(data.message || "Paystack initialization failed");
    }
    return {
      provider: "paystack",
      authorizationUrl: data.data.authorization_url,
      reference: data.data.reference,
      accessCode: data.data.access_code,
    };
  }

  // Simulated: bounce back to our callback which will "verify" successfully.
  const url = `${callbackUrl}?reference=${encodeURIComponent(
    params.reference,
  )}&simulated=1`;
  return { provider: "dryrun", authorizationUrl: url, reference: params.reference };
}

export interface VerifyResult {
  status: "success" | "failed" | "pending";
  amountMajor?: number;
  channel?: string;
  paidAt?: string;
  raw?: unknown;
}

export async function verifyTransaction(reference: string): Promise<VerifyResult> {
  if (isPaystackLive()) {
    const res = await fetch(
      `${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: { Authorization: `Bearer ${config.payments.paystackSecretKey}` },
      },
    );
    const data = (await res.json()) as {
      status: boolean;
      data?: { status: string; amount: number; channel: string; paid_at: string };
    };
    if (!res.ok || !data.status || !data.data) {
      return { status: "failed", raw: data };
    }
    return {
      status: data.data.status === "success" ? "success" : "failed",
      amountMajor: data.data.amount / 100,
      channel: data.data.channel,
      paidAt: data.data.paid_at,
      raw: data,
    };
  }
  // Simulated verification always succeeds.
  return { status: "success", channel: "simulated" };
}

/** Verifies a Paystack webhook signature (HMAC SHA512 of the raw body). */
export function verifyWebhookSignature(rawBody: Buffer, signature?: string): boolean {
  if (!config.payments.paystackSecretKey || !signature) return false;
  const hash = crypto
    .createHmac("sha512", config.payments.paystackSecretKey)
    .update(rawBody)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
  } catch {
    return false;
  }
}
