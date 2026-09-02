import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useBroadcastStudio, type VideoLook } from "../../lib/useBroadcastStudio";
import { Badge, Button, Input, Select, Textarea } from "../../components/ui";
import {
  OVERLAY_DESIGNS,
  OVERLAY_PALETTES,
  suggestDesigns,
  type OverlayDesignId,
  type OverlayPaletteId,
} from "../../lib/studioOverlays";
import { getAudioPreset } from "../../lib/studioSound";
import { pictureKindLabel, soundKindLabel } from "../../lib/studioMedia";
import { socialRestreamHint } from "../../lib/studioLive";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Film,
  Mic,
  MonitorPlay,
  Music,
  Radio,
  RefreshCw,
  SlidersHorizontal,
  Square,
  Type,
  Video,
} from "lucide-react";

function formatClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function Meter({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  const pct = Math.min(100, Math.max(0, value * 100));
  return (
    <div>
      <div className="mb-1 flex justify-between text-[10px] font-medium text-ink-400">
        <span>{label}</span>
        <span>{Math.round(pct)}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-black/40">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex justify-between text-[10px] text-ink-400">
        <span>{label}</span>
        <span className="tabular-nums">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-gold-400"
      />
    </label>
  );
}

function DeskCard({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-[#14161d] p-4 ${className}`}>{children}</div>
  );
}

function StudioField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink-200">{label}</span>
      {children}
    </label>
  );
}

