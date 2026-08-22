import crypto from "node:crypto";
import { config } from "./config.js";
import { newId } from "./util.js";

const TOKEN_URL =
  "https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token";
const SANDBOX_BASE = "https://developersandbox-api.flutterwave.com";
const LIVE_BASE = "https://f4bexperience.flutterwave.com";

export interface FlutterwaveCredentials {
  clientId: string;
  clientSecret: string;
  encryptionKey: string;
  secretHash: string;
  env: "live" | "sandbox";
  baseUrl?: string;
}

export function flutterwaveCredentials(): FlutterwaveCredentials {
  return {
    clientId: config.payments.flutterwaveClientId,
    clientSecret: config.payments.flutterwaveClientSecret,
    encryptionKey: config.payments.flutterwaveEncryptionKey,
    secretHash: config.payments.flutterwaveSecretHash,
    env: config.payments.flutterwaveEnv,
    baseUrl: config.payments.flutterwaveBaseUrl,
  };
}

export function flutterwaveApiBase(creds: FlutterwaveCredentials = flutterwaveCredentials()): string {
  if (creds.baseUrl) return creds.baseUrl.replace(/\/$/, "");
  return creds.env === "sandbox" ? SANDBOX_BASE : LIVE_BASE;
}

export function isFlutterwaveConfigured(
  creds: FlutterwaveCredentials = flutterwaveCredentials(),
): boolean {
  return !!creds.clientId && !!creds.clientSecret;
}

interface CachedToken {
  accessToken: string;
  expiresAtMs: number;
}

const tokenCache = new Map<string, CachedToken>();

export function resetFlutterwaveTokenCache(): void {
  tokenCache.clear();
}

function headerKey(): string {
  return newId("flw").replace(/[^a-zA-Z0-9]/g, "").slice(0, 40);
}

export async function getFlutterwaveAccessToken(
  creds: FlutterwaveCredentials = flutterwaveCredentials(),
): Promise<string> {
  const cached = tokenCache.get(creds.clientId);
  if (cached && Date.now() < cached.expiresAtMs - 60_000) {
    return cached.accessToken;
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      grant_type: "client_credentials",
    }),
  });
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(
      data.error_description || data.error || "Flutterwave OAuth token request failed",
    );
  }
  tokenCache.set(creds.clientId, {
    accessToken: data.access_token,
    expiresAtMs: Date.now() + (data.expires_in ?? 600) * 1000,
  });
  return data.access_token;
}

interface FlutterwaveErrorBody {
  status?: string;
  message?: string;
  error?: { message?: string; type?: string; code?: string };
  data?: unknown;
}

function flutterwaveErrorMessage(body: FlutterwaveErrorBody, fallback: string): string {
  return body.error?.message || body.message || fallback;
}

async function flutterwaveFetch<T>(
  creds: FlutterwaveCredentials,
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; body: T & FlutterwaveErrorBody }> {
  const token = await getFlutterwaveAccessToken(creds);
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json");
  headers.set("X-Trace-Id", headerKey());
  if (init.method && init.method !== "GET") {
    headers.set("X-Idempotency-Key", headerKey());
  }
  const res = await fetch(`${flutterwaveApiBase(creds)}${path}`, {
    ...init,
    headers,
  });
  const body = (await res.json()) as T & FlutterwaveErrorBody;
  return { status: res.status, body };
}

