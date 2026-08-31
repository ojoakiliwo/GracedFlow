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
