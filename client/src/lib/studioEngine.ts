/** Adaptive broadcast DSP — settings follow the live signal, they are not a one-time preset. */

export const AUDIO_TARGET_RMS = 0.12;
export const AGC_MIN = 0.4;
export const AGC_MAX = 7.5;

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
  agcGain: 1.4,
  compressorThresholdDb: -14,
  compressorRatio: 3,
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

/** Tracks the quiet-floor so the gate can rise/fall as the room changes. */
export function updateNoiseFloor(prev: number, rms: number): number {
  if (rms < prev * 1.9 || rms < 0.018) {
    return prev * 0.9 + rms * 0.1;
  }
  return prev * 0.997 + Math.min(rms, prev) * 0.003;
}

export function nextGate(rms: number, noiseFloor: number, prev: number): number {
  const threshold = Math.max(0.0035, noiseFloor * 3.4);
  let target = 0.015;
  if (rms > threshold) target = 1;
  else if (rms > threshold * 0.55) target = 0.4;
  return prev * 0.7 + target * 0.3;
}

export function nextAgcGain(rms: number, gate: number, prevGain: number): number {
  const effective = Math.max(0.0009, rms * Math.max(gate, 0.08));
  const desired = AUDIO_TARGET_RMS / effective;
  const clamped = Math.min(AGC_MAX, Math.max(AGC_MIN, desired));
  return prevGain + (clamped - prevGain) * 0.09;
}

export function nextCompressor(peak: number, rms: number): {
  thresholdDb: number;
  ratio: number;
} {
  const crest = peak / Math.max(0.001, rms);
  const thresholdDb = peak >= 0.62 ? -20 : peak >= 0.35 ? -15 : -11;
  const ratio = crest >= 9 ? 7 : crest >= 4.5 ? 4.2 : 2.6;
  return { thresholdDb, ratio };
}

export function tickAudio(
  state: AdaptiveAudioState,
  rms: number,
  peak: number,
): AdaptiveAudioState {
  const noiseFloor = updateNoiseFloor(state.noiseFloor, rms);
  const gate = nextGate(rms, noiseFloor, state.gate);
  const agcGain = nextAgcGain(rms, gate, state.agcGain);
  const comp = nextCompressor(peak, rms);
  return {
    noiseFloor,
    gate,
    agcGain,
    compressorThresholdDb: state.compressorThresholdDb * 0.85 + comp.thresholdDb * 0.15,
    compressorRatio: state.compressorRatio * 0.85 + comp.ratio * 0.15,
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

/** Average luma 0–255. Dark rooms lift brightness; harsh light eases it back. */
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
