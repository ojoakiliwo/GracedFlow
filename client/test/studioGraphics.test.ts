import { describe, expect, it, vi } from "vitest";
import {
  fetchAdjacentVerse,
  fetchVerseText,
  liveVerseFromOverlay,
  mergeBibleHits,
  nextBookChapter,
  parseBibleReferences,
  prevBookChapter,
} from "../src/lib/bibleRefs";
import {
  drawProgrammeOverlay,
  fitWrappedText,
  getOverlayPalette,
  overlayScale,
  OVERLAY_PALETTES,
  suggestDesigns,
  verseCardLayout,
  wrapText,
} from "../src/lib/studioOverlays";
import { transcriptFromSpeechEvent } from "../src/lib/studioSpeech";
import { searchQuotesLocal, searchQuotesRemote, scoreQuoteMatch } from "../src/lib/scriptureSearch";

function overlayCtx(extra?: Record<string, unknown>) {
  let font = "";
  let fillStyle = "";
  const ctx: Record<string, unknown> = {
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
    clip: vi.fn(),
    fillText: vi.fn(),
    measureText: (t: string) => ({ width: String(t).length * 10 }),
    filter: "none",
    textBaseline: "top",
    textAlign: "left",
    lineWidth: 1,
    strokeStyle: "",
  };
  Object.defineProperty(ctx, "font", {
    get: () => font,
    set: (value: string) => {
      font = String(value);
    },
    enumerable: true,
    configurable: true,
  });
  Object.defineProperty(ctx, "fillStyle", {
    get: () => fillStyle,
    set: (value: string) => {
      fillStyle = String(value);
    },
    enumerable: true,
    configurable: true,
  });
  if (extra) Object.defineProperties(ctx, Object.getOwnPropertyDescriptors(extra));
  return ctx as unknown as CanvasRenderingContext2D;
}

const LONG_VERSE =
  "John 3:16 — For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.\n\nRomans 8:28 — And we know that all things work together for good to them that love God, to them who are the called according to his purpose.";

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

  it("steps across chapter and book boundaries", () => {
    expect(nextBookChapter("John", 3)).toEqual({ book: "John", chapter: 4 });
    expect(nextBookChapter("John", 21)).toEqual({ book: "Acts", chapter: 1 });
    expect(nextBookChapter("Revelation", 22)).toBeNull();
    expect(prevBookChapter("John", 3)).toEqual({ book: "John", chapter: 2 });
    expect(prevBookChapter("Matthew", 1)).toEqual({ book: "Malachi", chapter: 4 });
    expect(prevBookChapter("Genesis", 1)).toBeNull();
    expect(liveVerseFromOverlay("John 3:16", "For God so loved the world")?.display).toBe("John 3:16");
  });

  it("loads the next and previous verse of a posted scripture", async () => {
    const john3 = [
      { verse: 15, text: "That whosoever believeth in him should not perish." },
      { verse: 16, text: "For God so loved the world." },
      { verse: 17, text: "For God sent not his Son into the world to condemn the world." },
    ];
    const john4 = [{ verse: 1, text: "When therefore the Lord knew how the Pharisees had heard." }];
    const fetcher = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("John%203") || url.includes("John 3")) {
        return { ok: true, json: async () => ({ verses: john3 }) } as Response;
      }
      if (url.includes("John%204") || url.includes("John 4")) {
        return { ok: true, json: async () => ({ verses: john4 }) } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    };
    const hit = { book: "John", chapter: 3, verse: 16, display: "John 3:16" };
    const next = await fetchAdjacentVerse(hit, 1, fetcher);
    expect(next?.hit.display).toBe("John 3:17");
    expect(next?.text).toContain("condemn");
    const prev = await fetchAdjacentVerse(hit, -1, fetcher);
    expect(prev?.hit.display).toBe("John 3:15");
    const over = await fetchAdjacentVerse(
      { book: "John", chapter: 3, verse: 17, display: "John 3:17" },
      1,
      fetcher,
    );
    expect(over?.hit.display).toBe("John 4:1");
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
      LONG_VERSE,
      400,
      280,
      "serif",
    );
    expect(fitted.lines.join(" ")).toContain("Romans 8:28");
    expect(fitted.lines.join(" ")).toContain("all things work together");
    expect(fitted.lines.every((line) => ctx.measureText(line).width <= 400.5)).toBe(true);
    expect(fitted.lines.length * fitted.lineHeight).toBeLessThanOrEqual(280);
  });

  it("breaks a word that is wider than the scripture card", () => {
    const ctx = {
      measureText: (t: string) => ({ width: t.length * 10 }),
    } as unknown as CanvasRenderingContext2D;
    const lines = wrapText(ctx, "Supercalifragilisticexpialidocious", 80);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every((line) => ctx.measureText(line).width <= 80)).toBe(true);
  });

  it("keeps Program overlay geometry in 16:9 at 360p and 720p", () => {
    expect(overlayScale(1280, 720)).toBe(1);
    expect(overlayScale(640, 360)).toBe(0.5);
    const full = verseCardLayout(1280, 720);
    const half = verseCardLayout(640, 360);
    expect(half.boxW).toBeCloseTo(full.boxW * 0.5, 0);
    expect(half.innerW).toBeLessThan(half.boxW);
  });

  it("keeps scripture lines inside the card on 16:9 Program frames", () => {
    for (const [width, height] of [
      [1280, 720],
      [960, 540],
      [640, 360],
    ] as const) {
      const fills: { text: string; y: number; font: string }[] = [];
      let font = "";
      const ctx = overlayCtx({
        fillText(text: string, _x: number, y: number) {
          fills.push({ text: String(text), y, font });
        },
        set font(value: string) {
          font = String(value);
        },
        get font() {
          return font;
        },
      });
      drawProgrammeOverlay(ctx, width, height, {
        design: "verse",
        palette: "sanctuary",
        headline: "John 3:16",
        body: LONG_VERSE,
        visible: true,
      });
      const layout = verseCardLayout(width, height);
      const fitted = fitWrappedText(ctx, LONG_VERSE, layout.innerW, layout.innerH, "Fraunces, Georgia, serif", {
        maxFont: Math.max(12, Math.round(28 * layout.scale)),
        minFont: Math.max(8, Math.round(12 * layout.scale)),
      });
      const contentH = layout.headerH + fitted.lines.length * fitted.lineHeight;
      const boxH = Math.min(layout.maxBoxH, layout.padY * 2 + contentH);
      const y = Math.max(layout.margin, (height - boxH) / 2);
      expect(fitted.lines.length).toBeGreaterThan(1);
      expect(fitted.lines.every((line) => ctx.measureText(line).width <= layout.innerW + 0.5)).toBe(true);
      expect(y + boxH).toBeLessThanOrEqual(height);
      expect(y).toBeGreaterThanOrEqual(0);
      for (const fill of fills) {
        const size = Number(/(\d+)px/.exec(fill.font)?.[1] ?? 0);
        expect(fill.y).toBeGreaterThanOrEqual(y);
        expect(fill.y + size).toBeLessThanOrEqual(y + boxH + 1);
      }
    }
  });

  it("does not draw typed text until it is put on air", () => {
    const fillText = vi.fn();
    const ctx = overlayCtx({ fillText });
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
    const ctx = overlayCtx({
      set fillStyle(value: string) {
        styles.push(String(value));
      },
      get fillStyle() {
        return styles.at(-1) ?? "";
      },
    });
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
