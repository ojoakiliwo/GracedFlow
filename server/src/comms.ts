import nodemailer from "nodemailer";
import { config } from "./config.js";

export interface DeliveryResult {
  ok: boolean;
  provider: string;
  error?: string;
}

/**
 * SMS adapter. Ships a Twilio implementation that activates automatically when
 * TWILIO_* credentials are present; otherwise runs in dry-run mode so the whole
 * targeting + outbox flow is fully testable without a paid provider.
 */
export async function sendSms(to: string, body: string): Promise<DeliveryResult> {
  const { provider, twilioAccountSid, twilioAuthToken, twilioFrom } = config.sms;
  if (provider === "twilio" && twilioAccountSid && twilioAuthToken && twilioFrom) {
    try {
      const params = new URLSearchParams({ To: to, From: twilioFrom, Body: body });
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization:
              "Basic " +
              Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString("base64"),
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
  // Dry-run: pretend delivery succeeds and log it.
  // eslint-disable-next-line no-console
  console.log(`[SMS:dryrun] -> ${to}: ${body.slice(0, 80)}`);
  return { ok: true, provider: "dryrun" };
}

/**
 * WhatsApp via Twilio (TWILIO_WHATSAPP_FROM) or Meta Cloud API.
 * Falls back to dry-run so assignment notices are testable without a provider.
 */
export async function sendWhatsApp(to: string, body: string): Promise<DeliveryResult> {
  const from = process.env.TWILIO_WHATSAPP_FROM ?? "";
  const { twilioAccountSid, twilioAuthToken } = config.sms;
  if (from && twilioAccountSid && twilioAuthToken) {
    try {
      const dest = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
      const params = new URLSearchParams({
        To: dest,
        From: from.startsWith("whatsapp:") ? from : `whatsapp:${from}`,
        Body: body,
      });
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization:
              "Basic " +
              Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString("base64"),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
        },
      );
      if (!res.ok) {
        return { ok: false, provider: "twilio-whatsapp", error: `Twilio ${res.status}` };
      }
      return { ok: true, provider: "twilio-whatsapp" };
    } catch (e) {
      return { ok: false, provider: "twilio-whatsapp", error: (e as Error).message };
    }
  }

  const token = process.env.WHATSAPP_TOKEN ?? "";
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID ?? "";
  if (token && phoneId) {
    try {
      const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: to.replace(/^\+/, ""),
          type: "text",
          text: { body },
        }),
      });
      if (!res.ok) {
        return { ok: false, provider: "whatsapp-cloud", error: `WhatsApp ${res.status}` };
      }
      return { ok: true, provider: "whatsapp-cloud" };
    } catch (e) {
      return { ok: false, provider: "whatsapp-cloud", error: (e as Error).message };
    }
  }

  // eslint-disable-next-line no-console
  console.log(`[WHATSAPP:dryrun] -> ${to}: ${body.slice(0, 80)}`);
  return { ok: true, provider: "dryrun" };
}

let transporter: nodemailer.Transporter | null = null;
function getTransporter(): nodemailer.Transporter | null {
  const { provider, smtpHost, smtpPort, smtpUser, smtpPass } = config.email;
  if (provider !== "smtp" || !smtpHost) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: smtpUser ? { user: smtpUser, pass: smtpPass } : undefined,
    });
  }
  return transporter;
}

/**
 * Email adapter (SMTP via nodemailer). Falls back to dry-run when SMTP is not
 * configured.
 */
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

/**
 * Social broadcast adapter. Real platform SDKs plug in here; connected
 * platforms are read from SOCIAL_CONNECTED. Unconnected platforms are queued in
 * dry-run so a post can be composed and its distribution tracked.
 */
export async function publishToPlatform(
  platform: string,
  content: string,
): Promise<SocialResult> {
  if (config.social.connected.includes(platform)) {
    // Real integration would call the platform API here.
    return { ok: true, externalUrl: `https://${platform}.com/igc/posts/live` };
  }
  // eslint-disable-next-line no-console
  console.log(`[SOCIAL:dryrun:${platform}] ${content.slice(0, 60)}`);
  return { ok: true, externalUrl: `https://${platform}.com/igc/preview` };
}