function splitName(fullName?: string): { first: string; last: string } | undefined {
  if (!fullName) return undefined;
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return undefined;
  const first = parts[0];
  const last = parts.slice(1).join(" ");
  const valid = /^(?![ ,.'-]*$)[A-Za-z ,.'-]{2,50}$/;
  if (!valid.test(first) || !valid.test(last)) return undefined;
  return { first, last };
}

async function findCustomerIdByEmail(
  creds: FlutterwaveCredentials,
  email: string,
): Promise<string | undefined> {
  const search = await flutterwaveFetch<{ data?: { id?: string } | Array<{ id?: string; email?: string }> }>(
    creds,
    "/customers/search",
    { method: "POST", body: JSON.stringify({ email }) },
  );
  const data = search.body.data;
  if (Array.isArray(data)) {
    const match = data.find((c) => c.email?.toLowerCase() === email.toLowerCase()) ?? data[0];
    return match?.id;
  }
  if (data && typeof data === "object" && "id" in data) return data.id;

  const list = await flutterwaveFetch<{ data?: Array<{ id?: string; email?: string }> }>(
    creds,
    `/customers?email=${encodeURIComponent(email)}`,
    { method: "GET" },
  );
  const rows = Array.isArray(list.body.data) ? list.body.data : [];
  return rows.find((c) => c.email?.toLowerCase() === email.toLowerCase())?.id ?? rows[0]?.id;
}

export async function getOrCreateFlutterwaveCustomer(
  creds: FlutterwaveCredentials,
  params: { email: string; name?: string },
): Promise<string> {
  const payload: Record<string, unknown> = { email: params.email };
  const name = splitName(params.name);
  if (name) payload.name = name;

  const created = await flutterwaveFetch<{ data?: { id?: string } }>(creds, "/customers", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if ((created.status === 200 || created.status === 201) && created.body.data?.id) {
    return created.body.data.id;
  }
  if (created.status === 409) {
    const existing = await findCustomerIdByEmail(creds, params.email);
    if (existing) return existing;
  }
  throw new Error(flutterwaveErrorMessage(created.body, "Flutterwave customer create failed"));
}

export interface FlutterwaveCheckoutResult {
  checkoutUrl: string;
  reference: string;
  sessionId?: string;
}

export async function createFlutterwaveCheckoutSession(
  creds: FlutterwaveCredentials,
  params: {
    email: string;
    name?: string;
    amountMajor: number;
    currency: string;
    reference: string;
    redirectUrl: string;
    metadata?: Record<string, unknown>;
  },
): Promise<FlutterwaveCheckoutResult> {
  const customerId = await getOrCreateFlutterwaveCustomer(creds, {
    email: params.email,
    name: params.name,
  });

  const created = await flutterwaveFetch<{
    data?: { checkout_url?: string; id?: string; reference?: string };
  }>(creds, "/checkout/sessions", {
    method: "POST",
    body: JSON.stringify({
      amount: params.amountMajor,
      currency: params.currency,
      reference: params.reference,
      customer_id: customerId,
      redirect_url: params.redirectUrl,
      session_duration: 60,
      meta: stringifyMeta(params.metadata),
    }),
  });

  const url = created.body.data?.checkout_url;
  if ((created.status === 200 || created.status === 201) && url) {
    return {
      checkoutUrl: url,
      reference: created.body.data?.reference ?? params.reference,
      sessionId: created.body.data?.id,
    };
  }
  throw new Error(flutterwaveErrorMessage(created.body, "Flutterwave checkout session failed"));
}

function stringifyMeta(meta?: Record<string, unknown>): Record<string, string> | undefined {
  if (!meta) return undefined;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (value === undefined || value === null) continue;
    out[key] = typeof value === "string" ? value : JSON.stringify(value);
  }
  return out;
}

export interface FlutterwaveChargeView {
  status: "success" | "failed" | "pending";
  amountMajor?: number;
  channel?: string;
  raw?: unknown;
}

export interface VerifyFlutterwaveOptions {
  /** Flutterwave charge id from the checkout redirect (`id`, `transaction_id`). */
  chargeId?: string;
  /** How many times to re-query Flutterwave. Default 3 — checkout can lag the redirect. */
  attempts?: number;
  /** Delay between attempts in ms. Use 0 in tests. */
  delayMs?: number;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapChargeStatus(status?: string): FlutterwaveChargeView["status"] {
  const normalized = (status ?? "").toLowerCase();
  if (normalized === "succeeded" || normalized === "successful" || normalized === "success") {
    return "success";
  }
  if (normalized === "pending" || normalized === "processing") return "pending";
  return "failed";
}

function chargeFromUnknown(raw: unknown): FlutterwaveChargeView | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const data = raw as {
    status?: string;
    amount?: number;
    payment_method?: { type?: string };
    payment_method_details?: { type?: string };
  };
  if (!data.status && data.amount === undefined) return undefined;
  return {
    status: mapChargeStatus(data.status),
    amountMajor: typeof data.amount === "number" ? data.amount : undefined,
    channel: data.payment_method?.type ?? data.payment_method_details?.type,
    raw,
  };
}

async function fetchChargeById(
  creds: FlutterwaveCredentials,
  chargeId: string,
): Promise<FlutterwaveChargeView | undefined> {
  const res = await flutterwaveFetch<{ data?: unknown }>(
    creds,
    `/charges/${encodeURIComponent(chargeId)}`,
    { method: "GET" },
  );
  return chargeFromUnknown(res.body.data) ?? chargeFromUnknown(res.body);
}

async function fetchChargeByReference(
  creds: FlutterwaveCredentials,
  reference: string,
): Promise<{ view?: FlutterwaveChargeView; raw: unknown }> {
  const listed = await flutterwaveFetch<{ data?: unknown }>(
    creds,
    `/charges?reference=${encodeURIComponent(reference)}`,
    { method: "GET" },
  );
  const payload = listed.body.data;
  const rows = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { items?: unknown[] }).items)
      ? (payload as { items: unknown[] }).items
      : payload
        ? [payload]
        : [];
  const match =
    rows.find((row) => {
      if (!row || typeof row !== "object") return false;
      return (row as { reference?: string }).reference === reference;
    }) ?? rows[0];
  return { view: chargeFromUnknown(match), raw: listed.body };
}

