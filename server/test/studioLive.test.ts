import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";
import {
  isPlaceholderKey,
  LIVE_PLATFORMS,
  livepeerWhipUrl,
  maskStreamKey,
  readyOutputs,
  resolveWhipIngest,
  restreamConfigured,
  restreamProfileName,
  rtmpTargetUrl,
  SOCIAL_TRANSCODE_PROFILE,
  SOCIAL_TRANSCODE_SOURCE_NAME,
  streamHasSocialTranscode,
} from "../src/studioLive.js";

process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://igc:igc@127.0.0.1:5432/gracedflow_test";
process.env.SCHEDULER_ENABLED = "false";
process.env.SEED_DEMO = "true";
delete process.env.LIVEPEER_API_KEY;
delete process.env.LIVEPEER_STUDIO_API_KEY;

let app: Express;
let token: string;

beforeAll(async () => {
  const { initSchema, resetSchema } = await import("../src/db.js");
  const { seed } = await import("../src/seed.js");
  const { createApp } = await import("../src/app.js");
  await resetSchema();
  await initSchema();
  await seed();
  app = createApp();
  const login = await request(app)
    .post("/api/auth/login")
    .send({ email: "admin@igc.church", password: "Grace@2024" });
  token = login.body.token;
});

afterEach(() => {
  delete process.env.LIVEPEER_API_KEY;
  delete process.env.LIVEPEER_STUDIO_API_KEY;
  vi.unstubAllGlobals();
});

function auth(req: request.Test) {
  return req.set("Authorization", `Bearer ${token}`);
}

