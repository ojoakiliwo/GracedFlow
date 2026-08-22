import nodemailer from "nodemailer";
import { config, emailIsConfigured, resolveSmsProvider } from "./config.js";
import { toE164 } from "./util.js";

export interface DeliveryResult {
  ok: boolean;
  provider: string;
  error?: string;
}

function smsMsisdn(to: string): string {
  return toE164(to).replace(/^\+/, "");
}

async function sendSmsTwilio(to: string, body: string): Promise<DeliveryResult> {
  const { twilioAccountSid, twilioAuthToken, twilioFrom } = config.sms;
  if (!twilioAccountSid || !twilioAuthToken || !twilioFrom) {
    return { ok: false, provider: "twilio", error: "Twilio credentials are incomplete" };
  }
  try {
    const params = new URLSearchParams({ To: toE164(to), From: twilioFrom, Body: body });
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization:
            "Basic " + Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      },
    );
    if (!res.ok) {
      return { ok: false, provider: "twilio", error: `Twilio ${res.status}` };
    }
    return { ok: true, provider: "twilio" };
  } catch (e) {
    return { ok: false, provider: "twilio", error: (e as Error).message };
  }
}

async function sendSmsBulkNigeria(to: string, body: string): Promise<DeliveryResult> {
  const token =
    process.env.BULKSMS_API_TOKEN || process.env.BULKSMSNIGERIA_API_TOKEN || "";
  const from = (process.env.BULKSMS_SENDER_ID || config.church.shortName || "IGC").slice(0, 11);
  const gateway = process.env.BULKSMS_GATEWAY || "direct-corporate";
  if (!token) {
    return { ok: false, provider: "bulksmsnigeria", error: "BULKSMS_API_TOKEN is not set" };
  }
  try {
    const res = await fetch("https://www.bulksmsnigeria.com/api/v2/sms", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        from,
        to: smsMsisdn(to),
        body,
        gateway,
      }),
    });
    const payload = (await res.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
      data?: { status?: string };
    };
    if (!res.ok) {
      return {
        ok: false,
        provider: "bulksmsnigeria",
        error: payload.error || payload.message || `BulkSMS ${res.status}`,
      };
    }
    return { ok: true, provider: "bulksmsnigeria" };
  } catch (e) {
    return { ok: false, provider: "bulksmsnigeria", error: (e as Error).message };
  }
}

async function sendSmsTermii(to: string, body: string): Promise<DeliveryResult> {
  const apiKey = process.env.TERMII_API_KEY || "";
  const from = (process.env.TERMII_SENDER_ID || config.church.shortName || "IGC").slice(0, 11);
  const channel = process.env.TERMII_CHANNEL || "generic";
  if (!apiKey) {
    return { ok: false, provider: "termii", error: "TERMII_API_KEY is not set" };
  }
  try {
    const res = await fetch("https://api.ng.termii.com/api/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: smsMsisdn(to),
        from,
        sms: body,
        type: "plain",
        channel,
        api_key: apiKey,
      }),
    });
    const payload = (await res.json().catch(() => ({}))) as {
      message?: string;
      code?: string;
    };
    if (!res.ok) {
      return { ok: false, provider: "termii", error: payload.message || `Termii ${res.status}` };
    }
    return { ok: true, provider: "termii" };
  } catch (e) {
    return { ok: false, provider: "termii", error: (e as Error).message };
  }
}

/**
 * SMS: BulkSMS Nigeria (cheap NG), Termii, or Twilio. Dry-run when no keys.
 */
export async function sendSms(to: string, body: string): Promise<DeliveryResult> {
  const provider = resolveSmsProvider();
  if (provider === "bulksmsnigeria") return sendSmsBulkNigeria(to, body);
  if (provider === "termii") return sendSmsTermii(to, body);
  if (provider === "twilio") return sendSmsTwilio(to, body);
  // eslint-disable-next-line no-console
  console.log(`[SMS:dryrun] -> ${to}: ${body.slice(0, 80)}`);
  return { ok: true, provider: "dryrun" };
}

/**
 * WhatsApp is unused for church notices (email + SMS only). Kept for optional later use.
 */
export async function sendWhatsApp(to: string, body: string): Promise<DeliveryResult> {
  // eslint-disable-next-line no-console
  console.log(`[WHATSAPP:skipped] -> ${to}: ${body.slice(0, 80)}`);
  return { ok: true, provider: "skipped" };
}

let transporter: nodemailer.Transporter | null = null;
function getTransporter(): nodemailer.Transporter | null {
  if (!emailIsConfigured() || !config.email.smtpHost) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.email.smtpHost,
      port: config.email.smtpPort,
      secure: config.email.smtpPort === 465,
      auth: config.email.smtpUser
        ? { user: config.email.smtpUser, pass: config.email.smtpPass }
        : undefined,
    });
  }
  return transporter;
}

export async function sendEmail(
  to: string,
  subject: string,
  body: string,
): Promise<DeliveryResult> {
  const t = getTransporter();
  if (t) {
    try {
      await t.sendMail({ from: config.email.from, to, subject, text: body });
      return { ok: true, provider: "smtp" };
    } catch (e) {
      return { ok: false, provider: "smtp", error: (e as Error).message };
    }
  }
  // eslint-disable-next-line no-console
  console.log(`[EMAIL:dryrun] -> ${to} | ${subject}`);
  return { ok: true, provider: "dryrun" };
}

export interface SocialResult {
  ok: boolean;
  externalUrl?: string;
  error?: string;
}

export async function publishToPlatform(
  platform: string,
  content: string,
): Promise<SocialResult> {
  if (config.social.connected.includes(platform)) {
    return { ok: true, externalUrl: `https://${platform}.com/igc/posts/live` };
  }
  // eslint-disable-next-line no-console
  console.log(`[SOCIAL:dryrun:${platform}] ${content.slice(0, 60)}`);
  return { ok: true, externalUrl: `https://${platform}.com/igc/preview` };
}
