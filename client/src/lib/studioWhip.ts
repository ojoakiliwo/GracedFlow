export async function waitForIce(pc: RTCPeerConnection, timeoutMs = 2500): Promise<void> {
  if (pc.iceGatheringState === "complete") return;
  await new Promise<void>((resolve) => {
    const timer = window.setTimeout(resolve, timeoutMs);
    const onChange = () => {
      if (pc.iceGatheringState === "complete") {
        window.clearTimeout(timer);
        pc.removeEventListener("icegatheringstatechange", onChange);
        resolve();
      }
    };
    pc.addEventListener("icegatheringstatechange", onChange);
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

export async function connectWhip(
  stream: MediaStream,
  whipUrl: string,
): Promise<RTCPeerConnection> {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }],
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
  const res = await fetch(whipUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/sdp",
      Accept: "application/sdp",
    },
    body: sdp,
  });
  const answer = await res.text();
  if (!res.ok) {
    pc.close();
    throw new Error(answer || `Live ingest failed (${res.status})`);
  }
  await pc.setRemoteDescription({ type: "answer", sdp: answer });
  return pc;
}
