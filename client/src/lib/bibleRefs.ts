export type BibleHit = {
  book: string;
  chapter: number;
  verse?: number;
  verseEnd?: number;
  display: string;
  snippet?: string;
  source?: "reference" | "quote";
};

type BookEntry = { name: string; aliases: string[] };

const BOOKS: BookEntry[] = [
  { name: "Genesis", aliases: ["genesis", "gen", "ge"] },
  { name: "Exodus", aliases: ["exodus", "exod", "ex"] },
  { name: "Leviticus", aliases: ["leviticus", "lev", "le"] },
  { name: "Numbers", aliases: ["numbers", "num", "nu"] },
  { name: "Deuteronomy", aliases: ["deuteronomy", "deut", "dt"] },
  { name: "Joshua", aliases: ["joshua", "josh", "jos"] },
  { name: "Judges", aliases: ["judges", "judg", "jdg"] },
  { name: "Ruth", aliases: ["ruth", "ru"] },
  { name: "1 Samuel", aliases: ["1 samuel", "1 sam", "1sa", "i samuel", "first samuel"] },
  { name: "2 Samuel", aliases: ["2 samuel", "2 sam", "2sa", "ii samuel", "second samuel"] },
  { name: "1 Kings", aliases: ["1 kings", "1 kgs", "1ki", "i kings", "first kings"] },
  { name: "2 Kings", aliases: ["2 kings", "2 kgs", "2ki", "ii kings", "second kings"] },
  { name: "1 Chronicles", aliases: ["1 chronicles", "1 chr", "1ch", "first chronicles"] },
  { name: "2 Chronicles", aliases: ["2 chronicles", "2 chr", "2ch", "second chronicles"] },
  { name: "Ezra", aliases: ["ezra", "ezr"] },
  { name: "Nehemiah", aliases: ["nehemiah", "neh"] },
  { name: "Esther", aliases: ["esther", "est"] },
  { name: "Job", aliases: ["job"] },
  { name: "Psalm", aliases: ["psalm", "psalms", "ps", "psa"] },
  { name: "Proverbs", aliases: ["proverbs", "prov", "pr"] },
  { name: "Ecclesiastes", aliases: ["ecclesiastes", "eccl", "ecc"] },
  { name: "Song of Solomon", aliases: ["song of solomon", "song of songs", "sos", "song"] },
  { name: "Isaiah", aliases: ["isaiah", "isa", "is"] },
  { name: "Jeremiah", aliases: ["jeremiah", "jer"] },
  { name: "Lamentations", aliases: ["lamentations", "lam"] },
  { name: "Ezekiel", aliases: ["ezekiel", "ezek", "eze"] },
  { name: "Daniel", aliases: ["daniel", "dan"] },
  { name: "Hosea", aliases: ["hosea", "hos"] },
  { name: "Joel", aliases: ["joel"] },
  { name: "Amos", aliases: ["amos"] },
  { name: "Obadiah", aliases: ["obadiah", "obad"] },
  { name: "Jonah", aliases: ["jonah", "jon"] },
  { name: "Micah", aliases: ["micah", "mic"] },
  { name: "Nahum", aliases: ["nahum", "nah"] },
  { name: "Habakkuk", aliases: ["habakkuk", "hab"] },
  { name: "Zephaniah", aliases: ["zephaniah", "zeph"] },
  { name: "Haggai", aliases: ["haggai", "hag"] },
  { name: "Zechariah", aliases: ["zechariah", "zech"] },
  { name: "Malachi", aliases: ["malachi", "mal"] },
  { name: "Matthew", aliases: ["matthew", "matt", "mt"] },
  { name: "Mark", aliases: ["mark", "mk", "mr"] },
  { name: "Luke", aliases: ["luke", "lk"] },
  { name: "John", aliases: ["john", "jn", "joh"] },
  { name: "Acts", aliases: ["acts", "act"] },
  { name: "Romans", aliases: ["romans", "rom", "ro"] },
  { name: "1 Corinthians", aliases: ["1 corinthians", "1 cor", "1co", "first corinthians", "i corinthians"] },
  { name: "2 Corinthians", aliases: ["2 corinthians", "2 cor", "2co", "second corinthians"] },
  { name: "Galatians", aliases: ["galatians", "gal"] },
  { name: "Ephesians", aliases: ["ephesians", "eph"] },
  { name: "Philippians", aliases: ["philippians", "phil", "php"] },
  { name: "Colossians", aliases: ["colossians", "col"] },
  { name: "1 Thessalonians", aliases: ["1 thessalonians", "1 thess", "1th", "first thessalonians"] },
  { name: "2 Thessalonians", aliases: ["2 thessalonians", "2 thess", "2th", "second thessalonians"] },
  { name: "1 Timothy", aliases: ["1 timothy", "1 tim", "1ti", "first timothy"] },
  { name: "2 Timothy", aliases: ["2 timothy", "2 tim", "2ti", "second timothy"] },
  { name: "Titus", aliases: ["titus", "tit"] },
  { name: "Philemon", aliases: ["philemon", "phm"] },
  { name: "Hebrews", aliases: ["hebrews", "heb"] },
  { name: "James", aliases: ["james", "jas"] },
  { name: "1 Peter", aliases: ["1 peter", "1 pet", "1pe", "first peter"] },
  { name: "2 Peter", aliases: ["2 peter", "2 pet", "2pe", "second peter"] },
  { name: "1 John", aliases: ["1 john", "1 jn", "1jo", "first john"] },
  { name: "2 John", aliases: ["2 john", "2 jn", "2jo", "second john"] },
  { name: "3 John", aliases: ["3 john", "3 jn", "3jo", "third john"] },
  { name: "Jude", aliases: ["jude"] },
  { name: "Revelation", aliases: ["revelation", "rev", "revelations"] },
];

