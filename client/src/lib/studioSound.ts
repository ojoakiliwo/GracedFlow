import {
  MUSIC_PROFILE,
  SPEECH_PROFILE,
  soundProfile,
  type SoundProfile,
} from "./studioEngine";

export type AudioPresetId =
  | "broadcast"
  | "pop"
  | "rock"
  | "classical"
  | "jazz"
  | "gospel"
  | "acoustic"
  | "voice";

export type ReverbSettings = {
  enabled: boolean;
  mix: number;
  roomSize: number;
  decay: number;
  preDelayMs: number;
};

export type StudioSoundSettings = {
  auto: boolean;
  preset: AudioPresetId;
  reverb: ReverbSettings;
};

export type AudioPreset = {
  id: AudioPresetId;
  label: string;
  hint: string;
  profile: SoundProfile;
  reverb: ReverbSettings;
};

export const DEFAULT_REVERB: ReverbSettings = {
  enabled: false,
  mix: 0.16,
  roomSize: 0.32,
  decay: 0.42,
  preDelayMs: 18,
};

export const AUDIO_PRESETS: AudioPreset[] = [
  {
    id: "broadcast",
    label: "Broadcast",
    hint: "House speech mix — words sit forward",
    profile: SPEECH_PROFILE,
    reverb: { ...DEFAULT_REVERB },
  },
  {
    id: "voice",
    label: "Voice",
    hint: "Preaching and MC — extra presence, little room",
    profile: {
      ...SPEECH_PROFILE,
      highpassHz: 70,
      lowShelfDb: 0.6,
      highShelfHz: 2800,
      highShelfDb: 3.6,
      programmeGain: 2.15,
      compressorThresholdDb: -10,
      compressorRatio: 2.2,
    },
    reverb: { enabled: false, mix: 0.08, roomSize: 0.18, decay: 0.28, preDelayMs: 12 },
  },
  {
    id: "pop",
    label: "Pop",
    hint: "Bright, tight, radio-ready",
    profile: {
      highpassHz: 70,
      lowShelfHz: 110,
      lowShelfDb: 2.2,
      highShelfHz: 7500,
      highShelfDb: 3.8,
      programmeGain: 1.7,
      limiterThresholdDb: -2.2,
      compressorThresholdDb: -14,
      compressorRatio: 3.2,
      compressorAttack: 0.008,
      compressorRelease: 0.22,
      safetyPeak: 0.62,
      comfortRms: 0.2,
      agcMax: 1.35,
    },
    reverb: { enabled: true, mix: 0.14, roomSize: 0.22, decay: 0.32, preDelayMs: 16 },
  },
  {
    id: "rock",
    label: "Rock",
    hint: "Punchy low end, controlled peaks",
    profile: {
      highpassHz: 85,
      lowShelfHz: 95,
      lowShelfDb: 3.4,
      highShelfHz: 5500,
      highShelfDb: 2.2,
      programmeGain: 1.55,
      limiterThresholdDb: -3.5,
      compressorThresholdDb: -16,
      compressorRatio: 4,
      compressorAttack: 0.006,
      compressorRelease: 0.18,
      safetyPeak: 0.55,
      comfortRms: 0.18,
      agcMax: 1.25,
    },
    reverb: { enabled: true, mix: 0.1, roomSize: 0.2, decay: 0.28, preDelayMs: 10 },
  },
  {
    id: "classical",
    label: "Classical",
    hint: "Open and gentle — hall space, little squeeze",
    profile: {
      highpassHz: 40,
      lowShelfHz: 140,
      lowShelfDb: 0.4,
      highShelfHz: 10000,
      highShelfDb: 1.1,
      programmeGain: 1.38,
      limiterThresholdDb: -2.8,
      compressorThresholdDb: -6,
      compressorRatio: 1.4,
      compressorAttack: 0.03,
      compressorRelease: 0.5,
      safetyPeak: 0.78,
      comfortRms: 0.32,
      agcMax: 1.2,
    },
    reverb: { enabled: true, mix: 0.32, roomSize: 0.72, decay: 0.68, preDelayMs: 38 },
  },
  {
    id: "jazz",
    label: "Jazz",
    hint: "Warm body, easy dynamics",
    profile: {
      highpassHz: 50,
      lowShelfHz: 180,
      lowShelfDb: 1.8,
      highShelfHz: 4800,
      highShelfDb: 1.6,
      programmeGain: 1.52,
      limiterThresholdDb: -2.4,
      compressorThresholdDb: -10,
      compressorRatio: 2,
      compressorAttack: 0.018,
      compressorRelease: 0.35,
      safetyPeak: 0.68,
      comfortRms: 0.24,
      agcMax: 1.3,
    },
    reverb: { enabled: true, mix: 0.2, roomSize: 0.4, decay: 0.48, preDelayMs: 22 },
  },
  {
    id: "gospel",
    label: "Gospel",
    hint: "Choir and band with room for the word",
    profile: {
      ...MUSIC_PROFILE,
      highpassHz: 70,
      lowShelfDb: -2.2,
      highShelfHz: 4200,
      highShelfDb: 2.4,
      programmeGain: 1.45,
      compressorThresholdDb: -12,
      compressorRatio: 2.4,
    },
    reverb: { enabled: true, mix: 0.22, roomSize: 0.48, decay: 0.5, preDelayMs: 24 },
  },
  {
    id: "acoustic",
    label: "Acoustic",
    hint: "Natural instruments, light glue",
    profile: {
      highpassHz: 60,
      lowShelfHz: 150,
      lowShelfDb: -0.8,
      highShelfHz: 8000,
      highShelfDb: 1.4,
      programmeGain: 1.48,
      limiterThresholdDb: -2.6,
      compressorThresholdDb: -9,
      compressorRatio: 1.8,
      compressorAttack: 0.02,
      compressorRelease: 0.4,
      safetyPeak: 0.7,
      comfortRms: 0.26,
      agcMax: 1.28,
    },
    reverb: { enabled: true, mix: 0.18, roomSize: 0.36, decay: 0.4, preDelayMs: 20 },
  },
];

