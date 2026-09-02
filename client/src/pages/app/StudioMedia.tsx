import { useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Film,
  Image as ImageIcon,
  Music,
  Pause,
  Play,
  Radio,
  Square,
} from "lucide-react";
import { Badge, Button } from "../../components/ui";
import { useBroadcastStudio } from "../../lib/useBroadcastStudio";
import {
  formatClipClock,
  pictureKindLabel,
  soundKindLabel,
  type StudioClip,
} from "../../lib/studioMedia";

function DeskCard({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#14161d] p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-100">
        {icon}
        {title}
      </h2>
      {children}
    </div>
  );
}

function ClipMeta({ clip }: { clip: StudioClip | null }) {
  if (!clip) {
    return <p className="text-xs text-ink-500">No file chosen yet.</p>;
  }
  return (
    <p className="truncate text-sm text-ink-200">
      {clip.name}
      {clip.durationSec != null ? (
        <span className="ml-2 font-mono text-ink-400">{formatClipClock(clip.durationSec)}</span>
      ) : null}
    </p>
  );
}

function FilePicker({
  accept,
  label,
  onFile,
  disabled,
}: {
  accept: string;
  label: string;
  onFile: (file: File) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onFile(file);
        }}
      />
      <Button size="sm" variant="secondary" disabled={disabled} onClick={() => inputRef.current?.click()}>
        {label}
      </Button>
    </>
  );
}