function stubLivepeer(stream: { id: string; streamKey: string }) {
  const calls: { url: string; method: string; body?: string }[] = [];
  let targetSeq = 0;
  vi.stubGlobal(
    "fetch",
    async (url: string | URL, init?: RequestInit) => {
      const href = String(url);
      const method = (init?.method || "GET").toUpperCase();
      calls.push({ url: href, method, body: typeof init?.body === "string" ? init.body : undefined });
      if (method === "HEAD" || (href.includes("/webrtc/") && !href.includes("/api/"))) {
        const key = href.split("/").pop()?.split("?")[0] || stream.streamKey;
        return {
          ok: false,
          status: 307,
          headers: {
            get: (name: string) =>
              name.toLowerCase() === "location"
                ? `https://lax-prod-catalyst-0.lp-playback.studio/webrtc/${key}`
                : null,
          },
          json: async () => ({}),
          text: async () => "",
        };
      }
      if (href.includes("/api/multistream/target") && method === "POST") {
        targetSeq += 1;
        return { ok: true, json: async () => ({ id: `tgt_${targetSeq}` }) };
      }
      if (method === "DELETE" || href.endsWith("/terminate")) {
        return { ok: true, json: async () => ({}) };
      }
      if (href.endsWith("/api/stream") && method === "POST") {
        return {
          ok: true,
          json: async () => ({
            ...stream,
            profiles: [{ name: SOCIAL_TRANSCODE_PROFILE }],
            isActive: false,
            multistream: { targets: [{ id: "tgt_1", profile: SOCIAL_TRANSCODE_PROFILE }] },
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          ...stream,
          profiles: [{ name: SOCIAL_TRANSCODE_PROFILE }],
          isActive: true,
          multistream: { targets: [{ id: "tgt_1", profile: SOCIAL_TRANSCODE_PROFILE }] },
        }),
      };
    },
  );
  return calls;
}

describe("Studio livestream destinations", () => {
  it("masks stream keys and treats bullets as placeholders", () => {
    expect(maskStreamKey("")).toBe("");
    expect(maskStreamKey("abc")).toBe("••••");
    expect(maskStreamKey("yt-live-secret-key")).toBe("yt••••-key");
    expect(isPlaceholderKey("")).toBe(true);
    expect(isPlaceholderKey("••••abcd")).toBe(true);
    expect(isPlaceholderKey("real-stream-key")).toBe(false);
  });

  it("only restreams destinations that are on and have a key", () => {
    expect(readyOutputs([
        { platform: "youtube", enabled: 1, ingest_url: "rtmps://a.rtmps.youtube.com/live2", stream_key: "ytk" },
        { platform: "tiktok", enabled: 1, ingest_url: "", stream_key: "ttk" },
        { platform: "facebook", enabled: 0, ingest_url: "rtmps://fb", stream_key: "fbk" },
      ]),
    ).toEqual([
      { platform: "youtube", url: "rtmps://a.rtmps.youtube.com/live2", streamKey: "ytk" },
    ]);
    expect(rtmpTargetUrl("rtmps://a.rtmps.youtube.com/live2", "yt-key")).toBe(
      "rtmps://a.rtmps.youtube.com/live2/yt-key",
    );
    expect(rtmpTargetUrl("rtmps://live-api-s.facebook.com:443/rtmp/", "fb-key")).toBe(
      "rtmps://live-api-s.facebook.com:443/rtmp/fb-key",
    );
    expect(
      rtmpTargetUrl("rtmps://live-api-s.facebook.com:443/rtmp/fb-key", "fb-key"),
    ).toBe("rtmps://live-api-s.facebook.com:443/rtmp/fb-key");
    expect(
      rtmpTargetUrl(
        "rtmps://live-api-s.facebook.com:443/rtmp/",
        "rtmps://live-api-s.facebook.com:443/rtmp/fb-key",
      ),
    ).toBe("rtmps://live-api-s.facebook.com:443/rtmp/fb-key");
    expect(livepeerWhipUrl("whipkey")).toBe("https://livepeer.studio/webrtc/whipkey");
    expect(streamHasSocialTranscode({ profiles: [{ name: "720p0" }] })).toBe(true);
    expect(streamHasSocialTranscode({ profiles: [] })).toBe(false);
    expect(restreamProfileName({ profiles: [{ name: "720p00" }] })).toBe("720p00");
    expect(restreamProfileName({ profiles: [{ name: "480p0", height: 480 }] })).toBe("480p0");
    expect(restreamProfileName({ profiles: [{ name: "custom", height: 720 }] })).toBe("custom");
  });

  it("tells Facebook operators that the Page stays dark until they go live in Producer", () => {
    const facebook = LIVE_PLATFORMS.find((p) => p.id === "facebook");
    const steps = facebook?.steps.join(" ") ?? "";
    expect(steps).toMatch(/preview/i);
    expect(steps).toMatch(/Go live on Facebook/);
    expect(steps).toMatch(/persistent key/i);
    const youtube = LIVE_PLATFORMS.find((p) => p.id === "youtube");
    expect(youtube?.steps.join(" ") ?? "").toMatch(/waiting for encoder/i);
  });

  it("lists YouTube, Facebook, Instagram and TikTok without exposing saved keys", async () => {
    const res = await auth(request(app).get("/api/studio/live"));
    expect(res.status).toBe(200);
    expect(res.body.restream).toBe(false);
    expect(res.body.destinations.map((d: { platform: string }) => d.platform)).toEqual([
      "youtube",
      "facebook",
      "instagram",
      "tiktok",
    ]);
    expect(res.body.destinations.every((d: { streamKey?: string }) => d.streamKey == null)).toBe(true);
    const byId = Object.fromEntries(
      res.body.destinations.map((d: { platform: string; helpUrl: string }) => [d.platform, d.helpUrl]),
    );
    expect(byId.youtube).toContain("youtube.com");
    expect(byId.instagram).toContain("instagram.com");
    expect(byId.instagram).not.toContain("facebook.com");
    expect(byId.tiktok).toContain("tiktok.com");
  });

  it("saves a YouTube key, keeps it on a later save that sends a placeholder, and rejects a live session without a restreamer", async () => {
    const save = await auth(request(app).put("/api/studio/live")).send({
      destinations: [
        {
          platform: "youtube",
          enabled: true,
          ingestUrl: "rtmps://a.rtmps.youtube.com/live2",
          streamKey: "youtube-secret-key",
        },
        { platform: "facebook", enabled: false, ingestUrl: "rtmps://live-api-s.facebook.com:443/rtmp/", streamKey: "" },
        { platform: "instagram", enabled: false, ingestUrl: "rtmps://live-upload.instagram.com:443/rtmp/", streamKey: "" },
        { platform: "tiktok", enabled: false, ingestUrl: "", streamKey: "" },
      ],
    });
    expect(save.status).toBe(200);
    expect(save.body.destinations[0].streamKeySet).toBe(true);
    expect(save.body.destinations[0].streamKeyHint).toContain("••••");
    expect(JSON.stringify(save.body)).not.toContain("youtube-secret-key");

    const keep = await auth(request(app).put("/api/studio/live")).send({
      destinations: [
        { platform: "youtube", enabled: true, ingestUrl: "rtmps://a.rtmps.youtube.com/live2", streamKey: "••••key" },
        { platform: "facebook", enabled: false, ingestUrl: "rtmps://live-api-s.facebook.com:443/rtmp/" },
        { platform: "instagram", enabled: false, ingestUrl: "rtmps://live-upload.instagram.com:443/rtmp/" },
        { platform: "tiktok", enabled: false, ingestUrl: "" },
      ],
    });
    expect(keep.status).toBe(200);
    expect(keep.body.destinations[0].enabled).toBe(true);
    expect(keep.body.destinations[0].streamKeySet).toBe(true);

    const session = await auth(request(app).post("/api/studio/live/session"));
    expect(session.status).toBe(409);
    expect(session.body.error).toMatch(/LIVEPEER_API_KEY/i);
  });

  it("opens a WHIP session and fans destinations out through Livepeer when configured", async () => {
    process.env.LIVEPEER_API_KEY = "lp_test";
    expect(restreamConfigured()).toBe(true);
    const calls = stubLivepeer({ id: "st_1", streamKey: "whip-secret" });

    const save = await auth(request(app).put("/api/studio/live")).send({
      destinations: [
        { platform: "youtube", enabled: true, ingestUrl: "rtmps://a.rtmps.youtube.com/live2", streamKey: "yt-key" },
        { platform: "facebook", enabled: true, ingestUrl: "rtmps://live-api-s.facebook.com:443/rtmp/", streamKey: "fb-key" },
        { platform: "instagram", enabled: false, ingestUrl: "rtmps://live-upload.instagram.com:443/rtmp/", streamKey: "" },
        { platform: "tiktok", enabled: false, ingestUrl: "rtmp://tiktok.example/live", streamKey: "" },
      ],
    });
    expect(save.status).toBe(200);

    const session = await auth(request(app).post("/api/studio/live/session"));
    expect(session.status).toBe(200);
    expect(session.body.mode).toBe("whip");
    expect(session.body.whipUrl).toBe("https://lax-prod-catalyst-0.lp-playback.studio/webrtc/whip-secret");
    expect(session.body.platforms).toEqual(["youtube", "facebook"]);
    expect(session.body.iceServers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          urls: "turn:lax-prod-catalyst-0.lp-playback.studio",
          username: "livepeer",
          credential: "livepeer",
        }),
      ]),
    );
    const targetPosts = calls.filter((c) => c.method === "POST" && c.url.includes("/api/multistream/target"));
    expect(targetPosts.some((c) => c.body?.includes("yt-key"))).toBe(true);
    expect(targetPosts.some((c) => c.body?.includes("rtmps://a.rtmps.youtube.com/live2/yt-key"))).toBe(true);
    expect(targetPosts.some((c) => c.body?.includes("rtmps://live-api-s.facebook.com:443/rtmp/fb-key"))).toBe(true);
    const create = calls.find((c) => c.method === "POST" && c.url.endsWith("/api/stream"));
    expect(create?.body).toContain(`"profile":"${SOCIAL_TRANSCODE_PROFILE}"`);
    expect(create?.body).toContain('"videoOnly":false');
    expect(create?.body).toContain(`"name":"${SOCIAL_TRANSCODE_SOURCE_NAME}"`);
    expect(create?.body).toContain("H264Baseline");
    expect(create?.body).not.toContain('"profile":"source"');

    const health = await auth(request(app).get("/api/studio/live/health"));
    expect(health.status).toBe(200);
    expect(health.body.ingesting).toBe(true);
    expect(health.body.targets.map((t: { platform: string }) => t.platform)).toEqual(["youtube", "facebook"]);
  });

  it("goes live with one ready destination and lets another join on the next Go live", async () => {
    process.env.LIVEPEER_API_KEY = "lp_test";
    const calls = stubLivepeer({ id: "st_join", streamKey: "whip-join" });

    const onlyYt = await auth(request(app).put("/api/studio/live")).send({
      destinations: [
        { platform: "youtube", enabled: true, ingestUrl: "rtmps://a.rtmps.youtube.com/live2", streamKey: "yt-only" },
        { platform: "facebook", enabled: false, ingestUrl: "rtmps://live-api-s.facebook.com:443/rtmp/", streamKey: "" },
        { platform: "instagram", enabled: true, ingestUrl: "rtmps://live-upload.instagram.com:443/rtmp/", streamKey: "" },
        { platform: "tiktok", enabled: true, ingestUrl: "", streamKey: "" },
      ],
    });
    expect(onlyYt.status).toBe(200);
    const byPlat = Object.fromEntries(
      onlyYt.body.destinations.map((d: { platform: string; enabled: boolean }) => [d.platform, d.enabled]),
    );
    expect(byPlat.youtube).toBe(true);
    expect(byPlat.facebook).toBe(false);
    expect(byPlat.instagram).toBe(false);
    expect(byPlat.tiktok).toBe(false);
    expect(onlyYt.body.platforms).toEqual(["youtube"]);

    const session = await auth(request(app).post("/api/studio/live/session"));
    expect(session.status).toBe(200);
    expect(session.body.platforms).toEqual(["youtube"]);

    const addFb = await auth(request(app).put("/api/studio/live")).send({
      destinations: [
        { platform: "youtube", enabled: true, ingestUrl: "rtmps://a.rtmps.youtube.com/live2", streamKey: "••••key" },
        { platform: "facebook", enabled: true, ingestUrl: "rtmps://live-api-s.facebook.com:443/rtmp/", streamKey: "fb-later" },
        { platform: "instagram", enabled: false, ingestUrl: "rtmps://live-upload.instagram.com:443/rtmp/", streamKey: "" },
        { platform: "tiktok", enabled: false, ingestUrl: "", streamKey: "" },
      ],
    });
    expect(addFb.status).toBe(200);
    expect(addFb.body.platforms).toEqual(["youtube", "facebook"]);
    expect(calls.some((c) => c.method === "PATCH" && c.body?.includes("fb-later"))).toBe(false);

    const again = await auth(request(app).post("/api/studio/live/session"));
    expect(again.status).toBe(200);
    expect(again.body.platforms).toEqual(["youtube", "facebook"]);
    expect(calls.some((c) => c.method === "POST" && c.body?.includes("fb-later"))).toBe(true);
    expect(calls.some((c) => c.method === "POST" && c.url.endsWith("/terminate"))).toBe(true);
  });

  it("starts a fresh Livepeer stream so Facebook gets the current key as H264", async () => {
    process.env.LIVEPEER_API_KEY = "lp_test";
    const calls = stubLivepeer({ id: "st_h264", streamKey: "whip-h264" });

    const save = await auth(request(app).put("/api/studio/live")).send({
      destinations: [
        { platform: "youtube", enabled: false, ingestUrl: "rtmps://a.rtmps.youtube.com/live2", streamKey: "yt-key" },
        { platform: "facebook", enabled: true, ingestUrl: "rtmps://live-api-s.facebook.com:443/rtmp/", streamKey: "fb-fresh" },
        { platform: "instagram", enabled: false, ingestUrl: "rtmps://live-upload.instagram.com:443/rtmp/", streamKey: "" },
        { platform: "tiktok", enabled: false, ingestUrl: "", streamKey: "" },
      ],
    });
    expect(save.status).toBe(200);

    const session = await auth(request(app).post("/api/studio/live/session"));
    expect(session.status).toBe(200);
    expect(session.body.platforms).toEqual(["facebook"]);
    expect(session.body.whipUrl).toContain("whip-h264");
    expect(calls.some((c) => c.method === "DELETE")).toBe(true);
    expect(calls.some((c) => c.method === "POST" && c.body?.includes("fb-fresh"))).toBe(true);
    const create = calls.find((c) => c.method === "POST" && c.url.endsWith("/api/stream"));
    expect(create?.body).toContain(`"profile":"${SOCIAL_TRANSCODE_PROFILE}"`);
    expect(create?.body).toContain(`"name":"${SOCIAL_TRANSCODE_SOURCE_NAME}"`);
    expect(create?.body).toContain("H264Baseline");
    expect(create?.body).not.toContain('"profile":"source"');
  });

  it("resolves the Livepeer regional WHIP host for ICE/TURN", async () => {
    const calls = stubLivepeer({ id: "st_whip", streamKey: "whip-geo" });
    const ingest = await resolveWhipIngest("whip-geo");
    expect(ingest.whipUrl).toBe("https://lax-prod-catalyst-0.lp-playback.studio/webrtc/whip-geo");
    expect(ingest.iceServers.some((s) => String(s.urls).startsWith("turn:"))).toBe(true);
    expect(calls.some((c) => c.method === "HEAD" && c.url.includes("/webrtc/whip-geo"))).toBe(true);
  });
});