export const DEFAULT_SOUND_SETTINGS: StudioSoundSettings = {
  auto: true,
  preset: "broadcast",
  reverb: { ...DEFAULT_REVERB },
};

const STORAGE_KEY = "igc-studio-sound";

export function getAudioPreset(id: AudioPresetId): AudioPreset {
  return AUDIO_PRESETS.find((p) => p.id === id) ?? AUDIO_PRESETS[0]!;
}

export function activeSoundProfile(
  settings: StudioSoundSettings,
  musicFilter: boolean,
): SoundProfile {
  if (settings.auto) return soundProfile(musicFilter ? "music" : "speech");
  return getAudioPreset(settings.preset).profile;
}

export function reverbDurationSec(roomSize: number): number {
  const t = Math.min(1, Math.max(0, roomSize));
  return 0.35 + t * 2.6;
}

export function reverbDecayPower(decay: number): number {
  const t = Math.min(1, Math.max(0, decay));
  return 1.4 + t * 6.2;
}

export function reverbWetDry(mix: number, enabled: boolean): { dry: number; wet: number } {
  if (!enabled) return { dry: 1, wet: 0 };
  const m = Math.min(1, Math.max(0, mix));
  return { dry: 1 - m, wet: m };
}

export function fillImpulseChannel(data: Float32Array, decayPower: number, seed = 1): void {
  let s = seed || 1;
  const n = data.length;
  for (let i = 0; i < n; i++) {
    s = (s * 16807) % 2147483647;
    const noise = (s / 2147483647) * 2 - 1;
    data[i] = noise * Math.pow(1 - i / n, decayPower);
  }
}

export function makeReverbImpulse(
  ctx: Pick<AudioContext, "sampleRate" | "createBuffer">,
  durationSec: number,
  decayPower: number,
): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * durationSec));
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  fillImpulseChannel(buffer.getChannelData(0), decayPower, 1);
  fillImpulseChannel(buffer.getChannelData(1), decayPower, 3);
  return buffer;
}

function clampReverb(reverb: Partial<ReverbSettings> | undefined): ReverbSettings {
  const base = { ...DEFAULT_REVERB, ...reverb };
  return {
    enabled: Boolean(base.enabled),
    mix: Math.min(1, Math.max(0, Number(base.mix) || 0)),
    roomSize: Math.min(1, Math.max(0, Number(base.roomSize) || 0)),
    decay: Math.min(1, Math.max(0, Number(base.decay) || 0)),
    preDelayMs: Math.min(120, Math.max(0, Number(base.preDelayMs) || 0)),
  };
}

export function loadSoundSettings(): StudioSoundSettings {
  try {
    if (typeof localStorage === "undefined") {
      return { ...DEFAULT_SOUND_SETTINGS, reverb: { ...DEFAULT_REVERB } };
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SOUND_SETTINGS, reverb: { ...DEFAULT_REVERB } };
    const parsed = JSON.parse(raw) as Partial<StudioSoundSettings>;
    const preset = AUDIO_PRESETS.some((p) => p.id === parsed.preset)
      ? (parsed.preset as AudioPresetId)
      : DEFAULT_SOUND_SETTINGS.preset;
    return {
      auto: parsed.auto !== false,
      preset,
      reverb: clampReverb(parsed.reverb),
    };
  } catch {
    return { ...DEFAULT_SOUND_SETTINGS, reverb: { ...DEFAULT_REVERB } };
  }
}

export function saveSoundSettings(settings: StudioSoundSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* private mode */
  }
}
