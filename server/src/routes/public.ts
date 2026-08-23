import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { config } from "../config.js";
import { HttpError, newId, nowIso } from "../util.js";
import { asyncHandler, parseBody } from "./helpers.js";
import { createPrayerRequest } from "./prayer.js";
import {
  initializeTransaction,
  isOnlineLive,
  livePaymentProviders,
  resolveCheckoutProvider,
  verifyTransaction,
} from "../payments.js";
import { GIVING_CURRENCIES, normalizeGivingCurrency } from "../currencies.js";

export const publicRouter = Router();

// Church profile + service info for the public site.
publicRouter.get(
  "/info",
  asyncHandler(async (_req, res) => {
    res.json({
      church: config.church,
      giving: {
        bankName: config.giving.bankName,
        accountName: config.giving.accountName,
        accountNumber: config.giving.accountNumber,
        onlineUrl: config.giving.onlineUrl,
      },
      services: [
        { name: "Sunday Service", time: "Sundays, 8:00 AM" },
        { name: "Wednesday Prayer Meeting", time: "Wednesdays, 4:00 PM" },
      ],
    });
  }),
);

publicRouter.get(
  "/events",
  asyncHandler(async (_req, res) => {
    res.json(
      await db.prepare(
          "SELECT id, title, description, type, starts_at, ends_at, location FROM events WHERE is_public = 1 ORDER BY starts_at ASC",
        )
        .all(),
    );
  }),
);

publicRouter.get(
  "/projects",
  asyncHandler(async (_req, res) => {
    res.json(
      await db.prepare(
          "SELECT id, title, description, category, status, progress FROM projects WHERE visibility = 'public' ORDER BY updated_at DESC",
        )
        .all(),
    );
  }),
);

const prayerSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  request: z.string().min(3),
  isPublic: z.boolean().optional(),
});

publicRouter.post(
  "/prayer-requests",
  asyncHandler(async (req, res) => {
    const input = parseBody(prayerSchema, req.body);
    const id = await createPrayerRequest({
      name: input.name,
      email: input.email || undefined,
      phone: input.phone,
      request: input.request,
      isPublic: input.isPublic,
    });
    res.status(201).json({ id, message: "Your prayer request has been received." });
  }),
);

// Reports which giving methods are available to the public site.
publicRouter.get(
  "/giving-options",
  asyncHandler(async (_req, res) => {
    const providers = livePaymentProviders();
    res.json({
      currency: config.payments.currency || "NGN",
      currencies: GIVING_CURRENCIES,
      online: true,
      onlineLive: isOnlineLive(),
      provider: resolveCheckoutProvider(),
      providers: {
        flutterwave: providers.includes("flutterwave"),
        paystack: providers.includes("paystack"),
      },
      paystackPublicKey: config.payments.paystackPublicKey || null,
      bank: config.giving,
    });
  }),
);

// Public giving. `online` starts a Paystack (or simulated) checkout; `transfer`
// returns bank details with a reference for a manual transfer.
const giveSchema = z.object({
  donorName: z.string().optional(),
  donorEmail: z.string().email().optional().or(z.literal("")),
  donorPhone: z.string().optional(),
  type: z.string().default("offering"),
  amount: z.number().positive(),
  currency: z.string().optional(),
  method: z.enum(["online", "transfer"]).default("online"),
  provider: z.enum(["flutterwave", "paystack", "dryrun"]).optional(),
  note: z.string().optional(),
});

publicRouter.post(
  "/give",
  asyncHandler(async (req, res) => {
    const input = parseBody(giveSchema, req.body);
    const currency = normalizeGivingCurrency(input.currency);
    if (input.method === "transfer" && currency !== "NGN") {
      throw new HttpError(
        400,
        "Bank transfer is in Nigerian Naira. Use Card / Online to give in another currency.",
      );
    }
    const id = newId("don");
    const reference = `IGC-${Date.now().toString(36).toUpperCase()}-${Math.floor(
      Math.random() * 1000,
    )}`;
    if (input.method === "online") {
      const init = await initializeTransaction({
        email: input.donorEmail || "giving@infinitelygracedchurch.com",
        amountMajor: input.amount,
        reference,
        customerName: input.donorName,
        provider: input.provider,
        currency,
        metadata: { donationId: id, type: input.type, donorName: input.donorName, currency },
      });
      await db.prepare(
        `INSERT INTO donations (id, donor_name, donor_email, donor_phone, type, amount, currency, method, reference, status, note, provider, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
      ).run(
        id,
        input.donorName ?? null,
        input.donorEmail || null,
        input.donorPhone ?? null,
        input.type,
        input.amount,
        currency,
        input.method,
        reference,
        input.note ?? null,
        init.provider,
        nowIso(),
      );
      return void res.status(201).json({
        id,
        reference,
        method: "online",
        currency,
        provider: init.provider,
        authorizationUrl: init.authorizationUrl,
      });
    }

    await db.prepare(
      `INSERT INTO donations (id, donor_name, donor_email, donor_phone, type, amount, currency, method, reference, status, note, provider, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
    ).run(
      id,
      input.donorName ?? null,
      input.donorEmail || null,
      input.donorPhone ?? null,
      input.type,
      input.amount,
      currency,
      input.method,
      reference,
      input.note ?? null,
      null,
      nowIso(),
    );

    res.status(201).json({
      id,
      reference,
      method: "transfer",
      currency,
      giving: config.giving,
      message:
        "Thank you for your generosity! Use the reference and account details to complete your gift.",
    });
  }),
);

// Called after returning from hosted checkout. Confirms the gift by querying
// Flutterwave/Paystack directly — webhooks are optional.
publicRouter.get(
  "/give/verify",
  asyncHandler(async (req, res) => {
    const reference = String(req.query.reference ?? req.query.tx_ref ?? req.query.trxref ?? "");
    if (!reference) throw new HttpError(400, "Missing reference");
    const donation = await db.prepare("SELECT * FROM donations WHERE reference = ?")
      .get(reference) as {
        id: string;
        amount: number;
        type: string;
        status: string;
        currency?: string | null;
        provider?: string | null;
      } | undefined;
    if (!donation) throw new HttpError(404, "Donation not found");

    if (donation.status === "confirmed") {
      return void res.json({
        status: "success",
        amount: donation.amount,
        type: donation.type,
        currency: donation.currency ?? "NGN",
      });
    }

    const chargeId = String(
      req.query.chargeId ?? req.query.id ?? req.query.transaction_id ?? req.query.charge_id ?? "",
    );
    const provider = String(req.query.provider ?? donation.provider ?? "");
    const result = await verifyTransaction(reference, {
      chargeId: chargeId || undefined,
      provider: provider || undefined,
    });
    if (result.status === "success") {
      await db.prepare(
        "UPDATE donations SET status = 'confirmed', method = 'card', confirmed_at = ? WHERE id = ?",
      ).run(nowIso(), donation.id);
    }
    res.json({
      status: result.status,
      amount: donation.amount,
      type: donation.type,
      currency: donation.currency ?? "NGN",
    });
  }),
);
