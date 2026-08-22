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
  return !!config.payments.paystackSecretKey && config.payments.provider !== "dryrun";
}

export function isFlutterwaveLive(): boolean {
  return isFlutterwaveConfigured() && config.payments.provider !== "dryrun";
}

export function isOnlineLive(): boolean {
  return isPaystackLive() || isFlutterwaveLive();
}

export type PaymentProvider = "paystack" | "flutterwave" | "dryrun";

export function livePaymentProviders(): PaymentProvider[] {
  const live: PaymentProvider[] = [];
  if (isFlutterwaveLive()) live.push("flutterwave");
  if (isPaystackLive()) live.push("paystack");
  return live;
}

export function resolveCheckoutProvider(requested?: string | null): PaymentProvider {
  if (requested === "flutterwave" && isFlutterwaveLive()) return "flutterwave";
  if (requested === "paystack" && isPaystackLive()) return "paystack";
  if (requested === "dryrun") return "dryrun";

  if (config.payments.provider === "paystack" && isPaystackLive()) return "paystack";
  if (config.payments.provider === "flutterwave" && isFlutterwaveLive()) return "flutterwave";
  if (isFlutterwaveLive()) return "flutterwave";
  if (isPaystackLive()) return "paystack";
  return "dryrun";
}

export interface InitResult {
  provider: PaymentProvider;
  authorizationUrl: string;
  reference: string;
  accessCode?: string;
}

const PAYSTACK_BASE = "https://api.paystack.co";

function checkoutReturnUrl(reference: string, provider: PaymentProvider): string {
  const base = config.appUrl.replace(/\/$/, "");
  return `${base}/give/callback?reference=${encodeURIComponent(reference)}&provider=${encodeURIComponent(provider)}`;
}

/**
 * Initializes an online transaction. Flutterwave v4 and Paystack can both be
 * live; `provider` selects the checkout. Without keys, giving is simulated.
 */
export async function initializeTransaction(params: {
  email: string;
  amountMajor: number; // in Naira (major units)
  reference: string;
  customerName?: string;
  provider?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<InitResult> {
  const provider = resolveCheckoutProvider(params.provider);
  const callbackUrl = checkoutReturnUrl(params.reference, provider);

  if (provider === "flutterwave") {
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

  if (provider === "paystack") {
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

  return { provider: "dryrun", authorizationUrl: `${callbackUrl}&simulated=1`, reference: params.reference };
}

export interface VerifyResult {
  status: "success" | "failed" | "pending";
  amountMajor?: number;
  channel?: string;
  paidAt?: string;
  raw?: unknown;
}

async function verifyPaystackCharge(reference: string): Promise<VerifyResult> {
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
  const status = data.data.status;
  if (status === "success") {
    return {
      status: "success",
      amountMajor: data.data.amount / 100,
      channel: data.data.channel,
      paidAt: data.data.paid_at,
      raw: data,
    };
  }
  if (status === "abandoned" || status === "failed" || status === "reversed") {
    return { status: "failed", raw: data };
  }
  return { status: "pending", raw: data };
}

export async function verifyTransaction(
  reference: string,
  extras: { chargeId?: string; provider?: string | null } = {},
): Promise<VerifyResult> {
  const requested = extras.provider;
  if (requested === "flutterwave" || requested === "paystack" || requested === "dryrun") {
    const provider = resolveCheckoutProvider(requested);
    if (provider === "flutterwave") {
      return verifyFlutterwaveCharge(flutterwaveCredentials(), reference, {
        chargeId: extras.chargeId,
      });
    }
    if (provider === "paystack") {
      return verifyPaystackCharge(reference);
    }
    return { status: "success", channel: "simulated" };
  }

  // Stored provider unknown (older gifts) — try every live gateway.
  if (isFlutterwaveLive()) {
    const flw = await verifyFlutterwaveCharge(flutterwaveCredentials(), reference, {
      chargeId: extras.chargeId,
      attempts: 1,
      delayMs: 0,
    });
    if (flw.status === "success") return flw;
  }
  if (isPaystackLive()) {
    return verifyPaystackCharge(reference);
  }
  if (isFlutterwaveLive()) {
    return verifyFlutterwaveCharge(flutterwaveCredentials(), reference, {
      chargeId: extras.chargeId,
    });
  }

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
