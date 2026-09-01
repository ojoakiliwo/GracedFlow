export const LIVE_PLATFORM_IDS = ["youtube", "facebook", "instagram", "tiktok"] as const;
export type LivePlatformId = (typeof LIVE_PLATFORM_IDS)[number];

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
