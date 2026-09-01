import { useState } from "react";
import { MessageSquare, Mail, CreditCard, Share2, Radio, Send, CheckCircle2, Circle } from "lucide-react";
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
  livestream: Radio,
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
        subtitle="Church notices go out by email and SMS. Connect those two first."
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
                  <strong>SMS (Nigeria):</strong> add{" "}
                  <code>BULKSMS_API_TOKEN</code> and <code>BULKSMS_SENDER_ID</code>{" "}
                  (max 11 characters, registered in BulkSMS Nigeria). Termii or Twilio
                  also work if those keys are set instead.
                </li>
                <li>
                  <strong>Email:</strong> send from{" "}
                  <code>@infinitelygracedchurch.com</code> via Brevo. Set{" "}
                  <code>SMTP_HOST=smtp-relay.brevo.com</code>,{" "}
                  <code>SMTP_PORT=587</code>, <code>SMTP_USER</code> (Brevo SMTP
                  login), <code>SMTP_PASS</code> (Brevo SMTP key, not the API
                  key), and <code>EMAIL_FROM</code>.
                </li>
                <li>
                  <strong>Payments:</strong> Flutterwave{" "}
                  <code>FLW_CLIENT_ID</code>, <code>FLW_CLIENT_SECRET</code>,{" "}
                  <code>FLW_ENCRYPTION_KEY</code> and/or Paystack{" "}
                  <code>PAYSTACK_SECRET_KEY</code>, <code>PAYSTACK_PUBLIC_KEY</code>.
                  Both can be live together. Gifts confirm on checkout return —
                  you can keep each account’s webhook on the other project.
                </li>
                <li>
                  <strong>Social:</strong> <code>SOCIAL_CONNECTED=facebook,twitter,...</code>
                </li>
                <li>
                  <strong>Studio livestream:</strong> save YouTube / Facebook / Instagram /
                  TikTok stream keys in Broadcast studio → Go live. One-click send needs{" "}
                  <code>CF_ACCOUNT_ID</code> and <code>CF_STREAM_API_TOKEN</code>.
                </li>
              </ul>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