function MonitorWell({
  tally,
  title,
  live,
  children,
}: {
  tally: "preview" | "program";
  title: string;
  live: boolean;
  children: ReactNode;
}) {
  const isPgm = tally === "program";
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex h-2 w-2 rounded-full ${
              isPgm ? (live ? "bg-rose-500 shadow-[0_0_8px_#f43f5e]" : "bg-rose-900") : "bg-emerald-400"
            }`}
          />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink-300">{title}</span>
        </div>
        {isPgm && live ? (
          <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
            On air
          </span>
        ) : null}
      </div>
      <div
        className={`overflow-hidden rounded-md bg-black shadow-inner ring-2 ${
          isPgm ? "ring-rose-600/80" : "ring-emerald-500/70"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

export default function Studio() {
  const s = useBroadcastStudio();
  const live = s.status === "live";
  const suggested = suggestDesigns(s.overlay.headline, s.overlay.body);
  const selectedHits = s.bibleHits.filter((h) => s.selectedVerseRefs.includes(h.display));
  const selectedPalette = OVERLAY_PALETTES.find((p) => p.id === s.overlay.palette) ?? OVERLAY_PALETTES[0]!;
  const canTake = Boolean(s.overlay.headline.trim() || s.overlay.body.trim());
  const canStepVerse =
    s.programOverlay.visible && (Boolean(s.liveVerse) || s.programOverlay.design === "verse");

  return (
    <div className="-mx-4 -my-6 min-h-[calc(100vh-4rem)] bg-[#0b0c10] px-3 py-4 text-ink-100 sm:-mx-6 lg:-mx-8">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          <h1 className="font-display text-2xl text-white sm:text-3xl">Broadcast studio</h1>
          <p className="mt-1 text-sm text-ink-400">
            Preview → Take to live → Program. Scripture heard stays beside the monitors.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/app/studio/live"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-white/15 px-3 text-sm font-medium text-ink-100 hover:bg-white/10"
          >
            Destinations
          </Link>
          <Link
            to="/app/studio/media"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-white/15 px-3 text-sm font-medium text-ink-100 hover:bg-white/10"
          >
            Recorded media
          </Link>
          {s.socialLive ? (
            <Button variant="danger" size="sm" onClick={s.stopSocialLive}>
              <Square className="h-4 w-4" /> End live
            </Button>
          ) : (
            <Button
              variant="gold"
              size="sm"
              disabled={s.socialConnecting}
              onClick={() => void s.goLiveToAir()}
            >
              <Radio className="h-4 w-4" />
              {s.socialConnecting ? "Going live…" : "Go live"}
            </Button>
          )}
          <Badge color={live ? "red" : "gray"}>{live ? "On air" : "Standby"}</Badge>
          {s.recording ? <Badge color="red">Recording</Badge> : null}
          {s.socialLive ? <Badge color="red">Social live</Badge> : null}
          {s.listening ? <Badge color="green">Listening</Badge> : null}
          {s.musicFilter ? <Badge color="gold">Music filter</Badge> : null}
          {!s.soundSettings.auto ? (
            <Badge color="gold">Manual · {getAudioPreset(s.soundSettings.preset).label}</Badge>
          ) : null}
          {s.searchingQuotes ? <Badge color="gold">Searching quotes</Badge> : null}
          <span className="font-mono text-lg tabular-nums text-gold-300">{formatClock(s.elapsedSec)}</span>
        </div>
      </div>

      {s.error ? (
        <p className="mb-3 rounded-lg border border-rose-800 bg-rose-950/60 px-3 py-2 text-sm text-rose-200">{s.error}</p>
      ) : null}
      {s.socialLive && s.socialPlatforms.length > 0 ? (
        <p className="mb-3 text-[11px] leading-relaxed text-gold-300">{socialRestreamHint(s.socialPlatforms)}</p>
      ) : null}

      <div className="sticky top-16 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-[#12141a]/95 p-2 shadow-lg backdrop-blur">
        {s.status === "idle" || s.status === "error" ? (
          <Button onClick={() => void s.start()}>
            <Radio className="h-4 w-4" /> Start capture
          </Button>
        ) : (
          <Button variant="danger" onClick={s.stop}>
            <Square className="h-4 w-4" /> Stop
          </Button>
        )}
        {live && !s.recording ? (
          <Button variant="secondary" onClick={s.startRecording}>
            Record
          </Button>
        ) : null}
        {s.recording ? (
          <Button variant="danger" onClick={s.stopRecording}>
            Stop recording
          </Button>
        ) : null}
        <div className="mx-1 hidden h-6 w-px bg-white/15 sm:block" />
        <Button variant="gold" onClick={s.takeToLive} disabled={!canTake}>
          Take to live
        </Button>
        <Button variant="danger" onClick={s.clearLive}>
          Clear live
        </Button>
        <Button
          variant="secondary"
          disabled={!canStepVerse || s.steppingVerse}
          onClick={() => void s.stepLiveVerse(-1)}
        >
          <ChevronLeft className="h-4 w-4" /> Previous verse
        </Button>
        <Button
          variant="secondary"
          disabled={!canStepVerse || s.steppingVerse}
          onClick={() => void s.stepLiveVerse(1)}
        >
          Next verse <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant={s.musicFilter ? "gold" : "secondary"}
          disabled={!s.soundSettings.auto}
          onClick={() => s.setMusicFilter(!s.musicFilter)}
        >
          <Music className="h-4 w-4" /> {s.musicFilter ? "Music filter on" : "Music filter"}
        </Button>
        <span className="hidden text-[11px] text-ink-400 xl:inline">
          Take to live clears Preview. Music filter lightens worship; switch it off for preaching.
        </span>
      </div>

      <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
        <div className="min-w-0 space-y-3">
          <div className="grid gap-3 lg:grid-cols-2">
            <MonitorWell tally="preview" title="Preview" live={false}>
              <canvas ref={s.previewCanvasRef} className="aspect-video w-full bg-black" />
            </MonitorWell>
            <MonitorWell tally="program" title="Program / live" live={s.programOverlay.visible}>
              <canvas ref={s.canvasRef} className="aspect-video w-full bg-black" />
            </MonitorWell>
          </div>
          <p className="text-[11px] text-ink-500">
            Type or post a verse onto Preview, then Take to live. Preview clears automatically. Use Previous / Next verse
            on Program, and Music filter while worship is playing.
          </p>
        </div>

        <DeskCard className="max-h-[min(70vh,720px)] overflow-hidden p-0 xl:sticky xl:top-[7.5rem]">
          <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-100">
              <BookOpen className="h-4 w-4 text-gold-400" /> Scripture heard
            </h2>
            {s.bibleHits.length ? (
              <button
                type="button"
                className="text-[11px] font-medium text-gold-300 hover:underline"
                onClick={s.dismissBibleHits}
              >
                Clear list
              </button>
            ) : null}
          </div>
          <div className="max-h-[min(58vh,620px)] overflow-y-auto p-3">
            <p className="mb-2 text-[11px] leading-relaxed text-ink-400">
              Matches stay beside the monitors. Select a card, then post it to Preview — never auto-posted.
            </p>
            {!s.listening ? (
              <Button size="sm" variant="secondary" className="mb-3" onClick={() => s.startListening()}>
                Listen for verses
              </Button>
            ) : (
              <Button size="sm" variant="ghost" className="mb-3 text-ink-200 hover:bg-white/10" onClick={s.stopListening}>
                Stop listening
              </Button>
            )}
            {s.bibleHits.length === 0 ? (
              <p className="rounded-md border border-dashed border-white/15 px-3 py-6 text-center text-xs text-ink-500">
                No matches yet. Speak a reference or quote, or type it in the graphics panel.
              </p>
            ) : (
              <ul className="space-y-2">
                {s.bibleHits.map((hit) => {
                  const selected = s.selectedVerseRefs.includes(hit.display);
                  return (
                    <li key={`${hit.source ?? "ref"}-${hit.display}`}>
                      <button
                        type="button"
                        onClick={() => s.toggleVerseHit(hit.display)}
                        className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                          selected
                            ? "border-gold-400 bg-gold-400/15 ring-1 ring-gold-400/40"
                            : "border-white/10 bg-black/20 hover:border-gold-400/40"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-gold-200">{hit.display}</p>
                          {selected ? (
                            <span className="text-[10px] font-bold uppercase tracking-wide text-gold-300">Selected</span>
                          ) : null}
                        </div>
                        <p className="mt-1 line-clamp-4 text-xs leading-relaxed text-ink-300">
                          {hit.snippet || "Select, then post to Preview to load the verse text."}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {selectedHits.length > 0 ? (
              <Button className="mt-3 w-full" disabled={s.postingVerse} onClick={() => void s.postBibleVerses()}>
                {s.postingVerse
                  ? "Preparing…"
                  : `Post ${selectedHits.length} verse${selectedHits.length === 1 ? "" : "s"} to Preview`}
              </Button>
            ) : null}
          </div>
        </DeskCard>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        <DeskCard>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-100">
            <Type className="h-4 w-4 text-gold-400" /> Graphics (Preview)
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <StudioField label="Headline">
              <Input
                value={s.overlay.headline}
                onChange={(e) => s.updateOverlay({ headline: e.target.value })}
                placeholder="John 3:16"
              />
            </StudioField>
            <StudioField label="Layout">
              <Select
                value={s.overlay.design}
                onChange={(e) => s.updateOverlay({ design: e.target.value as OverlayDesignId })}
              >
                {OVERLAY_DESIGNS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </Select>
            </StudioField>
          </div>
          <div className="mt-3">
            <StudioField label="Body">
              <Textarea
                rows={3}
                value={s.overlay.body}
                onChange={(e) => s.updateOverlay({ body: e.target.value })}
                placeholder="For God so loved the world…"
              />
            </StudioField>
          </div>
          {suggested.length > 0 ? (
            <p className="mt-2 text-[11px] text-ink-400">
              Suggested layout: {OVERLAY_DESIGNS.find((d) => d.id === suggested[0])?.label}
            </p>
          ) : null}

          <p className="mb-2 mt-4 text-[10px] font-bold uppercase tracking-[0.18em] text-ink-400">
            Background + matching text
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {OVERLAY_PALETTES.map((p) => {
              const active = s.overlay.palette === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => s.updateOverlay({ palette: p.id as OverlayPaletteId })}
                  className={`rounded-lg border p-2 text-left transition ${
                    active ? "border-gold-400 ring-1 ring-gold-400/50" : "border-white/10 hover:border-white/25"
                  }`}
                >
                  <span
                    className="mb-1.5 flex h-8 items-center justify-center rounded text-sm font-semibold"
                    style={{ background: p.bg, color: p.text, boxShadow: `inset 0 0 0 2px ${p.accent}` }}
                  >
                    Aa
                  </span>
                  <span className="block text-[11px] font-semibold text-ink-100">{p.label}</span>
                  {p.recommended ? (
                    <span className="text-[10px] font-medium text-gold-300">Best match</span>
                  ) : (
                    <span className="text-[10px] text-ink-500">Studio option</span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-ink-500">{selectedPalette.hint}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="gold" onClick={s.takeToLive} disabled={!canTake}>
              Take to live
            </Button>
            <Button size="sm" variant="danger" onClick={s.clearLive}>
              Clear live
            </Button>
          </div>
        </DeskCard>

        <DeskCard>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-100">
            <Video className="h-4 w-4 text-gold-400" /> Sources
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <StudioField label="Camera">
              <Select
                value={s.cameraId}
                onChange={(e) => void s.selectCamera(e.target.value)}
                disabled={Boolean(s.busySource) || s.cameras.length === 0}
              >
                {s.cameras.length === 0 ? <option value="">No camera found</option> : null}
                {s.cameras.map((c) => (
                  <option key={c.deviceId} value={c.deviceId}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </StudioField>
            <StudioField label="Microphone">
              <Select
                value={s.micId}
                onChange={(e) => void s.selectMic(e.target.value)}
                disabled={Boolean(s.busySource) || s.mics.length === 0}
              >
                {s.mics.length === 0 ? <option value="">No microphone found</option> : null}
                {s.mics.map((m) => (
                  <option key={m.deviceId} value={m.deviceId}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </StudioField>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="mt-3"
            onClick={() => void s.refreshDevices()}
            disabled={Boolean(s.busySource)}
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh devices
          </Button>
          <p className="mt-2 text-[11px] text-ink-500">
            Yamaha USB: pick the mixer as microphone. Listen-for-verses uses the browser default mic.
          </p>
          <p className="mt-2 text-[11px] text-ink-300">
            Program picture: {pictureKindLabel(s.pictureKind)}. Sound: {soundKindLabel(s.soundKind)}.
          </p>
          <Link
            to="/app/studio/media"
            className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-white/15 text-sm font-medium text-ink-100 hover:bg-white/10"
          >
            <Film className="h-3.5 w-3.5" /> Recorded video, picture or audio
          </Link>
        </DeskCard>

        <DeskCard>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-100">
            <Mic className="h-4 w-4 text-gold-400" /> Living sound
          </h2>
          <Meter label="Input" value={s.meters.inputRms} color="bg-gold-400" />
          <div className="mt-2">
            <Meter label="On air" value={s.meters.outputRms} color="bg-emerald-400" />
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-ink-400">
            {!s.soundSettings.auto
              ? `Automatic is off. Style is locked to ${getAudioPreset(s.soundSettings.preset).label}. Open advanced audio to change it.`
              : s.musicFilter
                ? "Music filter is on: lighter mix so worship is not as heavy as preaching. Switch it off when the music stops so every instrument and voice comes through clearly."
                : "Speech mix is louder and fuller for preaching. Turn on Music filter when worship starts."}
          </p>
          <label className="mt-3 flex items-center gap-2 text-sm text-ink-200">
            <input
              type="checkbox"
              checked={s.monitor}
              onChange={(e) => s.setMonitor(e.target.checked)}
              className="accent-gold-400"
            />
            Monitor in this room
          </label>
          {s.recordingUrl ? (
            <a
              href={s.recordingUrl}
              download={`igc-service-${new Date().toISOString().slice(0, 10)}.webm`}
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-gold-300 hover:underline"
            >
              <Clapperboard className="h-4 w-4" /> Download recording
            </a>
          ) : null}
          <Link
            to="/app/studio/live"
            className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-gold-400 text-sm font-semibold text-brand-950 hover:bg-gold-300"
          >
            <Radio className="h-3.5 w-3.5" /> Destinations
          </Link>
          <Link
            to="/app/studio/media"
            className="mt-2 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-brand-50 text-sm font-medium text-brand-800 hover:bg-brand-100"
          >
            <Film className="h-3.5 w-3.5" /> Recorded media
          </Link>
          <Link
            to="/app/studio/audio"
            className="mt-2 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-brand-50 text-sm font-medium text-brand-800 hover:bg-brand-100"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" /> Advanced audio
          </Link>
        </DeskCard>
      </div>

      <DeskCard className="mt-3">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-100">
          <MonitorPlay className="h-4 w-4 text-gold-400" /> Picture
        </h2>
        <label className="mb-3 flex items-center gap-2 text-sm text-ink-200">
          <input
            type="checkbox"
            checked={s.look.auto}
            onChange={(e) => s.setLook((l: VideoLook) => ({ ...l, auto: e.target.checked }))}
            className="accent-gold-400"
          />
          Auto exposure
        </label>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SliderRow
            label="Brightness"
            value={s.look.brightness}
            min={0.6}
            max={1.5}
            step={0.01}
            onChange={(n) => s.setLook((l: VideoLook) => ({ ...l, brightness: n }))}
          />
          <SliderRow
            label="Contrast"
            value={s.look.contrast}
            min={0.6}
            max={1.6}
            step={0.01}
            onChange={(n) => s.setLook((l: VideoLook) => ({ ...l, contrast: n }))}
          />
          <SliderRow
            label="Saturation"
            value={s.look.saturation}
            min={0.4}
            max={1.8}
            step={0.01}
            onChange={(n) => s.setLook((l: VideoLook) => ({ ...l, saturation: n }))}
          />
          <SliderRow
            label="Warmth"
            value={s.look.warmth}
            min={0}
            max={1}
            step={0.01}
            onChange={(n) => s.setLook((l: VideoLook) => ({ ...l, warmth: n }))}
          />
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-ink-200">
          <input
            type="checkbox"
            checked={s.look.mirror}
            onChange={(e) => s.setLook((l: VideoLook) => ({ ...l, mirror: e.target.checked }))}
            className="accent-gold-400"
          />
          Mirror preview
        </label>
      </DeskCard>
    </div>
  );
}
