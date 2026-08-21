import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import { api } from "../../lib/api";
import { Button, Card, Spinner } from "../../components/ui";
import { naira } from "../../lib/format";

interface VerifyResult {
  status: "success" | "failed" | "pending";
  amount: number;
  type: string;
}

export default function GiveCallback() {
  const [params] = useSearchParams();
  const reference = params.get("reference") ?? params.get("trxref") ?? "";
  const [state, setState] = useState<"loading" | VerifyResult["status"]>("loading");
  const [result, setResult] = useState<VerifyResult | null>(null);

  useEffect(() => {
    if (!reference) {
      setState("failed");
      return;
    }
    api<VerifyResult>(`/public/give/verify?reference=${encodeURIComponent(reference)}`)
      .then((r) => {
        setResult(r);
        setState(r.status);
      })
      .catch(() => setState("failed"));
  }, [reference]);

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
              <span className="font-semibold">{naira(result?.amount)}</span>. May God bless
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
                ? "Your payment is still processing. You'll receive confirmation shortly."
                : "If you were charged, please contact the church office with your reference."}
            </p>
            {reference && (
              <p className="mt-2 text-xs text-ink-400">Reference: {reference}</p>
            )}
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
