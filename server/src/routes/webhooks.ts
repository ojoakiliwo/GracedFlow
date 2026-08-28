import { Router, raw } from "express";
import { db } from "../db.js";
import { verifyFlutterwaveWebhookSignature, verifyWebhookSignature } from "../payments.js";
import { audit, nowIso } from "../util.js";

export const webhooksRouter = Router();

async function confirmDonation(reference: string | undefined): Promise<void> {
  if (!reference) return;
  const donation = (await db
    .prepare("SELECT id, status FROM donations WHERE reference = ?")
    .get(reference)) as { id: string; status: string } | undefined;
  if (donation && donation.status !== "confirmed") {
    await db
      .prepare(
        "UPDATE donations SET status = 'confirmed', method = 'card', confirmed_at = ? WHERE id = ?",
      )
      .run(nowIso(), donation.id);
    audit("webhook_confirm", "donation", donation.id, undefined, { reference });
  }
}

// Paystack posts payment events here. We verify the HMAC signature against the
// raw body, then confirm the matching donation on `charge.success`.
webhooksRouter.post(
  "/paystack",
  raw({ type: "*/*" }),
  async (req, res) => {
    const signature = req.headers["x-paystack-signature"] as string | undefined;
    const rawBody = req.body as Buffer;
    if (!verifyWebhookSignature(rawBody, signature)) {
      return res.status(401).json({ error: "Invalid signature" });
    }
    let event: { event?: string; data?: { reference?: string } };
    try {
      event = JSON.parse(rawBody.toString("utf8"));
    } catch {
      return res.status(400).json({ error: "Invalid payload" });
    }

    if (event.event === "charge.success") {
      await confirmDonation(event.data?.reference);
    }
    res.json({ received: true });
  },
);

// Flutterwave v4 posts `charge.completed` here. Signature is HMAC-SHA256
// (base64) of the raw body using the secret hash from the dashboard.
webhooksRouter.post(
  "/flutterwave",
  raw({ type: "*/*" }),
  async (req, res) => {
    const signature = req.headers["flutterwave-signature"] as string | undefined;
    const rawBody = req.body as Buffer;
    if (!verifyFlutterwaveWebhookSignature(rawBody, signature)) {
      return res.status(401).json({ error: "Invalid signature" });
    }
    let event: {
      type?: string;
      event?: string;
      data?: { reference?: string; status?: string };
    };
    try {
      event = JSON.parse(rawBody.toString("utf8"));
    } catch {
      return res.status(400).json({ error: "Invalid payload" });
    }

    const type = event.type ?? event.event;
    const status = (event.data?.status ?? "").toLowerCase();
    if (
      (type === "charge.completed" || type === "charge.success") &&
      (status === "succeeded" || status === "successful" || status === "success")
    ) {
      await confirmDonation(event.data?.reference);
    }
    res.json({ received: true });
  },
);
