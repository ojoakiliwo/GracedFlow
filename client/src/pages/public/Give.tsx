import { useState } from "react";
import { HandCoins, CheckCircle2, Landmark } from "lucide-react";
import { apiPost } from "../../lib/api";
import { Button, Card, Field, Input, Select } from "../../components/ui";
import { naira } from "../../lib/format";

interface GiveResult {
  reference: string;
  giving: {
    bankName: string;
    accountName: string;
    accountNumber: string;
    onlineUrl?: string;
  };
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
  const [form, setForm] = useState({
    donorName: "",
    donorEmail: "",
    donorPhone: "",
    type: "tithe",
    amount: "",
  });
  const [result, setResult] = useState<GiveResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiPost<GiveResult>("/public/give", {
        ...form,
        amount: Number(form.amount),
      });
      setResult(res);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
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
        {result ? (
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
                <Row label="Bank" value={result.giving.bankName} />
                <Row label="Account name" value={result.giving.accountName} />
                <Row label="Account number" value={result.giving.accountNumber} />
                <Row label="Reference" value={result.reference} highlight />
              </dl>
            </div>
            <Button
              className="mt-6"
              variant="outline"
              onClick={() => {
                setResult(null);
                setForm({ ...form, amount: "" });
              }}
            >
              Make another gift
            </Button>
          </Card>
        ) : (
          <Card className="p-8">
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
                    placeholder="Optional"
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
              <Button type="submit" size="lg" variant="gold" loading={loading} className="w-full">
                Continue to give {form.amount && naira(Number(form.amount))}
              </Button>
            </form>
          </Card>
        )}
      </section>
    </div>
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
