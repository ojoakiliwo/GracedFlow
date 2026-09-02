import { describe, expect, it } from "vitest";
import {
  assembleRecordingBlob,
  formatRecordingBytes,
  newRecordingId,
  recordingFileName,
  sealRecordingName,
} from "../src/lib/studioRecordings";

describe("Studio recordings kept on this computer", () => {
  it("names a service recording with a timestamp and marks crash leftovers as partial", () => {
    const at = new Date("2026-09-02T19:15:00.000Z");
    expect(recordingFileName(at)).toBe("igc-service-2026-09-02T19-15-00.webm");
    expect(recordingFileName(at, true)).toBe("igc-service-2026-09-02T19-15-00-partial.webm");
  });

  it("builds a downloadable blob from the chunks written while recording", () => {
    const blob = assembleRecordingBlob(
      [new Blob(["abc"], { type: "video/webm" }), new Blob(["def"], { type: "video/webm" })],
      "video/webm",
    );
    expect(blob.type).toBe("video/webm");
    expect(blob.size).toBe(6);
  });

  it("shows recording size in church-desk units", () => {
    expect(formatRecordingBytes(800)).toBe("800 B");
    expect(formatRecordingBytes(2048)).toBe("2 KB");
    expect(formatRecordingBytes(3.5 * 1024 * 1024)).toBe("3.5 MB");
  });

  it("gives each take a unique id", () => {
    expect(newRecordingId(1)).not.toBe(newRecordingId(1));
    expect(newRecordingId(99)).toMatch(/^rec_99_/);
  });

  it("seals a crash leftover with a partial file name once", () => {
    expect(sealRecordingName("igc-service-2026-09-02T19-15-00.webm", true)).toBe(
      "igc-service-2026-09-02T19-15-00-partial.webm",
    );
    expect(sealRecordingName("igc-service-2026-09-02T19-15-00-partial.webm", true)).toBe(
      "igc-service-2026-09-02T19-15-00-partial.webm",
    );
    expect(sealRecordingName("igc-service-2026-09-02T19-15-00.webm", false)).toBe(
      "igc-service-2026-09-02T19-15-00.webm",
    );
  });
});