export default function StudioMedia() {
  const s = useBroadcastStudio();
  const live = s.status === "live";
  const busy = Boolean(s.busySource);
  const hasMediaOnProgram =
    s.pictureKind !== "camera" || s.soundKind !== "mic";

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
          <h1 className="font-display text-2xl text-white sm:text-3xl">Recorded media</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-400">
            Send a recorded video, a still picture, or recorded audio to Program on its own. The live
            camera is not required.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {s.socialLive ? (
            <Button variant="danger" size="sm" onClick={s.stopSocialLive}>
              <Square className="h-4 w-4" /> End live
            </Button>
          ) : (
            <Button
              variant="gold"
              size="sm"
              disabled={s.socialConnecting || busy}
              onClick={() => void s.goLiveToAir()}
            >
              <Radio className="h-4 w-4" />
              {s.socialConnecting ? "Going live…" : "Go live"}
            </Button>
          )}
          {live ? (
            <Button variant="danger" size="sm" onClick={s.stop}>
              <Square className="h-4 w-4" /> Stop
            </Button>
          ) : null}
          <Badge color={live ? "red" : "gray"}>{live ? "On air" : "Standby"}</Badge>
          {s.socialLive ? <Badge color="red">Social live</Badge> : null}
        </div>
      </div>

      {s.error ? (
        <p className="mb-3 rounded-lg border border-rose-800 bg-rose-950/60 px-3 py-2 text-sm text-rose-200">{s.error}</p>
      ) : null}

      <div className="mb-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="overflow-hidden rounded-md bg-black shadow-inner ring-2 ring-rose-600/80">
          <canvas ref={s.canvasRef} className="aspect-video w-full bg-black" />
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#14161d] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-400">On Program</p>
          <p className="mt-2 text-sm text-ink-100">Picture: {pictureKindLabel(s.pictureKind)}</p>
          <p className="mt-1 text-sm text-ink-100">Sound: {soundKindLabel(s.soundKind)}</p>
          <p className="mt-3 text-[11px] leading-relaxed text-ink-500">
            {hasMediaOnProgram
              ? "This room is driving Program. Destinations still send whatever is here."
              : "Choose a file below, then send picture, sound, or both. Each one can go independently."}
          </p>
          <label className="mt-3 flex items-center gap-2 text-sm text-ink-200">
            <input
              type="checkbox"
              checked={s.mediaLoop}
              onChange={(e) => s.setMediaLoop(e.target.checked)}
              className="accent-gold-400"
            />
            Loop recorded files
          </label>
          <label className="mt-2 flex items-center gap-2 text-sm text-ink-200">
            <input
              type="checkbox"
              checked={s.monitor}
              onChange={(e) => s.setMonitor(e.target.checked)}
              className="accent-gold-400"
            />
            Monitor in this room
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            {s.mediaPlaying ? (
              <Button size="sm" variant="secondary" onClick={s.pauseStudioMedia}>
                <Pause className="h-3.5 w-3.5" /> Pause
              </Button>
            ) : (
              <Button size="sm" variant="secondary" disabled={!live} onClick={() => void s.playStudioMedia()}>
                <Play className="h-3.5 w-3.5" /> Play
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <DeskCard title="Recorded video" icon={<Film className="h-4 w-4 text-gold-400" />}>
          <ClipMeta clip={s.videoClip} />
          <div className="mt-3 flex flex-wrap gap-2">
            <FilePicker
              accept="video/*"
              label={s.videoClip ? "Replace video" : "Choose video"}
              disabled={busy}
              onFile={(file) => void s.loadStudioFile("video", file)}
            />
            {s.videoClip ? (
              <Button size="sm" variant="ghost" className="text-ink-300" onClick={() => void s.clearStudioFile("video")}>
                Clear
              </Button>
            ) : null}
          </div>
          <div className="mt-3 flex flex-col gap-2">
            <Button
              size="sm"
              variant="gold"
              disabled={!s.videoClip || busy}
              onClick={() => void s.useStudioMedia("video", "both")}
            >
              Send picture + sound
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={!s.videoClip || busy}
              onClick={() => void s.useStudioMedia("video", "picture")}
            >
              Picture only
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={!s.videoClip || busy}
              onClick={() => void s.useStudioMedia("video", "sound")}
            >
              Sound only
            </Button>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-ink-500">
            Picture only keeps the desk mic or a separate audio file. Sound only can sit under a still or a black
            frame.
          </p>
        </DeskCard>

        <DeskCard title="Picture" icon={<ImageIcon className="h-4 w-4 text-gold-400" />}>
          <ClipMeta clip={s.stillClip} />
          {s.stillClip ? (
            <img src={s.stillClip.url} alt={s.stillClip.name} className="mt-3 max-h-36 w-full rounded-md object-contain bg-black" />
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <FilePicker
              accept="image/*"
              label={s.stillClip ? "Replace picture" : "Choose picture"}
              disabled={busy}
              onFile={(file) => void s.loadStudioFile("picture", file)}
            />
            {s.stillClip ? (
              <Button size="sm" variant="ghost" className="text-ink-300" onClick={() => void s.clearStudioFile("picture")}>
                Clear
              </Button>
            ) : null}
          </div>
          <Button
            className="mt-3 w-full"
            size="sm"
            variant="gold"
            disabled={!s.stillClip || busy}
            onClick={() => void s.useStudioMedia("picture", "picture")}
          >
            Send picture to Program
          </Button>
          <p className="mt-3 text-[11px] leading-relaxed text-ink-500">
            A still can go out with recorded audio, the Yamaha mix, or silence. It does not need the camera.
          </p>
        </DeskCard>

        <DeskCard title="Recorded audio" icon={<Music className="h-4 w-4 text-gold-400" />}>
          <ClipMeta clip={s.audioClip} />
          <div className="mt-3 flex flex-wrap gap-2">
            <FilePicker
              accept="audio/*"
              label={s.audioClip ? "Replace audio" : "Choose audio"}
              disabled={busy}
              onFile={(file) => void s.loadStudioFile("audio", file)}
            />
            {s.audioClip ? (
              <Button size="sm" variant="ghost" className="text-ink-300" onClick={() => void s.clearStudioFile("audio")}>
                Clear
              </Button>
            ) : null}
          </div>
          <Button
            className="mt-3 w-full"
            size="sm"
            variant="gold"
            disabled={!s.audioClip || busy}
            onClick={() => void s.useStudioMedia("audio", "sound")}
          >
            Send audio to Program
          </Button>
          <p className="mt-3 text-[11px] leading-relaxed text-ink-500">
            Audio-only uses a black frame unless a still or recorded video is already on Program.
          </p>
        </DeskCard>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => void s.useCameraPicture()}>
          Use camera
        </Button>
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => void s.useDeskMic()}>
          Use desk mic
        </Button>
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => void s.useBlackFrame()}>
          Black frame
        </Button>
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => void s.useSilentSound()}>
          Silent
        </Button>
        <Link
          to="/app/studio/live"
          className="inline-flex h-8 items-center justify-center rounded-xl border border-white/15 px-3 text-sm font-medium text-ink-100 hover:bg-white/10"
        >
          Destinations
        </Link>
      </div>
    </div>
  );
}
