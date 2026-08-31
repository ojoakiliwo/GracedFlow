import { CANON_BOOKS, formatBibleHit, type BibleHit } from "./bibleRefs";

type QuoteVerse = {
  book: string;
  chapter: number;
  verse: number;
  verseEnd?: number;
  text: string;
};

/** Well-known KJV lines a preacher is likely to quote without naming the reference. */
export const KNOWN_QUOTES: QuoteVerse[] = [
  { book: "Matthew", chapter: 7, verse: 7, text: "Ask, and it shall be given you; seek, and ye shall find; knock, and it shall be opened unto you:" },
  { book: "Matthew", chapter: 7, verse: 8, text: "For every one that asketh receiveth; and he that seeketh findeth; and to him that knocketh it shall be opened." },
  { book: "Luke", chapter: 11, verse: 9, text: "And I say unto you, Ask, and it shall be given you; seek, and ye shall find; knock, and it shall be opened unto you." },
  { book: "Luke", chapter: 11, verse: 10, text: "For every one that asketh receiveth; and he that seeketh findeth; and to him that knocketh it shall be opened." },
  { book: "James", chapter: 1, verse: 5, text: "If any of you lack wisdom, let him ask of God, that giveth to all men liberally, and upbraideth not; and it shall be given him." },
  { book: "John", chapter: 16, verse: 24, text: "Hitherto have ye asked nothing in my name: ask, and ye shall receive, that your joy may be full." },
  { book: "John", chapter: 3, verse: 16, text: "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life." },
  { book: "John", chapter: 14, verse: 6, text: "Jesus saith unto him, I am the way, the truth, and the life: no man cometh unto the Father, but by me." },
  { book: "John", chapter: 14, verse: 1, text: "Let not your heart be troubled: ye believe in God, believe also in me." },
  { book: "John", chapter: 11, verse: 25, text: "Jesus said unto her, I am the resurrection, and the life: he that believeth in me, though he were dead, yet shall he live:" },
  { book: "John", chapter: 8, verse: 32, text: "And ye shall know the truth, and the truth shall make you free." },
  { book: "John", chapter: 8, verse: 36, text: "If the Son therefore shall make you free, ye shall be free indeed." },
  { book: "Matthew", chapter: 11, verse: 28, text: "Come unto me, all ye that labour and are heavy laden, and I will give you rest." },
  { book: "Matthew", chapter: 6, verse: 33, text: "But seek ye first the kingdom of God, and his righteousness; and all these things shall be added unto you." },
  { book: "Matthew", chapter: 5, verse: 14, text: "Ye are the light of the world. A city that is set on an hill cannot be hid." },
  { book: "Matthew", chapter: 5, verse: 16, text: "Let your light so shine before men, that they may see your good works, and glorify your Father which is in heaven." },
  { book: "Matthew", chapter: 28, verse: 19, verseEnd: 20, text: "Go ye therefore, and teach all nations, baptizing them in the name of the Father, and of the Son, and of the Holy Ghost: Teaching them to observe all things whatsoever I have commanded you: and, lo, I am with you alway, even unto the end of the world. Amen." },
  { book: "Mark", chapter: 16, verse: 15, text: "And he said unto them, Go ye into all the world, and preach the gospel to every creature." },
  { book: "Luke", chapter: 4, verse: 18, text: "The Spirit of the Lord is upon me, because he hath anointed me to preach the gospel to the poor;" },
  { book: "Psalm", chapter: 23, verse: 1, text: "The Lord is my shepherd; I shall not want." },
  { book: "Psalm", chapter: 23, verse: 4, text: "Yea, though I walk through the valley of the shadow of death, I will fear no evil: for thou art with me; thy rod and thy staff they comfort me." },
  { book: "Psalm", chapter: 27, verse: 1, text: "The Lord is my light and my salvation; whom shall I fear? the Lord is the strength of my life; of whom shall I be afraid?" },
  { book: "Psalm", chapter: 46, verse: 1, text: "God is our refuge and strength, a very present help in trouble." },
  { book: "Psalm", chapter: 121, verse: 1, verseEnd: 2, text: "I will lift up mine eyes unto the hills, from whence cometh my help. My help cometh from the Lord, which made heaven and earth." },
  { book: "Psalm", chapter: 103, verse: 1, text: "Bless the Lord, O my soul: and all that is within me, bless his holy name." },
  { book: "Isaiah", chapter: 40, verse: 31, text: "But they that wait upon the Lord shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint." },
  { book: "Isaiah", chapter: 53, verse: 5, text: "But he was wounded for our transgressions, he was bruised for our iniquities: the chastisement of our peace was upon him; and with his stripes we are healed." },
  { book: "Isaiah", chapter: 41, verse: 10, text: "Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee; yea, I will help thee; yea, I will uphold thee with the right hand of my righteousness." },
  { book: "Isaiah", chapter: 60, verse: 1, text: "Arise, shine; for thy light is come, and the glory of the Lord is risen upon thee." },
  { book: "Jeremiah", chapter: 29, verse: 11, text: "For I know the thoughts that I think toward you, saith the Lord, thoughts of peace, and not of evil, to give you an expected end." },
  { book: "Proverbs", chapter: 3, verse: 5, verseEnd: 6, text: "Trust in the Lord with all thine heart; and lean not unto thine own understanding. In all thy ways acknowledge him, and he shall direct thy paths." },
  { book: "Joshua", chapter: 1, verse: 9, text: "Have not I commanded thee? Be strong and of a good courage; be not afraid, neither be thou dismayed: for the Lord thy God is with thee whithersoever thou goest." },
  { book: "Genesis", chapter: 1, verse: 1, text: "In the beginning God created the heaven and the earth." },
  { book: "Numbers", chapter: 6, verse: 24, verseEnd: 26, text: "The Lord bless thee, and keep thee: The Lord make his face shine upon thee, and be gracious unto thee: The Lord lift up his countenance upon thee, and give thee peace." },
  { book: "Romans", chapter: 8, verse: 28, text: "And we know that all things work together for good to them that love God, to them who are the called according to his purpose." },
  { book: "Romans", chapter: 8, verse: 31, text: "What shall we then say to these things? If God be for us, who can be against us?" },
  { book: "Romans", chapter: 10, verse: 9, text: "That if thou shalt confess with thy mouth the Lord Jesus, and shalt believe in thine heart that God hath raised him from the dead, thou shalt be saved." },
  { book: "Romans", chapter: 12, verse: 1, text: "I beseech you therefore, brethren, by the mercies of God, that ye present your bodies a living sacrifice, holy, acceptable unto God, which is your reasonable service." },
  { book: "Philippians", chapter: 4, verse: 13, text: "I can do all things through Christ which strengtheneth me." },
  { book: "Philippians", chapter: 4, verse: 6, verseEnd: 7, text: "Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God. And the peace of God, which passeth all understanding, shall keep your hearts and minds through Christ Jesus." },
  { book: "Philippians", chapter: 4, verse: 19, text: "But my God shall supply all your need according to his riches in glory by Christ Jesus." },
  { book: "Ephesians", chapter: 3, verse: 20, text: "Now unto him that is able to do exceeding abundantly above all that we ask or think, according to the power that worketh in us," },
  { book: "Ephesians", chapter: 2, verse: 8, verseEnd: 9, text: "For by grace are ye saved through faith; and that not of yourselves: it is the gift of God: Not of works, lest any man should boast." },
  { book: "2 Timothy", chapter: 1, verse: 7, text: "For God hath not given us the spirit of fear; but of power, and of love, and of a sound mind." },
  { book: "2 Timothy", chapter: 3, verse: 16, text: "All scripture is given by inspiration of God, and is profitable for doctrine, for reproof, for correction, for instruction in righteousness:" },
  { book: "Hebrews", chapter: 11, verse: 1, text: "Now faith is the substance of things hoped for, the evidence of things not seen." },
  { book: "Hebrews", chapter: 13, verse: 8, text: "Jesus Christ the same yesterday, and to day, and for ever." },
  { book: "Hebrews", chapter: 4, verse: 12, text: "For the word of God is quick, and powerful, and sharper than any twoedged sword," },
  { book: "1 Corinthians", chapter: 13, verse: 4, verseEnd: 7, text: "Charity suffereth long, and is kind; charity envieth not; charity vaunteth not itself, is not puffed up, Doth not behave itself unseemly, seeketh not her own, is not easily provoked, thinketh no evil; Rejoiceth not in iniquity, but rejoiceth in the truth; Beareth all things, believeth all things, hopeth all things, endureth all things." },
  { book: "1 Corinthians", chapter: 13, verse: 13, text: "And now abideth faith, hope, charity, these three; but the greatest of these is charity." },
  { book: "1 Corinthians", chapter: 15, verse: 57, text: "But thanks be to God, which giveth us the victory through our Lord Jesus Christ." },
  { book: "2 Corinthians", chapter: 5, verse: 17, text: "Therefore if any man be in Christ, he is a new creature: old things are passed away; behold, all things are become new." },
  { book: "2 Corinthians", chapter: 12, verse: 9, text: "And he said unto me, My grace is sufficient for thee: for my strength is made perfect in weakness." },
  { book: "Galatians", chapter: 2, verse: 20, text: "I am crucified with Christ: nevertheless I live; yet not I, but Christ liveth in me:" },
  { book: "Galatians", chapter: 6, verse: 9, text: "And let us not be weary in well doing: for in due season we shall reap, if we faint not." },
  { book: "Colossians", chapter: 3, verse: 23, text: "And whatsoever ye do, do it heartily, as to the Lord, and not unto men;" },
  { book: "1 Peter", chapter: 5, verse: 7, text: "Casting all your care upon him; for he careth for you." },
  { book: "1 Peter", chapter: 2, verse: 9, text: "But ye are a chosen generation, a royal priesthood, an holy nation, a peculiar people;" },
  { book: "1 John", chapter: 4, verse: 8, text: "He that loveth not knoweth not God; for God is love." },
  { book: "1 John", chapter: 1, verse: 9, text: "If we confess our sins, he is faithful and just to forgive us our sins, and to cleanse us from all unrighteousness." },
  { book: "Revelation", chapter: 3, verse: 20, text: "Behold, I stand at the door, and knock: if any man hear my voice, and open the door, I will come in to him, and will sup with him, and he with me." },
  { book: "Revelation", chapter: 21, verse: 4, text: "And God shall wipe away all tears from their eyes; and there shall be no more death, neither sorrow, nor crying, neither shall there be any more pain: for the former things are passed away." },
  { book: "Acts", chapter: 1, verse: 8, text: "But ye shall receive power, after that the Holy Ghost is come upon you: and ye shall be witnesses unto me" },
  { book: "Acts", chapter: 16, verse: 31, text: "And they said, Believe on the Lord Jesus Christ, and thou shalt be saved, and thy house." },
  { book: "Matthew", chapter: 19, verse: 26, text: "But Jesus beheld them, and said unto them, With men this is impossible; but with God all things are possible." },
  { book: "Luke", chapter: 1, verse: 37, text: "For with God nothing shall be impossible." },
  { book: "Malachi", chapter: 3, verse: 10, text: "Bring ye all the tithes into the storehouse, that there may be meat in mine house, and prove me now herewith, saith the Lord of hosts, if I will not open you the windows of heaven, and pour you out a blessing, that there shall not be room enough to receive it." },
  { book: "Joel", chapter: 2, verse: 28, text: "And it shall come to pass afterward, that I will pour out my spirit upon all flesh;" },
];

