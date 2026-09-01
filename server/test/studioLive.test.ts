import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";
import {
  isPlaceholderKey,
  livepeerWhipUrl,
  maskStreamKey,
  readyOutputs,
  restreamConfigured,
  rtmpTargetUrl,
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
    expect(livepeerWhipUrl("whipkey")).toBe("https://livepeercdn.studio/webrtc/whipkey");
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

    const calls: { url: string; method: string; body?: string }[] = [];
    vi.stubGlobal(
      "fetch",
      async (url: string | URL, init?: RequestInit) => {
        const href = String(url);
        const method = (init?.method || "GET").toUpperCase();
        calls.push({ url: href, method, body: typeof init?.body === "string" ? init.body : undefined });
        if (href.endsWith("/api/stream") && method === "POST") {
          return {
            ok: true,
            json: async () => ({ id: "st_1", streamKey: "whip-secret" }),
          };
        }
        if (href.includes("/api/stream/st_1") && method === "PATCH") {
          return { ok: true, json: async () => ({ id: "st_1", streamKey: "whip-secret" }) };
        }
        return { ok: true, json: async () => ({ id: "st_1", streamKey: "whip-secret" }) };
      },
    );

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
    expect(session.body).toEqual({
      mode: "whip",
      whipUrl: "https://livepeercdn.studio/webrtc/whip-secret",
      platforms: ["youtube", "facebook"],
    });
    const create = calls.find((c) => c.method === "POST" && c.url.endsWith("/api/stream"));
    expect(create?.body).toContain("yt-key");
    expect(create?.body).toContain("rtmps://a.rtmps.youtube.com/live2/yt-key");
    expect(create?.body).toContain("rtmps://live-api-s.facebook.com:443/rtmp/fb-key");
  });
});
