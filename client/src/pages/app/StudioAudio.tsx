import { Link } from "react-router-dom";
import { ArrowLeft, SlidersHorizontal } from "lucide-react";
import { Badge } from "../../components/ui";
import { AUDIO_PRESETS, getAudioPreset } from "../../lib/studioSound";
import { useBroadcastStudio } from "../../lib/useBroadcastStudio";

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex justify-between text-[11px] text-ink-400">
        <span>{label}</span>
        <span className="tabular-nums">
          {value.toFixed(step < 1 ? 2 : 0)}
          {suffix ?? ""}
        </span>
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

export default function StudioAudio() {
  const s = useBroadcastStudio();
  const live = s.status === "live";
  const preset = getAudioPreset(s.soundSettings.preset);
  const reverb = s.soundSettings.reverb;

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
          <h1 className="font-display text-2xl text-white sm:text-3xl">Advanced audio</h1>
          <p className="mt-1 text-sm text-ink-400">
            Turn off automatic living sound to pick a style yourself. Reverb can sit on any mix.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge color={live ? "red" : "gray"}>{live ? "On air" : "Standby"}</Badge>
          <Badge color={s.soundSettings.auto ? "green" : "gold"}>
            {s.soundSettings.auto ? "Automatic" : `Manual · ${preset.label}`}
          </Badge>
        </div>
      </div>

      {s.error ? (
        <p className="mb-3 rounded-lg border border-rose-800 bg-rose-950/60 px-3 py-2 text-sm text-rose-200">{s.error}</p>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-3">
          <div className="rounded-2xl border border-white/10 bg-[#14161d] p-4">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink-100">
              <SlidersHorizontal className="h-4 w-4 text-gold-400" /> Automatic living sound
            </h2>
            <p className="mb-3 text-[12px] leading-relaxed text-ink-400">
              Automatic follows the room for preaching and the music filter. Switch it off to lock Pop, Rock, Classical
              and the other styles.
            </p>
            <label className="flex items-center gap-3 text-sm text-ink-100">
              <input
                type="checkbox"
                checked={s.soundSettings.auto}
                onChange={(e) => s.setSoundAuto(e.target.checked)}
                className="h-4 w-4 accent-gold-400"
              />
              Automatic audio is {s.soundSettings.auto ? "on" : "off"}
            </label>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#14161d] p-4">
            <h2 className="mb-1 text-sm font-semibold text-ink-100">Style</h2>
            <p className="mb-3 text-[12px] text-ink-400">
              {s.soundSettings.auto
                ? "Turn automatic off, then tap a style. The mix locks to that sound."
                : `${preset.label}: ${preset.hint}`}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {AUDIO_PRESETS.map((p) => {
                const active = !s.soundSettings.auto && s.soundSettings.preset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => s.setAudioPreset(p.id)}
                    className={`rounded-lg border px-3 py-2.5 text-left transition ${
                      active
                        ? "border-gold-400 bg-gold-400/15 ring-1 ring-gold-400/40"
                        : "border-white/10 bg-black/20 hover:border-white/25"
                    }`}
                  >
                    <span className="block text-sm font-semibold text-ink-100">{p.label}</span>
                    <span className="mt-0.5 block text-[10px] leading-snug text-ink-500">{p.hint}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#14161d] p-4">
            <h2 className="mb-1 text-sm font-semibold text-ink-100">Reverb</h2>
            <p className="mb-3 text-[12px] text-ink-400">
              Add room after the mix. Keep it light on preaching; halls suit choir and classical.
            </p>
            <label className="mb-4 flex items-center gap-3 text-sm text-ink-100">
              <input
                type="checkbox"
                checked={reverb.enabled}
                onChange={(e) => s.setReverb({ enabled: e.target.checked })}
                className="h-4 w-4 accent-gold-400"
              />
              Reverb is {reverb.enabled ? "on" : "off"}
            </label>
            <div className={`grid gap-3 sm:grid-cols-2 ${reverb.enabled ? "" : "opacity-40"}`}>
              <SliderRow
                label="Mix"
                value={reverb.mix}
                min={0}
                max={0.7}
                step={0.01}
                onChange={(n) => s.setReverb({ mix: n })}
              />
              <SliderRow
                label="Room size"
                value={reverb.roomSize}
                min={0}
                max={1}
                step={0.01}
                onChange={(n) => s.setReverb({ roomSize: n })}
              />
              <SliderRow
                label="Decay"
                value={reverb.decay}
                min={0}
                max={1}
                step={0.01}
                onChange={(n) => s.setReverb({ decay: n })}
              />
              <SliderRow
                label="Pre-delay"
                value={reverb.preDelayMs}
                min={0}
                max={80}
                step={1}
                suffix=" ms"
                onChange={(n) => s.setReverb({ preDelayMs: n })}
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#14161d] p-4 lg:sticky lg:top-20">
          <h2 className="mb-3 text-sm font-semibold text-ink-100">On air meters</h2>
          <p className="mb-3 text-[11px] text-ink-500">
            {live
              ? "Capture is running. Changes apply to the live mix immediately."
              : "Start capture on the studio desk to hear these settings."}
          </p>
          <div className="mb-2 flex justify-between text-[10px] text-ink-400">
            <span>Input</span>
            <span>{Math.round(Math.min(100, s.meters.inputRms * 100))}%</span>
          </div>
          <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-black/40">
            <div
              className="h-full rounded-full bg-gold-400"
              style={{ width: `${Math.min(100, s.meters.inputRms * 100)}%` }}
            />
          </div>
          <div className="mb-2 flex justify-between text-[10px] text-ink-400">
            <span>On air</span>
            <span>{Math.round(Math.min(100, s.meters.outputRms * 100))}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-black/40">
            <div
              className="h-full rounded-full bg-emerald-400"
              style={{ width: `${Math.min(100, s.meters.outputRms * 100)}%` }}
            />
          </div>
          <Link
            to="/app/studio"
            className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-xl bg-brand-50 text-sm font-medium text-brand-800 hover:bg-brand-100"
          >
            <ArrowLeft className="mr-1 h-4 w-4" /> Return to desk
          </Link>
        </div>
      </div>
    </div>
  );
}
