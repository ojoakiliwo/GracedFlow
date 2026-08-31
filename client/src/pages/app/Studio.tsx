import { useBroadcastStudio, type VideoLook } from "../../lib/useBroadcastStudio";
import { Badge, Button, Card, Field, Input, PageHeader, Select, Textarea } from "../../components/ui";
import {
  OVERLAY_DESIGNS,
  suggestDesigns,
  type OverlayDesignId,
} from "../../lib/studioOverlays";
import {
  BookOpen,
  Clapperboard,
  Mic,
  MonitorPlay,
  Radio,
  RefreshCw,
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
      <div className="mb-1 flex justify-between text-[11px] font-medium text-ink-500">
        <span>{label}</span>
        <span>{Math.round(pct)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-ink-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function SliderRow({
  label,
  min,
  max,
  step,
  value,
  onChange,
  hint,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (n: number) => void;
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-brand-600"
      />
    </Field>
  );
}

export default function Studio() {
  const studio = useBroadcastStudio();
  const live = studio.status === "live";
  const suggested = suggestDesigns(studio.overlay.headline, studio.overlay.body);
  const verseLabel = studio.bibleHits.length === 1 ? "Post bible verse" : "Post bible verses";

  function patchLook(partial: Partial<VideoLook>) {
    studio.setLook((look) => ({ ...look, ...partial }));
  }

  function chooseDesign(id: OverlayDesignId) {
    studio.updateOverlay({ design: id });
  }

  return (
    <div>
      <PageHeader
        title="Broadcast studio"
        subtitle="Live camera and pulpit sound, with processing that follows the room — not a frozen OBS preset."
        actions={
          live ? (
            <Badge color="red">On air · {formatClock(studio.elapsedSec)}</Badge>
          ) : (
            <Badge color="gray">Preview off</Badge>
          )
        }
      />

      <div className="grid gap-6 xl:grid-cols-5">
        <div className="space-y-4 xl:col-span-3">
          <Card className="overflow-hidden bg-ink-950 p-0">
            <div className="relative aspect-video bg-black">
              <video ref={studio.videoRef} className="hidden" muted playsInline />
              <audio ref={studio.programmeAudioRef} className="hidden" playsInline />
              <canvas ref={studio.canvasRef} className="h-full w-full object-contain" />
              {!live && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-brand-100">
                  <MonitorPlay className="h-10 w-10 text-brand-300" />
                  <p className="text-sm">Start the studio to open camera and microphone.</p>
                </div>
              )}
              {studio.recording && (
                <span className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                  Recording
                </span>
              )}
              {live && studio.overlay.visible && (
                <span className="absolute right-4 top-4 rounded-full bg-gold-500 px-3 py-1 text-[11px] font-semibold text-white">
                  Text on air
                </span>
              )}
              {live && (
                <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-black/70 px-2.5 py-1 text-[11px] text-white">
                    {studio.cameras.find((d) => d.deviceId === studio.cameraId)?.label || "Camera"}
                  </span>
                  <span className="rounded-full bg-black/70 px-2.5 py-1 text-[11px] text-white">
                    {studio.mics.find((d) => d.deviceId === studio.micId)?.label || "Audio"}
                  </span>
                </div>
              )}
            </div>
          </Card>

          <div className="flex flex-wrap gap-2">
            {live ? (
              <Button variant="danger" onClick={studio.stop}>
                <Square className="h-4 w-4" /> Stop studio
              </Button>
            ) : (
              <Button onClick={() => void studio.start()}>
                <Radio className="h-4 w-4" /> Start studio
              </Button>
            )}
            {live && !studio.recording && (
              <Button variant="gold" onClick={studio.startRecording}>
                <Clapperboard className="h-4 w-4" /> Record programme
              </Button>
            )}
            {studio.recording && (
              <Button variant="outline" onClick={studio.stopRecording}>
                Stop recording
              </Button>
            )}
          </div>
          {studio.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{studio.error}</p>
          )}

          <Card className="space-y-4 p-5">
            <div className="flex items-center gap-2 text-ink-800">
              <Type className="h-4 w-4 text-brand-600" />
              <h2 className="text-sm font-semibold">On-air text</h2>
            </div>
            <p className="text-xs text-ink-500">
              Type a welcome, news line, or announcement. Suggested designs appear from the
              words — pick the one that fits, then put it on the picture.
            </p>
            <Field label="Headline">
              <Input
                value={studio.overlay.headline}
                onChange={(e) => studio.updateOverlay({ headline: e.target.value })}
                placeholder="Welcome · Midweek service · John 3:16"
              />
            </Field>
            <Field label="Message">
              <Textarea
                value={studio.overlay.body}
                onChange={(e) => studio.updateOverlay({ body: e.target.value })}
                placeholder="The words you want on screen"
              />
            </Field>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-400">
                Suggested for this message
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                {suggested.map((id) => {
                  const design = OVERLAY_DESIGNS.find((d) => d.id === id);
                  if (!design) return null;
                  const active = studio.overlay.design === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => chooseDesign(id)}
                      className={`rounded-xl border px-3 py-2 text-left transition ${
                        active
                          ? "border-brand-500 bg-brand-50 ring-2 ring-brand-200"
                          : "border-ink-200 bg-white hover:border-brand-300"
                      }`}
                    >
                      <span className="flex items-center gap-2 text-sm font-medium text-ink-800">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ background: design.swatch }}
                        />
                        {design.label}
                      </span>
                      <span className="mt-1 block text-[11px] text-ink-500">{design.hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-400">
                All designs
              </p>
              <div className="flex flex-wrap gap-1.5">
                {OVERLAY_DESIGNS.map((design) => (
                  <button
                    key={design.id}
                    type="button"
                    onClick={() => chooseDesign(design.id)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                      studio.overlay.design === design.id
                        ? "bg-brand-700 text-white"
                        : "bg-ink-100 text-ink-700 hover:bg-ink-200"
                    }`}
                  >
                    {design.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={studio.putOverlayOnAir}
                disabled={!studio.overlay.headline.trim() && !studio.overlay.body.trim()}
              >
                Put on air
              </Button>
              <Button type="button" variant="outline" onClick={studio.clearOverlay}>
                Clear from picture
              </Button>
            </div>
          </Card>

          <Card className="space-y-4 p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-ink-800">
                <BookOpen className="h-4 w-4 text-brand-600" />
                <h2 className="text-sm font-semibold">Scripture heard</h2>
              </div>
              {studio.listening ? (
                <Button type="button" variant="danger" size="sm" onClick={studio.stopListening}>
                  Stop listening
                </Button>
              ) : (
                <Button type="button" variant="secondary" size="sm" onClick={studio.startListening}>
                  Listen for verses
                </Button>
              )}
            </div>
            <p className="text-xs text-ink-500">
              When the speaker names a passage, it is collected here. Nothing is shown on the
              picture until you click {verseLabel.toLowerCase()}. Listening uses the browser
              microphone in Chrome or Edge — typed references in the text box are also found.
            </p>
            {studio.listening && (
              <p className="text-xs font-medium text-brand-700">Listening for bible references…</p>
            )}
            {studio.bibleHits.length === 0 ? (
              <p className="rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-500">
                No passages yet. Speak or type one, for example John 3:16.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {studio.bibleHits.map((hit) => (
                  <li
                    key={hit.display}
                    className="rounded-full bg-gold-100 px-3 py-1 text-sm font-medium text-gold-900"
                  >
                    {hit.display}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="gold"
                onClick={() => void studio.postBibleVerses()}
                disabled={!studio.bibleHits.length}
                loading={studio.postingVerse}
              >
                {verseLabel}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={studio.dismissBibleHits}
                disabled={!studio.bibleHits.length}
              >
                Dismiss
              </Button>
            </div>
          </Card>

          {studio.recordingUrl && (
            <Card className="p-4">
              <p className="mb-2 text-sm font-medium text-ink-800">Last recording</p>
              <video src={studio.recordingUrl} controls playsInline className="w-full rounded-xl" />
              <p className="mt-2 text-xs text-ink-500">
                Turn the player volume up. If this is still silent, the recording was made on a
                source with no programme — switch to the Yamaha USB input and record again.
              </p>
              <a
                href={studio.recordingUrl}
                download="igc-broadcast.webm"
                className="mt-2 inline-block text-sm font-medium text-brand-700"
              >
                Download .webm
              </a>
            </Card>
          )}
        </div>

        <div className="space-y-4 xl:col-span-2">
          <Card className="space-y-4 p-5">
            <div className="flex items-center justify-between gap-2 text-ink-800">
              <div className="flex items-center gap-2">
                <Video className="h-4 w-4 text-brand-600" />
                <h2 className="text-sm font-semibold">Sources</h2>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void studio.refreshDevices()}
              >
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </Button>
            </div>
            <p className="text-xs text-ink-500">
              Camera and audio are separate. Plug the Yamaha mixer in by USB, start the studio,
              then pick that USB input here — you can switch while on air.
            </p>
            <Field label="Camera / video">
              <Select
                value={studio.cameraId}
                disabled={studio.busySource === "camera"}
                onChange={(e) => void studio.selectCamera(e.target.value)}
              >
                {studio.cameras.length === 0 && <option value="">Allow camera to list devices</option>}
                {studio.cameras.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Audio / mixer"
              hint="Choose the Yamaha (or USB Audio) line, not the laptop microphone."
            >
              <Select
                value={studio.micId}
                disabled={studio.busySource === "mic"}
                onChange={(e) => void studio.selectMic(e.target.value)}
              >
                {studio.mics.length === 0 && (
                  <option value="">Allow microphone to list mixers</option>
                )}
                {studio.mics.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label}
                  </option>
                ))}
              </Select>
            </Field>
            <label className="flex items-center gap-2 text-sm text-ink-700">
              <input
                type="checkbox"
                checked={studio.monitor}
                onChange={(e) => studio.setMonitor(e.target.checked)}
              />
              Hear programme in these speakers / headphones
            </label>
          </Card>

          <Card className="space-y-3 p-5">
            <div className="flex items-center gap-2 text-ink-800">
              <Mic className="h-4 w-4 text-brand-600" />
              <h2 className="text-sm font-semibold">Living sound</h2>
            </div>
            <p className="text-xs text-ink-500">
              Quiet prayer and choir stay in the mix — we do not mute low words. Gain only eases
              shouting so car stereos, headsets, phones and computers hear a calm programme.
            </p>
            <Meter label="Mic in" value={studio.meters.inputRms * 3.2} color="bg-ink-400" />
            <Meter label="Programme out" value={studio.meters.outputRms * 3.2} color="bg-brand-600" />
            <Meter label="Voice kept (open)" value={studio.meters.gate} color="bg-emerald-500" />
            <dl className="grid grid-cols-2 gap-2 pt-1 text-xs text-ink-600">
              <div className="rounded-lg bg-ink-50 px-2 py-1.5">
                Auto gain {studio.meters.agcDb.toFixed(1)} dB
              </div>
              <div className="rounded-lg bg-ink-50 px-2 py-1.5">
                Compress {studio.meters.compressorDb.toFixed(0)} dB
              </div>
              <div className="rounded-lg bg-ink-50 px-2 py-1.5">
                Noise floor {(studio.meters.noiseFloor * 100).toFixed(1)}
              </div>
              <div className="rounded-lg bg-ink-50 px-2 py-1.5">
                Peak {(studio.meters.peak * 100).toFixed(0)}%
              </div>
            </dl>
          </Card>

          <Card className="space-y-3 p-5">
            <h2 className="text-sm font-semibold text-ink-800">Picture</h2>
            <label className="flex items-center gap-2 text-sm text-ink-700">
              <input
                type="checkbox"
                checked={studio.look.auto}
                onChange={(e) => patchLook({ auto: e.target.checked })}
              />
              Auto-balance exposure as the light changes
            </label>
            <SliderRow
              label="Brightness"
              min={0.6}
              max={1.6}
              step={0.01}
              value={studio.look.brightness}
              onChange={(brightness) => patchLook({ brightness })}
            />
            <SliderRow
              label="Contrast"
              min={0.7}
              max={1.5}
              step={0.01}
              value={studio.look.contrast}
              onChange={(contrast) => patchLook({ contrast })}
            />
            <SliderRow
              label="Saturation"
              min={0.5}
              max={1.6}
              step={0.01}
              value={studio.look.saturation}
              onChange={(saturation) => patchLook({ saturation })}
            />
            <SliderRow
              label="Warmth"
              min={0}
              max={1}
              step={0.01}
              value={studio.look.warmth}
              onChange={(warmth) => patchLook({ warmth })}
              hint="Lift for tungsten sanctuary lights."
            />
            <label className="flex items-center gap-2 text-sm text-ink-700">
              <input
                type="checkbox"
                checked={studio.look.mirror}
                onChange={(e) => patchLook({ mirror: e.target.checked })}
              />
              Mirror preview (presenter view)
            </label>
          </Card>

          <p className="text-xs leading-relaxed text-ink-400">
            This is the in-browser desk: capture, living audio, picture grade, on-air text, and a
            local recording. Sending that programme to YouTube or Facebook Live the way OBS does
            still needs a stream ingest (RTMP/WHIP) in a later step — a Vercel site cannot open an
            RTMP socket itself.
          </p>
        </div>
      </div>
    </div>
  );
}
