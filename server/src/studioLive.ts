import { config } from "./config.js";
import { db } from "./db.js";
import { HttpError, newId } from "./util.js";

function streamAccountId(): string {
  return process.env.CF_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || config.stream.accountId;
}

function streamApiToken(): string {
  return process.env.CF_STREAM_API_TOKEN || process.env.CLOUDFLARE_STREAM_API_TOKEN || config.stream.apiToken;
}

export const LIVE_PLATFORMS = [
  {
    id: "youtube",
    label: "YouTube",
    defaultIngest: "rtmps://a.rtmps.youtube.com/live2",
    helpUrl: "https://studio.youtube.com/channel/UC/livestreaming",
    steps: [
      "Open YouTube Studio → Go live → Stream.",
      "Copy Stream URL (usually rtmps://a.rtmps.youtube.com/live2) and Stream key.",
      "Paste both here and turn the destination on. Create the live event before you go live from the desk.",
    ],
  },
  {
    id: "facebook",
    label: "Facebook",
    defaultIngest: "rtmps://live-api-s.facebook.com:443/rtmp/",
    helpUrl: "https://www.facebook.com/live/producer",
    steps: [
      "Open Facebook Live Producer for the church Page.",
      "Choose Use stream key. Copy Server URL and Stream key.",
      "Paste both here. Go live on Facebook after this desk is already sending.",
    ],
  },
  {
    id: "instagram",
    label: "Instagram",
    defaultIngest: "rtmps://live-upload.instagram.com:443/rtmp/",
    helpUrl: "https://www.facebook.com/live/producer",
    steps: [
      "Instagram Live from a computer needs a Professional Instagram account linked to the Facebook Page.",
      "In Meta Live Producer, choose Instagram (or Facebook + Instagram) and Use stream key.",
      "Paste the Instagram server URL and stream key here. Do not put spaces in the key.",
    ],
  },
  {
    id: "tiktok",
    label: "TikTok",
    defaultIngest: "",
    helpUrl: "https://www.tiktok.com/live/creators",
    steps: [
      "TikTok only gives a custom RTMP URL to accounts that can go LIVE.",
      "Open TikTok LIVE Studio or LIVE Center → Custom RTMP / streaming software.",
      "Paste TikTok’s Server URL and Stream key here. Both are unique — do not reuse the YouTube URL.",
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

export function restreamConfigured(): boolean {
  return Boolean(streamAccountId() && streamApiToken());
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
    if (item.enabled && !ingestUrl) {
      throw new HttpError(400, `${meta.label} needs a stream URL`);
    }
    let streamKey = prev?.stream_key ?? "";
    if (!isPlaceholderKey(item.streamKey)) {
      streamKey = item.streamKey!.trim();
    }
    if (item.enabled && !streamKey) {
      throw new HttpError(400, `${meta.label} needs a stream key before you turn it on`);
    }
    await db
      .prepare(
        `UPDATE studio_live_destinations
         SET enabled = ?, ingest_url = ?, stream_key = ?, updated_at = now()
         WHERE platform = ?`,
      )
      .run(item.enabled ? 1 : 0, ingestUrl, streamKey, item.platform);
  }
  return listDestinationRows();
}

interface CfLiveInput {
  uid: string;
  webRTC?: { url?: string };
}

interface CfOutput {
  uid: string;
  url?: string;
}

async function cfFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const accountId = streamAccountId();
  const apiToken = streamApiToken();
  if (!accountId || !apiToken) {
    throw new HttpError(409, "Cloudflare Stream is not configured");
  }
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const payload = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    result?: T;
    errors?: { message?: string }[];
  };
  if (!res.ok || payload.success === false) {
    throw new HttpError(
      502,
      payload.errors?.[0]?.message || `Cloudflare Stream ${res.status}`,
    );
  }
  return payload.result as T;
}

async function getBridgeInputId(): Promise<string | null> {
  const row = (await db
    .prepare("SELECT cf_live_input_id FROM studio_live_bridge WHERE id = ?")
    .get(BRIDGE_ID)) as { cf_live_input_id?: string | null } | undefined;
  return row?.cf_live_input_id || null;
}

async function setBridgeInputId(uid: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO studio_live_bridge (id, cf_live_input_id, updated_at)
       VALUES (?, ?, now())
       ON CONFLICT (id) DO UPDATE SET cf_live_input_id = excluded.cf_live_input_id, updated_at = now()`,
    )
    .run(BRIDGE_ID, uid);
}

export async function ensureWhipSession(outputs: ReadyLiveOutput[]): Promise<{
  whipUrl: string;
  liveInputId: string;
}> {
  if (!restreamConfigured()) {
    throw new HttpError(
      409,
      "This browser cannot send RTMP itself. Add CF_ACCOUNT_ID and CF_STREAM_API_TOKEN (Cloudflare Stream) to go live from the desk, or capture Program with OBS using the stream keys you saved.",
    );
  }
  if (outputs.length === 0) {
    throw new HttpError(400, "Turn on at least one destination with a stream key");
  }

  let uid = await getBridgeInputId();
  let input: CfLiveInput | null = null;
  if (uid) {
    try {
      input = await cfFetch<CfLiveInput>(`/stream/live_inputs/${uid}`);
    } catch {
      input = null;
      uid = null;
    }
  }
  if (!input) {
    input = await cfFetch<CfLiveInput>("/stream/live_inputs", {
      method: "POST",
      body: JSON.stringify({
        meta: { name: "IGC Broadcast studio" },
        recording: { mode: "off" },
      }),
    });
    uid = input.uid;
    await setBridgeInputId(uid);
  }

  if (!input?.uid) {
    throw new HttpError(502, "Cloudflare Stream did not return a live input");
  }
  const liveInputId = input.uid;

  const whipUrl = input.webRTC?.url?.trim();
  if (!whipUrl) {
    throw new HttpError(502, "Cloudflare Stream did not return a WHIP publish URL");
  }

  const existingRaw = await cfFetch<CfOutput[] | { outputs?: CfOutput[] }>(
    `/stream/live_inputs/${liveInputId}/outputs`,
  ).catch(() => [] as CfOutput[]);
  const existing = Array.isArray(existingRaw) ? existingRaw : existingRaw?.outputs ?? [];
  for (const out of existing ?? []) {
    if (!out.uid) continue;
    await cfFetch(`/stream/live_inputs/${liveInputId}/outputs/${out.uid}`, { method: "DELETE" }).catch(
      () => undefined,
    );
  }
  for (const dest of outputs) {
    await cfFetch(`/stream/live_inputs/${liveInputId}/outputs`, {
      method: "POST",
      body: JSON.stringify({ url: dest.url, streamKey: dest.streamKey }),
    });
  }

  return { whipUrl, liveInputId };
}
