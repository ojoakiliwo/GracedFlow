import { db } from "./db.js";
import { sendEmail, sendSms } from "./comms.js";
import { newId, nowIso } from "./util.js";

export interface MemberContact {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
}

export type AudienceType =
  | "all"
  | "class"
  | "department"
  | "role"
  | "individual"
  | "custom";

export function resolveAudience(
  audienceType: AudienceType,
  audienceValue?: string | null,
): MemberContact[] {
  const base =
    "SELECT DISTINCT m.id, m.first_name, m.last_name, m.email, m.phone FROM members m";
  switch (audienceType) {
    case "all":
      return db
        .prepare(`${base} WHERE m.membership_status != 'inactive'`)
        .all() as MemberContact[];
    case "class":
      return db
        .prepare(`${base} WHERE m.spiritual_class = ?`)
        .all(audienceValue) as MemberContact[];
    case "role":
      return db.prepare(`${base} WHERE m.role = ?`).all(audienceValue) as MemberContact[];
    case "department":
      return db
        .prepare(
          `${base} JOIN department_members dm ON dm.member_id = m.id WHERE dm.department_id = ?`,
        )
        .all(audienceValue) as MemberContact[];
    case "individual":
      return db.prepare(`${base} WHERE m.id = ?`).all(audienceValue) as MemberContact[];
    case "custom": {
      const ids: string[] = audienceValue ? JSON.parse(audienceValue) : [];
      if (ids.length === 0) return [];
      const placeholders = ids.map(() => "?").join(",");
      return db
        .prepare(`${base} WHERE m.id IN (${placeholders})`)
        .all(...ids) as MemberContact[];
    }
    default:
      return [];
  }
}

export function personalize(template: string, member: MemberContact): string {
  return template
    .replaceAll("{{first_name}}", member.first_name)
    .replaceAll("{{last_name}}", member.last_name)
    .replaceAll("{{name}}", `${member.first_name} ${member.last_name}`);
}

export interface CreateMessageInput {
  channel: "sms" | "email" | "both";
  subject?: string | null;
  body: string;
  audienceType: AudienceType;
  audienceValue?: string | null;
  category?: string;
  createdBy?: string | null;
}

export interface SendSummary {
  messageId: string;
  recipients: number;
  sent: number;
  failed: number;
  skipped: number;
}

/**
 * Creates a message, expands the audience into an outbox, and dispatches it via
 * the SMS/email adapters. Every attempt is persisted in message_recipients.
 */
export async function createAndSendMessage(
  input: CreateMessageInput,
): Promise<SendSummary> {
  const recipients = resolveAudience(input.audienceType, input.audienceValue);
  const messageId = newId("msg");

  db.prepare(
    `INSERT INTO messages (id, channel, subject, body, audience_type, audience_value, status, recipients_count, category, created_by)
     VALUES (?, ?, ?, ?, ?, ?, 'sending', ?, ?, ?)`,
  ).run(
    messageId,
    input.channel,
    input.subject ?? null,
    input.body,
    input.audienceType,
    input.audienceValue ?? null,
    recipients.length,
    input.category ?? "manual",
    input.createdBy ?? null,
  );

  const channels: ("sms" | "email")[] =
    input.channel === "both" ? ["sms", "email"] : [input.channel];

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const member of recipients) {
    const personalBody = personalize(input.body, member);
    const personalSubject = input.subject
      ? personalize(input.subject, member)
      : "Infinitely Graced Church";

    for (const channel of channels) {
      const to = channel === "sms" ? member.phone : member.email;
      const recipientId = newId("rcpt");
      if (!to) {
        db.prepare(
          `INSERT INTO message_recipients (id, message_id, member_id, channel, to_address, recipient_name, status, error)
           VALUES (?, ?, ?, ?, ?, ?, 'skipped', ?)`,
        ).run(
          recipientId,
          messageId,
          member.id,
          channel,
          null,
          `${member.first_name} ${member.last_name}`,
          `No ${channel} address on file`,
        );
        skipped++;
        continue;
      }
      const result =
        channel === "sms"
          ? await sendSms(to, personalBody)
          : await sendEmail(to, personalSubject, personalBody);

      db.prepare(
        `INSERT INTO message_recipients (id, message_id, member_id, channel, to_address, recipient_name, status, provider, error, sent_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        recipientId,
        messageId,
        member.id,
        channel,
        to,
        `${member.first_name} ${member.last_name}`,
        result.ok ? "sent" : "failed",
        result.provider,
        result.error ?? null,
        result.ok ? nowIso() : null,
      );
      if (result.ok) sent++;
      else failed++;
    }
  }

  db.prepare("UPDATE messages SET status = 'sent', sent_at = ? WHERE id = ?").run(
    nowIso(),
    messageId,
  );

  return { messageId, recipients: recipients.length, sent, failed, skipped };
}