export const CANON_BOOKS = BOOKS.map((b) => b.name);

const ALIAS_TO_BOOK = (() => {
  const map = new Map<string, string>();
  for (const book of BOOKS) {
    map.set(book.name.toLowerCase(), book.name);
    for (const alias of book.aliases) map.set(alias, book.name);
  }
  return map;
})();

const ALIAS_PATTERN = [...ALIAS_TO_BOOK.keys()]
  .sort((a, b) => b.length - a.length)
  .map((a) => a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  .join("|");

const REF_RE = new RegExp(
  `\\b(${ALIAS_PATTERN})\\b\\s*(?:chapter\\s*)?(\\d{1,3})(?:\\s*[:.]\\s*|\\s+verse\\s+|\\s+v\\.?\\s*|\\s+(?=\\d))?(\\d{1,3})?(?:\\s*[-–]\\s*(\\d{1,3}))?`,
  "gi",
);

export function formatBibleHit(hit: Pick<BibleHit, "book" | "chapter" | "verse" | "verseEnd">): string {
  if (hit.verse && hit.verseEnd && hit.verseEnd !== hit.verse) {
    return `${hit.book} ${hit.chapter}:${hit.verse}-${hit.verseEnd}`;
  }
  if (hit.verse) return `${hit.book} ${hit.chapter}:${hit.verse}`;
  return `${hit.book} ${hit.chapter}`;
}

export function parseBibleReferences(text: string): BibleHit[] {
  const hits: BibleHit[] = [];
  const seen = new Set<string>();
  REF_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = REF_RE.exec(text)) !== null) {
    const book = ALIAS_TO_BOOK.get(match[1]!.toLowerCase());
    if (!book) continue;
    const chapter = Number(match[2]);
    const verse = match[3] ? Number(match[3]) : undefined;
    const verseEnd = match[4] ? Number(match[4]) : undefined;
    if (!chapter || chapter > 150) continue;
    const hit: BibleHit = {
      book,
      chapter,
      verse,
      verseEnd: verseEnd && verse && verseEnd > verse ? verseEnd : undefined,
      display: "",
      source: "reference",
    };
    hit.display = formatBibleHit(hit);
    if (seen.has(hit.display)) continue;
    seen.add(hit.display);
    hits.push(hit);
  }
  return hits;
}

