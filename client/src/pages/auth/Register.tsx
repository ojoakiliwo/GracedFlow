import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { Button, Field, Input } from "../../components/ui";
import { PreviewLockNotice } from "../../components/PreviewLockNotice";
import { BrandLogo } from "../../components/BrandLogo";

export default function Register() {
  const { register, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(form);
      navigate("/app");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (authLoading) return null;
  if (user) return <Navigate to="/app" replace />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 p-6">
      <div className="w-full max-w-md rounded-2xl border border-ink-100 bg-white p-8 card-shadow">
        <BrandLogo size="md" className="mb-6">
          <span className="font-display text-lg font-semibold text-brand-900">
            Infinitely Graced Church
          </span>
        </BrandLogo>
        <h2 className="text-2xl text-ink-900">Create your account</h2>
        <p className="mt-1 text-sm text-ink-500">
          If your pastor already added you, use that same email or phone. This opens
          your existing record and does not create a second membership. New signups
          without a church record join as workers.
        </p>
        <PreviewLockNotice />

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name">
              <Input value={form.firstName} onChange={set("firstName")} required />
            </Field>
            <Field label="Last name">
              <Input value={form.lastName} onChange={set("lastName")} required />
            </Field>
          </div>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={set("email")} required />
          </Field>
          <Field label="Phone">
            <Input value={form.phone} onChange={set("phone")} placeholder="+234..." />
          </Field>
          <Field label="Password" hint="At least 6 characters">
            <Input
              type="password"
              value={form.password}
              onChange={set("password")}
              required
            />
          </Field>
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}
          <Button type="submit" size="lg" loading={loading} className="w-full">
            Create account
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-500">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-brand-700 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
