import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { Button, Field, Input } from "../../components/ui";
import { PreviewLockNotice } from "../../components/PreviewLockNotice";
import { BrandLogo } from "../../components/BrandLogo";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate("/app");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden grace-gradient lg:flex lg:flex-col lg:justify-between lg:p-12">
        <BrandLogo size="md">
          <span className="font-display text-xl font-semibold text-white">
            Infinitely Graced Church
          </span>
        </BrandLogo>
        <div>
          <h1 className="max-w-md font-display text-4xl font-semibold leading-tight text-white">
            Shepherd every soul with grace and excellence.
          </h1>
          <p className="mt-4 max-w-md text-brand-200">
            One portal for members, workers, departments, projects, giving and
            communication — flowing in His infinite grace.
          </p>
        </div>
        <p className="text-sm text-brand-300">Powered by GracedFlow</p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <BrandLogo size="lg">
              <span className="font-display text-lg font-semibold text-brand-900">
                Infinitely Graced Church
              </span>
            </BrandLogo>
          </div>
          <h2 className="text-2xl text-ink-900">Welcome back</h2>
          <p className="mt-1 text-sm text-ink-500">
            Sign in to the ministry portal to continue.
          </p>
          <PreviewLockNotice />

          <form onSubmit={submit} className="mt-8 space-y-4">
            <Field label="Email address">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@igc.church"
                required
              />
            </Field>
            <Field label="Password">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </Field>
            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" loading={loading} className="w-full">
              Sign in
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-500">
            New worker?{" "}
            <Link to="/register" className="font-medium text-brand-700 hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
