import { describe, expect, it, vi } from "vitest";
import {
  applySavedDestinations,
  draftsFromConfig,
  enabledWithKeys,
  keepTypedKeys,
  mergeConfigWithStored,
  readStoredLiveDrafts,
  savePayload,
  socialRestreamHint,
  STUDIO_LIVE_DRAFTS_KEY,
  writeStoredLiveDrafts,
} from "../src/lib/studioLive";
import {
  iceServersForWhipHost,
  iceIsConnected,
  livepeerIceHost,
  preferH264Codecs,
  streamKeyFromWhipUrl,
  waitForIce,
  waitForIceConnected,
  whipHostLooksRegional,
} from "../src/lib/studioWhip";

function memoryStore(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    getItem(key: string) {
      return data.get(key) ?? null;
    },
    key(index: number) {
      return [...data.keys()][index] ?? null;
    },
    removeItem(key: string) {
      data.delete(key);
    },
    setItem(key: string, value: string) {
      data.set(key, value);
    },
  };
}

const sampleConfig = {
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
};

describe("Studio live drafts", () => {
  it("keeps saved keys unless a new key is typed", () => {
    const drafts = draftsFromConfig(sampleConfig);
    expect(enabledWithKeys(drafts).map((d) => d.platform)).toEqual(["youtube"]);
    drafts[0]!.streamKey = "new-key";
    expect(savePayload(drafts).destinations[0]).toMatchObject({
      platform: "youtube",
      enabled: true,
      streamKey: "new-key",
    });
  });

  it("puts pasted keys back after leaving Destinations", () => {
    const store = memoryStore();
    writeStoredLiveDrafts(
      [
        {
          ...sampleConfig.destinations[0]!,
          streamKey: "youtube-secret-key",
        },
        {
          ...sampleConfig.destinations[1]!,
          streamKey: "tiktok-secret-key",
          ingestUrl: "rtmp://tiktok.example/live",
          enabled: true,
        },
      ],
      store,
    );
    expect(store.getItem(STUDIO_LIVE_DRAFTS_KEY)).toContain("youtube-secret-key");

    const restored = mergeConfigWithStored(
      {
        ...sampleConfig,
        destinations: sampleConfig.destinations.map((d) => ({
          ...d,
          streamKeySet: false,
          streamKeyHint: "",
        })),
      },
      readStoredLiveDrafts(store),
    );
    expect(restored[0]?.streamKey).toBe("youtube-secret-key");
    expect(restored[1]?.streamKey).toBe("tiktok-secret-key");
    expect(restored[1]?.enabled).toBe(true);
    expect(restored[1]?.ingestUrl).toBe("rtmp://tiktok.example/live");
  });

  it("does not let a server reload wipe keys the operator just typed", () => {
    const typed = draftsFromConfig(sampleConfig);
    typed[0]!.streamKey = "still-here";
    const incoming = draftsFromConfig(sampleConfig);
    const kept = keepTypedKeys(incoming, typed);
    expect(kept[0]?.streamKey).toBe("still-here");
    expect(kept[0]?.enabled).toBe(true);
  });

  it("turns Off destinations that saved without a key so others can stay live", () => {
    const typed = draftsFromConfig(sampleConfig);
    typed[1]!.enabled = true;
    typed[1]!.streamKey = "";
    const saved = applySavedDestinations(sampleConfig, typed);
    expect(saved[0]?.enabled).toBe(true);
    expect(saved[0]?.streamKey).toBe("");
    expect(saved[1]?.enabled).toBe(false);
  });
});

describe("social restream hint", () => {
  it("does not treat a Facebook destination as the Page already being live", () => {
    expect(socialRestreamHint(["youtube", "facebook"])).toMatch(/Livepeer is restreaming Program to YouTube, Facebook/);
    expect(socialRestreamHint(["youtube", "facebook"])).toMatch(/Go live on Facebook/);
    expect(socialRestreamHint(["youtube", "facebook"])).not.toMatch(/^Sending to /);
    expect(socialRestreamHint(["instagram"])).toMatch(/Instagram also needs its own Go live click/);
    expect(
      socialRestreamHint(["facebook"], { ingesting: false, profiles: [], targets: [] }),
    ).toMatch(/has not received Program yet/);
    expect(
      socialRestreamHint(["youtube", "facebook"], { ingesting: false, profiles: [], targets: [] }),
    ).toMatch(/YouTube and Facebook stay dark/);
    expect(
      socialRestreamHint(["facebook"], { ingesting: true, profiles: ["720p0"], targets: [{ platform: "facebook", profile: "720p0" }] }),
    ).toMatch(/Livepeer is receiving Program/);
    expect(
      socialRestreamHint(["youtube"], { ingesting: true, profiles: ["720p0"], targets: [{ platform: "youtube", profile: "720p0" }] }),
    ).toMatch(/waiting in YouTube Studio/);
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

  it("puts H264 ahead of VP8 so Facebook can ingest a transcodable restream", () => {
    const ordered = preferH264Codecs([
      { mimeType: "video/VP8" },
      { mimeType: "video/H264" },
      { mimeType: "video/VP9" },
    ]);
    expect(ordered[0]?.mimeType).toBe("video/H264");
  });

  it("builds Livepeer TURN servers from the regional WHIP host", () => {
    expect(
      streamKeyFromWhipUrl("https://nyc-prod-catalyst-0.lp-playback.studio:443/webrtc/video+whip-secret"),
    ).toBe("video+whip-secret");
    expect(whipHostLooksRegional("nyc-prod-catalyst-0.lp-playback.studio:443")).toBe(true);
    expect(whipHostLooksRegional("lax-prod-catalyst-0.lp-playback.studio")).toBe(true);
    expect(whipHostLooksRegional("livepeer.studio")).toBe(false);
    expect(livepeerIceHost("nyc-prod-catalyst-0.lp-playback.studio:443")).toBe("nyc.livepeer.com");
    const ice = iceServersForWhipHost("nyc-prod-catalyst-0.lp-playback.studio:443");
    expect(ice).toEqual(
      expect.arrayContaining([
        { urls: "stun:nyc.livepeer.com:3478" },
        { urls: "turn:nyc.livepeer.com:3478", username: "livepeer", credential: "livepeer" },
        { urls: "turn:nyc.livepeer.com:3478?transport=tcp", username: "livepeer", credential: "livepeer" },
        { urls: "turn:nyc.livepeer.com:5349", username: "livepeer", credential: "livepeer" },
      ]),
    );
    expect(ice.some((s) => String(s.urls).includes("lp-playback.studio"))).toBe(false);
  });

  it("waits until ICE is connected before treating WHIP as live", async () => {
    expect(
      iceIsConnected({ iceConnectionState: "checking", connectionState: "connecting" } as RTCPeerConnection),
    ).toBe(false);
    expect(
      iceIsConnected({ iceConnectionState: "connected", connectionState: "connecting" } as RTCPeerConnection),
    ).toBe(true);
    const pc = {
      iceConnectionState: "checking",
      connectionState: "connecting",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as RTCPeerConnection;
    const pending = waitForIceConnected(pc, 20);
    await expect(pending).rejects.toThrow(/Could not reach Livepeer/);
  });
});