export type VersePayload = {
  reference: string;
  text: string;
};

const verseCache = new Map<string, VersePayload>();

export async function fetchVerseText(
  hit: BibleHit,
  fetcher: typeof fetch = fetch,
): Promise<VersePayload> {
  const cached = verseCache.get(hit.display);
  if (cached) return cached;
  const url = `https://bible-api.com/${encodeURIComponent(hit.display)}?translation=kjv`;
  const res = await fetcher(url);
  if (!res.ok) {
    return { reference: hit.display, text: "" };
  }
  const data = (await res.json()) as { reference?: string; text?: string };
  const payload = {
    reference: (data.reference || hit.display).trim(),
    text: (data.text || "").replace(/\s+/g, " ").trim(),
  };
  verseCache.set(hit.display, payload);
  return payload;
}

/** True when `short` looks like a half-typed version of `long` (John 3 → John 3:16). */
export function isTypingPrefix(short: BibleHit, long: BibleHit): boolean {
  if (short.book !== long.book || short.chapter !== long.chapter) return false;
  if (short.display === long.display) return false;
  if (!short.verse && long.verse) return true;
  if (
    short.verse &&
    long.verse &&
    !short.verseEnd &&
    String(long.verse).startsWith(String(short.verse)) &&
    String(long.verse).length > String(short.verse).length
  ) {
    return true;
  }
  if (short.verse && long.verse && short.verse === long.verse && !short.verseEnd && long.verseEnd) {
    return true;
  }
  return false;
}

export function mergeBibleHits(existing: BibleHit[], incoming: BibleHit[]): BibleHit[] {
  let next = [...existing];
  for (const hit of incoming) {
    next = next.filter((old) => !isTypingPrefix(old, hit));
    if (next.some((h) => h.display === hit.display)) {
      next = next.map((old) =>
        old.display === hit.display && !old.snippet && hit.snippet ? { ...old, ...hit } : old,
      );
      continue;
    }
    if (next.some((h) => isTypingPrefix(hit, h))) continue;
    next.push(hit);
  }
  return next.slice(-12);
}

/** Protestant canon chapter counts, aligned with CANON_BOOKS. */
export const BOOK_CHAPTERS: Record<string, number> = {
  Genesis: 50,
  Exodus: 40,
  Leviticus: 27,
  Numbers: 36,
  Deuteronomy: 34,
  Joshua: 24,
  Judges: 21,
  Ruth: 4,
  "1 Samuel": 31,
  "2 Samuel": 24,
  "1 Kings": 22,
  "2 Kings": 25,
  "1 Chronicles": 29,
  "2 Chronicles": 36,
  Ezra: 10,
  Nehemiah: 13,
  Esther: 10,
  Job: 42,
  Psalm: 150,
  Proverbs: 31,
  Ecclesiastes: 12,
  "Song of Solomon": 8,
  Isaiah: 66,
  Jeremiah: 52,
  Lamentations: 5,
  Ezekiel: 48,
  Daniel: 12,
  Hosea: 14,
  Joel: 3,
  Amos: 9,
  Obadiah: 1,
  Jonah: 4,
  Micah: 7,
  Nahum: 3,
  Habakkuk: 3,
  Zephaniah: 3,
  Haggai: 2,
  Zechariah: 14,
  Malachi: 4,
  Matthew: 28,
  Mark: 16,
  Luke: 24,
  John: 21,
  Acts: 28,
  Romans: 16,
  "1 Corinthians": 16,
  "2 Corinthians": 13,
  Galatians: 6,
  Ephesians: 6,
  Philippians: 4,
  Colossians: 4,
  "1 Thessalonians": 5,
  "2 Thessalonians": 3,
  "1 Timothy": 6,
  "2 Timothy": 4,
  Titus: 3,
  Philemon: 1,
  Hebrews: 13,
  James: 5,
  "1 Peter": 5,
  "2 Peter": 3,
  "1 John": 5,
  "2 John": 1,
  "3 John": 1,
  Jude: 1,
  Revelation: 22,
};

