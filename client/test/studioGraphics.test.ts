import { describe, expect, it, vi } from "vitest";
import { fetchVerseText, mergeBibleHits, parseBibleReferences } from "../src/lib/bibleRefs";
import {
  drawProgrammeOverlay,
  fitWrappedText,
  getOverlayPalette,
  OVERLAY_PALETTES,
  suggestDesigns,
  wrapText,
} from "../src/lib/studioOverlays";
import { transcriptFromSpeechEvent } from "../src/lib/studioSpeech";
import { searchQuotesLocal, searchQuotesRemote, scoreQuoteMatch } from "../src/lib/scriptureSearch";

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

  it("replaces a half-typed reference instead of keeping every keystroke", () => {
    const chapter = parseBibleReferences("John 3");
    const mid = mergeBibleHits(chapter, parseBibleReferences("John 3:1"));
    const done = mergeBibleHits(mid, parseBibleReferences("John 3:16"));
    expect(done.map((h) => h.display)).toEqual(["John 3:16"]);
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
    const paras = wrapText(ctx, "John 3:16 — For God so loved\n\nRomans 8:28 — And we know", 80);
    expect(paras.length).toBeGreaterThan(lines.length);
    const fitted = fitWrappedText(
      ctx,
      "John 3:16 — For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.\n\nRomans 8:28 — And we know that all things work together for good to them that love God.",
      400,
      280,
      "serif",
    );
    expect(fitted.lines.join(" ")).toContain("Romans 8:28");
    expect(fitted.lines.join(" ")).toContain("all things work together");
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
      palette: "sanctuary",
      headline: "Welcome home",
      body: "Sunday service",
      visible: false,
    });
    expect(fillText).not.toHaveBeenCalled();
    drawProgrammeOverlay(
      ctx,
      1280,
      720,
      {
        design: "lower-third",
        palette: "sanctuary",
        headline: "Welcome home",
        body: "Sunday service",
        visible: false,
      },
      { stage: true },
    );
    expect(fillText).toHaveBeenCalled();
    fillText.mockClear();
    drawProgrammeOverlay(ctx, 1280, 720, {
      design: "lower-third",
      palette: "sanctuary",
      headline: "Welcome home",
      body: "Sunday service",
      visible: true,
    });
    expect(fillText).toHaveBeenCalled();
  });

  it("marks sanctuary, glory gold, and linen as the best-match palettes", () => {
    const recommended = OVERLAY_PALETTES.filter((p) => p.recommended).map((p) => p.id);
    expect(recommended).toEqual(["sanctuary", "glory", "linen"]);
  });

  it("paints overlay plates with the matching ink colour", () => {
    const styles: string[] = [];
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
      fillText: vi.fn(),
      measureText: (t: string) => ({ width: t.length * 10 }),
      set fillStyle(value: string) {
        styles.push(String(value));
      },
      get fillStyle() {
        return styles.at(-1) ?? "";
      },
      set strokeStyle(_value: string) {},
      set lineWidth(_value: number) {},
      set font(_value: string) {},
      set filter(_value: string) {},
      set textBaseline(_value: string) {},
      set textAlign(_value: string) {},
    } as unknown as CanvasRenderingContext2D;
    const pal = getOverlayPalette("glory");
    drawProgrammeOverlay(ctx, 1280, 720, {
      design: "lower-third",
      palette: "glory",
      headline: "Welcome home",
      body: "Sunday service",
      visible: true,
    });
    expect(styles).toContain(pal.bg);
    expect(styles).toContain(pal.text);
    expect(styles).toContain(pal.accent);
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

describe("Scripture quoted by words", () => {
  const spoken =
    "the bible says Ask, it shall be given unto you, seek, you will find, knock and the door";

  it("finds Matthew 7:7 and Luke 11:9 from the spoken words without a reference", () => {
    const hits = searchQuotesLocal(spoken);
    expect(hits.map((h) => h.display)).toContain("Matthew 7:7");
    expect(hits.map((h) => h.display)).toContain("Luke 11:9");
  });

  it("does not treat ordinary church talk as a verse", () => {
    expect(searchQuotesLocal("We thank God for john in the choir this morning")).toEqual([]);
  });

  it("ranks the knock-and-ask saying above a weak overlap", () => {
    const ask = scoreQuoteMatch(spoken, "Ask, and it shall be given you; seek, and ye shall find; knock, and it shall be opened unto you:");
    const weak = scoreQuoteMatch(spoken, "The Lord is my shepherd; I shall not want.");
    expect(ask).toBeGreaterThan(weak);
    expect(weak).toBe(0);
  });

  it("keeps remote search results that match the spoken words", async () => {
    const fetcher = async () =>
      ({
        ok: true,
        json: async () => ({
          results: [
            { book: 40, chapter: 7, verse: 7, text: "Ask, and it shall be given you; seek, and ye shall find; knock, and it shall be opened unto you:" },
            { book: 42, chapter: 11, verse: 9, text: "Ask, and it shall be given you; seek, and ye shall find; knock, and it shall be opened unto you." },
            { book: 19, chapter: 2, verse: 8, text: "Ask of me, and I shall give thee the heathen for thine inheritance." },
          ],
        }),
      }) as Response;
    const hits = await searchQuotesRemote(spoken, fetcher);
    expect(hits.map((h) => h.display)).toEqual(["Matthew 7:7", "Luke 11:9"]);
  });
});
