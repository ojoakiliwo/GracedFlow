import { Router } from "express";
import { z } from "zod";
import { config, emailIsConfigured, resolveSmsProvider } from "../config.js";
import { authenticate, requireRole } from "../auth.js";
import { sendEmail, sendSms } from "../comms.js";
import { isFlutterwaveLive, isOnlineLive, isPaystackLive } from "../payments.js";
import { HttpError } from "../util.js";
import { asyncHandler, parseBody } from "./helpers.js";

function paymentsIntegrationName(): string {
  const flw = isFlutterwaveLive();
  const paystack = isPaystackLive();
  if (flw && paystack) return "Payments (Flutterwave + Paystack)";
  if (flw || config.payments.provider === "flutterwave") return "Payments (Flutterwave v4)";
  if (paystack || config.payments.provider === "paystack") return "Payments (Paystack)";
  return "Payments";
}

function paymentsIntegrationDetail(): string {
  const parts: string[] = [];
  if (isFlutterwaveLive()) parts.push(`Flutterwave ${config.payments.flutterwaveEnv}`);
  if (isPaystackLive()) parts.push("Paystack");
  if (parts.length) {
    return `Live · ${parts.join(" + ")} · ${config.payments.currency} · confirms on checkout return`;
  }
  return "Simulated — add Flutterwave (FLW_CLIENT_ID + FLW_CLIENT_SECRET) and/or PAYSTACK_SECRET_KEY";
}

export const settingsRouter = Router();
settingsRouter.use(authenticate);

// Live-vs-simulated status for every external integration.
settingsRouter.get(
  "/integrations",
  requireRole("admin"),
  asyncHandler(async (_req, res) => {
    res.json({
      church: config.church,
      integrations: [
        {
          key: "sms",
          name: "SMS",
          live: resolveSmsProvider() !== "dryrun",
          detail:
            resolveSmsProvider() === "bulksmsnigeria"
              ? `Live · BulkSMS Nigeria · sender ${process.env.BULKSMS_SENDER_ID || config.church.shortName}`
              : resolveSmsProvider() === "termii"
                ? `Live · Termii · sender ${process.env.TERMII_SENDER_ID || config.church.shortName}`
                : resolveSmsProvider() === "twilio"
                  ? `Live · Twilio · from ${config.sms.twilioFrom ?? "(unset)"}`
                  : "Simulated — add BULKSMS_API_TOKEN (cheap NG SMS) to go live",
        },
        {
          key: "email",
          name: "Email (SMTP)",
          live: emailIsConfigured(),
          detail: emailIsConfigured()
            ? `Live · ${process.env.SMTP_HOST}`
            : "Simulated — add SMTP_HOST, SMTP_USER, SMTP_PASS for @infinitelygracedchurch.com",
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
