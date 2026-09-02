import { config } from "./config.js";
import { db } from "./db.js";
import { HttpError, newId } from "./util.js";

export const LIVE_PLATFORMS = [
  {
    id: "youtube",
    label: "YouTube",
    defaultIngest: "rtmps://a.rtmps.youtube.com/live2",
    helpUrl: "https://www.youtube.com/livestreaming",
    steps: [
      "YouTube Studio → Create → Go live. Choose Stream (encoder), not Webcam.",
      "Stream URL is the server. Ignore Backup server URL. Stream key is the next field — click Show if it is dots.",
      "Paste URL and key here, turn On, then create/schedule the YouTube live event before Sunday Go live.",
    ],
  },
  {
    id: "facebook",
    label: "Facebook",
    defaultIngest: "rtmps://live-api-s.facebook.com:443/rtmp/",
    helpUrl: "https://www.facebook.com/live/producer",
    steps: [
      "Open Facebook Live Producer for the church Page. Choose Use stream key. A persistent key (Advanced) is more reliable than a one-session key.",
      "Copy Stream URL and Stream key from this Producer session, paste them here, turn On, and Save. If preview never appears later, paste a fresh key, Save, End live, then Go live again.",
      "Click Go live on this desk first. Stay on Live Producer until a preview appears (often 10–20 seconds; refresh Facebook if it still says connect streaming software). Then click Go live on Facebook — the Page will not show this live until that click.",
    ],
  },
  {
    id: "instagram",
    label: "Instagram",
    defaultIngest: "rtmps://live-upload.instagram.com:443/rtmp/",
    helpUrl: "https://www.instagram.com/",
    steps: [
      "On a computer, log in at instagram.com with the church Professional Instagram account (not the Facebook Page).",
      "Create (+) → Live video. Copy Stream URL and Stream key from Instagram Live Producer — not from Facebook.",
      "Paste both here. Instagram gives a new key for each live; refresh it before Sunday. Then click Go live on Instagram after this desk is sending.",
    ],
  },
  {
    id: "tiktok",
    label: "TikTok",
    defaultIngest: "",
    helpUrl: "https://livecenter.tiktok.com/producer",
    steps: [
      "Installing LIVE Studio does not show a key by itself. You need PC / third-party LIVE access on this TikTok account.",
      "Computer: tiktok.com → Go LIVE (or livecenter.tiktok.com/producer) → title → Stream settings → Server URL and Stream key. Phone: + → LIVE → Cast to PC / Connect to PC.",
      "If those fields are missing, open LIVE Studio → Your LIVE access (top right) and apply. Leave TikTok Off here until a key appears — YouTube, Facebook and Instagram still go out from this desk.",
    ],
  },
] as const;

export type LivePlatformId = (typeof LIVE_PLATFORMS)[number]["id"];

export interface LiveDestinationRow {
  platform: string;
  enabled: number;
  ingest_url: string;
  stream_key: string;
}

export interface LiveDestinationInput {
  platform: string;
  enabled: boolean;
  ingestUrl: string;
  streamKey?: string;
}

export interface ReadyLiveOutput {
  platform: string;
  url: string;
  streamKey: string;
}

const BRIDGE_ID = "default";

export function maskStreamKey(key: string): string {
  const t = key.trim();
  if (!t) return "";
  if (t.length <= 6) return "••••";
  return `${t.slice(0, 2)}••••${t.slice(-4)}`;
}

export function isPlaceholderKey(key: string | undefined): boolean {
  const t = (key ?? "").trim();
  return !t || /[•*]/.test(t);
}

function livepeerApiKey(): string {
  return process.env.LIVEPEER_API_KEY || process.env.LIVEPEER_STUDIO_API_KEY || config.stream.livepeerApiKey;
}

export function restreamConfigured(): boolean {
  return Boolean(livepeerApiKey());
}

