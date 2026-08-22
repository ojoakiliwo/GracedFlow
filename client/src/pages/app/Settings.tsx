import { useState } from "react";
import { MessageSquare, Mail, CreditCard, Share2, Send, CheckCircle2, Circle } from "lucide-react";
import { apiPost } from "../../lib/api";
import { useApi } from "../../lib/useApi";
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Select,
  Spinner,
} from "../../components/ui";
import { useToast } from "../../components/toast";
import { useAuth } from "../../lib/auth";

interface IntegrationsData {
  integrations: { key: string; name: string; live: boolean; detail: string }[];
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  sms: MessageSquare,
  email: Mail,
  payments: CreditCard,
  social: Share2,
};

export default function Settings() {
  const { data, loading } = useApi<IntegrationsData>("/settings/integrations");
  const { hasRole } = useAuth();
  const [channel, setChannel] = useState<"sms" | "email">("sms");
  const [to, setTo] = useState("");
  const [sending, setSending] = useState(false);
  const { notify } = useToast();

  async function sendTest(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      const res = await apiPost<{ provider: string }>("/settings/test-message", {
        channel,
        to,
      });
      notify(
        `Test ${channel} sent via ${res.provider}${
          res.provider === "dryrun" ? " (simulated — add credentials to send for real)" : ""
        }`,
        res.provider === "dryrun" ? "info" : "success",
      );
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Settings & Integrations"
        subtitle="Connect SMS, email, payments and social accounts to go fully live."
      />

      {loading || !data ? (
        <div className="flex h-48 items-center justify-center">
          <Spinner className="h-7 w-7" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            {data.integrations.map((i) => {
              const Icon = ICONS[i.key] ?? Circle;
              return (
                <Card key={i.key} className="flex items-center gap-4 p-5">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                      i.live ? "bg-emerald-50 text-emerald-600" : "bg-ink-100 text-ink-500"
                    }`}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-ink-900">{i.name}</h3>
                      <Badge color={i.live ? "green" : "gray"}>
                        {i.live ? (
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Live
                          </span>
                        ) : (
                          "Simulated"
                        )}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-sm text-ink-500">{i.detail}</p>
                  </div>
                </Card>
              );
            })}
          </div>

          <Card className="h-fit p-6">
            <div className="mb-4 flex items-center gap-2">
              <Send className="h-5 w-5 text-brand-600" />
              <h3 className="text-lg text-ink-900">Send a test message</h3>
            </div>
            {hasRole("admin") ? (
              <form onSubmit={sendTest} className="space-y-4">
                <Field label="Channel">
                  <Select
                    value={channel}
                    onChange={(e) => setChannel(e.target.value as "sms" | "email")}
                  >
                    <option value="sms">SMS</option>
                    <option value="email">Email</option>
                  </Select>
                </Field>
                <Field label={channel === "sms" ? "Phone number" : "Email address"}>
                  <Input
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    placeholder={channel === "sms" ? "+234..." : "you@example.com"}
                    required
                  />
                </Field>
                <Button type="submit" loading={sending} className="w-full">
                  Send test
                </Button>
              </form>
            ) : (
              <p className="text-sm text-ink-400">
                Only admins can send test messages.
              </p>
            )}
          </Card>

          <Card className="p-6 lg:col-span-3">
            <h3 className="mb-3 text-lg text-ink-900">How to go live</h3>
            <div className="space-y-2 text-sm text-ink-600">
              <p>
                Add the relevant credentials to the server environment (see{" "}
                <code className="rounded bg-ink-100 px-1.5 py-0.5">server/.env.example</code>
                ), then restart the API:
              </p>
              <ul className="ml-5 list-disc space-y-1 text-ink-500">
                <li>
                  <strong>SMS:</strong> <code>SMS_PROVIDER=twilio</code>,{" "}
                  <code>TWILIO_ACCOUNT_SID</code>, <code>TWILIO_AUTH_TOKEN</code>,{" "}
                  <code>TWILIO_FROM</code>
                </li>
                <li>
                  <strong>Email:</strong> <code>EMAIL_PROVIDER=smtp</code>,{" "}
                  <code>SMTP_HOST</code>, <code>SMTP_USER</code>, <code>SMTP_PASS</code>
                </li>
                <li>
                  <strong>Payments (Flutterwave v4):</strong>{" "}
                  <code>FLW_CLIENT_ID</code>, <code>FLW_CLIENT_SECRET</code>,{" "}
                  <code>FLW_ENCRYPTION_KEY</code>, <code>FLW_ENV=live</code>.
                  Gifts confirm when the donor returns from checkout — a
                  webhook is optional. (Or Paystack:{" "}
                  <code>PAYSTACK_SECRET_KEY</code>, <code>PAYSTACK_PUBLIC_KEY</code>)
                </li>
                <li>
                  <strong>Social:</strong> <code>SOCIAL_CONNECTED=facebook,twitter,...</code>
                </li>
              </ul>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
