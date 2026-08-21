import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { authenticate, requireRole } from "../auth.js";
import { sendEmail, sendSms } from "../comms.js";
import { isPaystackLive } from "../payments.js";
import { HttpError } from "../util.js";
import { asyncHandler, parseBody } from "./helpers.js";

export const settingsRouter = Router();
settingsRouter.use(authenticate);

// Live-vs-simulated status for every external integration.
settingsRouter.get(
  "/integrations",
  asyncHandler(async (_req, res) => {
    res.json({
      church: config.church,
      integrations: [
        {
          key: "sms",
          name: "SMS (Twilio)",
          live: config.sms.provider === "twilio" && !!config.sms.twilioAccountSid,
          detail:
            config.sms.provider === "twilio" && config.sms.twilioAccountSid
              ? `From ${config.sms.twilioFrom ?? "(unset)"}`
              : "Simulated — add TWILIO_* credentials to go live",
        },
        {
          key: "email",
          name: "Email (SMTP)",
          live: config.email.provider === "smtp" && !!config.email.smtpHost,
          detail:
            config.email.provider === "smtp" && config.email.smtpHost
              ? `Host ${config.email.smtpHost}`
              : "Simulated — add SMTP_* credentials to go live",
        },
        {
          key: "payments",
          name: "Payments (Paystack)",
          live: isPaystackLive(),
          detail: isPaystackLive()
            ? `Live · ${config.payments.currency}`
            : "Simulated — add PAYSTACK_SECRET_KEY to accept real payments",
        },
        {
          key: "social",
          name: "Social platforms",
          live: config.social.connected.length > 0,
          detail:
            config.social.connected.length > 0
              ? `Connected: ${config.social.connected.join(", ")}`
              : "Simulated — set SOCIAL_CONNECTED to go live",
        },
      ],
    });
  }),
);

const testSchema = z.object({
  channel: z.enum(["sms", "email"]),
  to: z.string().min(3),
});

// Sends a real test message when credentials are present (dry-run otherwise).
settingsRouter.post(
  "/test-message",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const { channel, to } = parseBody(testSchema, req.body);
    const body = `This is a test message from ${config.church.name}. Your ${channel.toUpperCase()} integration is working!`;
    const result =
      channel === "sms"
        ? await sendSms(to, body)
        : await sendEmail(to, `${config.church.name} — test message`, body);
    if (!result.ok) throw new HttpError(502, result.error ?? "Delivery failed");
    res.json({ ok: true, provider: result.provider });
  }),
);
