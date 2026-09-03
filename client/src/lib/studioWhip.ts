export type WhipIceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

export async function waitForIce(pc: RTCPeerConnection, timeoutMs = 8000): Promise<void> {
  if (pc.iceGatheringState === "complete") return;
  await new Promise<void>((resolve) => {
    const timer = globalThis.setTimeout(resolve, timeoutMs);
    const onChange = () => {
      if (pc.iceGatheringState === "complete") {
        globalThis.clearTimeout(timer);
        pc.removeEventListener("icegatheringstatechange", onChange);
        resolve();
      }
    };
    pc.addEventListener("icegatheringstatechange", onChange);
  });
}

export function iceIsConnected(pc: RTCPeerConnection): boolean {
  const ice = pc.iceConnectionState;
  const conn = pc.connectionState;
  return ice === "connected" || ice === "completed" || conn === "connected";
}

export async function waitForIceConnected(pc: RTCPeerConnection, timeoutMs = 20000): Promise<void> {
  if (iceIsConnected(pc)) return;
  if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "closed") {
    throw new Error("Livepeer connection failed. Check the church internet connection and try Go live again.");
  }
  await new Promise<void>((resolve, reject) => {
    const timer = globalThis.setTimeout(() => {
      cleanup();
      reject(
        new Error(
          `Could not reach Livepeer from this computer (${pc.iceConnectionState}). Stay on this page and try Go live again.`,
        ),
      );
    }, timeoutMs);
    const onChange = () => {
      if (iceIsConnected(pc)) {
        cleanup();
        resolve();
        return;
      }
      if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "closed") {
        cleanup();
        reject(
          new Error("Livepeer connection failed. Check the church internet connection and try Go live again."),
        );
      }
    };
    const cleanup = () => {
      globalThis.clearTimeout(timer);
      pc.removeEventListener("iceconnectionstatechange", onChange);
      pc.removeEventListener("connectionstatechange", onChange);
    };
    pc.addEventListener("iceconnectionstatechange", onChange);
    pc.addEventListener("connectionstatechange", onChange);
  });
}

export function preferH264Codecs<T extends { mimeType: string }>(codecs: T[]): T[] {
  const h264 = codecs.filter((c) => /h264/i.test(c.mimeType));
  if (h264.length === 0) return codecs;
  return [...h264, ...codecs.filter((c) => !/h264/i.test(c.mimeType))];
}

function preferVideoH264(transceiver: RTCRtpTransceiver) {
  try {
    const caps = RTCRtpSender.getCapabilities?.("video");
    if (!caps?.codecs?.length || !transceiver.setCodecPreferences) return;
    transceiver.setCodecPreferences(preferH264Codecs(caps.codecs));
  } catch {
    // Safari and some embedded WebViews omit setCodecPreferences.
  }
}

export function streamKeyFromWhipUrl(url: string): string {
  try {
    return new URL(url).pathname.split("/").filter(Boolean).pop() || "";
  } catch {
    return "";
  }
}

export function livepeerIceHost(host: string): string {
  const hostname = host.replace(/:\d+$/, "");
  const region = hostname.match(/^([a-z0-9]+)-prod-catalyst/i)?.[1];
  return region ? `${region}.livepeer.com` : hostname;
}

function turnPair(host: string): WhipIceServer[] {
  const h = host.replace(/:\d+$/, "");
  return [
    { urls: `stun:${h}` },
    { urls: `turn:${h}`, username: "livepeer", credential: "livepeer" },
    { urls: `stun:${h}:3478` },
    { urls: `turn:${h}:3478`, username: "livepeer", credential: "livepeer" },
    { urls: `turn:${h}:3478?transport=tcp`, username: "livepeer", credential: "livepeer" },
    { urls: `turns:${h}:5349?transport=tcp`, username: "livepeer", credential: "livepeer" },
  ];
}

