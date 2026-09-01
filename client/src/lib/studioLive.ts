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

export function draftsFromConfig(config: StudioLiveConfig | null): StudioLiveDraft[] {
  return (config?.destinations ?? []).map((d) => ({ ...d, streamKey: "" }));
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