export function restreamDetail(): string {
  return restreamConfigured()
    ? "Go live with whichever destinations are On and have a key — one is enough. Add the rest later and Save; they join YouTube / Facebook / Instagram / TikTok. Stay on Livepeer’s free Sandbox. You do not open OBS."
    : "Turn On only the platforms you have keys for. Add LIVEPEER_API_KEY once (Livepeer Studio → Developers → API Key, free Sandbox). Then Start capture and Go live from this desk.";
}

export function rtmpTargetUrl(ingestUrl: string, streamKey: string): string {
  const ingest = ingestUrl.trim();
  const key = streamKey.trim();
  // Operator pasted the full RTMP URL into Stream key (Facebook Live Producer copies it that way).
  if (/^rtmps?:\/\//i.test(key)) return key.replace(/\/+$/, "");
  if (!ingest || !key) return "";
  const base = ingest.replace(/\/+$/, "");
  if (base.endsWith(key)) return base;
  return `${base}/${key}`;
}

/** H.264 720p so Facebook/YouTube RTMP can ingest browser WHIP (VP8/Opus cannot ride `source`). */
export const SOCIAL_TRANSCODE_PROFILE = "720p0";

export const SOCIAL_TRANSCODE_PROFILES = [
  {
    name: SOCIAL_TRANSCODE_PROFILE,
    width: 1280,
    height: 720,
    bitrate: 2500000,
    fps: 30,
    gop: "2",
    profile: "H264Baseline",
  },
];

export function streamHasSocialTranscode(stream: { profiles?: { name?: string }[] } | null): boolean {
  return Boolean(stream?.profiles?.some((p) => p.name === SOCIAL_TRANSCODE_PROFILE));
}

export function livepeerWhipUrl(streamKey: string): string {
  const base = (process.env.LIVEPEER_WHIP_BASE || "https://livepeercdn.studio/webrtc").replace(/\/$/, "");
  return `${base}/${streamKey}`;
}

export function platformById(id: string) {
  return LIVE_PLATFORMS.find((p) => p.id === id);
}

export function readyOutputs(rows: LiveDestinationRow[]): ReadyLiveOutput[] {
  const out: ReadyLiveOutput[] = [];
  for (const row of rows) {
    if (!row.enabled) continue;
    const url = row.ingest_url.trim();
    const streamKey = row.stream_key.trim();
    if (!url || !streamKey) continue;
    out.push({ platform: row.platform, url, streamKey });
  }
  return out;
}

export async function listDestinationRows(): Promise<LiveDestinationRow[]> {
  const existing = (await db
    .prepare(
      "SELECT platform, enabled, ingest_url, stream_key FROM studio_live_destinations ORDER BY platform",
    )
    .all()) as LiveDestinationRow[];
  const byId = new Map(existing.map((r) => [r.platform, r]));
  const rows: LiveDestinationRow[] = [];
  for (const p of LIVE_PLATFORMS) {
    const row = byId.get(p.id);
    if (row) {
      rows.push(row);
      continue;
    }
    await db
      .prepare(
        `INSERT INTO studio_live_destinations (id, platform, enabled, ingest_url, stream_key)
         VALUES (?, ?, 0, ?, '')`,
      )
      .run(newId("live"), p.id, p.defaultIngest);
    rows.push({
      platform: p.id,
      enabled: 0,
      ingest_url: p.defaultIngest,
      stream_key: "",
    });
  }
  return rows;
}

export function publicDestinations(rows: LiveDestinationRow[]) {
  return LIVE_PLATFORMS.map((p) => {
    const row = rows.find((r) => r.platform === p.id) ?? {
      platform: p.id,
      enabled: 0,
      ingest_url: p.defaultIngest,
      stream_key: "",
    };
    return {
      platform: p.id,
      label: p.label,
      enabled: Boolean(row.enabled),
      ingestUrl: row.ingest_url || p.defaultIngest,
      streamKeySet: Boolean(row.stream_key.trim()),
      streamKeyHint: maskStreamKey(row.stream_key),
      helpUrl: p.helpUrl,
      steps: [...p.steps],
    };
  });
}

export async function saveDestinations(input: LiveDestinationInput[]): Promise<LiveDestinationRow[]> {
  const current = await listDestinationRows();
  const seen = new Set<string>();
  for (const item of input) {
    const meta = platformById(item.platform);
    if (!meta) throw new HttpError(400, `Unknown destination ${item.platform}`);
    if (seen.has(item.platform)) throw new HttpError(400, `Duplicate destination ${item.platform}`);
    seen.add(item.platform);
    const prev = current.find((r) => r.platform === item.platform);
    const ingestUrl = item.ingestUrl.trim() || meta.defaultIngest;
    let streamKey = prev?.stream_key ?? "";
    if (!isPlaceholderKey(item.streamKey)) {
      streamKey = item.streamKey!.trim();
    }
    // Incomplete destinations stay Off so YouTube (etc.) can go live without TikTok/Instagram.
    const enabled = Boolean(item.enabled && ingestUrl && streamKey);
    await db
      .prepare(
        `UPDATE studio_live_destinations
         SET enabled = ?, ingest_url = ?, stream_key = ?, updated_at = now()
         WHERE platform = ?`,
      )
      .run(enabled ? 1 : 0, ingestUrl, streamKey, item.platform);
  }
  return listDestinationRows();
}

interface LivepeerTargetRef {
  id?: string;
  profile?: string;
}

interface LivepeerStream {
  id: string;
  streamKey?: string;
  playbackId?: string;
  isActive?: boolean;
  profiles?: { name?: string }[];
  multistream?: { targets?: LivepeerTargetRef[] };
  errors?: string[];
  error?: string;
  message?: string;
}

export interface RestreamHealth {
  ingesting: boolean;
  playbackId?: string;
  profiles: string[];
  targets: { platform: string; profile: string }[];
}

async function livepeerFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const key = livepeerApiKey();
  if (!key) {
    throw new HttpError(
      409,
      "Add LIVEPEER_API_KEY on the server (Livepeer Studio → Developers → API Key). After that, this desk goes live to YouTube, Facebook, Instagram and TikTok without OBS.",
    );
  }
  const res = await fetch(`https://livepeer.studio/api${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const payload = (await res.json().catch(() => ({}))) as T & {
    errors?: string[];
    error?: string;
    message?: string;
  };
  if (!res.ok) {
    const msg =
      (Array.isArray(payload.errors) && payload.errors[0]) ||
      payload.error ||
      payload.message ||
      `Livepeer ${res.status}`;
    throw new HttpError(res.status >= 400 && res.status < 500 ? res.status : 502, String(msg));
  }
  return payload;
}

async function getBridgeStreamId(): Promise<string | null> {
  const row = (await db
    .prepare("SELECT cf_live_input_id FROM studio_live_bridge WHERE id = ?")
    .get(BRIDGE_ID)) as { cf_live_input_id?: string | null } | undefined;
  return row?.cf_live_input_id || null;
}

async function setBridgeStreamId(uid: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO studio_live_bridge (id, cf_live_input_id, updated_at)
       VALUES (?, ?, now())
       ON CONFLICT (id) DO UPDATE SET cf_live_input_id = excluded.cf_live_input_id, updated_at = now()`,
    )
    .run(BRIDGE_ID, uid);
}

