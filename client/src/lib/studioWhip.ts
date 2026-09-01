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

export async function connectWhip(
  stream: MediaStream,
  whipUrl: string,
): Promise<RTCPeerConnection> {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }],
  });
  for (const track of stream.getTracks()) {
    pc.addTransceiver(track, { direction: "sendonly" });
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
