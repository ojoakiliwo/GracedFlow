/** Adaptive broadcast DSP — follow the room, but never mute a quiet voice or choir. */

export const AGC_MIN = 0.55;
export const AGC_MAX = 1.45;
export const COMFORT_RMS_HIGH = 0.2;
export const SAFETY_PEAK = 0.58;

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
export function nextAgcGain(rms: number, peak: number, prevGain: number): number {
  let desired = prevGain;
  if (peak > SAFETY_PEAK) {
    desired = prevGain * (SAFETY_PEAK / peak);
  } else if (rms > COMFORT_RMS_HIGH) {
    desired = prevGain * 0.97;
  }
  const clamped = Math.min(AGC_MAX, Math.max(AGC_MIN, desired));
  return prevGain + (clamped - prevGain) * 0.05;
}

export function nextCompressor(peak: number, rms: number): {
  thresholdDb: number;
  ratio: number;
} {
  const crest = peak / Math.max(0.001, rms);
  if (peak >= 0.7 || (rms >= 0.22 && crest >= 6)) return { thresholdDb: -14, ratio: 3.2 };
  if (peak >= 0.48) return { thresholdDb: -11, ratio: 2.4 };
  return { thresholdDb: -6, ratio: 1.6 };
}

export function tickAudio(
  state: AdaptiveAudioState,
  rms: number,
  peak: number,
): AdaptiveAudioState {
  const noiseFloor = updateNoiseFloor(state.noiseFloor, rms);
  const gate = nextGate(rms, noiseFloor, state.gate);
  const agcGain = nextAgcGain(rms, peak, state.agcGain);
  const comp = nextCompressor(peak, rms);
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