function livepeerTargets(outputs: ReadyLiveOutput[]) {
  return outputs.map((dest) => ({
    profile: SOCIAL_TRANSCODE_PROFILE,
    videoOnly: false,
    spec: {
      name: dest.platform,
      url: rtmpTargetUrl(dest.url, dest.streamKey),
    },
  }));
}

function livepeerStreamBody(
  targets: ReturnType<typeof livepeerTargets> | { id: string; profile: string; videoOnly: boolean }[],
) {
  return {
    name: "IGC Broadcast studio",
    record: false,
    profiles: SOCIAL_TRANSCODE_PROFILES,
    multistream: { targets },
  };
}

async function retireBridgeStream(id: string | null): Promise<void> {
  if (!id) return;
  try {
    await livepeerFetch(`/stream/${id}/terminate`, { method: "POST" });
  } catch {
    // Already idle.
  }
  try {
    const existing = await livepeerFetch<LivepeerStream>(`/stream/${id}`);
    for (const target of existing.multistream?.targets ?? []) {
      if (!target.id) continue;
      try {
        await livepeerFetch(`/multistream/target/${target.id}`, { method: "DELETE" });
      } catch {
        // Target may already be gone.
      }
    }
  } catch {
    // Stream may already be gone.
  }
  try {
    await livepeerFetch(`/stream/${id}`, { method: "DELETE" });
  } catch {
    // Replace even if Livepeer already dropped the old stream.
  }
}

