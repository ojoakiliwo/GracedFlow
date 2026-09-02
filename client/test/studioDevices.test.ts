import { describe, expect, it } from "vitest";
import {
  decorateAudioLabel,
  keepDeviceId,
  looksLikeDeskAudio,
  pickRecordingMime,
  sortAudioDevices,
  audioConstraintsFor,
} from "../src/lib/studioDevices";

describe("Studio source switching helpers", () => {
  it("treats mixers, USB boxes, and desktop/loopback inputs as desk audio", () => {
    expect(looksLikeDeskAudio("Yamaha AG06MK2")).toBe(true);
    expect(looksLikeDeskAudio("Steinberg USB ASIO")).toBe(true);
    expect(looksLikeDeskAudio("USB Audio Device")).toBe(true);
    expect(looksLikeDeskAudio("Desktop Audio")).toBe(true);
    expect(looksLikeDeskAudio("Stereo Mix (Realtek(R) Audio)")).toBe(true);
    expect(looksLikeDeskAudio("CABLE Output (VB-Audio Virtual Cable)")).toBe(true);
    expect(looksLikeDeskAudio("Microphone Array (Realtek(R) Audio)")).toBe(false);
    expect(looksLikeDeskAudio("Headset Microphone")).toBe(false);
  });

  it("sorts mixer / USB and computer-sound inputs above the laptop mic", () => {
    const sorted = sortAudioDevices([
      { deviceId: "laptop", label: "Microphone Array (Realtek(R) Audio)" },
      { deviceId: "desk", label: "Yamaha AG06MK2" },
      { deviceId: "loop", label: "Desktop Audio" },
    ]);
    expect(sorted.map((d) => d.deviceId).slice(0, 2).sort()).toEqual(["desk", "loop"]);
    expect(decorateAudioLabel("Yamaha AG06MK2", 0)).toContain("mixer / USB");
    expect(decorateAudioLabel("Desktop Audio", 0)).toContain("computer sound");
  });

  it("turns off echo cancellation so a USB mix is not treated like a webcam mic", () => {
    const c = audioConstraintsFor("yamaha-id");
    expect(c.echoCancellation).toBe(false);
    expect(c.noiseSuppression).toBe(false);
    expect(c.autoGainControl).toBe(false);
    expect(c.deviceId).toEqual({ exact: "yamaha-id" });
  });

  it("prefers a WebM type that includes Opus so recordings are not silent video", () => {
    const mime = pickRecordingMime((type) => type.includes("opus"));
    expect(mime).toContain("opus");
  });

  it("keeps the chosen device when the list refreshes after permission", () => {
    const devices = [
      { deviceId: "a", label: "Cam" },
      { deviceId: "yamaha", label: "Yamaha AG06MK2" },
      { deviceId: "loop", label: "Desktop Audio · computer sound" },
    ];
    expect(keepDeviceId("yamaha", devices)).toBe("yamaha");
    expect(keepDeviceId("gone", devices)).toBe("a");
    expect(keepDeviceId("", devices)).toBe("");
    expect(keepDeviceId("", devices, "Desktop Audio")).toBe("loop");
  });
});