const STOP = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "is", "be", "it",
  "that", "this", "with", "from", "as", "at", "by", "was", "were", "are", "i",
  "we", "he", "she", "they", "you", "your", "our", "his", "her", "them", "unto",
  "ye", "shall", "will", "but", "not", "so", "if", "my", "me", "him", "us",
  "all", "any", "who", "which", "there", "then", "than", "into", "upon",
]);

export function normalizeScriptureWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/\bye\b/g, "you")
    .replace(/\bthy\b/g, "your")
    .replace(/\bthine\b/g, "your")
    .replace(/\bthou\b/g, "you")
    .replace(/\bthee\b/g, "you")
    .replace(/\bshalt\b/g, "shall")
    .replace(/\bwilt\b/g, "will")
    .replace(/\bhath\b/g, "has")
    .replace(/\bdoth\b/g, "does")
    .replace(/\basketh\b/g, "ask")
    .replace(/\bseeketh\b/g, "seek")
    .replace(/\bfindeth\b/g, "find")
    .replace(/\bknocketh\b/g, "knock")
    .replace(/\breceiveth\b/g, "receive")
    .replace(/\bopened\b/g, "open")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function contentWords(words: string[]): string[] {
  return words.filter((w) => w.length > 2 && !STOP.has(w));
}

function lcsLength(a: string[], b: string[]): number {
  const m = a.length;
  const n = b.length;
  if (!m || !n) return 0;
  let prev = new Array<number>(n + 1).fill(0);
  let curr = new Array<number>(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      curr[j] = a[i - 1] === b[j - 1] ? (prev[j - 1] ?? 0) + 1 : Math.max(prev[j] ?? 0, curr[j - 1] ?? 0);
    }
    const tmp = prev;
    prev = curr;
    curr = tmp;
    curr.fill(0);
  }
  return prev[n] ?? 0;
}

