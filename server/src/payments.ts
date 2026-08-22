import crypto from "node:crypto";
import { config } from "./config.js";
import {
  createFlutterwaveCheckoutSession,
  flutterwaveCredentials,
  isFlutterwaveConfigured,
  verifyFlutterwaveCharge,
  verifyFlutterwaveWebhookSignature as verifyFlwSig,
} from "./flutterwave.js";

export function isPaystackLive(): boolean {
  return config.payments.provider === "paystack" && !!config.payments.paystackSecretKey;
}

export function isFlutterwaveLive(): boolean {
  return config.payments.provider === "flutterwave" && isFlutterwaveConfigured();
}

export function isOnlineLive(): boolean {
  return isPaystackLive() || isFlutterwaveLive();
}

export type PaymentProvider = "paystack" | "flutterwave" | "dryrun";

export interface InitResult {
  provider: PaymentProvider;
  authorizationUrl: string;
  reference: string;
  accessCode?: string;
}

const PAYSTACK_BASE = "https://api.paystack.co";

/**
 * Initializes an online transaction. With Flutterwave v4 or Paystack
 * credentials this creates a hosted-checkout session. Without them it
 * returns a URL back to our own callback so the giving flow is testable.
 */
export async function initializeTransaction(params: {
  email: string;
  amountMajor: number; // in Naira (major units)
  reference: string;
  customerName?: string;
  metadata?: Record<string, unknown>;
}): Promise<InitResult> {
  const callbackUrl = `${config.appUrl}/give/callback?reference=${encodeURIComponent(params.reference)}`;

  if (isFlutterwaveLive()) {
    const session = await createFlutterwaveCheckoutSession(flutterwaveCredentials(), {
      email: params.email,
      name: params.customerName,
      amountMajor: params.amountMajor,
      currency: config.payments.currency,
      reference: params.reference,
      redirectUrl: callbackUrl,
      metadata: params.metadata,
    });
    return {
      provider: "flutterwave",
      authorizationUrl: session.checkoutUrl,
      reference: session.reference,
    };
  }

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
  return { provider: "dryrun", authorizationUrl: callbackUrl + "&simulated=1", reference: params.reference };
}

export interface VerifyResult {
  status: "success" | "failed" | "pending";
  amountMajor?: number;
  channel?: string;
  paidAt?: string;
  raw?: unknown;
}

export async function verifyTransaction(
  reference: string,
  extras: { chargeId?: string } = {},
): Promise<VerifyResult> {
  if (isFlutterwaveLive()) {
    return verifyFlutterwaveCharge(flutterwaveCredentials(), reference, {
      chargeId: extras.chargeId,
    });
  }

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

export function verifyFlutterwaveWebhookSignature(rawBody: Buffer, signature?: string): boolean {
  return verifyFlwSig(rawBody, signature);
}
