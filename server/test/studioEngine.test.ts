import { describe, expect, it } from "vitest";
import {
  nextAgcGain,
  nextGate,
  nextVideoAuto,
  peakFromSamples,
  rmsFromSamples,
  tickAudio,
  updateNoiseFloor,
  INITIAL_AUDIO_STATE,
} from "../../client/src/lib/studioEngine";

describe("Broadcast studio adaptive engine", () => {
  it("measures RMS and peak from a buffer", () => {
    expect(rmsFromSamples([0, 0, 0, 0])).toBe(0);
    expect(peakFromSamples([-0.5, 0.2, 0.9])).toBe(0.9);
    const rms = rmsFromSamples([0.5, -0.5, 0.5, -0.5]);
    expect(rms).toBeCloseTo(0.5, 5);
  });

  it("lowers the noise floor in a quiet room and holds it when speech arrives", () => {
    let floor = 0.02;
    for (let i = 0; i < 40; i++) floor = updateNoiseFloor(floor, 0.004);
    expect(floor).toBeLessThan(0.01);
    const duringSpeech = updateNoiseFloor(floor, 0.25);
    expect(duringSpeech).toBeLessThan(0.03);
  });

  it("opens the gate for speech and closes it for noise-floor hiss", () => {
    const floor = 0.006;
    let open = 0.2;
    for (let i = 0; i < 10; i++) open = nextGate(0.12, floor, open);
    expect(open).toBeGreaterThan(0.85);
    let closed = 0.8;
    for (let i = 0; i < 10; i++) closed = nextGate(0.004, floor, closed);
    expect(closed).toBeLessThan(0.25);
  });

  it("raises gain on a quiet talker and eases it on a loud one", () => {
    const quiet = nextAgcGain(0.03, 1, 1.2);
    const loud = nextAgcGain(0.4, 1, 1.2);
    expect(quiet).toBeGreaterThan(loud);
    expect(quiet).toBeGreaterThan(1.2);
    expect(loud).toBeLessThan(1.2);
  });

  it("moves compressor settings when the crest factor changes", () => {
    const quiet = tickAudio(INITIAL_AUDIO_STATE, 0.05, 0.08);
    const shout = tickAudio(INITIAL_AUDIO_STATE, 0.2, 0.95);
    expect(shout.compressorThresholdDb).toBeLessThan(quiet.compressorThresholdDb);
    expect(shout.compressorRatio).toBeGreaterThan(quiet.compressorRatio);
  });

  it("lifts video brightness in a dark frame", () => {
    const next = nextVideoAuto(40, { brightness: 1, contrast: 1 });
    expect(next.brightness).toBeGreaterThan(1);
    expect(next.contrast).toBeGreaterThan(1);
  });

  it("keeps adapting across ticks instead of locking a preset", () => {
    let state = { ...INITIAL_AUDIO_STATE };
    for (let i = 0; i < 24; i++) state = tickAudio(state, 0.02, 0.03);
    const quietGain = state.agcGain;
    for (let i = 0; i < 24; i++) state = tickAudio(state, 0.3, 0.55);
    expect(state.agcGain).toBeLessThan(quietGain);
    expect(state.gate).toBeGreaterThan(0.8);
  });
});
