import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Copy, Download, Radio, Video } from "lucide-react";
import { Badge, Button } from "../../components/ui";
import { apiGet } from "../../lib/api";
import {
  downloadTextFile,
  ffmpegGoLiveCommand,
  unixCameraScript,
  unixGoLiveScript,
  windowsCameraBat,
  windowsGoLiveBat,
  type EncoderTarget,
} from "../../lib/studioEncoder";

export default function StudioEncoder() {
  const [targets, setTargets] = useState<EncoderTarget[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiGet<{ targets: EncoderTarget[] }>("/studio/live/encoder");
        if (!cancelled) setTargets(data.targets ?? []);
      } catch (e) {
        if (!cancelled) setError((e as Error).message || "Could not load encoder destinations.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const names = targets.map((row) => row.label).join(", ");
  const ready = targets.length > 0;
  const command = useMemo(
    () => (ready ? ffmpegGoLiveCommand("sermon.mp4", targets) : ""),
    [ready, targets],
  );

  async function copyCommand() {
    if (!command) return;
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="-mx-4 -my-6 min-h-[calc(100vh-4rem)] bg-[#0b0c10] px-3 py-4 text-ink-100 sm:-mx-6 lg:-mx-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          <Link
            to="/app/studio/live"
            className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-gold-300 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" /> Destinations
          </Link>
          <h1 className="font-display text-2xl text-white sm:text-3xl">IGC Encoder</h1>
          <p className="mt-1 max-w-3xl text-sm text-ink-400">
            Chrome cannot be OBS. OBS is a program on this computer that encodes H.264 and speaks RTMP.
            IGC Encoder is that same job, downloaded from this church site: FFmpeg on this PC, then the
            YouTube and Facebook keys already saved under Destinations.
          </p>
        </div>
        {ready ? <Badge color="gold">{names}</Badge> : <Badge color="gray">No destinations On</Badge>}
      </div>

      {error ? (
        <p className="mb-3 rounded-lg border border-rose-800 bg-rose-950/60 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-[#14161d] p-4">
          <h2 className="text-sm font-semibold text-white">This is the OBS-kind app we can ship</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-ink-300">
            <li>
              Install FFmpeg once on this church computer. Windows:{" "}
              <code className="rounded bg-black/40 px-1 text-gold-300">winget install Gyan.FFmpeg</code>
              . Mac: <code className="rounded bg-black/40 px-1 text-gold-300">brew install ffmpeg</code>.
            </li>
            <li>Turn On Destinations with keys, Save, then come back here.</li>
            <li>
              Download IGC Encoder. Double-click it and pick the recording, or drag the video onto the
              file. For a live camera, download the camera encoder and type the device names it lists.
            </li>
            <li>
              YouTube must already be waiting for an encoder. Facebook Live Producer must be open; click{" "}
              <strong className="text-ink-100">Go live on Facebook</strong> after the preview appears.
            </li>
          </ol>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="gold"
              size="sm"
              disabled={!ready || loading}
              onClick={() => downloadTextFile("igc-go-live.bat", windowsGoLiveBat(targets))}
            >
              <Download className="h-4 w-4" /> Windows — recorded file
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="border border-white/15 bg-transparent text-ink-100 hover:bg-white/10"
              disabled={!ready || loading}
              onClick={() => downloadTextFile("igc-go-live.sh", unixGoLiveScript(targets))}
            >
              <Download className="h-4 w-4" /> Mac — recorded file
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="border border-white/15 bg-transparent text-ink-100 hover:bg-white/10"
              disabled={!ready || loading}
              onClick={() => downloadTextFile("igc-camera.bat", windowsCameraBat(targets))}
            >
              <Video className="h-4 w-4" /> Windows — camera
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="border border-white/15 bg-transparent text-ink-100 hover:bg-white/10"
              disabled={!ready || loading}
              onClick={() => downloadTextFile("igc-camera.sh", unixCameraScript(targets))}
            >
              <Video className="h-4 w-4" /> Mac — camera
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="border border-white/15 bg-transparent text-ink-100 hover:bg-white/10"
              disabled={!ready || loading}
              onClick={() => void copyCommand()}
            >
              <Copy className="h-4 w-4" /> {copied ? "Copied" : "Copy FFmpeg command"}
            </Button>
          </div>
          {!ready && !loading ? (
            <p className="mt-3 text-[11px] leading-relaxed text-ink-500">
              Save at least one On destination with a key first. The encoder file contains those RTMP
              URLs, like OBS Stream settings.
            </p>
          ) : (
            <p className="mt-3 text-[11px] leading-relaxed text-ink-500">
              Treat the downloaded file like an OBS profile: it holds the church stream keys. Keep it on
              this computer.
            </p>
          )}
          {command ? (
            <pre className="mt-3 max-h-28 overflow-auto rounded-lg bg-black/50 p-2 text-[10px] leading-relaxed text-ink-400 whitespace-pre-wrap break-all">
              {command}
            </pre>
          ) : null}
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#14161d] p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
            <Radio className="h-4 w-4 text-gold-400" /> Why Chrome Go live failed
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-300">
            A website tab cannot speak RTMP. This computer connected to Livepeer and sent 0 video
            packets, so YouTube and Facebook stayed dark. Lowering Output to 360p cannot fix that: the
            encoder never ran on this PC the way OBS does.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-ink-300">
            A full OBS clone (scenes, filters, NVENC, window capture) is a native Windows/Mac product,
            not a page on infinitelygracedchurch.com. IGC Encoder is the core we can ship today: local
            H.264, then RTMP to the same destinations. Live camera mixing with graphics still belongs in
            OBS if you need that on Sunday — Destinations already hold the keys.
          </p>
          <Link
            to="/app/studio/live"
            className="mt-4 inline-flex text-sm font-medium text-gold-300 hover:underline"
          >
            Back to Destinations
          </Link>
        </div>
      </div>
    </div>
  );
}
