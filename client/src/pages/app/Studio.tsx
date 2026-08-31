import { useBroadcastStudio, type VideoLook } from "../../lib/useBroadcastStudio";
import { Badge, Button, Card, Field, PageHeader, Select } from "../../components/ui";
import {
  Clapperboard,
  Mic,
  MonitorPlay,
  Radio,
  Square,
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

  function patchLook(partial: Partial<VideoLook>) {
    studio.setLook((look) => ({ ...look, ...partial }));
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
          {studio.recordingUrl && (
            <Card className="p-4">
              <p className="mb-2 text-sm font-medium text-ink-800">Last recording</p>
              <video src={studio.recordingUrl} controls className="w-full rounded-xl" />
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
            <div className="flex items-center gap-2 text-ink-800">
              <Video className="h-4 w-4 text-brand-600" />
              <h2 className="text-sm font-semibold">Sources</h2>
            </div>
            <Field label="Camera">
              <Select
                value={studio.cameraId}
                onChange={(e) => studio.setCameraId(e.target.value)}
                disabled={live}
              >
                {studio.cameras.length === 0 && <option value="">Allow camera to list devices</option>}
                {studio.cameras.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Microphone">
              <Select
                value={studio.micId}
                onChange={(e) => studio.setMicId(e.target.value)}
                disabled={live}
              >
                {studio.mics.length === 0 && <option value="">Allow microphone to list devices</option>}
                {studio.mics.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label}
                  </option>
                ))}
              </Select>
            </Field>
          </Card>

          <Card className="space-y-3 p-5">
            <div className="flex items-center gap-2 text-ink-800">
              <Mic className="h-4 w-4 text-brand-600" />
              <h2 className="text-sm font-semibold">Living sound</h2>
            </div>
            <p className="text-xs text-ink-500">
              Noise gate, loudness and compression move with the room — a quiet prayer and a loud
              chorus are not treated the same.
            </p>
            <Meter label="Mic in" value={studio.meters.inputRms * 3.2} color="bg-ink-400" />
            <Meter label="Programme out" value={studio.meters.outputRms * 3.2} color="bg-brand-600" />
            <Meter label="Gate (open)" value={studio.meters.gate} color="bg-emerald-500" />
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
            This is the in-browser desk: capture, living audio, picture grade, and a local recording.
            Sending that programme to YouTube or Facebook Live the way OBS does still needs a stream
            ingest (RTMP/WHIP) in a later step — a Vercel site cannot open an RTMP socket itself.
          </p>
        </div>
      </div>
    </div>
  );
}
