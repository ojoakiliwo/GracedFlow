import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import { api } from "../../lib/api";
import { Button, Card, Spinner } from "../../components/ui";
import { ChurchContactLinks } from "../../components/ChurchContact";
import { money } from "../../lib/currencies";

interface VerifyResult {
  status: "success" | "failed" | "pending";
  amount: number;
  type: string;
  currency?: string;
}

const CANCELLED = new Set(["cancelled", "canceled", "failed", "error"]);

function firstParam(params: URLSearchParams, ...keys: string[]): string {
  for (const key of keys) {
    const value = params.get(key);
    if (value) return value;
  }
  return "";
}

export default function GiveCallback() {
  const [params] = useSearchParams();
  const reference = firstParam(params, "reference", "trxref", "tx_ref");
  const chargeId = firstParam(params, "id", "transaction_id", "charge_id", "chargeId");
  const provider = firstParam(params, "provider");
  const redirectHint = (params.get("status") ?? "").toLowerCase();
  const [state, setState] = useState<"loading" | VerifyResult["status"]>("loading");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [checking, setChecking] = useState(false);

  async function confirm(attempt = 0): Promise<void> {
    if (!reference) {
      setState("failed");
      return;
    }
    const qs = new URLSearchParams({ reference });
    if (chargeId) qs.set("chargeId", chargeId);
    if (provider) qs.set("provider", provider);
    try {
      const r = await api<VerifyResult>(`/public/give/verify?${qs.toString()}`);
      setResult(r);
      if (r.status === "pending" && !CANCELLED.has(redirectHint) && attempt < 4) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return confirm(attempt + 1);
      }
      if (r.status === "pending" && CANCELLED.has(redirectHint)) {
        setState("failed");
        return;
      }
      setState(r.status);
    } catch {
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return confirm(attempt + 1);
      }
      setState("failed");
    }
  }

  useEffect(() => {
    void confirm(0);
    // Intentionally run once when the donor lands from checkout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference, chargeId, provider]);

  async function checkAgain() {
    setChecking(true);
    setState("loading");
    await confirm(4);
    setChecking(false);
  }

  return (
    <section className="mx-auto flex min-h-[70vh] max-w-xl items-center px-6 py-14">
      <Card className="w-full p-10 text-center">
        {state === "loading" && (
          <>
            <Spinner className="mx-auto h-10 w-10" />
            <h2 className="mt-4 text-xl text-ink-900">Confirming your gift…</h2>
            <p className="mt-1 text-sm text-ink-500">Please wait a moment.</p>
          </>
        )}
        {state === "success" && (
          <>
            <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-500" />
            <h2 className="mt-4 font-display text-2xl text-ink-900">
              Your gift was received!
            </h2>
            <p className="mt-2 text-ink-500">
              Thank you for your{" "}
              <span className="font-semibold capitalize">{result?.type}</span> of{" "}
              <span className="font-semibold">
                {money(result?.amount, result?.currency)}
              </span>. May God bless
              you richly.
            </p>
            <p className="mt-2 text-xs text-ink-400">Reference: {reference}</p>
          </>
        )}
        {(state === "failed" || state === "pending") && (
          <>
            {state === "pending" ? (
              <Clock className="mx-auto h-16 w-16 text-amber-500" />
            ) : (
              <XCircle className="mx-auto h-16 w-16 text-red-500" />
            )}
            <h2 className="mt-4 font-display text-2xl text-ink-900">
              {state === "pending" ? "Payment pending" : "We couldn't confirm the payment"}
            </h2>
            <p className="mt-2 text-ink-500">
              {state === "pending"
                ? "Flutterwave is still finalizing this payment. If you completed checkout, tap Check again in a moment."
                : "If you were charged, tap Check again or contact the church office with your reference."}
            </p>
            {state === "failed" && (
              <div className="mt-4 flex justify-center">
                <ChurchContactLinks align="center" />
              </div>
            )}
            {reference && (
              <p className="mt-2 text-xs text-ink-400">Reference: {reference}</p>
            )}
            <Button className="mt-4" variant="outline" loading={checking} onClick={checkAgain}>
              Check again
            </Button>
          </>
        )}
        <div className="mt-6 flex justify-center gap-2">
          <Link to="/">
            <Button variant="outline">Back to home</Button>
          </Link>
          <Link to="/give">
            <Button>Give again</Button>
          </Link>
        </div>
      </Card>
    </section>
  );
}
