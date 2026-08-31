/** Adaptive broadcast DSP — follow the room, but never mute a quiet voice or choir. */

export const AGC_MIN = 0.7;
export const AGC_MAX = 1.85;
export const COMFORT_RMS_HIGH = 0.28;
export const SAFETY_PEAK = 0.72;

export type StudioSoundMode = "speech" | "music";

export type SoundProfile = {
  highpassHz: number;
  lowShelfHz: number;
  lowShelfDb: number;
  highShelfHz: number;
  highShelfDb: number;
  programmeGain: number;
  limiterThresholdDb: number;
  compressorThresholdDb: number;
  compressorRatio: number;
  compressorAttack: number;
  compressorRelease: number;
  safetyPeak: number;
  comfortRms: number;
  agcMax: number;
};

/** Preaching and speaking: fuller, louder, words sit forward. */
export const SPEECH_PROFILE: SoundProfile = {
  highpassHz: 55,
  lowShelfHz: 160,
  lowShelfDb: 1.8,
  highShelfHz: 3200,
  highShelfDb: 2.8,
  programmeGain: 2.05,
  limiterThresholdDb: -1.2,
  compressorThresholdDb: -8,
  compressorRatio: 1.8,
  compressorAttack: 0.012,
  compressorRelease: 0.28,
  safetyPeak: SAFETY_PEAK,
  comfortRms: COMFORT_RMS_HIGH,
  agcMax: AGC_MAX,
};

/**
 * Worship / musical: lighter than speech so the band is not as heavy.
 * Switch this off when the music stops so every instrument comes through.
 */
export const MUSIC_PROFILE: SoundProfile = {
  highpassHz: 95,
  lowShelfHz: 220,
  lowShelfDb: -5.5,
  highShelfHz: 9000,
  highShelfDb: 1.2,
  programmeGain: 1.12,
  limiterThresholdDb: -5,
  compressorThresholdDb: -14,
  compressorRatio: 2.8,
  compressorAttack: 0.02,
  compressorRelease: 0.42,
  safetyPeak: 0.5,
  comfortRms: 0.16,
  agcMax: 1.12,
};

export function soundProfile(mode: StudioSoundMode): SoundProfile {
  return mode === "music" ? MUSIC_PROFILE : SPEECH_PROFILE;
}

export type AdaptiveAudioState = {
  noiseFloor: number;
  gate: number;
  agcGain: number;
  compressorThresholdDb: number;
  compressorRatio: number;
};

export const INITIAL_AUDIO_STATE: AdaptiveAudioState = {
  noiseFloor: 0.008,
  gate: 1,
  agcGain: 1,
  compressorThresholdDb: -8,
  compressorRatio: 1.8,
};

export function rmsFromSamples(samples: ArrayLike<number>): number {
  let sum = 0;
  const n = samples.length;
  for (let i = 0; i < n; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / Math.max(1, n));
}

export function peakFromSamples(samples: ArrayLike<number>): number {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = Math.abs(samples[i]);
    if (v > peak) peak = v;
  }
  return peak;
}

export function updateNoiseFloor(prev: number, rms: number): number {
  if (rms < prev * 1.9 || rms < 0.018) {
    return prev * 0.9 + rms * 0.1;
  }
  return prev * 0.997 + Math.min(rms, prev) * 0.003;
}

/**
 * Transparency, not a mute. Quiet prayer and choir stay in the mix.
 * Only a little hiss is eased — never pulled to silence.
 */
export function nextGate(rms: number, noiseFloor: number, prev: number): number {
  const hiss = Math.max(0.0022, noiseFloor * 1.2);
  const target = rms < hiss ? 0.82 : 1;
  const mix = target > prev ? 0.22 : 0.08;
  return prev * (1 - mix) + target * mix;
}

/**
 * Do not chase one loudness. Leave quiet passages quiet; ease only the extremes
 * so car stereos, phones and headsets are not blasted.
 */
export function nextAgcGain(
  rms: number,
  peak: number,
  prevGain: number,
  profile: SoundProfile = SPEECH_PROFILE,
): number {
  let desired = prevGain;
  if (peak > profile.safetyPeak) {
    desired = prevGain * (profile.safetyPeak / peak);
  } else if (rms > profile.comfortRms) {
    desired = prevGain * 0.97;
  }
  const clamped = Math.min(profile.agcMax, Math.max(AGC_MIN, desired));
  return prevGain + (clamped - prevGain) * 0.05;
}

export function nextCompressor(
  peak: number,
  rms: number,
  profile: SoundProfile = SPEECH_PROFILE,
): {
  thresholdDb: number;
  ratio: number;
} {
  const crest = peak / Math.max(0.001, rms);
  if (peak >= 0.7 || (rms >= 0.22 && crest >= 6)) {
    return {
      thresholdDb: profile.compressorThresholdDb - 6,
      ratio: Math.min(6, profile.compressorRatio + 1.4),
    };
  }
  if (peak >= 0.48) {
    return {
      thresholdDb: profile.compressorThresholdDb - 3,
      ratio: profile.compressorRatio + 0.6,
    };
  }
  return { thresholdDb: profile.compressorThresholdDb, ratio: profile.compressorRatio };
}

export function tickAudio(
  state: AdaptiveAudioState,
  rms: number,
  peak: number,
  profile: SoundProfile = SPEECH_PROFILE,
  auto = true,
): AdaptiveAudioState {
  const noiseFloor = updateNoiseFloor(state.noiseFloor, rms);
  if (!auto) {
    return {
      noiseFloor,
      gate: 1,
      agcGain: 1,
      compressorThresholdDb: profile.compressorThresholdDb,
      compressorRatio: profile.compressorRatio,
    };
  }
  const gate = nextGate(rms, noiseFloor, state.gate);
  const agcGain = nextAgcGain(rms, peak, state.agcGain, profile);
  const comp = nextCompressor(peak, rms, profile);
  return {
    noiseFloor,
    gate,
    agcGain,
    compressorThresholdDb: state.compressorThresholdDb * 0.9 + comp.thresholdDb * 0.1,
    compressorRatio: state.compressorRatio * 0.9 + comp.ratio * 0.1,
  };
}

export type VideoAutoState = {
  brightness: number;
  contrast: number;
};

export const INITIAL_VIDEO_AUTO: VideoAutoState = { brightness: 1, contrast: 1 };

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function nextVideoAuto(luma: number, prev: VideoAutoState): VideoAutoState {
  const target = 120;
  const delta = (target - luma) / 255;
  return {
    brightness: clamp(prev.brightness + delta * 0.1, 0.72, 1.42),
    contrast: clamp(
      prev.contrast + (luma < 65 ? 0.012 : luma > 185 ? -0.012 : (1 - prev.contrast) * 0.02),
      0.86,
      1.32,
    ),
  };
}

export function dbFromLinear(gain: number): number {
  return 20 * Math.log10(Math.max(0.0001, gain));
}
