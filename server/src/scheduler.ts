import cron from "node-cron";
import { config } from "./config.js";
import { db } from "./db.js";
import { createAndSendMessage } from "./messaging.js";
import { sendEmail, sendSms } from "./comms.js";
import { newId, nowIso } from "./util.js";

function logRun(job: string, detail: string, recipients: number): void {
  db.prepare(
    "INSERT INTO automation_runs (id, job, detail, recipients_count) VALUES (?, ?, ?, ?)",
  ).run(newId("run"), job, detail, recipients);
}

export async function runSundayReminder() {
  const summary = await createAndSendMessage({
    channel: "both",
    subject: "See you tomorrow at Infinitely Graced Church",
    body: "Hello {{first_name}}, this is a loving reminder about our Sunday Service tomorrow. Come expectant — His infinite grace awaits you! God bless you.",
    audienceType: "all",
    category: "auto:sunday_reminder",
  });
  logRun("sunday_reminder", `Sent to ${summary.sent} deliveries`, summary.recipients);
  return summary;
}

export async function runPrayerReminder() {
  const summary = await createAndSendMessage({
    channel: "both",
    subject: "Wednesday Prayer Meeting today",
    body: "Good morning {{first_name}}! Remember our Wednesday Prayer Meeting today. Let us gather and press in together. See you there!",
    audienceType: "all",
    category: "auto:prayer_reminder",
  });
  logRun("prayer_reminder", `Sent to ${summary.sent} deliveries`, summary.recipients);
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

  const birthdays = resolveCelebrants("date_of_birth", mmdd);
  const anniversaries = resolveCelebrants("wedding_anniversary", mmdd);
  let count = 0;

  for (const m of birthdays) {
    await sendPrivate(
      m,
      "Happy Birthday from your church family!",
      `Happy Birthday, ${m.first_name}! The whole family at Infinitely Graced Church celebrates you today. May God's infinite grace crown this new year of your life with joy, health and testimonies. We love you!`,
    );
    count++;
  }
  for (const m of anniversaries) {
    await sendPrivate(
      m,
      "Happy Wedding Anniversary!",
      `Happy Wedding Anniversary, ${m.first_name}! We thank God for your union. May His grace continue to strengthen and beautify your marriage. Congratulations from all of us at Infinitely Graced Church!`,
    );
    count++;
  }

  logRun(
    "celebrations",
    `Birthdays: ${birthdays.length}, Anniversaries: ${anniversaries.length}`,
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

function resolveCelebrants(column: string, mmdd: string): Celebrant[] {
  return db
    .prepare(
      `SELECT id, first_name, last_name, email, phone FROM members
       WHERE ${column} IS NOT NULL AND substr(${column}, 6, 5) = ?
       AND membership_status != 'inactive'`,
    )
    .all(mmdd) as Celebrant[];
}

async function sendPrivate(m: Celebrant, subject: string, body: string): Promise<void> {
  const messageId = newId("msg");
  db.prepare(
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
    db.prepare(
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
