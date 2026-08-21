import { useState } from "react";
import { HeartHandshake, CheckCircle2 } from "lucide-react";
import { apiPost } from "../../lib/api";
import { Button, Card, Field, Input, Textarea } from "../../components/ui";

export default function Prayer() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", request: "" });
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiPost("/public/prayer-requests", form);
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <section className="grace-gradient px-6 py-16 text-center">
        <HeartHandshake className="mx-auto h-10 w-10 text-gold-300" />
        <h1 className="mt-4 font-display text-4xl font-semibold text-white">
          Request Prayer
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-brand-100">
          Our pastoral team would be honoured to stand with you in prayer. Share your
          request below — it is completely confidential.
        </p>
      </section>

      <section className="mx-auto max-w-2xl px-6 py-14">
        {done ? (
          <Card className="p-10 text-center">
            <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
            <h2 className="mt-4 text-2xl text-ink-900">We are praying with you</h2>
            <p className="mt-2 text-ink-500">
              Your prayer request has been received by our pastoral team. Be encouraged —
              His grace is sufficient for you.
            </p>
            <Button
              className="mt-6"
              variant="outline"
              onClick={() => {
                setDone(false);
                setForm({ name: "", email: "", phone: "", request: "" });
              }}
            >
              Submit another request
            </Button>
          </Card>
        ) : (
          <Card className="p-8">
            <form onSubmit={submit} className="space-y-4">
              <Field label="Your name">
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Optional"
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Email">
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="Optional"
                  />
                </Field>
                <Field label="Phone">
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="Optional"
                  />
                </Field>
              </div>
              <Field label="How can we pray for you?">
                <Textarea
                  value={form.request}
                  onChange={(e) => setForm({ ...form, request: e.target.value })}
                  rows={5}
                  required
                  placeholder="Share your prayer request..."
                />
              </Field>
              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                  {error}
                </p>
              )}
              <Button type="submit" size="lg" loading={loading} className="w-full">
                Send prayer request
              </Button>
            </form>
          </Card>
        )}
      </section>
    </div>
  );
}
