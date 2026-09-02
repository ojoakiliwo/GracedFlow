import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  appendRecordingChunk,
  assembleRecordingBlob,
  beginRecording,
  deleteRecording,
  finishRecording,
  formatRecordingBytes,
  getRecordingBlob,
  listRecordings,
  newRecordingId,
  recoverIncompleteRecordings,
  recordingFileName,
  sealRecordingName,
} from "../src/lib/studioRecordings";

async function resetRecordingsDb(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase("gracedflow-studio");
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error("Could not reset recordings db"));
    req.onblocked = () => resolve();
  });
}

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

describe("Studio recordings IndexedDB keep-until-deleted", () => {
  beforeEach(async () => {
    await resetRecordingsDb();
  });

  it("keeps chunked takes until they are deleted", async () => {
    const id = "rec_keep_1";
    await beginRecording({
      id,
      createdAt: 1,
      name: "igc-service-keep.webm",
      mime: "video/webm",
    });
    await appendRecordingChunk(id, 0, new Blob(["hello"], { type: "video/webm" }));
    await appendRecordingChunk(id, 1, new Blob(["world"], { type: "video/webm" }));
    const finished = await finishRecording(id, false);
    expect(finished?.complete).toBe(true);
    expect(finished?.partial).toBe(false);
    expect(finished?.size).toBe(10);

    const listed = await listRecordings();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(id);

    const blob = await getRecordingBlob(id);
    expect(blob).not.toBeNull();
    expect(await blob!.text()).toBe("helloworld");

    await deleteRecording(id);
    expect(await listRecordings()).toEqual([]);
    expect(await getRecordingBlob(id)).toBeNull();
  });

  it("seals a crash leftover as a partial take once, and drops empty leftovers", async () => {
    await beginRecording({
      id: "rec_crash",
      createdAt: 2,
      name: "igc-service-crash.webm",
      mime: "video/webm",
    });
    await appendRecordingChunk("rec_crash", 0, new Blob(["part"], { type: "video/webm" }));
    await beginRecording({
      id: "rec_empty",
      createdAt: 3,
      name: "igc-service-empty.webm",
      mime: "video/webm",
    });

    const recovered = await recoverIncompleteRecordings();
    expect(recovered.map((row) => row.id)).toEqual(["rec_crash"]);
    expect(recovered[0]?.complete).toBe(true);
    expect(recovered[0]?.partial).toBe(true);
    expect(recovered[0]?.name).toBe("igc-service-crash-partial.webm");

    const again = await recoverIncompleteRecordings();
    expect(again).toEqual([]);
    const listed = await listRecordings();
    expect(listed.map((row) => row.id)).toEqual(["rec_crash"]);
  });
});
