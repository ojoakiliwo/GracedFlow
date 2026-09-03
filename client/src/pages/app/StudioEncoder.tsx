import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Download, Radio } from "lucide-react";
import { Badge, Button } from "../../components/ui";
import { apiGet } from "../../lib/api";
import { downloadTextFile, unixGoLiveScript, windowsGoLiveBat, type EncoderTarget } from "../../lib/studioEncoder";

export default function StudioEncoder() {
  const [targets, setTargets] = useState<EncoderTarget[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
          <p className="mt-1 max-w-2xl text-sm text-ink-400">
            This is not OBS, and it is not Chrome. Chrome cannot speak RTMP, which is why Go live kept
            sending 0 packets. IGC Encoder encodes the file on this computer with FFmpeg and pushes
            RTMP to the same YouTube and Facebook keys — the job OBS does.
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
          <h2 className="text-sm font-semibold text-white">On this church computer</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-ink-300">
            <li>
              Install FFmpeg once. Windows: run{" "}
              <code className="rounded bg-black/40 px-1 text-gold-300">winget install Gyan.FFmpeg</code>, or
              download a build from gyan.dev and put ffmpeg.exe on PATH.
            </li>
            <li>Turn On Destinations with keys, Save, then come back here.</li>
            <li>Download IGC Encoder for this computer. Drag a recorded video onto that file.</li>
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
              <Download className="h-4 w-4" /> Download for Windows
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="border border-white/15 bg-transparent text-ink-100 hover:bg-white/10"
              disabled={!ready || loading}
              onClick={() => downloadTextFile("igc-go-live.sh", unixGoLiveScript(targets))}
            >
              <Download className="h-4 w-4" /> Download for Mac / Linux
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
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#14161d] p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
            <Radio className="h-4 w-4 text-gold-400" /> Why this exists
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-300">
            Building a full OBS clone (scenes, filters, NVENC, window capture) is a native desktop
            product, not a page on infinitelygracedchurch.com. IGC Encoder is the same core: local
            H.264 encode, then RTMP. It is built for the path that failed in Chrome — sending a
            recorded file to YouTube and Facebook.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-ink-300">
            Live camera mixing still belongs in OBS if you need that on Sunday. Destinations already
            hold the keys OBS would use.
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
