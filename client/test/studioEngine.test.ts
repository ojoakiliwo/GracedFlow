import { describe, expect, it } from "vitest";
import {
  MUSIC_PROFILE,
  SPEECH_PROFILE,
  nextAgcGain,
  nextGate,
  nextVideoAuto,
  peakFromSamples,
  rmsFromSamples,
  soundProfile,
  tickAudio,
  updateNoiseFloor,
  INITIAL_AUDIO_STATE,
} from "../src/lib/studioEngine";

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

  it("keeps quiet speech and choir open instead of muting them", () => {
    const floor = 0.006;
    expect(nextGate(0.02, floor, 1)).toBeGreaterThan(0.95);
    let open = 0.2;
    for (let i = 0; i < 16; i++) open = nextGate(0.03, floor, open);
    expect(open).toBeGreaterThan(0.9);
    let hiss = 1;
    for (let i = 0; i < 30; i++) hiss = nextGate(0.0012, floor, hiss);
    expect(hiss).toBeGreaterThan(0.7);
    expect(hiss).toBeLessThan(1);
  });

  it("does not boost a quiet passage; it eases only a loud peak", () => {
    const quiet = nextAgcGain(0.03, 0.05, 1);
    const loud = nextAgcGain(0.28, 0.9, 1);
    expect(quiet).toBeCloseTo(1, 2);
    expect(loud).toBeLessThan(1);
  });

  it("tightens the ceiling only when peaks get extreme", () => {
    const calm = tickAudio(INITIAL_AUDIO_STATE, 0.08, 0.12);
    const shout = tickAudio(INITIAL_AUDIO_STATE, 0.22, 0.9);
    expect(shout.compressorThresholdDb).toBeLessThan(calm.compressorThresholdDb);
    expect(shout.compressorRatio).toBeGreaterThan(calm.compressorRatio);
    expect(shout.compressorRatio).toBeLessThan(4);
  });

  it("lifts video brightness in a dark frame", () => {
    const next = nextVideoAuto(40, { brightness: 1, contrast: 1 });
    expect(next.brightness).toBeGreaterThan(1);
    expect(next.contrast).toBeGreaterThan(1);
  });

  it("keeps adapting across ticks instead of locking a preset", () => {
    let state = { ...INITIAL_AUDIO_STATE };
    for (let i = 0; i < 24; i++) state = tickAudio(state, 0.05, 0.08);
    const calmGain = state.agcGain;
    for (let i = 0; i < 24; i++) state = tickAudio(state, 0.3, 0.7);
    expect(state.agcGain).toBeLessThan(calmGain);
    expect(state.gate).toBeGreaterThan(0.9);
  });

  it("makes the speech mix louder than the music filter", () => {
    expect(SPEECH_PROFILE.programmeGain).toBeGreaterThan(MUSIC_PROFILE.programmeGain);
    expect(SPEECH_PROFILE.highpassHz).toBeLessThan(MUSIC_PROFILE.highpassHz);
    expect(MUSIC_PROFILE.lowShelfDb).toBeLessThan(0);
    expect(SPEECH_PROFILE.lowShelfDb).toBeGreaterThan(0);
    expect(soundProfile("music")).toBe(MUSIC_PROFILE);
    expect(soundProfile("speech")).toBe(SPEECH_PROFILE);
    const speechAgc = nextAgcGain(0.4, 0.9, 1.8, SPEECH_PROFILE);
    const musicAgc = nextAgcGain(0.4, 0.9, 1.8, MUSIC_PROFILE);
    expect(musicAgc).toBeLessThan(speechAgc);
  });
});