export function liveVerseFromOverlay(headline: string, body: string): BibleHit | null {
  const hits = parseBibleReferences(`${headline} ${body}`);
  return hits[0] ?? null;
}

export function nextBookChapter(book: string, chapter: number): { book: string; chapter: number } | null {
  const total = BOOK_CHAPTERS[book];
  if (!total) return null;
  if (chapter < total) return { book, chapter: chapter + 1 };
  const idx = CANON_BOOKS.indexOf(book);
  if (idx < 0 || idx >= CANON_BOOKS.length - 1) return null;
  return { book: CANON_BOOKS[idx + 1]!, chapter: 1 };
}

export function prevBookChapter(book: string, chapter: number): { book: string; chapter: number } | null {
  if (chapter > 1) return { book, chapter: chapter - 1 };
  const idx = CANON_BOOKS.indexOf(book);
  if (idx <= 0) return null;
  const prevBook = CANON_BOOKS[idx - 1]!;
  return { book: prevBook, chapter: BOOK_CHAPTERS[prevBook] ?? 1 };
}

type ChapterVerse = { verse: number; text: string };

const chapterCache = new Map<string, ChapterVerse[]>();

export async function fetchChapterVerses(
  book: string,
  chapter: number,
  fetcher: typeof fetch = fetch,
): Promise<ChapterVerse[]> {
  const key = `${book}|${chapter}`;
  const cached = chapterCache.get(key);
  if (cached) return cached;
  const url = `https://bible-api.com/${encodeURIComponent(`${book} ${chapter}`)}?translation=kjv`;
  const res = await fetcher(url);
  if (!res.ok) return [];
  const data = (await res.json()) as { verses?: { verse?: number; text?: string }[]; text?: string };
  const verses = (data.verses ?? [])
    .map((v) => ({
      verse: Number(v.verse) || 0,
      text: (v.text || "").replace(/\s+/g, " ").trim(),
    }))
    .filter((v) => v.verse > 0);
  if (verses.length) chapterCache.set(key, verses);
  return verses;
}

export async function fetchAdjacentVerse(
  hit: BibleHit,
  direction: 1 | -1,
  fetcher: typeof fetch = fetch,
): Promise<{ hit: BibleHit; text: string } | null> {
  const currentVerse = direction > 0 ? hit.verseEnd || hit.verse || 1 : hit.verse || 1;
  let book = hit.book;
  let chapter = hit.chapter;
  let verses = await fetchChapterVerses(book, chapter, fetcher);
  if (!verses.length) return null;

  const idx = verses.findIndex((v) => v.verse === currentVerse);
  const at = idx >= 0 ? idx : 0;
  const nextIdx = at + direction;
  if (nextIdx >= 0 && nextIdx < verses.length) {
    const row = verses[nextIdx]!;
    const nextHit: BibleHit = {
      book,
      chapter,
      verse: row.verse,
      display: formatBibleHit({ book, chapter, verse: row.verse }),
      snippet: row.text,
      source: "reference",
    };
    verseCache.set(nextHit.display, { reference: nextHit.display, text: row.text });
    return { hit: nextHit, text: row.text };
  }

  const neighbour = direction > 0 ? nextBookChapter(book, chapter) : prevBookChapter(book, chapter);
  if (!neighbour) return null;
  verses = await fetchChapterVerses(neighbour.book, neighbour.chapter, fetcher);
  if (!verses.length) return null;
  const row = direction > 0 ? verses[0]! : verses[verses.length - 1]!;
  const nextHit: BibleHit = {
    book: neighbour.book,
    chapter: neighbour.chapter,
    verse: row.verse,
    display: formatBibleHit({ book: neighbour.book, chapter: neighbour.chapter, verse: row.verse }),
    snippet: row.text,
    source: "reference",
  };
  verseCache.set(nextHit.display, { reference: nextHit.display, text: row.text });
  return { hit: nextHit, text: row.text };
}
