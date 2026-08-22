import "dotenv/config";

function bool(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function firstEnv(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key];
    if (value) return value;
  }
  return "";
}

function hasFlutterwaveCreds(): boolean {
  return !!(firstEnv("FLW_CLIENT_ID", "FLUTTERWAVE_CLIENT_ID") &&
    firstEnv("FLW_CLIENT_SECRET", "FLUTTERWAVE_CLIENT_SECRET"));
}

export function resolveSmsProvider(): "bulksmsnigeria" | "termii" | "twilio" | "dryrun" {
  const explicit = process.env.SMS_PROVIDER;
  if (explicit === "dryrun") return "dryrun";
  if (explicit === "bulksmsnigeria" || explicit === "termii" || explicit === "twilio") {
    return explicit;
  }
  if (firstEnv("BULKSMS_API_TOKEN", "BULKSMSNIGERIA_API_TOKEN")) return "bulksmsnigeria";
  if (process.env.TERMII_API_KEY) return "termii";
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM) {
    return "twilio";
  }
  return "dryrun";
}

export function emailIsConfigured(): boolean {
  if ((process.env.EMAIL_PROVIDER ?? "").toLowerCase() === "dryrun") return false;
  return !!(process.env.SMTP_HOST && (process.env.SMTP_USER || process.env.SMTP_PASS));
}

function resolvePaymentProvider(): "flutterwave" | "paystack" | "dryrun" {
  const explicit = process.env.PAYMENT_PROVIDER;
  if (explicit === "flutterwave" || explicit === "paystack" || explicit === "dryrun") {
    return explicit;
  }
  if (hasFlutterwaveCreds()) return "flutterwave";
  if (process.env.PAYSTACK_SECRET_KEY) return "paystack";
  return "dryrun";
}

export const config = {
  env: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 3001),
  jwtSecret: process.env.JWT_SECRET ?? "igc-dev-secret-change-in-production",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  databaseUrl:
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    "postgres://igc:igc@127.0.0.1:5432/gracedflow",
  // True when running inside a Vercel serverless function (no always-on process).
  isServerless: !!process.env.VERCEL,
  cronSecret: process.env.CRON_SECRET ?? "",
  // Load the sample church (fake members, gifts, projects) only when explicitly requested.
  seedDemo: bool(process.env.SEED_DEMO, false),
  bootstrapAdmin: {
    email: firstEnv("ADMIN_EMAIL", "BOOTSTRAP_ADMIN_EMAIL"),
    password: firstEnv("ADMIN_PASSWORD", "BOOTSTRAP_ADMIN_PASSWORD"),
    firstName: process.env.ADMIN_FIRST_NAME ?? "Church",
    lastName: process.env.ADMIN_LAST_NAME ?? "Admin",
  },

  church: {
    name: process.env.CHURCH_NAME ?? "Infinitely Graced Church",
    shortName: process.env.CHURCH_SHORT_NAME ?? "IGC",
    tagline: process.env.CHURCH_TAGLINE ?? "Flowing in His infinite grace",
  },

  // External providers run in "dry-run" mode unless real credentials are set.
  // Every message is still composed, targeted and recorded in the outbox.
  sms: {
    get provider() {
      return resolveSmsProvider();
    },
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
    twilioFrom: process.env.TWILIO_FROM,
    bulkSmsToken: firstEnv("BULKSMS_API_TOKEN", "BULKSMSNIGERIA_API_TOKEN"),
    bulkSmsSender: process.env.BULKSMS_SENDER_ID || process.env.CHURCH_SHORT_NAME || "IGC",
    bulkSmsGateway: process.env.BULKSMS_GATEWAY || "direct-corporate",
    termiiApiKey: process.env.TERMII_API_KEY ?? "",
    termiiSender: process.env.TERMII_SENDER_ID || process.env.CHURCH_SHORT_NAME || "IGC",
    termiiChannel: process.env.TERMII_CHANNEL || "generic",
  },
  email: {
    get provider() {
      return emailIsConfigured() ? "smtp" : "dryrun";
    },
    smtpHost: process.env.SMTP_HOST,
    smtpPort: Number(process.env.SMTP_PORT ?? 587),
    smtpUser: process.env.SMTP_USER,
    smtpPass: process.env.SMTP_PASS,
    from:
      process.env.EMAIL_FROM ??
      "Infinitely Graced Church <noreply@infinitelygracedchurch.com>",
  },
  social: {
    // Comma separated list of platforms that have credentials configured.
    // When empty, posts are queued and logged (dry-run) so the flow is testable.
    connected: (process.env.SOCIAL_CONNECTED ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  },
  scheduler: {
    enabled: bool(process.env.SCHEDULER_ENABLED, true),
    timezone: process.env.TZ_NAME ?? "Africa/Lagos",
  },
  giving: {
    bankName: process.env.GIVING_BANK_NAME ?? "",
    accountName: process.env.GIVING_ACCOUNT_NAME ?? "",
    accountNumber: process.env.GIVING_ACCOUNT_NUMBER ?? "",
    onlineUrl: process.env.GIVING_ONLINE_URL ?? "",
  },
  payments: {
    // Default checkout when the donor does not pick a gateway. Flutterwave and
    // Paystack can both be live at once when their keys are set.
    provider: resolvePaymentProvider(),
    currency: process.env.PAYMENT_CURRENCY ?? "NGN",
    paystackSecretKey: process.env.PAYSTACK_SECRET_KEY ?? "",
    paystackPublicKey: process.env.PAYSTACK_PUBLIC_KEY ?? "",
    flutterwaveClientId: firstEnv("FLW_CLIENT_ID", "FLUTTERWAVE_CLIENT_ID"),
    flutterwaveClientSecret: firstEnv("FLW_CLIENT_SECRET", "FLUTTERWAVE_CLIENT_SECRET"),
    flutterwaveEncryptionKey: firstEnv("FLW_ENCRYPTION_KEY", "FLUTTERWAVE_ENCRYPTION_KEY"),
    // Secret hash you set on the Flutterwave dashboard (Settings → Webhooks).
    flutterwaveSecretHash: firstEnv("FLW_SECRET_HASH", "FLUTTERWAVE_SECRET_HASH"),
    flutterwaveEnv: (process.env.FLW_ENV === "sandbox" ? "sandbox" : "live") as "live" | "sandbox",
    flutterwaveBaseUrl: process.env.FLW_BASE_URL ?? "",
  },
  appUrl: process.env.APP_URL ?? "http://localhost:5173",
};

export type AppConfig = typeof config;
