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
      "Paste URL and key here, turn On, then leave a YouTube live event waiting (Go live / waiting for encoder) before Sunday Go live. YouTube stays dark until this desk’s Program reaches Livepeer.",
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
    ? "Go live from this desk. YouTube and Facebook receive Program from IGC — you do not open OBS. Start capture, put picture and sound on Program, then Go live. Leave YouTube waiting for encoder and Facebook Live Producer open."
    : "Turn On only the platforms that have a key, Save, then Go live from this desk. Ask an admin to set LIVEPEER_API_KEY on Vercel once if Go live is not wired yet.";
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

/** H.264 720p so Facebook/YouTube RTMP can ingest browser WHIP (`source` is VP8). Livepeer keeps this name as `720p`, not `720p0`. */
export const SOCIAL_TRANSCODE_PROFILE = "720p";

export const SOCIAL_TRANSCODE_SOURCE_NAME = SOCIAL_TRANSCODE_PROFILE;

export const SOCIAL_TRANSCODE_PROFILES = [
  {
    name: SOCIAL_TRANSCODE_SOURCE_NAME,
    width: 1280,
    height: 720,
    bitrate: 2500000,
    fps: 30,
    gop: "2",
    profile: "H264Baseline",
  },
];

export function restreamProfileName(stream: { profiles?: { name?: string; height?: number }[] } | null): string {
  const profiles = (stream?.profiles ?? []).filter((p) => p.name && p.name.toLowerCase() !== "source");
  const names = profiles.map((p) => p.name).filter((name): name is string => Boolean(name));
  const named =
    names.find((n) => /^720p0$/i.test(n)) ||
    names.find((n) => /^720p$/i.test(n)) ||
    names.find((n) => /720p/i.test(n));
  if (named) return named;
  const byHeight = profiles.find((p) => p.height === 720 && p.name);
  if (byHeight?.name) return byHeight.name;
  const by480 = names.find((n) => /480p/i.test(n));
  if (by480) return by480;
  return names[0] || SOCIAL_TRANSCODE_PROFILE;
}

export function streamHasSocialTranscode(stream: { profiles?: { name?: string }[] } | null): boolean {
  return Boolean(stream?.profiles?.some((p) => p.name && /720p/i.test(p.name)));
}

export function livepeerWhipUrl(streamKey: string): string {
  const base = (process.env.LIVEPEER_WHIP_BASE || "https://livepeer.studio/webrtc").replace(/\/$/, "");
  return `${base}/${streamKey}`;
}

export interface WhipIceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

/** `nyc-prod-catalyst-0.lp-playback.studio:443` → `nyc.livepeer.com` (Livepeer TURN, not the HTTPS ingest host). */
export function iceHostFromWhipUrl(whipUrl: string): string {
  let hostname = whipUrl;
  try {
    hostname = new URL(whipUrl).hostname;
  } catch {
    hostname = whipUrl.replace(/^https?:\/\//, "").split("/")[0]?.replace(/:\d+$/, "") || whipUrl;
  }
  const region = hostname.match(/^([a-z0-9]+)-prod-catalyst/i)?.[1];
  return region ? `${region}.livepeer.com` : hostname;
}

export function livepeerIceServers(host: string): WhipIceServer[] {
  const hostname = host.replace(/:\d+$/, "");
  const region = iceHostFromWhipUrl(hostname);
  const pair = (h: string): WhipIceServer[] => [
    { urls: `stun:${h}` },
    { urls: `turn:${h}`, username: "livepeer", credential: "livepeer" },
    { urls: `stun:${h}:3478` },
    { urls: `turn:${h}:3478`, username: "livepeer", credential: "livepeer" },
    { urls: `turn:${h}:3478?transport=tcp`, username: "livepeer", credential: "livepeer" },
    { urls: `turns:${h}:5349?transport=tcp`, username: "livepeer", credential: "livepeer" },
  ];
  const out = [...pair(hostname)];
  if (region !== hostname) out.push(...pair(region));
  out.push({ urls: "stun:stun.cloudflare.com:3478" });
  return out;
}

/** WHIP `Link: stun:nyc.livepeer.com:3478; rel="ice-server"` (with or without <angle brackets>). */
export function parseIceLinkHeader(linkHeader: string | null | undefined): WhipIceServer[] {
  if (!linkHeader) return [];
  const parts = linkHeader.split(/,(?=\s*(?:<?(?:stun|turn|turns):))/i);
  const out: WhipIceServer[] = [];
  for (const part of parts) {
    if (!/rel\s*=\s*"?ice-server"?/i.test(part)) continue;
    const urlMatch = part.match(/<((?:stun|turn|turns):[^>]+)>/i) || part.match(/((?:stun|turn|turns):[^\s;]+)/i);
    if (!urlMatch?.[1]) continue;
    const urls = normalizeTurnUrl(urlMatch[1].trim());
    const username = part.match(/username="?([^";]+)"?/i)?.[1];
    const credential = part.match(/credential="?([^";]+)"?/i)?.[1];
    out.push(username ? { urls, username, credential } : { urls });
  }
  return out;
}

