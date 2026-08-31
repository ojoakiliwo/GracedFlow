import { describe, expect, it } from "vitest";
import {
  AUDIO_PRESETS,
  activeSoundProfile,
  fillImpulseChannel,
  getAudioPreset,
  reverbDecayPower,
  reverbDurationSec,
  reverbWetDry,
} from "../src/lib/studioSound";
import { MUSIC_PROFILE, SPEECH_PROFILE } from "../src/lib/studioEngine";

describe("Studio advanced sound", () => {
  it("offers pop, rock and classical among the manual styles", () => {
    expect(AUDIO_PRESETS.map((p) => p.id)).toEqual(
      expect.arrayContaining(["pop", "rock", "classical", "jazz", "gospel", "acoustic", "voice", "broadcast"]),
    );
  });

  it("uses speech or music while automatic is on, and the chosen style when it is off", () => {
    const autoSpeech = activeSoundProfile({ auto: true, preset: "rock", reverb: getAudioPreset("rock").reverb }, false);
    const autoMusic = activeSoundProfile({ auto: true, preset: "rock", reverb: getAudioPreset("rock").reverb }, true);
    const manual = activeSoundProfile({ auto: false, preset: "classical", reverb: getAudioPreset("classical").reverb }, true);
    expect(autoSpeech).toBe(SPEECH_PROFILE);
    expect(autoMusic).toBe(MUSIC_PROFILE);
    expect(manual).toBe(getAudioPreset("classical").profile);
    expect(manual.compressorRatio).toBeLessThan(getAudioPreset("rock").profile.compressorRatio);
  });

  it("keeps the mix dry until reverb is switched on", () => {
    expect(reverbWetDry(0.4, false)).toEqual({ dry: 1, wet: 0 });
    expect(reverbWetDry(0.25, true)).toEqual({ dry: 0.75, wet: 0.25 });
    expect(reverbDurationSec(0)).toBeCloseTo(0.35);
    expect(reverbDurationSec(1)).toBeGreaterThan(2);
    expect(reverbDecayPower(1)).toBeGreaterThan(reverbDecayPower(0));
  });

  it("builds an impulse that fades instead of staying full-level noise", () => {
    const data = new Float32Array(64);
    fillImpulseChannel(data, 3, 1);
    const early = Math.abs(data[2]!);
    const late = Math.abs(data[60]!);
    expect(early).toBeGreaterThan(late);
    expect(data.some((v) => v !== 0)).toBe(true);
  });
});