export function scoreQuoteMatch(spoken: string, verseText: string): number {
  const spokenContent = contentWords(normalizeScriptureWords(spoken));
  const verseContent = contentWords(normalizeScriptureWords(verseText));
  if (spokenContent.length < 3 || verseContent.length < 3) return 0;
  const lcs = lcsLength(spokenContent, verseContent);
  if (lcs < 3) return 0;
  const spokenSet = new Set(spokenContent);
  const overlap = verseContent.filter((w) => spokenSet.has(w)).length;
  return lcs * 3 + overlap;
}

function hitFromQuote(verse: QuoteVerse, snippet?: string): BibleHit {
  const hit: BibleHit = {
    book: verse.book,
    chapter: verse.chapter,
    verse: verse.verse,
    verseEnd: verse.verseEnd,
    display: "",
    snippet: snippet || verse.text,
    source: "quote",
  };
  hit.display = formatBibleHit(hit);
  return hit;
}

export function searchQuotesLocal(spoken: string): BibleHit[] {
  const scored = KNOWN_QUOTES.map((verse) => ({
    verse,
    score: scoreQuoteMatch(spoken, verse.text),
  }))
    .filter((row) => row.score >= 12)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
  return scored.map((row) => hitFromQuote(row.verse));
}

export function cleanSearchHtml(html: string): string {
  return html
    .replace(/<S>\d+<\/S>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function bookFromCanonNumber(n: number): string | undefined {
  return CANON_BOOKS[n - 1];
}

export function quoteQueryFromSpeech(spoken: string): string | null {
  const words = normalizeScriptureWords(spoken);
  const content = contentWords(words);
  if (content.length < 4) return null;
  const window = words.slice(-18);
  if (contentWords(window).length < 4) return content.slice(0, 10).join(" ");
  return window.join(" ");
}

type RemoteRow = {
  book?: number;
  chapter?: number;
  verse?: number;
  text?: string;
};

export async function searchQuotesRemote(
  spoken: string,
  fetcher: typeof fetch = fetch,
): Promise<BibleHit[]> {
  const query = quoteQueryFromSpeech(spoken);
  if (!query) return [];
  const url = `https://bolls.life/v2/find/KJV?search=${encodeURIComponent(query)}`;
  try {
    const res = await fetcher(url);
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: RemoteRow[] };
    const rows = data.results ?? [];
    const hits: BibleHit[] = [];
    for (const row of rows) {
      const book = typeof row.book === "number" ? bookFromCanonNumber(row.book) : undefined;
      if (!book || !row.chapter || !row.verse) continue;
      const snippet = cleanSearchHtml(row.text || "");
      const score = scoreQuoteMatch(spoken, snippet);
      if (score < 12) continue;
      hits.push({
        book,
        chapter: row.chapter,
        verse: row.verse,
        display: formatBibleHit({ book, chapter: row.chapter, verse: row.verse }),
        snippet,
        source: "quote",
      });
    }
    return hits
      .sort((a, b) => scoreQuoteMatch(spoken, b.snippet || "") - scoreQuoteMatch(spoken, a.snippet || ""))
      .slice(0, 6);
  } catch {
    return [];
  }
}

export function appendSpokenWindow(prev: string, next: string, maxWords = 100): string {
  return `${prev} ${next}`.trim().split(/\s+/).filter(Boolean).slice(-maxWords).join(" ");
}