async function createMultistreamTarget(name: string, url: string): Promise<string> {
  const created = await livepeerFetch<{ id?: string }>("/multistream/target", {
    method: "POST",
    body: JSON.stringify({ name, url }),
  });
  if (!created.id) throw new HttpError(502, "Livepeer did not create a restream target");
  return created.id;
}

/** Destinations are applied on the next Go live — Livepeer ignores target URL changes on an active stream. */
export async function syncLiveRestream(): Promise<string[]> {
  return readyOutputs(await listDestinationRows()).map((o) => o.platform);
}

export async function restreamHealth(): Promise<RestreamHealth> {
  const outputs = readyOutputs(await listDestinationRows());
  const empty: RestreamHealth = { ingesting: false, profiles: [], targets: [] };
  if (!restreamConfigured()) return empty;
  const id = await getBridgeStreamId();
  if (!id) return empty;
  try {
    const stream = await livepeerFetch<LivepeerStream>(`/stream/${id}`);
    const attached = stream.multistream?.targets ?? [];
    return {
      ingesting: Boolean(stream.isActive),
      playbackId: stream.playbackId,
      profiles: (stream.profiles ?? []).map((p) => p.name).filter((name): name is string => Boolean(name)),
      targets: outputs.map((dest, i) => ({
        platform: dest.platform,
        profile: attached[i]?.profile || SOCIAL_TRANSCODE_PROFILE,
      })),
    };
  } catch {
    return empty;
  }
}

export async function ensureWhipSession(outputs: ReadyLiveOutput[]): Promise<{
  whipUrl: string;
  liveInputId: string;
}> {
  if (!restreamConfigured()) {
    throw new HttpError(
      409,
      "Add LIVEPEER_API_KEY on the server (Livepeer Studio → Developers → API Key). After that, this desk goes live to YouTube, Facebook, Instagram and TikTok without OBS.",
    );
  }
  if (outputs.length === 0) {
    throw new HttpError(400, "Turn On at least one destination that has a stream key. The others can wait.");
  }

  const previousId = await getBridgeStreamId();
  await retireBridgeStream(previousId);

  let stream: LivepeerStream | null = null;
  try {
    const dedicated = [];
    for (const dest of outputs) {
      dedicated.push({
        id: await createMultistreamTarget(dest.platform, rtmpTargetUrl(dest.url, dest.streamKey)),
        profile: SOCIAL_TRANSCODE_PROFILE,
        videoOnly: false,
      });
    }
    stream = await livepeerFetch<LivepeerStream>("/stream", {
      method: "POST",
      body: JSON.stringify(livepeerStreamBody(dedicated)),
    });
  } catch {
    stream = await livepeerFetch<LivepeerStream>("/stream", {
      method: "POST",
      body: JSON.stringify(livepeerStreamBody(livepeerTargets(outputs))),
    });
  }
  if (!stream.id) throw new HttpError(502, "Livepeer did not create a stream");
  await setBridgeStreamId(stream.id);
  if (!stream.streamKey) {
    stream = await livepeerFetch<LivepeerStream>(`/stream/${stream.id}`);
  }
  if (!stream.streamKey) {
    throw new HttpError(502, "Livepeer did not return a stream key");
  }
  return { whipUrl: livepeerWhipUrl(stream.streamKey), liveInputId: stream.id };
}
