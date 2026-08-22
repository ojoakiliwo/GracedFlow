import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { authenticate, requireRole } from "../auth.js";
import { sendEmail, sendSms } from "../comms.js";
import { isFlutterwaveLive, isOnlineLive, isPaystackLive } from "../payments.js";
import { HttpError } from "../util.js";
import { asyncHandler, parseBody } from "./helpers.js";

function paymentsIntegrationName(): string {
  if (isFlutterwaveLive() || config.payments.provider === "flutterwave") {
    return "Payments (Flutterwave v4)";
  }
  if (isPaystackLive() || config.payments.provider === "paystack") {
    return "Payments (Paystack)";
  }
  return "Payments";
}

function paymentsIntegrationDetail(): string {
  if (isFlutterwaveLive()) {
    return `Live · Flutterwave ${config.payments.flutterwaveEnv} · ${config.payments.currency} · confirms on checkout return`;
  }
  if (isPaystackLive()) {
    return `Live · ${config.payments.currency}`;
  }
  if (config.payments.provider === "flutterwave") {
    return "Simulated — add FLW_CLIENT_ID and FLW_CLIENT_SECRET to accept real payments";
  }
  return "Simulated — add Flutterwave v4 (FLW_CLIENT_ID + FLW_CLIENT_SECRET) or PAYSTACK_SECRET_KEY";
}

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
          name: paymentsIntegrationName(),
          live: isOnlineLive(),
          detail: paymentsIntegrationDetail(),
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
