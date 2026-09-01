import { describe, expect, it, vi } from "vitest";
import { draftsFromConfig, enabledWithKeys, savePayload } from "../src/lib/studioLive";
import { waitForIce } from "../src/lib/studioWhip";

describe("Studio live drafts", () => {
  it("keeps saved keys unless a new key is typed", () => {
    const drafts = draftsFromConfig({
      restream: false,
      restreamDetail: "",
      destinations: [
        {
          platform: "youtube",
          label: "YouTube",
          enabled: true,
          ingestUrl: "rtmps://a.rtmps.youtube.com/live2",
          streamKeySet: true,
          streamKeyHint: "yt••••key",
          helpUrl: "https://studio.youtube.com",
          steps: ["Copy the stream key"],
        },
        {
          platform: "tiktok",
          label: "TikTok",
          enabled: false,
          ingestUrl: "",
          streamKeySet: false,
          streamKeyHint: "",
          helpUrl: "https://www.tiktok.com/live/creators",
          steps: ["Paste TikTok’s server URL"],
        },
      ],
    });
    expect(enabledWithKeys(drafts).map((d) => d.platform)).toEqual(["youtube"]);
    drafts[0]!.streamKey = "new-key";
    expect(savePayload(drafts).destinations[0]).toMatchObject({
      platform: "youtube",
      enabled: true,
      streamKey: "new-key",
    });
  });
});

describe("WHIP ICE wait", () => {
  it("resolves immediately when gathering is already complete", async () => {
    const pc = {
      iceGatheringState: "complete",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as RTCPeerConnection;
    await expect(waitForIce(pc)).resolves.toBeUndefined();
    expect(pc.addEventListener).not.toHaveBeenCalled();
  });
});