/**
 * Confirms a gift by calling Flutterwave's Charges API — no webhook required.
 * Used when the donor is redirected back to /give/callback.
 */
export async function verifyFlutterwaveCharge(
  creds: FlutterwaveCredentials,
  reference: string,
  options: VerifyFlutterwaveOptions = {},
): Promise<FlutterwaveChargeView> {
  const attempts = Math.max(1, options.attempts ?? 3);
  const delayMs = options.delayMs ?? 700;
  let lastRaw: unknown;

  for (let i = 0; i < attempts; i++) {
    if (options.chargeId) {
      const byId = await fetchChargeById(creds, options.chargeId);
      if (byId?.status === "success") return byId;
      if (byId?.status === "failed") return byId;
      if (byId) lastRaw = byId.raw;
    }

    const byRef = await fetchChargeByReference(creds, reference);
    lastRaw = byRef.raw;
    if (byRef.view?.status === "success") return byRef.view;
    if (byRef.view?.status === "failed") return byRef.view;
    if (byRef.view?.status === "pending" && i === attempts - 1) return byRef.view;

    if (i < attempts - 1 && delayMs > 0) await wait(delayMs);
  }

  // Charge not visible yet (or checkout abandoned). Treat as pending so the
  // callback page can retry — do not mark a just-paid gift as failed.
  return { status: "pending", raw: lastRaw };
}

/** HMAC-SHA256 (base64) of the raw webhook body using the dashboard secret hash. */
export function verifyFlutterwaveWebhookSignature(
  rawBody: Buffer,
  signature: string | undefined,
  secretHash: string = flutterwaveCredentials().secretHash,
): boolean {
  if (!secretHash || !signature) return false;
  const hash = crypto.createHmac("sha256", secretHash).update(rawBody).digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
  } catch {
    return false;
  }
}

/**
 * Encrypts a single field with the v4 encryption key (AES-256-GCM).
 * Required only for direct card charges — hosted checkout does not send card data.
 */
export function encryptFlutterwaveField(
  plainText: string,
  encryptionKeyB64: string,
  nonce: string,
): string {
  if (nonce.length !== 12) {
    throw new Error("Nonce must be exactly 12 characters long");
  }
  const key = Buffer.from(encryptionKeyB64, "base64");
  const iv = Buffer.from(nonce, "utf8");
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  return Buffer.concat([encrypted, cipher.getAuthTag()]).toString("base64");
}

export function generateFlutterwaveNonce(length = 12): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += chars[bytes[i] % chars.length];
  return out;
}
