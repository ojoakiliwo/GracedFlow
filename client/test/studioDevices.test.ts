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
  it("recognises a Yamaha USB mixer as desk audio, not a laptop mic", () => {
    expect(looksLikeDeskAudio("Yamaha AG06MK2")).toBe(true);
    expect(looksLikeDeskAudio("Steinberg USB ASIO")).toBe(true);
    expect(looksLikeDeskAudio("USB Audio Device")).toBe(true);
    expect(looksLikeDeskAudio("Microphone Array (Realtek(R) Audio)")).toBe(false);
    expect(looksLikeDeskAudio("Headset Microphone")).toBe(false);
  });

  it("sorts mixer / USB inputs above the laptop mic", () => {
    const sorted = sortAudioDevices([
      { deviceId: "laptop", label: "Microphone Array (Realtek(R) Audio)" },
      { deviceId: "desk", label: "Yamaha AG06MK2" },
    ]);
    expect(sorted[0]?.deviceId).toBe("desk");
    expect(decorateAudioLabel("Yamaha AG06MK2", 0)).toContain("mixer / USB");
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
    ];
    expect(keepDeviceId("yamaha", devices)).toBe("yamaha");
    expect(keepDeviceId("gone", devices)).toBe("a");
  });
});
