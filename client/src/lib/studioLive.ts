export const LIVE_PLATFORM_IDS = ["youtube", "facebook", "instagram", "tiktok"] as const;
export type LivePlatformId = (typeof LIVE_PLATFORM_IDS)[number];

const PLATFORM_LABELS: Record<string, string> = {
  youtube: "YouTube",
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
};

export interface RestreamHealth {
  ingesting: boolean;
  playbackId?: string;
  profiles: string[];
  targets: { platform: string; profile: string }[];
}

/** Desk copy after WHIP succeeds. Restreaming a key is not the same as the Page being live. */
export function socialRestreamHint(platforms: string[], health?: RestreamHealth | null): string {
  if (platforms.length === 0) return "";
  const names = platforms.map((p) => PLATFORM_LABELS[p] ?? p).join(", ");
  if (health && !health.ingesting) {
    return `This desk opened a Livepeer session for ${names}, but Livepeer has not received Program yet. YouTube and Facebook stay dark until that ingest starts. Stay on this page with Program running. If this does not change, End live and Go live again.`;
  }
  const ingesting = Boolean(health?.ingesting);
  let text = ingesting
    ? `Livepeer is receiving Program and restreaming to ${names}.`
    : `This desk is live. Livepeer is restreaming Program to ${names}.`;
  if (platforms.includes("youtube")) {
    text += " YouTube needs a live event already waiting in YouTube Studio.";
  }
  if (platforms.includes("facebook")) {
    text +=
      " Facebook Live Producer still has to show a preview, then you click Go live on Facebook. The Page stays dark until that click.";
  }
  if (platforms.includes("instagram")) {
    text += " Instagram also needs its own Go live click after a preview.";
  }
  return text;
}

export interface StudioLiveDestination {
  platform: LivePlatformId | string;
  label: string;
  enabled: boolean;
  ingestUrl: string;
  streamKeySet: boolean;
  streamKeyHint: string;
  helpUrl: string;
  steps: string[];
}

export interface StudioLiveConfig {
  restream: boolean;
  restreamDetail: string;
  destinations: StudioLiveDestination[];
  platforms?: string[];
}

export interface StudioLiveDraft extends StudioLiveDestination {
  streamKey: string;
}

export const STUDIO_LIVE_DRAFTS_KEY = "gracedflow.studioLive.drafts";

export interface StoredLiveDraft {
  platform: string;
  enabled: boolean;
  ingestUrl: string;
  streamKey: string;
}

function storage(): Storage | undefined {
  try {
    return globalThis.sessionStorage;
  } catch {
    return undefined;
  }
}

export function draftsFromConfig(config: StudioLiveConfig | null): StudioLiveDraft[] {
  return (config?.destinations ?? []).map((d) => ({ ...d, streamKey: "" }));
}

export function readStoredLiveDrafts(store: Storage | undefined = storage()): StoredLiveDraft[] {
  if (!store) return [];
  try {
    const raw = store.getItem(STUDIO_LIVE_DRAFTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((row): row is StoredLiveDraft => Boolean(row && typeof row === "object" && "platform" in row))
      .map((row) => ({
        platform: String(row.platform),
        enabled: Boolean(row.enabled),
        ingestUrl: String(row.ingestUrl ?? ""),
        streamKey: String(row.streamKey ?? ""),
      }));
  } catch {
    return [];
  }
}

export function writeStoredLiveDrafts(
  drafts: StudioLiveDraft[],
  store: Storage | undefined = storage(),
): void {
  if (!store || drafts.length === 0) return;
  store.setItem(
    STUDIO_LIVE_DRAFTS_KEY,
    JSON.stringify(
      drafts.map((d) => ({
        platform: d.platform,
        enabled: d.enabled,
        ingestUrl: d.ingestUrl,
        streamKey: d.streamKey,
      })),
    ),
  );
}

export function mergeConfigWithStored(
  config: StudioLiveConfig,
  stored: StoredLiveDraft[] = readStoredLiveDrafts(),
): StudioLiveDraft[] {
  const byPlatform = new Map(stored.map((row) => [row.platform, row]));
  return (config.destinations ?? []).map((d) => {
    const local = byPlatform.get(d.platform);
    if (!local) return { ...d, streamKey: "" };
    return {
      ...d,
      enabled: local.enabled,
      ingestUrl: local.ingestUrl || d.ingestUrl,
      streamKey: local.streamKey || "",
    };
  });
}

export function keepTypedKeys(incoming: StudioLiveDraft[], current: StudioLiveDraft[]): StudioLiveDraft[] {
  if (current.length === 0) return incoming;
  const byPlatform = new Map(current.map((d) => [d.platform, d]));
  return incoming.map((d) => {
    const prev = byPlatform.get(d.platform);
    if (!prev) return d;
    return {
      ...d,
      enabled: prev.enabled,
      ingestUrl: prev.ingestUrl,
      streamKey: prev.streamKey || d.streamKey,
    };
  });
}

/** After a server save, keep typed keys but trust which destinations are actually On. */
export function applySavedDestinations(saved: StudioLiveConfig, prev: StudioLiveDraft[]): StudioLiveDraft[] {
  const prevBy = new Map(prev.map((d) => [d.platform, d]));
  return (saved.destinations ?? []).map((d) => ({
    ...d,
    ingestUrl: prevBy.get(d.platform)?.ingestUrl || d.ingestUrl,
    streamKey: prevBy.get(d.platform)?.streamKey || "",
  }));
}

export function enabledWithKeys(drafts: StudioLiveDraft[]): StudioLiveDraft[] {
  return drafts.filter((d) => d.enabled && (d.streamKeySet || d.streamKey.trim()));
}

export function savePayload(drafts: StudioLiveDraft[]) {
  return {
    destinations: drafts.map((d) => ({
      platform: d.platform,
      enabled: d.enabled,
      ingestUrl: d.ingestUrl,
      streamKey: d.streamKey,
    })),
  };
}
