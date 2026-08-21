import { useEffect, useState } from "react";
import { Mail, MessageSquare, Send, Users2, Eye } from "lucide-react";
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
  Textarea,
} from "../../components/ui";
import { formatDateTime, SPIRITUAL_CLASSES, ROLES } from "../../lib/format";
import { useToast } from "../../components/toast";

interface Dept {
  id: string;
  name: string;
}
interface Member {
  id: string;
  first_name: string;
  last_name: string;
}
interface MessageRow {
  id: string;
  channel: string;
  subject: string | null;
  audience_type: string;
  recipients_count: number;
  category: string;
  status: string;
  created_at: string;
  delivered: number;
  failed: number;
}
interface Preview {
  count: number;
  withPhone: number;
  withEmail: number;
  sample: string[];
}

export default function Messages() {
  const { data: depts } = useApi<Dept[]>("/departments");
  const { data: members } = useApi<Member[]>("/members");
  const { data: history, reload } = useApi<MessageRow[]>("/messages");

  const [channel, setChannel] = useState("both");
  const [audienceType, setAudienceType] = useState("all");
  const [audienceValue, setAudienceValue] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState(
    "Hello {{first_name}}, grace and peace to you from Infinitely Graced Church!",
  );
  const [preview, setPreview] = useState<Preview | null>(null);
  const [sending, setSending] = useState(false);
  const { notify } = useToast();

  useEffect(() => {
    setAudienceValue("");
    setPreview(null);
  }, [audienceType]);

  async function runPreview() {
    try {
      const res = await apiPost<Preview>("/messages/preview", {
        audienceType,
        audienceValue: audienceValue || undefined,
      });
      setPreview(res);
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      const res = await apiPost<{ recipients: number; sent: number; failed: number }>(
        "/messages",
        {
          channel,
          audienceType,
          audienceValue: audienceValue || undefined,
          subject: subject || undefined,
          body,
        },
      );
      notify(
        `Sent to ${res.recipients} member(s) · ${res.sent} deliveries, ${res.failed} failed`,
      );
      reload();
      setPreview(null);
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setSending(false);
    }
  }

  const needsValue = audienceType !== "all";

  return (
    <div>
      <PageHeader
        title="Messages"
        subtitle="Send bulk or single SMS & email — target the whole church or a specific class."
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="p-6 lg:col-span-3">
          <form onSubmit={send} className="space-y-4">
            <Field label="Channel">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { v: "sms", label: "SMS", icon: MessageSquare },
                  { v: "email", label: "Email", icon: Mail },
                  { v: "both", label: "SMS + Email", icon: Send },
                ].map((c) => (
                  <button
                    key={c.v}
                    type="button"
                    onClick={() => setChannel(c.v)}
                    className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                      channel === c.v
                        ? "border-brand-500 bg-brand-50 text-brand-700"
                        : "border-ink-200 text-ink-600 hover:bg-ink-50"
                    }`}
                  >
                    <c.icon className="h-4 w-4" /> {c.label}
                  </button>
                ))}
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Send to">
                <Select
                  value={audienceType}
                  onChange={(e) => setAudienceType(e.target.value)}
                >
                  <option value="all">Everyone (whole church)</option>
                  <option value="class">By spiritual class</option>
                  <option value="department">By department</option>
                  <option value="role">By role</option>
                  <option value="individual">A single member</option>
                </Select>
              </Field>
              {needsValue && (
                <Field label="Choose">
                  <Select
                    value={audienceValue}
                    onChange={(e) => setAudienceValue(e.target.value)}
                  >
                    <option value="">Select…</option>
                    {audienceType === "class" &&
                      SPIRITUAL_CLASSES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    {audienceType === "role" &&
                      ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    {audienceType === "department" &&
                      depts?.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    {audienceType === "individual" &&
                      members?.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.first_name} {m.last_name}
                        </option>
                      ))}
                  </Select>
                </Field>
              )}
            </div>

            {channel !== "sms" && (
              <Field label="Subject (email)">
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="A word of grace for you"
                />
              </Field>
            )}
            <Field
              label="Message"
              hint="Personalize with {{first_name}}, {{last_name}} or {{name}}"
            >
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                required
              />
            </Field>

            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={runPreview}>
                <Eye className="h-4 w-4" /> Preview audience
              </Button>
              <Button type="submit" loading={sending}>
                <Send className="h-4 w-4" /> Send message
              </Button>
            </div>

            {preview && (
              <div className="rounded-xl bg-brand-50 p-4 text-sm text-brand-800">
                <p className="flex items-center gap-2 font-medium">
                  <Users2 className="h-4 w-4" /> {preview.count} recipient(s) matched
                </p>
                <p className="mt-1 text-brand-600">
                  {preview.withPhone} with phone · {preview.withEmail} with email
                </p>
                {preview.sample.length > 0 && (
                  <p className="mt-1 text-xs text-brand-500">
                    e.g. {preview.sample.join(", ")}
                  </p>
                )}
              </div>
            )}
          </form>
        </Card>

        <Card className="p-6 lg:col-span-2">
          <h3 className="mb-4 text-lg text-ink-900">Recent broadcasts</h3>
          {!history ? (
            <Spinner />
          ) : history.length === 0 ? (
            <p className="text-sm text-ink-400">No messages sent yet.</p>
          ) : (
            <ul className="space-y-3">
              {history.slice(0, 12).map((m) => (
                <li key={m.id} className="rounded-xl border border-ink-100 p-3">
                  <div className="flex items-center justify-between">
                    <p className="truncate text-sm font-medium text-ink-800">
                      {m.subject || m.category.replace("auto:", "Auto: ")}
                    </p>
                    <Badge color={m.channel === "both" ? "brand" : "gray"}>
                      {m.channel}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-ink-400">
                    {m.recipients_count} recipients · {m.delivered} delivered
                    {m.failed ? ` · ${m.failed} failed` : ""}
                  </p>
                  <p className="text-xs text-ink-400">{formatDateTime(m.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
