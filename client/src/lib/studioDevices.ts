export type NamedDevice = { deviceId: string; label: string };

const MIXER_AUDIO =
  /yamaha|steinberg|mixer|usb audio|usb microphone|ag0|mg\d|dm3|ql\d|cl\d|tf\d|interface|behringer|soundcraft|presonus|focusrite|scarlett|umc|audio box|evocam|line \(usb/i;
const COMPUTER_AUDIO =
  /desktop audio|stereo mix|loopback|cable output|blackhole|voicemeeter|what u hear|wave out|vb-audio|soundflower|system audio/i;

export function looksLikeDeskAudio(label: string): boolean {
  return MIXER_AUDIO.test(label) || COMPUTER_AUDIO.test(label);
}

export function decorateAudioLabel(label: string, index: number): string {
  const name = label.trim() || `Audio input ${index + 1}`;
  if (COMPUTER_AUDIO.test(name)) return `${name} · computer sound`;
  if (MIXER_AUDIO.test(name)) return `${name} · mixer / USB`;
  return name;
}

function audioLabelKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/\s·\s(mixer \/ usb|computer sound)$/i, "")
    .trim();
}

export function sortAudioDevices(devices: NamedDevice[]): NamedDevice[] {
  return [...devices].sort((a, b) => {
    const deskA = looksLikeDeskAudio(a.label) ? 0 : 1;
    const deskB = looksLikeDeskAudio(b.label) ? 0 : 1;
    if (deskA !== deskB) return deskA - deskB;
    return a.label.localeCompare(b.label);
  });
}

/** Programme capture: no Zoom-style echo cancel — a USB mixer is already the desk. */
export function audioConstraintsFor(deviceId: string): MediaTrackConstraints {
  return {
    deviceId: deviceId ? { exact: deviceId } : undefined,
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    channelCount: { ideal: 2 },
  };
}

export function videoConstraintsFor(deviceId: string): MediaTrackConstraints {
  return {
    deviceId: deviceId ? { exact: deviceId } : undefined,
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30 },
  };
}

export function pickRecordingMime(isSupported: (type: string) => boolean): string {
  const candidates = [
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  return candidates.find((type) => isSupported(type)) ?? "";
}

export function keepDeviceId(current: string, devices: NamedDevice[], preferredLabel = ""): string {
  if (current && devices.some((d) => d.deviceId === current)) return current;
  const want = audioLabelKey(preferredLabel);
  if (want) {
    const match = devices.find((d) => audioLabelKey(d.label) === want);
    if (match?.deviceId) return match.deviceId;
  }
  // Empty means "browser default / any available" — do not snap to Yamaha.
  if (!current) return "";
  return devices[0]?.deviceId ?? "";
}

export function deviceIdFromStream(stream: MediaStream, kind: "audio" | "video"): string {
  const tracks = kind === "audio" ? stream.getAudioTracks() : stream.getVideoTracks();
  return tracks[0]?.getSettings().deviceId || "";
}
