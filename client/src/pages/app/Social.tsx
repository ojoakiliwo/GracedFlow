import { useState } from "react";
import {
  Facebook,
  Instagram,
  Twitter,
  Youtube,
  Send,
  Share2,
  MessageCircle,
} from "lucide-react";
import { apiPost } from "../../lib/api";
import { useApi } from "../../lib/useApi";
import { Badge, Button, Card, Field, PageHeader, Spinner, Textarea } from "../../components/ui";
import { formatDateTime } from "../../lib/format";
import { useToast } from "../../components/toast";

interface SocialData {
  connected: string[];
  posts: {
    id: string;
    content: string;
    platforms: string[];
    status: string;
    created_at: string;
    targets: { platform: string; status: string; external_url: string | null }[];
  }[];
}

const PLATFORMS = [
  { id: "facebook", label: "Facebook", icon: Facebook },
  { id: "twitter", label: "X (Twitter)", icon: Twitter },
  { id: "instagram", label: "Instagram", icon: Instagram },
  { id: "youtube", label: "YouTube", icon: Youtube },
  { id: "telegram", label: "Telegram", icon: Send },
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
];

export default function Social() {
  const { data, loading, reload } = useApi<SocialData>("/social");
  const [content, setContent] = useState("");
  const [selected, setSelected] = useState<string[]>(["facebook", "twitter", "instagram"]);
  const [posting, setPosting] = useState(false);
  const { notify } = useToast();

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function post(e: React.FormEvent) {
    e.preventDefault();
    if (selected.length === 0) return notify("Select at least one platform", "error");
    setPosting(true);
    try {
      const res = await apiPost<{ published: number; platforms: number }>("/social", {
        content,
        platforms: selected,
      });
      notify(`Published to ${res.published}/${res.platforms} platforms`);
      setContent("");
      reload();
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Social Broadcast"
        subtitle="Compose once and distribute to all your church social media accounts."
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="p-6 lg:col-span-3">
          <form onSubmit={post} className="space-y-4">
            <Field label="Post content">
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={5}
                required
                placeholder="Share an announcement, scripture or invitation..."
              />
              <p className="mt-1 text-right text-xs text-ink-400">
                {content.length} characters
              </p>
            </Field>
            <Field label="Distribute to">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {PLATFORMS.map((p) => {
                  const active = selected.includes(p.id);
                  const connected = data?.connected.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggle(p.id)}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                        active
                          ? "border-brand-500 bg-brand-50 text-brand-700"
                          : "border-ink-200 text-ink-600 hover:bg-ink-50"
                      }`}
                    >
                      <p.icon className="h-4 w-4" />
                      <span className="flex-1 text-left">{p.label}</span>
                      {!connected && (
                        <span className="text-[10px] text-ink-400">demo</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Button type="submit" loading={posting}>
              <Share2 className="h-4 w-4" /> Publish to {selected.length} platform(s)
            </Button>
            <p className="text-xs text-ink-400">
              Platforms marked “demo” are queued in preview mode until their API
              credentials are added in Settings — the distribution log still records each
              post.
            </p>
          </form>
        </Card>

        <Card className="p-6 lg:col-span-2">
          <h3 className="mb-4 text-lg text-ink-900">Distribution log</h3>
          {loading || !data ? (
            <Spinner />
          ) : data.posts.length === 0 ? (
            <p className="text-sm text-ink-400">No posts published yet.</p>
          ) : (
            <ul className="space-y-3">
              {data.posts.slice(0, 10).map((p) => (
                <li key={p.id} className="rounded-xl border border-ink-100 p-3">
                  <p className="line-clamp-2 text-sm text-ink-700">{p.content}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {p.targets.map((t) => (
                      <Badge
                        key={t.platform}
                        color={t.status === "published" ? "green" : "red"}
                      >
                        {t.platform}
                      </Badge>
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs text-ink-400">
                    {formatDateTime(p.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
