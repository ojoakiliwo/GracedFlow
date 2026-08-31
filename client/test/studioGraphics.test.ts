import { describe, expect, it, vi } from "vitest";
import { fetchVerseText, mergeBibleHits, parseBibleReferences } from "../src/lib/bibleRefs";
import { drawProgrammeOverlay, suggestDesigns, wrapText } from "../src/lib/studioOverlays";
import { transcriptFromSpeechEvent } from "../src/lib/studioSpeech";

describe("Bible reference parsing", () => {
  it("finds ordinary spoken and written references", () => {
    const hits = parseBibleReferences(
      "He read John 3:16 and then Psalm 23 and first Corinthians 13:4-7.",
    );
    expect(hits.map((h) => h.display)).toEqual([
      "John 3:16",
      "Psalm 23",
      "1 Corinthians 13:4-7",
    ]);
  });

  it("understands chapter and verse wording", () => {
    const hits = parseBibleReferences("Open with us Romans chapter 8 verse 28");
    expect(hits[0]?.display).toBe("Romans 8:28");
    expect(parseBibleReferences("John 3 16")[0]?.display).toBe("John 3:16");
  });

  it("does not invent a verse the speaker did not say", () => {
    expect(parseBibleReferences("We thank God for john in the choir")).toEqual([]);
  });

  it("merges new suggestions without duplicating", () => {
    const a = parseBibleReferences("John 3:16");
    const merged = mergeBibleHits(a, parseBibleReferences("John 3:16 and Luke 4:18"));
    expect(merged.map((h) => h.display)).toEqual(["John 3:16", "Luke 4:18"]);
  });

  it("loads verse text through the lookup helper", async () => {
    const fetcher = async () =>
      ({
        ok: true,
        json: async () => ({ reference: "John 3:16", text: "For God so loved the world." }),
      }) as Response;
    const payload = await fetchVerseText(
      { book: "John", chapter: 3, verse: 16, display: "John 3:16" },
      fetcher,
    );
    expect(payload.text).toContain("God so loved");
  });
});

describe("On-air design suggestions", () => {
  it("offers a scripture card when the text looks like a verse", () => {
    expect(suggestDesigns("John 3:16", "For God so loved the world")).toContain("verse");
  });

  it("offers a title treatment for a short headline", () => {
    expect(suggestDesigns("Welcome home", "")).toContain("title");
  });

  it("wraps overlay copy to a width", () => {
    const ctx = {
      measureText: (t: string) => ({ width: t.length * 10 }),
    } as unknown as CanvasRenderingContext2D;
    const lines = wrapText(ctx, "God is good all the time", 80);
    expect(lines.length).toBeGreaterThan(1);
  });

  it("does not draw typed text until it is put on air", () => {
    const fillText = vi.fn();
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      setTransform: vi.fn(),
      fillRect: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      arcTo: vi.fn(),
      closePath: vi.fn(),
      fillText,
      measureText: (t: string) => ({ width: t.length * 10 }),
    } as unknown as CanvasRenderingContext2D;
    drawProgrammeOverlay(ctx, 1280, 720, {
      design: "lower-third",
      headline: "Welcome home",
      body: "Sunday service",
      visible: false,
    });
    expect(fillText).not.toHaveBeenCalled();
    drawProgrammeOverlay(ctx, 1280, 720, {
      design: "lower-third",
      headline: "Welcome home",
      body: "Sunday service",
      visible: true,
    });
    expect(fillText).toHaveBeenCalled();
  });
});

describe("Spoken verse capture", () => {
  it("reads transcripts from a speech result event", () => {
    const text = transcriptFromSpeechEvent({
      resultIndex: 0,
      results: [{ 0: { transcript: "open John 3:16" } }],
    });
    expect(text).toBe("open John 3:16");
  });
});
