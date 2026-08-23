import { useState } from "react";
import { HandCoins, CheckCircle2, Landmark, CreditCard } from "lucide-react";
import { apiPost } from "../../lib/api";
import { useApi } from "../../lib/useApi";
import { Button, Card, Field, Input, Select, Spinner } from "../../components/ui";
import { GIVING_CURRENCIES, money } from "../../lib/currencies";

type CheckoutProvider = "paystack" | "flutterwave" | "dryrun";

interface GivingOptions {
  currency: string;
  currencies?: { code: string; name: string; symbol: string }[];
  online: boolean;
  onlineLive: boolean;
  provider?: CheckoutProvider;
  providers?: { flutterwave: boolean; paystack: boolean };
  paystackCurrencies?: string[];
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
  const [checkout, setCheckout] = useState<CheckoutProvider | "">("");
  const [form, setForm] = useState({
    donorName: "",
    donorEmail: "",
    donorPhone: "",
    type: "tithe",
    amount: "",
    currency: "NGN",
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
        currency: form.currency,
        method,
        provider:
          method === "online"
            ? paystackCanTake(options, form.currency)
              ? checkout || undefined
              : "flutterwave"
            : undefined,
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
              <span className="font-semibold">
                {money(Number(form.amount), form.currency)}
              </span>{" "}
              using the
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
              <div className="mb-6 space-y-3">
                <div className={`grid gap-3 ${hasBankDetails(options) ? "grid-cols-2" : "grid-cols-1"}`}>
                  <MethodTile
                    active={method === "online"}
                    onClick={() => setMethod("online")}
                    icon={<CreditCard className="h-5 w-5" />}
                    title="Card / Online"
                    subtitle={onlineSubtitle(options)}
                  />
                  {hasBankDetails(options) && (
                  <MethodTile
                    active={method === "transfer"}
                    onClick={() => {
                      setMethod("transfer");
                      setForm((f) => ({ ...f, currency: "NGN" }));
                    }}
                      icon={<Landmark className="h-5 w-5" />}
                      title="Bank transfer"
                      subtitle="Get account details"
                    />
                  )}
                </div>
                {method === "online" &&
                  bothLive(options) &&
                  paystackCanTake(options, form.currency) && (
                  <div className="grid grid-cols-2 gap-3">
                    <MethodTile
                      active={checkout === "flutterwave" || (!checkout && options.provider !== "paystack")}
                      onClick={() => setCheckout("flutterwave")}
                      icon={<CreditCard className="h-5 w-5" />}
                      title="Flutterwave"
                      subtitle="Cards, transfer, USSD"
                    />
                    <MethodTile
                      active={checkout === "paystack" || (!checkout && options.provider === "paystack")}
                      onClick={() => setCheckout("paystack")}
                      icon={<CreditCard className="h-5 w-5" />}
                      title="Paystack"
                      subtitle="Nigerian cards & bank"
                    />
                  </div>
                )}
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
                <Field label="Amount">
                  <Input
                    type="number"
                    min="1"
                    step={form.currency === "NGN" ? "1" : "0.01"}
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    placeholder={form.currency === "NGN" ? "5000" : "25"}
                    required
                  />
                </Field>
              </div>
              <Field
                label="Currency"
                hint={currencyHint(method, form.currency)}
              >
                <Select
                  value={form.currency}
                  onChange={(e) => {
                    const currency = e.target.value;
                    setForm({ ...form, currency });
                    if (currency !== "NGN" && method === "transfer") setMethod("online");
                    if (!paystackCanTake(options, currency)) setCheckout("flutterwave");
                  }}
                >
                  {(options?.currencies?.length ? options.currencies : [...GIVING_CURRENCIES]).map(
                    (c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} — {c.name}
                      </option>
                    ),
                  )}
                </Select>
              </Field>
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
                {form.amount && money(Number(form.amount), form.currency)}
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

function hasBankDetails(options: GivingOptions): boolean {
  const number = options.bank?.accountNumber?.trim() ?? "";
  return number.length > 0 && number !== "0000000000";
}

function bothLive(options: GivingOptions): boolean {
  return !!options.providers?.flutterwave && !!options.providers?.paystack;
}

function paystackCanTake(options: GivingOptions | null | undefined, currency: string): boolean {
  const allowed = options?.paystackCurrencies;
  if (allowed && allowed.length > 0) return allowed.includes(currency);
  return currency === "NGN";
}

function currencyHint(method: "online" | "transfer", currency: string): string {
  if (method === "transfer") return "Bank transfer is received in Nigerian Naira.";
  if (currency === "NGN") {
    return "Naira checkout is for Nigerian cards. Paying from a dollar account? Switch to USD.";
  }
  return "Dollar and other currencies go through Flutterwave. Paystack on this church account cannot take foreign cards.";
}

function onlineSubtitle(options: GivingOptions): string {
  if (!options.onlineLive) return "Instant & secure";
  if (bothLive(options)) return "Naira: Paystack or Flutterwave. Dollars: Flutterwave.";
  if (options.providers?.flutterwave) return "Secured by Flutterwave";
  if (options.providers?.paystack) return "Secured by Paystack";
  return "Instant & secure";
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