function normalizeTurnUrl(urls: string): string {
  if (/:5349(\?|$)/.test(urls) && /^turn:/i.test(urls)) return urls.replace(/^turn:/i, "turns:");
  return urls;
}

function withTcpTurn(servers: WhipIceServer[]): WhipIceServer[] {
  const extra: WhipIceServer[] = [];
  for (const server of servers) {
    const urls = String(server.urls);
    if (!/^turns?:/i.test(urls) || /[?&]transport=/i.test(urls) || !server.username) continue;
    extra.push({ ...server, urls: `${urls}${urls.includes("?") ? "&" : "?"}transport=tcp` });
  }
  return extra.length ? [...servers, ...extra] : servers;
}

async function readWhipRedirect(url: string): Promise<string | null> {
  for (const method of ["HEAD", "GET"] as const) {
    try {
      const res = await fetch(url, { method, redirect: "manual" });
      const loc = res.headers?.get?.("location") ?? null;
      if (loc) return new URL(loc, url).href.split("?")[0];
      if (res.ok) return url;
    } catch {
      // Try the next method or ingest base.
    }
  }
  return null;
}

/** Follow Livepeer GeoDNS to the regional catalyst so ICE/TURN can complete. */
export async function resolveWhipIngest(streamKey: string): Promise<{
  whipUrl: string;
  iceServers: WhipIceServer[];
}> {
  const bases = [
    process.env.LIVEPEER_WHIP_BASE || "https://livepeer.studio/webrtc",
    "https://livepeer.studio/webrtc",
    "https://livepeercdn.studio/webrtc",
  ].filter((base, i, all) => all.indexOf(base) === i);
  for (const base of bases) {
    const start = `${base.replace(/\/$/, "")}/${streamKey}`;
    const resolved = await readWhipRedirect(start);
    if (!resolved) continue;
    try {
      return { whipUrl: resolved, iceServers: livepeerIceServers(new URL(resolved).hostname) };
    } catch {
      continue;
    }
  }
  const fallback = livepeerWhipUrl(streamKey);
  return { whipUrl: fallback, iceServers: livepeerIceServers(iceHostFromWhipUrl(fallback)) };
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

function livepeerTargets(outputs: ReadyLiveOutput[], profile = SOCIAL_TRANSCODE_PROFILE) {
  return outputs.map((dest) => ({
    profile,
    videoOnly: false,
    spec: {
      name: dest.platform,
      url: rtmpTargetUrl(dest.url, dest.streamKey),
    },
  }));
}

function livepeerStreamBody(
  targets?: ReturnType<typeof livepeerTargets> | { id: string; profile: string; videoOnly: boolean }[],
) {
  return {
    name: "IGC Broadcast studio",
    record: false,
    profiles: SOCIAL_TRANSCODE_PROFILES,
    ...(targets && targets.length > 0 ? { multistream: { targets } } : {}),
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
        profile: attached[i]?.profile || restreamProfileName(stream),
      })),
    };
  } catch {
    return empty;
  }
}

