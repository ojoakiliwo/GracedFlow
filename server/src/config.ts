import "dotenv/config";

function bool(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

export const config = {
  env: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 3001),
  jwtSecret: process.env.JWT_SECRET ?? "igc-dev-secret-change-in-production",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  // Accept the many env-var names Vercel/Neon may use (depending on the chosen
  // storage prefix) so the connection string is found regardless of setup.
  databaseUrl:
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_PRISMA_URL ??
    process.env.DATABASE_POSTGRES_URL ??
    process.env.STORAGE_URL ??
    process.env.STORAGE_POSTGRES_URL ??
    process.env.NEON_DATABASE_URL ??
    "postgres://igc:igc@127.0.0.1:5432/gracedflow",
  // True when running inside a Vercel serverless function (no always-on process).
  isServerless: !!process.env.VERCEL,
  cronSecret: process.env.CRON_SECRET ?? "",

  church: {
    name: process.env.CHURCH_NAME ?? "Infinitely Graced Church",
    shortName: process.env.CHURCH_SHORT_NAME ?? "IGC",
    tagline: process.env.CHURCH_TAGLINE ?? "Flowing in His infinite grace",
  },

  // External providers run in "dry-run" mode unless real credentials are set.
  // Every message is still composed, targeted and recorded in the outbox.
  sms: {
    provider: process.env.SMS_PROVIDER ?? "dryrun", // "twilio" | "dryrun"
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
    twilioFrom: process.env.TWILIO_FROM,
  },
  email: {
    provider: process.env.EMAIL_PROVIDER ?? "dryrun", // "smtp" | "dryrun"
    smtpHost: process.env.SMTP_HOST,
    smtpPort: Number(process.env.SMTP_PORT ?? 587),
    smtpUser: process.env.SMTP_USER,
    smtpPass: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM ?? "Infinitely Graced Church <noreply@igc.church>",
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
    bankName: process.env.GIVING_BANK_NAME ?? "First Bank",
    accountName: process.env.GIVING_ACCOUNT_NAME ?? "Infinitely Graced Church",
    accountNumber: process.env.GIVING_ACCOUNT_NUMBER ?? "0000000000",
    onlineUrl: process.env.GIVING_ONLINE_URL ?? "",
  },
  payments: {
    // Provider activates automatically when its credentials are present;
    // otherwise giving runs in a self-contained simulated mode.
    provider:
      process.env.PAYMENT_PROVIDER ??
      (process.env.FLW_CLIENT_ID
        ? "flutterwave"
        : process.env.PAYSTACK_SECRET_KEY
          ? "paystack"
          : "dryrun"),
    currency: process.env.PAYMENT_CURRENCY ?? "NGN",
    paystackSecretKey: process.env.PAYSTACK_SECRET_KEY ?? "",
    paystackPublicKey: process.env.PAYSTACK_PUBLIC_KEY ?? "",
    // Flutterwave V4 (OAuth). Encryption key is only needed for direct card
    // charges, not the hosted checkout used here. Secret hash secures webhooks.
    flw: {
      clientId: process.env.FLW_CLIENT_ID ?? "",
      clientSecret: process.env.FLW_CLIENT_SECRET ?? "",
      encryptionKey: process.env.FLW_ENCRYPTION_KEY ?? "",
      secretHash: process.env.FLW_SECRET_HASH ?? "",
      baseUrl: process.env.FLW_BASE_URL ?? "https://api.flutterwave.cloud/f4bexperience",
      tokenUrl:
        process.env.FLW_TOKEN_URL ??
        "https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token",
    },
  },
  appUrl: process.env.APP_URL ?? "http://localhost:5173",
};

export type AppConfig = typeof config;
