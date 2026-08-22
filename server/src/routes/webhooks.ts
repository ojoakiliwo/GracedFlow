import { Router, raw } from "express";
import { db } from "../db.js";
import {
  verifyFlutterwaveSignature,
  verifyPaystackSignature,
} from "../payments.js";
import { audit, nowIso } from "../util.js";

export const webhooksRouter = Router();

async function confirmDonationByReference(
  reference: string,
  source: string,
): Promise<void> {
  const donation = (await db
    .prepare("SELECT id, status FROM donations WHERE reference = ?")
    .get(reference)) as { id: string; status: string } | undefined;
  if (donation && donation.status !== "confirmed") {
    await db
      .prepare(
        "UPDATE donations SET status = 'confirmed', method = 'card', confirmed_at = ? WHERE id = ?",
      )
      .run(nowIso(), donation.id);
    audit(source, "donation", donation.id, undefined, { reference });
  }
}

// Paystack: HMAC-SHA512 (hex) of the raw body in `x-paystack-signature`.
webhooksRouter.post("/paystack", raw({ type: "*/*" }), async (req, res) => {
  const signature = req.headers["x-paystack-signature"] as string | undefined;
  const rawBody = req.body as Buffer;
  if (!verifyPaystackSignature(rawBody, signature)) {
    return res.status(401).json({ error: "Invalid signature" });
  }
  let event: { event?: string; data?: { reference?: string } };
  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return res.status(400).json({ error: "Invalid payload" });
  }
  if (event.event === "charge.success" && event.data?.reference) {
    await confirmDonationByReference(event.data.reference, "webhook_confirm");
  }
  res.json({ received: true });
});

// Flutterwave V4: HMAC-SHA256 (base64) of the raw body in `flutterwave-signature`.
webhooksRouter.post("/flutterwave", raw({ type: "*/*" }), async (req, res) => {
  const signature = req.headers["flutterwave-signature"] as string | undefined;
  const rawBody = req.body as Buffer;
  if (!verifyFlutterwaveSignature(rawBody, signature)) {
    return res.status(401).json({ error: "Invalid signature" });
  }
  let event: {
    type?: string;
    event?: string;
    data?: {
      reference?: string;
      tx_ref?: string;
      status?: string;
      meta?: { reference?: string };
    };
  };
  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return res.status(400).json({ error: "Invalid payload" });
  }
  const data = event.data ?? {};
  const reference = data.reference ?? data.tx_ref ?? data.meta?.reference;
  const status = (data.status ?? "").toLowerCase();
  const succeeded = ["succeeded", "successful", "completed", "success"].includes(status);
  if (succeeded && reference) {
    await confirmDonationByReference(reference, "webhook_confirm_flw");
  }
  res.json({ received: true });
});
