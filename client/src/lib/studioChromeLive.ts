export const CHROME_LIVE_BLOCKED_KEY = "igc_chrome_live_blocked";

export const USE_IGC_ENCODER =
  "This computer cannot Go live in Chrome (0 packets). The pictures in the corner are this tab only — not YouTube or Facebook. Open IGC Encoder, download Windows — recorded file, and run igc-go-live.bat.";

export function chromeLiveBlocked(): boolean {
  try {
    return globalThis.localStorage?.getItem(CHROME_LIVE_BLOCKED_KEY) === "1";
  } catch {
    return false;
  }
}

export function markChromeLiveBlocked(): void {
  try {
    globalThis.localStorage?.setItem(CHROME_LIVE_BLOCKED_KEY, "1");
  } catch {
    // Private windows may refuse storage.
  }
}
