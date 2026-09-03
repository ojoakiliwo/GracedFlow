import type { WhipEncode } from "./studioWhip";

export const STUDIO_OUTPUT_KEY = "gracedflow.studioOutput";

export type StudioOutputId = "720p" | "540p" | "360p";

export type StudioOutput = {
  id: StudioOutputId;
  label: string;
  hint: string;
  width: number;
  height: number;
  maxBitrate: number;
  fps: number;
};

export const STUDIO_OUTPUTS: StudioOutput[] = [
  {
    id: "720p",
    label: "High · 720p",
    hint: "Best picture. This computer must be able to encode it.",
    width: 1280,
    height: 720,
    maxBitrate: 2_500_000,
    fps: 30,
  },
  {
    id: "540p",
    label: "Medium · 540p",
    hint: "Easier for a church laptop to encode.",
    width: 960,
    height: 540,
    maxBitrate: 1_500_000,
    fps: 30,
  },
  {
    id: "360p",
    label: "Low · 360p",
    hint: "Use this if Go live says 0 packets.",
    width: 640,
    height: 360,
    maxBitrate: 800_000,
    fps: 24,
  },
];

export const DEFAULT_STUDIO_OUTPUT: StudioOutput = STUDIO_OUTPUTS[0]!;

export function studioOutput(id: StudioOutputId | string | undefined): StudioOutput {
  return STUDIO_OUTPUTS.find((row) => row.id === id) ?? DEFAULT_STUDIO_OUTPUT;
}

export function nextLowerStudioOutput(id: StudioOutputId): StudioOutput | null {
  if (id === "720p") return studioOutput("540p");
  if (id === "540p") return studioOutput("360p");
  return null;
}

export function whipEncodeFromOutput(out: StudioOutput, scale = 1, preferH264 = true): WhipEncode {
  return {
    maxBitrate: out.maxBitrate,
    maxFramerate: out.fps,
    scaleResolutionDownBy: scale > 1 ? scale : undefined,
    preferH264,
  };
}

export function loadStudioOutputId(): StudioOutputId {
  try {
    if (typeof localStorage === "undefined") return DEFAULT_STUDIO_OUTPUT.id;
    const raw = localStorage.getItem(STUDIO_OUTPUT_KEY);
    if (!raw) return DEFAULT_STUDIO_OUTPUT.id;
    const parsed = JSON.parse(raw) as { id?: string };
    return studioOutput(parsed.id).id;
  } catch {
    return DEFAULT_STUDIO_OUTPUT.id;
  }
}

export function saveStudioOutputId(id: StudioOutputId) {
  try {
    localStorage.setItem(STUDIO_OUTPUT_KEY, JSON.stringify({ id }));
  } catch {
    // Private windows may refuse localStorage.
  }
}
