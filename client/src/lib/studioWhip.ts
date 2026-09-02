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

export function iceServersForWhipHost(host: string): WhipIceServer[] {
  const h = livepeerIceHost(host);
  return [
    { urls: `stun:${h}:3478` },
    { urls: `turn:${h}:3478`, username: "livepeer", credential: "livepeer" },
    { urls: `turn:${h}:3478?transport=tcp`, username: "livepeer", credential: "livepeer" },
    { urls: `stun:${h}:5349` },
    { urls: `turn:${h}:5349`, username: "livepeer", credential: "livepeer" },
    { urls: `turn:${h}:5349?transport=tcp`, username: "livepeer", credential: "livepeer" },
    { urls: "stun:stun.cloudflare.com:3478" },
  ];
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
  let res = await fetch(url, { method: "POST", mode: "cors", headers, body: sdp });
  if ((res.status === 401 || res.status === 403) && streamKey) {
    res = await fetch(url, {
      method: "POST",
      mode: "cors",
      headers: { ...headers, Authorization: `Bearer ${streamKey}` },
      body: sdp,
    });
  }
  return res;
}

export async function connectWhip(
  stream: MediaStream,
  whipUrl: string,
  iceServers?: WhipIceServer[],
): Promise<RTCPeerConnection> {
  let url = whipUrl;
  let servers = iceServers?.length ? [...iceServers] : [];
  let host = "";
  try {
    host = new URL(whipUrl).host;
  } catch {
    throw new Error("Live ingest URL is invalid.");
  }
  if (!whipHostLooksRegional(host)) {
    const resolved = await resolveWhipEndpoint(whipUrl);
    url = resolved.url;
    if (!servers.length) servers = resolved.iceServers;
    try {
      host = new URL(url).host;
    } catch {
      host = "";
    }
  }
  if (!servers.length) {
    servers = iceServersForWhipHost(host || new URL(url).hostname);
  }
  const pc = new RTCPeerConnection({
    iceServers: servers as RTCIceServer[],
  });
  for (const track of stream.getTracks()) {
    const transceiver = pc.addTransceiver(track, { direction: "sendonly" });
    if (track.kind === "video") preferVideoH264(transceiver);
  }
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await waitForIce(pc);
  const sdp = pc.localDescription?.sdp;
  if (!sdp) {
    pc.close();
    throw new Error("Could not create a live offer.");
  }
  const streamKey = streamKeyFromWhipUrl(url) || streamKeyFromWhipUrl(whipUrl);
  let res: Response;
  try {
    res = await postWhipOffer(url, sdp, streamKey);
  } catch (e) {
    pc.close();
    throw new Error((e as Error).message || "Could not reach Livepeer ingest.");
  }
  const answer = await res.text();
  if (!res.ok) {
    pc.close();
    throw new Error(answer || `Live ingest failed (${res.status})`);
  }
  await pc.setRemoteDescription({ type: "answer", sdp: answer });
  try {
    await waitForIceConnected(pc);
  } catch (e) {
    pc.close();
    throw e;
  }
  return pc;
}
