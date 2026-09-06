import cron from "node-cron";
import { config } from "./config.js";
import { db } from "./db.js";
import { createAndSendMessage, personalize } from "./messaging.js";
import { sendEmail, sendSms } from "./comms.js";
import { newId, nowIso } from "./util.js";
import {
  parseAutomationDate,
  pickAutomationCopy,
  type AutomationCopyKind,
} from "./automationCopy.js";

async function logRun(job: string, detail: string, recipients: number): Promise<void> {
  await db
    .prepare(
      "INSERT INTO automation_runs (id, job, detail, recipients_count) VALUES (?, ?, ?, ?)",
    )
    .run(newId("run"), job, detail, recipients);
}

function copyFor(kind: AutomationCopyKind, date?: Date | string | null) {
  return pickAutomationCopy(kind, parseAutomationDate(date), config.scheduler.timezone);
}

export async function runSundayReminder(date?: Date | string | null) {
  const copy = copyFor("sunday", date);
  const summary = await createAndSendMessage({
    channel: "both",
    subject: copy.subject,
    body: copy.body,
    audienceType: "all",
    category: "auto:sunday_reminder",
  });
  await logRun(
    "sunday_reminder",
    `Copy ${copy.index + 1}/${copy.total} · sent to ${summary.sent} deliveries`,
    summary.recipients,
  );
  return summary;
}

export async function runPrayerReminder(date?: Date | string | null) {
  const copy = copyFor("prayer", date);
  const summary = await createAndSendMessage({
    channel: "both",
    subject: copy.subject,
    body: copy.body,
    audienceType: "all",
    category: "auto:prayer_reminder",
  });
  await logRun(
    "prayer_reminder",
    `Copy ${copy.index + 1}/${copy.total} · sent to ${summary.sent} deliveries`,
    summary.recipients,
  );
  return summary;
}

/**
 * Sends private birthday and wedding-anniversary greetings to members whose
 * celebration falls on the given date (defaults to today).
 */
export async function runCelebrations(dateIso?: string) {
  const target = dateIso ? new Date(dateIso) : new Date();
  const mmdd = `${String(target.getMonth() + 1).padStart(2, "0")}-${String(
    target.getDate(),
  ).padStart(2, "0")}`;

  const birthdays = await resolveCelebrants("date_of_birth", mmdd);
  const anniversaries = await resolveCelebrants("wedding_anniversary", mmdd);
  let count = 0;

  const birthdayCopy = copyFor("birthday", target);
  const anniversaryCopy = copyFor("anniversary", target);

  for (const m of birthdays) {
    await sendPrivate(
      m,
      personalize(birthdayCopy.subject, m),
      personalize(birthdayCopy.body, m),
    );
    count++;
  }
  for (const m of anniversaries) {
    await sendPrivate(
      m,
      personalize(anniversaryCopy.subject, m),
      personalize(anniversaryCopy.body, m),
    );
    count++;
  }

  await logRun(
    "celebrations",
    `Birthdays: ${birthdays.length} (copy ${birthdayCopy.index + 1}/${birthdayCopy.total}), Anniversaries: ${anniversaries.length} (copy ${anniversaryCopy.index + 1}/${anniversaryCopy.total})`,
    count,
  );
  return { birthdays: birthdays.length, anniversaries: anniversaries.length };
}

interface Celebrant {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
}

async function resolveCelebrants(column: string, mmdd: string): Promise<Celebrant[]> {
  return await db.prepare(
      `SELECT id, first_name, last_name, email, phone FROM members
       WHERE ${column} IS NOT NULL AND substring(${column} from 6 for 5) = ?
       AND membership_status != 'inactive'`,
    )
    .all<Celebrant>(mmdd);
}

async function sendPrivate(m: Celebrant, subject: string, body: string): Promise<void> {
  const messageId = newId("msg");
  await db.prepare(
    `INSERT INTO messages (id, channel, subject, body, audience_type, audience_value, status, recipients_count, category, sent_at)
     VALUES (?, 'both', ?, ?, 'individual', ?, 'sent', 1, 'auto:celebration', ?)`,
  ).run(messageId, subject, body, m.id, nowIso());

  for (const [channel, to] of [
    ["sms", m.phone],
    ["email", m.email],
  ] as const) {
    if (!to) continue;
    const result =
      channel === "sms" ? await sendSms(to, body) : await sendEmail(to, subject, body);
    await db.prepare(
      `INSERT INTO message_recipients (id, message_id, member_id, channel, to_address, recipient_name, status, provider, sent_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      newId("rcpt"),
      messageId,
      m.id,
      channel,
      to,
      `${m.first_name} ${m.last_name}`,
      result.ok ? "sent" : "failed",
      result.provider,
      nowIso(),
    );
  }
}

export function registerSchedules(): void {
  if (config.isServerless) {
    // On serverless (e.g. Vercel) there is no always-on process; automations run
    // via HTTP cron endpoints (/api/cron/:job) triggered by Vercel Cron instead.
    // eslint-disable-next-line no-console
    console.log("[scheduler] serverless mode — using cron endpoints");
    return;
  }
  if (!config.scheduler.enabled) {
    // eslint-disable-next-line no-console
    console.log("[scheduler] disabled");
    return;
  }
  const tz = config.scheduler.timezone;

  // Saturday 6:00 PM — reminder for Sunday service.
  cron.schedule("0 18 * * 6", () => void runSundayReminder(), { timezone: tz });
  // Wednesday 6:00 AM — reminder for the prayer meeting.
  cron.schedule("0 6 * * 3", () => void runPrayerReminder(), { timezone: tz });
  // Every day 7:00 AM — birthday & anniversary greetings.
  cron.schedule("0 7 * * *", () => void runCelebrations(), { timezone: tz });

  // eslint-disable-next-line no-console
  console.log(`[scheduler] registered (timezone ${tz})`);
}
