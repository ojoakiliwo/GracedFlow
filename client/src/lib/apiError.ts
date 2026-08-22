/** Live church site. Preview `*.vercel.app` URLs are often locked by Vercel SSO. */
export const LIVE_APP_ORIGIN = "https://graced-flow.vercel.app";

export function isLockedVercelHost(hostname: string): boolean {
  const host = hostname.toLowerCase().split(":")[0];
  if (host === "graced-flow.vercel.app") return false;
  if (host === "localhost" || host === "127.0.0.1") return false;
  return host.endsWith(".vercel.app");
}

export function vercelProtectionMessage(): string {
  return `This Vercel preview is locked, so church login cannot run here. Open the live site: ${LIVE_APP_ORIGIN}/login`;
}

function extractErrorString(data: unknown): string | null {
  if (typeof data === "string" && data.trim()) return data;
  if (!data || typeof data !== "object") return null;
  const rec = data as Record<string, unknown>;
  if (typeof rec.error === "string" && rec.error.trim()) return rec.error;
  if (rec.error && typeof rec.error === "object") {
    const nested = rec.error as Record<string, unknown>;
    if (typeof nested.message === "string" && nested.message.trim()) return nested.message;
  }
  if (typeof rec.message === "string" && rec.message.trim()) return rec.message;
  return null;
}

export function isVercelProtectionPayload(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const rec = data as Record<string, unknown>;
  if (rec.protection && typeof rec.protection === "object") return true;
  const nested =
    rec.error && typeof rec.error === "object" ? (rec.error as Record<string, unknown>) : null;
  const msg = typeof nested?.message === "string" ? nested.message : "";
  return msg.toLowerCase().includes("protected deployment");
}

/** Turns API / Vercel JSON failures into a string the login form can show. */
export function formatApiError(data: unknown, status: number, fallback = "Request failed"): string {
  if (isVercelProtectionPayload(data)) return vercelProtectionMessage();
  const extracted = extractErrorString(data);
  if (extracted) {
    if (extracted.toLowerCase().includes("protected deployment")) return vercelProtectionMessage();
    return extracted;
  }
  if (status === 0 || status === 502 || status === 503 || status === 504) {
    return `The church server did not respond. Try again, or open ${LIVE_APP_ORIGIN}/login`;
  }
  return fallback;
}
