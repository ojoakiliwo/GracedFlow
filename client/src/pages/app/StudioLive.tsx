import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Facebook,
  Instagram,
  Radio,
  Square,
  Youtube,
} from "lucide-react";
import { Badge, Button, Input } from "../../components/ui";
import { useToast } from "../../components/toast";
import { useApi } from "../../lib/useApi";
import { apiPut } from "../../lib/api";
import { useBroadcastStudio } from "../../lib/useBroadcastStudio";
import {
  draftsFromConfig,
  savePayload,
  type StudioLiveConfig,
  type StudioLiveDraft,
} from "../../lib/studioLive";

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M14.5 3h2.1c.2 1.8 1.2 3.4 2.7 4.4 1 .7 2.1 1 3.2 1.1v2.2c-1.5 0-3-.4-4.3-1.2v6.8c0 3.8-3.1 6.8-6.9 6.8S4.4 20.1 4.4 16.3c0-3.7 3-6.7 6.7-6.8v2.3c-2.4.1-4.4 2.1-4.4 4.5 0 2.5 2 4.5 4.5 4.5s4.5-2 4.5-4.5V3z" />
    </svg>
  );
}

function platformIcon(id: string) {
  if (id === "youtube") return Youtube;
  if (id === "facebook") return Facebook;
  if (id === "instagram") return Instagram;
  return TikTokIcon;
}

export default function StudioLive() {
  const s = useBroadcastStudio();
  const live = s.status === "live";
  const { data, loading, error, reload } = useApi<StudioLiveConfig>("/studio/live");
  const [drafts, setDrafts] = useState<StudioLiveDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const { notify } = useToast();

  useEffect(() => {
    if (data) setDrafts(draftsFromConfig(data));
  }, [data]);

  function patch(platform: string, next: Partial<StudioLiveDraft>) {
    setDrafts((prev) => prev.map((d) => (d.platform === platform ? { ...d, ...next } : d)));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const saved = await apiPut<StudioLiveConfig>("/studio/live", savePayload(drafts));
      setDrafts(draftsFromConfig(saved));
      notify("Destinations saved");
      reload();
    } catch (err) {
      notify((err as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  if (s.outputFocus) {
    return (
      <div className="fixed inset-0 z-50 bg-black">
        <canvas ref={s.canvasRef} className="h-full w-full object-contain" />
        <canvas ref={s.previewCanvasRef} className="hidden" />
        <button
          type="button"
          onClick={() => s.setOutputFocus(false)}
          className="absolute right-4 top-4 rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20"
        >
          Back to desk
        </button>
      </div>
    );
  }

  return (
    <div className="-mx-4 -my-6 min-h-[calc(100vh-4rem)] bg-[#0b0c10] px-3 py-4 text-ink-100 sm:-mx-6 lg:-mx-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          <Link
            to="/app/studio"
            className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-gold-300 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" /> Back to studio
          </Link>
          <h1 className="font-display text-2xl text-white sm:text-3xl">Go live</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-400">
            Paste each platform’s stream key once. Then Go live from this desk — Program goes
            straight on air. You do not open OBS.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge color={live ? "red" : "gray"}>{live ? "Capture on" : "Standby"}</Badge>
          {s.socialLive ? <Badge color="red">Social live</Badge> : null}
        </div>
      </div>

      {s.error ? (
        <p className="mb-3 rounded-lg border border-rose-800 bg-rose-950/60 px-3 py-2 text-sm text-rose-200">
          {s.error}
        </p>
      ) : null}
      {error ? (
        <p className="mb-3 rounded-lg border border-rose-800 bg-rose-950/60 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink-300">
              Program
            </span>
            {s.socialLive ? (
              <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                On air
              </span>
            ) : null}
          </div>
          <canvas ref={s.canvasRef} className="aspect-video w-full bg-black" />
          <canvas ref={s.previewCanvasRef} className="hidden" />
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#14161d] p-4">
          <p className="text-sm leading-relaxed text-ink-300">
            {data?.restreamDetail ||
              "Save the four stream keys, then Go live from this desk."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {s.socialLive ? (
              <Button variant="danger" onClick={s.stopSocialLive}>
                <Square className="h-4 w-4" /> End live
              </Button>
            ) : (
              <Button variant="gold" disabled={s.socialConnecting} onClick={() => void s.goLiveToAir()}>
                <Radio className="h-4 w-4" />
                {s.socialConnecting ? "Going live…" : "Go live"}
              </Button>
            )}
          </div>
          {s.socialPlatforms.length > 0 ? (
            <p className="mt-3 text-[11px] text-gold-300">
              Sending to {s.socialPlatforms.join(", ")}.
            </p>
          ) : null}
          <p className="mt-3 text-[11px] leading-relaxed text-ink-500">
            {data?.restream
              ? "Start capture is included in Go live. Destinations that are On receive Program together."
              : "Ask an admin to set LIVEPEER_API_KEY on Vercel (Livepeer Studio → Developers → API Key), then redeploy. That is a one-time pipe — not an app you open on Sunday."}
          </p>
        </div>
      </div>

      {loading && drafts.length === 0 ? (
        <p className="text-sm text-ink-500">Loading destinations…</p>
      ) : (
        <form onSubmit={(e) => void save(e)} className="space-y-3">
          <div className="grid gap-3 lg:grid-cols-2">
            {drafts.map((d) => {
              const Icon = platformIcon(d.platform);
              return (
                <div key={d.platform} className="rounded-2xl border border-white/10 bg-[#14161d] p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                      <Icon className="h-4 w-4 text-gold-400" /> {d.label}
                    </h2>
                    <label className="flex items-center gap-2 text-xs text-ink-300">
                      <input
                        type="checkbox"
                        checked={d.enabled}
                        onChange={(e) => patch(d.platform, { enabled: e.target.checked })}
                        className="accent-gold-400"
                      />
                      On
                    </label>
                  </div>
                  <label className="mb-2 block">
                    <span className="mb-1 block text-[11px] text-ink-400">Stream URL</span>
                    <Input
                      value={d.ingestUrl}
                      onChange={(e) => patch(d.platform, { ingestUrl: e.target.value })}
                      placeholder="rtmps://…"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] text-ink-400">
                      Stream key{d.streamKeySet ? ` · saved ${d.streamKeyHint}` : ""}
                    </span>
                    <Input
                      type="password"
                      autoComplete="off"
                      value={d.streamKey}
                      onChange={(e) => patch(d.platform, { streamKey: e.target.value })}
                      placeholder={d.streamKeySet ? "Leave blank to keep the saved key" : "Paste stream key"}
                    />
                  </label>
                  <ol className="mt-3 list-decimal space-y-1 pl-4 text-[11px] leading-relaxed text-ink-400">
                    {d.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                  <a
                    href={d.helpUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-[11px] font-medium text-gold-300 hover:underline"
                  >
                    Open {d.label}
                  </a>
                </div>
              );
            })}
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save destinations"}
          </Button>
        </form>
      )}
    </div>
  );
}
