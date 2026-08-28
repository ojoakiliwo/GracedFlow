import { randomUUID } from "node:crypto";
import { db } from "./db.js";

export function newId(prefix = ""): string {
  const uuid = randomUUID();
  return prefix ? `${prefix}_${uuid}` : uuid;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function audit(
  action: string,
  entity: string,
  entityId: string | null,
  actor?: { id?: string; name?: string },
  meta?: unknown,
): void {
  // Fire-and-forget; audit failures must never break the primary request.
  db.prepare(
    `INSERT INTO audit_log (id, actor_id, actor_name, action, entity, entity_id, meta)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .run(
      newId("aud"),
      actor?.id ?? null,
      actor?.name ?? null,
      action,
      entity,
      entityId,
      meta ? JSON.stringify(meta) : null,
    )
    .catch((e: Error) => {
      // eslint-disable-next-line no-console
      console.error("[audit] failed", e.message);
    });
}

/** Last 10 digits so +2348012345678 and 08012345678 match. */
export function phoneKey(phone: string | null | undefined): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return "";
  const local = digits.startsWith("234") ? digits.slice(3) : digits.startsWith("0") ? digits.slice(1) : digits;
  return local.slice(-10);
}

export function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (phone.trim().startsWith("+")) return `+${digits}`;
  if (digits.startsWith("234")) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 11) return `+234${digits.slice(1)}`;
  return digits ? `+${digits}` : "";
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
