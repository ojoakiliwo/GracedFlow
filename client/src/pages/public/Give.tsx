import { useState } from "react";
import { HandCoins, CheckCircle2, Landmark, CreditCard } from "lucide-react";
import { apiPost } from "../../lib/api";
import { useApi } from "../../lib/useApi";
import { Button, Card, Field, Input, Select, Spinner } from "../../components/ui";
import { naira } from "../../lib/format";

interface GivingOptions {
  currency: string;
  online: boolean;
  onlineLive: boolean;
  provider?: "paystack" | "flutterwave" | "dryrun";
  bank: {
    bankName: string;
    accountName: string;
    accountNumber: string;
  };
}
interface GiveResult {
  reference: string;
  method: string;
  authorizationUrl?: string;
  giving?: { bankName: string; accountName: string; accountNumber: string };
}

const TYPES = [
  { value: "tithe", label: "Tithe" },
  { value: "offering", label: "Offering" },
  { value: "seed", label: "Seed / Sacrifice" },
  { value: "building", label: "Building Fund" },
  { value: "missions", label: "Missions" },
  { value: "donation", label: "General Donation" },
];

export default function Give() {
  const { data: options, loading } = useApi<GivingOptions>("/public/giving-options");
  const [method, setMethod] = useState<"online" | "transfer">("online");
  const [form, setForm] = useState({
    donorName: "",
    donorEmail: "",
    donorPhone: "",
    type: "tithe",
    amount: "",
  });
  const [result, setResult] = useState<GiveResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiPost<GiveResult>("/public/give", {
        ...form,
        amount: Number(form.amount),
        method,
      });
      if (res.method === "online" && res.authorizationUrl) {
        // Hand off to Flutterwave / Paystack hosted checkout (or simulated callback).
        window.location.href = res.authorizationUrl;
        return;
      }
      setResult(res);
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <div>
      <section className="grace-gradient px-6 py-16 text-center">
        <HandCoins className="mx-auto h-10 w-10 text-gold-300" />
        <h1 className="mt-4 font-display text-4xl font-semibold text-white">Give</h1>
        <p className="mx-auto mt-3 max-w-xl text-brand-100">
          “Each of you should give what you have decided in your heart to give.” Thank you
          for sowing into the work of the Kingdom.
        </p>
      </section>

      <section className="mx-auto max-w-2xl px-6 py-14">
        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner className="h-7 w-7" />
          </div>
        ) : result && result.method === "transfer" ? (
          <Card className="p-8 text-center">
            <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
            <h2 className="mt-4 text-2xl text-ink-900">Thank you for your gift!</h2>
            <p className="mt-2 text-ink-500">
              Please complete your{" "}
              <span className="font-semibold capitalize">{form.type}</span> of{" "}
              <span className="font-semibold">{naira(Number(form.amount))}</span> using the
              details below.
            </p>
            <div className="mx-auto mt-6 max-w-sm rounded-2xl bg-brand-50 p-6 text-left">
              <div className="mb-3 flex items-center gap-2 text-brand-800">
                <Landmark className="h-5 w-5" />
                <span className="font-semibold">Bank transfer</span>
              </div>
              <dl className="space-y-2 text-sm">
                <Row label="Bank" value={result.giving!.bankName} />
                <Row label="Account name" value={result.giving!.accountName} />
                <Row label="Account number" value={result.giving!.accountNumber} />
                <Row label="Reference" value={result.reference} highlight />
              </dl>
            </div>
            <Button
              className="mt-6"
              variant="outline"
              onClick={() => {
                setResult(null);
                setSubmitting(false);
                setForm({ ...form, amount: "" });
              }}
            >
              Make another gift
            </Button>
          </Card>
        ) : (
          <Card className="p-8">
            {options?.online && (
              <div className="mb-6 grid grid-cols-2 gap-3">
                <MethodTile
                  active={method === "online"}
                  onClick={() => setMethod("online")}
                  icon={<CreditCard className="h-5 w-5" />}
                  title="Card / Online"
                  subtitle={
                    options.onlineLive
                      ? options.provider === "flutterwave"
                        ? "Secured by Flutterwave"
                        : "Secured by Paystack"
                      : "Instant & secure"
                  }
                />
                <MethodTile
                  active={method === "transfer"}
                  onClick={() => setMethod("transfer")}
                  icon={<Landmark className="h-5 w-5" />}
                  title="Bank transfer"
                  subtitle="Get account details"
                />
              </div>
            )}

            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Giving type">
                  <Select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                  >
                    {TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Amount (₦)">
                  <Input
                    type="number"
                    min="1"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    placeholder="5000"
                    required
                  />
                </Field>
              </div>
              <Field label="Full name">
                <Input
                  value={form.donorName}
                  onChange={(e) => setForm({ ...form, donorName: e.target.value })}
                  placeholder="Optional"
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Email">
                  <Input
                    type="email"
                    value={form.donorEmail}
                    onChange={(e) => setForm({ ...form, donorEmail: e.target.value })}
                    placeholder={method === "online" ? "For your receipt" : "Optional"}
                  />
                </Field>
                <Field label="Phone">
                  <Input
                    value={form.donorPhone}
                    onChange={(e) => setForm({ ...form, donorPhone: e.target.value })}
                    placeholder="Optional"
                  />
                </Field>
              </div>
              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                size="lg"
                variant="gold"
                loading={submitting}
                className="w-full"
              >
                {method === "online" ? "Give securely" : "Continue"}{" "}
                {form.amount && naira(Number(form.amount))}
              </Button>
              {method === "online" && !options?.onlineLive && (
                <p className="text-center text-xs text-ink-400">
                  Demo mode: no live payment keys yet — you'll see a simulated success.
                </p>
              )}
            </form>
          </Card>
        )}
      </section>
    </div>
  );
}

function MethodTile({
  active,
  onClick,
  icon,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${
        active
          ? "border-brand-500 bg-brand-50"
          : "border-ink-200 hover:bg-ink-50"
      }`}
    >
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-lg ${
          active ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-500"
        }`}
      >
        {icon}
      </span>
      <span>
        <span className="block text-sm font-semibold text-ink-800">{title}</span>
        <span className="block text-xs text-ink-500">{subtitle}</span>
      </span>
    </button>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-ink-500">{label}</dt>
      <dd className={highlight ? "font-bold text-brand-800" : "font-medium text-ink-800"}>
        {value}
      </dd>
    </div>
  );
}