export async function ensureWhipSession(outputs: ReadyLiveOutput[]): Promise<{
  whipUrl: string;
  iceServers: WhipIceServer[];
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

  let stream = await livepeerFetch<LivepeerStream>("/stream", {
    method: "POST",
    body: JSON.stringify(livepeerStreamBody()),
  });
  if (!stream.id) throw new HttpError(502, "Livepeer did not create a stream");
  await setBridgeStreamId(stream.id);
  if (!stream.streamKey || !(stream.profiles ?? []).length) {
    stream = await livepeerFetch<LivepeerStream>(`/stream/${stream.id}`);
  }
  const profile = restreamProfileName(stream);
  try {
    const dedicated = [];
    for (const dest of outputs) {
      dedicated.push({
        id: await createMultistreamTarget(dest.platform, rtmpTargetUrl(dest.url, dest.streamKey)),
        profile,
        videoOnly: false,
      });
    }
    const patched = await livepeerFetch<LivepeerStream>(`/stream/${stream.id}`, {
      method: "PATCH",
      body: JSON.stringify({ multistream: { targets: dedicated } }),
    });
    stream = { ...stream, ...patched };
  } catch {
    await retireBridgeStream(stream.id);
    stream = await livepeerFetch<LivepeerStream>("/stream", {
      method: "POST",
      body: JSON.stringify(livepeerStreamBody(livepeerTargets(outputs, profile))),
    });
    if (!stream.id) throw new HttpError(502, "Livepeer did not create a stream");
    await setBridgeStreamId(stream.id);
  }
  if (!stream.streamKey) {
    stream = await livepeerFetch<LivepeerStream>(`/stream/${stream.id}`);
  }
  if (!stream.streamKey) {
    throw new HttpError(502, "Livepeer did not return a stream key");
  }
  const ingest = await resolveWhipIngest(stream.streamKey);
  return { ...ingest, liveInputId: stream.id };
}

export function isAllowedWhipUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (new URL(url).protocol !== "https:") return false;
    return (
      host.endsWith(".lp-playback.studio") ||
      host === "livepeer.studio" ||
      host === "livepeercdn.studio" ||
      host.endsWith(".livepeer.studio")
    );
  } catch {
    return false;
  }
}

/** Fallback if the browser cannot POST SDP to Livepeer. Prefer the allowlisted URL from Go live. */
export async function whipExchange(sdp: string, whipUrl?: string): Promise<string> {
  const offer = sdp.trim();
  if (!offer.startsWith("v=")) throw new HttpError(400, "Live ingest offer was empty.");
  let url = (whipUrl ?? "").trim();
  if (url && !isAllowedWhipUrl(url)) {
    throw new HttpError(400, "Live ingest URL is not a Livepeer address.");
  }
  if (!url) {
    const id = await getBridgeStreamId();
    if (!id) {
      throw new HttpError(409, "Go live from this desk first so Livepeer can open a session.");
    }
    const stream = await livepeerFetch<LivepeerStream>(`/stream/${id}`);
    if (!stream.streamKey) throw new HttpError(502, "Livepeer did not return a stream key");
    url = (await resolveWhipIngest(stream.streamKey)).whipUrl;
  }
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/sdp",
        Accept: "application/sdp",
      },
      body: offer,
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw new HttpError(504, "Livepeer ingest timed out. Stay on this page and Go live again.");
  }
  const answer = await res.text();
  if (!res.ok) {
    throw new HttpError(502, answer.slice(0, 280) || `Live ingest failed (${res.status})`);
  }
  if (!answer.trim().startsWith("v=")) {
    throw new HttpError(502, "Livepeer did not return a live answer.");
  }
  return answer;
}
