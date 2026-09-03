import { describe, expect, it, vi } from "vitest";
import {
  CHROME_LIVE_BLOCKED_KEY,
  chromeLiveBlocked,
  markChromeLiveBlocked,
  USE_IGC_ENCODER,
} from "../src/lib/studioChromeLive";

describe("Chrome Go live block after 0 packets", () => {
  it("remembers that this computer cannot send in Chrome", () => {
    const mem = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => mem.get(key) ?? null,
      setItem: (key: string, value: string) => {
        mem.set(key, value);
      },
      removeItem: (key: string) => {
        mem.delete(key);
      },
      clear: () => mem.clear(),
      key: (index: number) => [...mem.keys()][index] ?? null,
      get length() {
        return mem.size;
      },
    });
    expect(chromeLiveBlocked()).toBe(false);
    markChromeLiveBlocked();
    expect(mem.get(CHROME_LIVE_BLOCKED_KEY)).toBe("1");
    expect(chromeLiveBlocked()).toBe(true);
    expect(USE_IGC_ENCODER).toMatch(/igc-go-live\.bat/i);
    expect(USE_IGC_ENCODER).toMatch(/not YouTube/i);
    vi.unstubAllGlobals();
  });
});
