import crypto from "node:crypto";
import { config } from "./config.js";

export type PaymentProvider = "flutterwave" | "paystack" | "dryrun";

/** The effective provider — only "live" when its credentials are present. */
export function paymentProvider(): PaymentProvider {
  const p = config.payments.provider;
  if (p === "flutterwave" && config.payments.flw.clientId && config.payments.flw.clientSecret)
    return "flutterwave";
  if (p === "paystack" && config.payments.paystackSecretKey) return "paystack";
  return "dryrun";
}

export function isPaymentsLive(): boolean {
  return paymentProvider() !== "dryrun";
}
export function isPaystackLive(): boolean {
  return paymentProvider() === "paystack";
}
export function isFlutterwaveLive(): boolean {
  return paymentProvider() === "flutterwave";
}
export function paymentProviderLabel(): string {
  const p = paymentProvider();
  return p === "flutterwave" ? "Flutterwave" : p === "paystack" ? "Paystack" : "Simulated";
}

export interface InitResult {
  provider: PaymentProvider;
  authorizationUrl: string;
  reference: string;
}

export interface VerifyResult {
  status: "success" | "failed" | "pending";
  amountMajor?: number;
  channel?: string;
  raw?: unknown;
}

const PAYSTACK_BASE = "https://api.paystack.co";

// ---------------------------------------------------------------------------
// Flutterwave V4 (OAuth 2.0 + hosted checkout session)
// ---------------------------------------------------------------------------

let flwToken: { token: string; expMs: number } | null = null;

async function flwAccessToken(): Promise<string> {
  const now = Date.now();
  if (flwToken && flwToken.expMs - 30_000 > now) return flwToken.token;
  const body = new URLSearchParams({
    client_id: config.payments.flw.clientId,
    client_secret: config.payments.flw.clientSecret,
    grant_type: "client_credentials",
  });
  const res = await fetch(config.payments.flw.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(
      data.error_description || data.error || `Flutterwave auth failed (${res.status})`,
    );
  }
  flwToken = { token: data.access_token, expMs: now + (data.expires_in ?? 600) * 1000 };
  return flwToken.token;
}

async function flwCreateCheckout(params: {
  amountMajor: number;
  reference: string;
  redirectUrl: string;
}): Promise<string> {
  const token = await flwAccessToken();
  const res = await fetch(`${config.payments.flw.baseUrl}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Trace-Id": crypto.randomUUID(),
      "X-Idempotency-Key": params.reference,
    },
    body: JSON.stringify({
      amount: params.amountMajor,
      currency: config.payments.currency,
      reference: params.reference,
      redirect_url: params.redirectUrl,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    data?: { checkout_url?: string };
    message?: string;
    error?: { message?: string };
  };
  const url = data?.data?.checkout_url;
  if (!res.ok || !url) {
    throw new Error(
      data?.error?.message || data?.message || `Flutterwave checkout failed (${res.status})`,
    );
  }
  return url;
}

/** Verifies a Flutterwave V4 webhook (flutterwave-signature: HMAC-SHA256 base64). */
export function verifyFlutterwaveSignature(rawBody: Buffer, signature?: string): boolean {
  const secret = config.payments.flw.secretHash;
  if (!secret || !signature) return false;
  // Flutterwave documents two schemes; accept either the direct secret-hash
  // match or the HMAC-SHA256 (base64) of the raw body.
  if (signature === secret) return true;
  const hmac = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(signature));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Paystack
// ---------------------------------------------------------------------------

async function paystackInitialize(params: {
  email: string;
  amountMajor: number;
  reference: string;
  metadata?: Record<string, unknown>;
  callbackUrl: string;
}): Promise<string> {
  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.payments.paystackSecretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: params.email,
      amount: Math.round(params.amountMajor * 100),
      currency: config.payments.currency,
      reference: params.reference,
      callback_url: params.callbackUrl,
      metadata: params.metadata ?? {},
    }),
  });
  const data = (await res.json()) as {
    status: boolean;
    message: string;
    data?: { authorization_url: string };
  };
  if (!res.ok || !data.status || !data.data) {
    throw new Error(data.message || "Paystack initialization failed");
  }
  return data.data.authorization_url;
}

export function verifyPaystackSignature(rawBody: Buffer, signature?: string): boolean {
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

// ---------------------------------------------------------------------------
// Provider-agnostic entry points
// ---------------------------------------------------------------------------

/**
 * Starts a hosted payment and returns the URL to redirect the donor to. Falls
 * back to a self-contained simulated checkout when no provider is configured.
 */
export async function initializeTransaction(params: {
  email: string;
  amountMajor: number;
  reference: string;
  metadata?: Record<string, unknown>;
}): Promise<InitResult> {
  const provider = paymentProvider();
  const callbackUrl = `${config.appUrl}/give/callback`;

  if (provider === "flutterwave") {
    const url = await flwCreateCheckout({
      amountMajor: params.amountMajor,
      reference: params.reference,
      redirectUrl: callbackUrl,
    });
    return { provider, authorizationUrl: url, reference: params.reference };
  }

  if (provider === "paystack") {
    const url = await paystackInitialize({ ...params, callbackUrl });
    return { provider, authorizationUrl: url, reference: params.reference };
  }

  return {
    provider: "dryrun",
    authorizationUrl: `${callbackUrl}?reference=${encodeURIComponent(
      params.reference,
    )}&simulated=1`,
    reference: params.reference,
  };
}

/**
 * Confirms a transaction. Paystack is verified via its API; Flutterwave is
 * confirmed by its signed webhook (this returns "pending" so the donation
 * stays pending until the webhook lands); dry-run always succeeds.
 */
export async function verifyTransaction(reference: string): Promise<VerifyResult> {
  const provider = paymentProvider();

  if (provider === "paystack") {
    const res = await fetch(
      `${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${config.payments.paystackSecretKey}` } },
    );
    const data = (await res.json()) as {
      status: boolean;
      data?: { status: string; amount: number; channel: string };
    };
    if (!res.ok || !data.status || !data.data) return { status: "failed", raw: data };
    return {
      status: data.data.status === "success" ? "success" : "failed",
      amountMajor: data.data.amount / 100,
      channel: data.data.channel,
    };
  }

  if (provider === "flutterwave") {
    // Confirmation happens via the signed webhook; the caller treats the DB
    // donation status as the source of truth.
    return { status: "pending" };
  }

  return { status: "success", channel: "simulated" };
}