export function mergeIceServers(...groups: WhipIceServer[][]): WhipIceServer[] {
  const seen = new Set<string>();
  const out: WhipIceServer[] = [];
  for (const group of groups) {
    for (const server of group) {
      const key = `${String(server.urls)}|${server.username ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(server);
    }
  }
  return out;
}

/** Livepeer's own WHIP client uses the catalyst host as STUN/TURN, plus regional `*.livepeer.com`. */
export function iceServersForWhipHost(host: string): WhipIceServer[] {
  const hostname = host.replace(/:\d+$/, "");
  const region = livepeerIceHost(hostname);
  return mergeIceServers(turnPair(hostname), hostname === region ? [] : turnPair(region), [
    { urls: "stun:stun.cloudflare.com:3478" },
  ]);
}

export function preferH264InSdp(sdp: string): string {
  const lines = sdp.split(/\r?\n/);
  const mLineIndex = lines.findIndex((line) => line.startsWith("m=video"));
  if (mLineIndex < 0) return sdp;
  const codecLine = lines.find((line) => /a=rtpmap:(\d+) H264\//i.test(line));
  const payload = codecLine?.match(/a=rtpmap:(\d+) H264\//i)?.[1];
  if (!payload) return sdp;
  const parts = lines[mLineIndex]!.split(" ");
  if (parts.length < 4) return sdp;
  lines[mLineIndex] = [...parts.slice(0, 3), payload, ...parts.slice(3).filter((p) => p !== payload)].join(" ");
  return lines.join("\r\n");
}

export type WhipEncode = {
  maxBitrate: number;
  maxFramerate: number;
  scaleResolutionDownBy?: number;
  preferH264?: boolean;
};

export const DEFAULT_WHIP_ENCODE: WhipEncode = {
  maxBitrate: 2_500_000,
  maxFramerate: 30,
  preferH264: true,
};

export function outboundRtpBytes(
  stats: {
    values: () => Iterable<{
      type?: string;
      bytesSent?: number;
      packetsSent?: number;
      framesEncoded?: number;
      framesSent?: number;
    }>;
  },
): number {
  let n = 0;
  for (const row of stats.values()) {
    if (row.type !== "outbound-rtp") continue;
    n += row.bytesSent ?? 0;
    n += row.packetsSent ?? 0;
    n += row.framesEncoded ?? 0;
    n += row.framesSent ?? 0;
  }
  return n;
}

/** True when packets left, or when getStats never worked so we cannot claim a send failure. */
export async function waitForOutboundRtp(pc: RTCPeerConnection, timeoutMs = 8000): Promise<boolean> {
  const started = Date.now();
  let sawStats = false;
  while (Date.now() - started < timeoutMs) {
    try {
      if (outboundRtpBytes(await pc.getStats()) > 0) return true;
      sawStats = true;
    } catch {
      // getStats can throw while ICE is still settling — do not treat that as 0 frames.
    }
    await new Promise((resolve) => globalThis.setTimeout(resolve, 250));
  }
  return !sawStats;
}

export const NO_PROGRAM_PACKETS =
  "This computer connected to Livepeer but sent 0 video packets. Set Output to Low · 360p, keep the recorded file or camera playing on this page in Chrome or Edge, then End live and Go live again. YouTube and Facebook stay dark until packets leave this computer.";

export async function waitTwoAnimationFrames(): Promise<void> {
  const raf = globalThis.requestAnimationFrame;
  if (typeof raf !== "function") return;
  await new Promise<void>((resolve) => {
    raf.call(globalThis, () => raf.call(globalThis, () => resolve()));
  });
}

const captureSources = new WeakMap<MediaStream, MediaStream>();

function kickVideoTracks(stream: MediaStream) {
  for (const track of stream.getVideoTracks()) {
    track.enabled = true;
    if ("contentHint" in track) {
      try {
        track.contentHint = "motion";
      } catch {
        // Older Chromium omits contentHint.
      }
    }
    const requestFrame = (track as MediaStreamTrack & { requestFrame?: () => void }).requestFrame;
    if (typeof requestFrame === "function") requestFrame.call(track);
  }
}

export function releaseCaptureSource(stream?: MediaStream) {
  if (!stream) return;
  const raw = captureSources.get(stream);
  if (!raw) return;
  for (const track of raw.getVideoTracks()) {
    try {
      track.stop();
    } catch {
      // Track may already have ended.
    }
  }
  captureSources.delete(stream);
}

export function detachProgrammePump(pump?: HTMLVideoElement | null) {
  if (!pump) return;
  try {
    pump.pause();
  } catch {
    // Element may already be gone.
  }
  pump.srcObject = null;
}

function mediaStreamFromTracks(tracks: MediaStreamTrack[]): MediaStream {
  if (typeof MediaStream === "function") return new MediaStream(tracks);
  return {
    getVideoTracks: () => tracks.filter((track) => track.kind === "video"),
    getAudioTracks: () => tracks.filter((track) => track.kind === "audio"),
    getTracks: () => tracks,
    addTrack: (track: MediaStreamTrack) => {
      tracks.push(track);
    },
  } as unknown as MediaStream;
}

/** Capture the playing file itself. OBS-style media source; canvas.captureStream is the fallback. */
export function capturePlayingVideo(
  el: HTMLVideoElement | null | undefined,
  fps = 30,
): MediaStream | null {
  if (!el || el.readyState < 2) return null;
  const capture =
    (el as HTMLVideoElement & { captureStream?: (fps?: number) => MediaStream }).captureStream ??
    (el as HTMLVideoElement & { mozCaptureStream?: (fps?: number) => MediaStream }).mozCaptureStream;
  if (typeof capture !== "function") return null;
  try {
    const stream = capture.call(el, fps);
    const video = stream.getVideoTracks().filter((track) => track.readyState === "live");
    if (video.length === 0) return null;
    for (const track of stream.getAudioTracks()) {
      try {
        track.stop();
      } catch {
        // Program sound comes from the studio mix, not the raw file track.
      }
    }
    const out = mediaStreamFromTracks(video);
    kickVideoTracks(out);
    return out;
  } catch {
    return null;
  }
}

export function cloneLiveVideoStream(stream?: MediaStream | null): MediaStream | null {
  if (!stream) return null;
  const video = stream.getVideoTracks().filter((track) => track.readyState === "live");
  if (video.length === 0) return null;
  const out = mediaStreamFromTracks(video.map((track) => track.clone()));
  kickVideoTracks(out);
  return out;
}

/**
 * Chrome skips encoding a tiny or near-invisible canvas.captureStream.
 * Paint twice, capture, play that stream in a video, then prefer video.captureStream.
 */
export async function captureProgrammeStream(
  canvas: HTMLCanvasElement,
  pump?: HTMLVideoElement | null,
  size?: { width: number; height: number; fps: number },
): Promise<MediaStream> {
  await waitTwoAnimationFrames();
  if (typeof canvas.captureStream !== "function") {
    throw new Error("This browser cannot send Program video. Use Chrome or Edge on this desk.");
  }
  const fps = size?.fps ?? 30;
  const raw = canvas.captureStream(fps);
  kickVideoTracks(raw);
  for (const track of raw.getVideoTracks()) {
    try {
      await track.applyConstraints({
        width: size?.width ?? 1280,
        height: size?.height ?? 720,
        frameRate: fps,
      });
    } catch {
      // Canvas tracks often ignore applyConstraints.
    }
  }

  const el = pump;
  if (el) {
    el.muted = true;
    el.playsInline = true;
    el.autoplay = true;
    el.srcObject = raw;
    try {
      await el.play();
    } catch {
      // Go live is a click, so play() usually works. Canvas stream is still used if it does not.
    }
    await new Promise((resolve) => globalThis.setTimeout(resolve, 80));
    kickVideoTracks(raw);
    const recapture = (el as HTMLVideoElement & { captureStream?: (fps?: number) => MediaStream }).captureStream;
    if (typeof recapture === "function") {
      try {
        const fromVideo = recapture.call(el, fps);
        if (fromVideo.getVideoTracks().length > 0) {
          captureSources.set(fromVideo, raw);
          kickVideoTracks(fromVideo);
          return fromVideo;
        }
      } catch {
        // Fall back to the canvas stream.
      }
    }
  }
  return raw;
}

/** GeoDNS fronts. Regional catalysts look like nyc-prod-catalyst-0.lp-playback.studio:443. */
export function whipHostLooksRegional(host: string): boolean {
  return /\.lp-playback\.studio(?::\d+)?$/i.test(host) || /catalyst/i.test(host);
}

export async function resolveWhipEndpoint(whipUrl: string): Promise<{ url: string; iceServers: WhipIceServer[] }> {
  try {
    const res = await fetch(whipUrl, { method: "HEAD", redirect: "follow", mode: "cors" });
    const url = (res.url || whipUrl).split("?")[0];
    return { url, iceServers: iceServersForWhipHost(new URL(url).hostname) };
  } catch {
    try {
      return { url: whipUrl, iceServers: iceServersForWhipHost(new URL(whipUrl).hostname) };
    } catch {
      return { url: whipUrl, iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }] };
    }
  }
}

async function postWhipOffer(url: string, sdp: string, streamKey: string): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/sdp",
    Accept: "application/sdp",
  };
  let res = await fetch(url, { method: "POST", mode: "cors", credentials: "omit", headers, body: sdp });
  if ((res.status === 401 || res.status === 403) && streamKey) {
    res = await fetch(url, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      headers: { ...headers, Authorization: `Bearer ${streamKey}` },
      body: sdp,
    });
  }
  return res;
}

export function kickCanvasFrames(stream: MediaStream | undefined) {
  if (!stream) return;
  kickVideoTracks(stream);
  const raw = captureSources.get(stream);
  if (raw) kickVideoTracks(raw);
}

async function applyVideoEncode(pc: RTCPeerConnection, encode: WhipEncode) {
  for (const sender of pc.getSenders()) {
    if (sender.track?.kind !== "video") continue;
    try {
      const params = sender.getParameters();
      if (!params.encodings?.length) params.encodings = [{}];
      params.encodings[0] = {
        ...params.encodings[0],
        maxBitrate: encode.maxBitrate,
        maxFramerate: encode.maxFramerate,
        ...(encode.scaleResolutionDownBy ? { scaleResolutionDownBy: encode.scaleResolutionDownBy } : {}),
      };
      await sender.setParameters(params);
    } catch {
      // Some browsers reject encodings until ICE has a selected pair.
    }
  }
}

async function negotiateWhip(
  stream: MediaStream,
  url: string,
  whipUrl: string,
  servers: WhipIceServer[],
  iceTransportPolicy: RTCIceTransportPolicy,
  postOffer?: (sdp: string) => Promise<string>,
  encode: WhipEncode = DEFAULT_WHIP_ENCODE,
): Promise<RTCPeerConnection> {
  kickCanvasFrames(stream);
  const pc = new RTCPeerConnection({
    iceServers: servers as RTCIceServer[],
    iceTransportPolicy,
    bundlePolicy: "max-bundle",
  });
  for (const track of stream.getTracks()) {
    const init: RTCRtpTransceiverInit = { direction: "sendonly" };
    if (track.kind === "video") {
      init.sendEncodings = [
        {
          maxBitrate: encode.maxBitrate,
          maxFramerate: encode.maxFramerate,
          ...(encode.scaleResolutionDownBy ? { scaleResolutionDownBy: encode.scaleResolutionDownBy } : {}),
        },
      ];
    }
    let transceiver: RTCRtpTransceiver;
    try {
      transceiver = pc.addTransceiver(track, init);
    } catch {
      transceiver = pc.addTransceiver(track, { direction: "sendonly" });
    }
    if (track.kind === "video" && encode.preferH264 !== false) preferVideoH264(transceiver);
  }
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await waitForIce(pc, 5000);
  const sdp =
    encode.preferH264 === false
      ? pc.localDescription?.sdp || ""
      : preferH264InSdp(pc.localDescription?.sdp || "");
  if (!sdp.startsWith("v=")) {
    pc.close();
    throw new Error("Could not create a live offer.");
  }
  const streamKey = streamKeyFromWhipUrl(url) || streamKeyFromWhipUrl(whipUrl);
  let answer = "";
  try {
    const res = await postWhipOffer(url, sdp, streamKey);
    answer = await res.text();
    if (!res.ok) throw new Error(answer || `Live ingest failed (${res.status})`);
  } catch (directErr) {
    if (!postOffer) {
      pc.close();
      throw new Error((directErr as Error).message || "Could not reach Livepeer ingest.");
    }
    try {
      answer = await postOffer(sdp);
    } catch (proxyErr) {
      pc.close();
      const proxyMsg = (proxyErr as Error).message || "";
      throw new Error(
        /church server did not respond|timed out|Failed to fetch/i.test(proxyMsg)
          ? "Could not reach Livepeer from this computer. Stay on this page and Go live again."
          : proxyMsg || (directErr as Error).message || "Could not reach Livepeer ingest.",
      );
    }
  }
  if (!answer.trim().startsWith("v=")) {
    pc.close();
    throw new Error("Livepeer did not return a live answer.");
  }
  await pc.setRemoteDescription({ type: "answer", sdp: answer });
  try {
    await waitForIceConnected(pc);
  } catch (e) {
    pc.close();
    throw e;
  }
  await applyVideoEncode(pc, encode);
  return pc;
}

export async function connectWhip(
  stream: MediaStream,
  whipUrl: string,
  iceServers?: WhipIceServer[],
  postOffer?: (sdp: string) => Promise<string>,
  encode: WhipEncode = DEFAULT_WHIP_ENCODE,
): Promise<RTCPeerConnection> {
  let url = whipUrl;
  let host = "";
  try {
    host = new URL(whipUrl).host;
  } catch {
    throw new Error("Live ingest URL is invalid.");
  }
  if (!whipHostLooksRegional(host)) {
    const resolved = await resolveWhipEndpoint(whipUrl);
    url = resolved.url;
    try {
      host = new URL(url).host;
    } catch {
      host = "";
    }
  }
  const servers = mergeIceServers(
    iceServersForWhipHost(host || new URL(url).hostname),
    iceServers ?? [],
  );
  const attempts: { policy: RTCIceTransportPolicy; encode: WhipEncode; waitMs: number }[] = [
    { policy: "all", encode, waitMs: 5000 },
    { policy: "relay", encode, waitMs: 4000 },
    {
      policy: "relay",
      encode: {
        ...encode,
        maxBitrate: Math.min(encode.maxBitrate, 1_200_000),
        scaleResolutionDownBy: Math.max(encode.scaleResolutionDownBy ?? 1, 2),
      },
      waitMs: 3500,
    },
    {
      policy: "relay",
      encode: {
        maxBitrate: 600_000,
        maxFramerate: 24,
        scaleResolutionDownBy: 4,
        preferH264: false,
      },
      waitMs: 3500,
    },
  ];

  let firstErr: unknown;
  let connectedWithoutPackets = false;
  for (const attempt of attempts) {
    try {
      const pc = await negotiateWhip(
        stream,
        url,
        whipUrl,
        servers,
        attempt.policy,
        postOffer,
        attempt.encode,
      );
      if (await waitForOutboundRtp(pc, attempt.waitMs)) return pc;
      pc.close();
      connectedWithoutPackets = true;
    } catch (e) {
      firstErr ??= e;
    }
  }
  if (connectedWithoutPackets) throw new Error(NO_PROGRAM_PACKETS);
  throw firstErr || new Error(NO_PROGRAM_PACKETS);
}
