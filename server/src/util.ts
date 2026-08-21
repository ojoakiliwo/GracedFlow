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

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
