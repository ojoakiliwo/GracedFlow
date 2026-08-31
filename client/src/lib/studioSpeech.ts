/** Chrome / Edge speech recognition, typed loosely so we do not need extra DOM libs. */

export type StudioSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((ev: { resultIndex: number; results: SpeechResultList }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechResultList = {
  length: number;
  item?: (i: number) => SpeechAlt;
  [index: number]: SpeechAlt;
};

type SpeechAlt = { 0?: { transcript?: string }; isFinal?: boolean };

export function getSpeechRecognitionCtor(): (new () => StudioSpeechRecognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => StudioSpeechRecognition;
    webkitSpeechRecognition?: new () => StudioSpeechRecognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function transcriptFromSpeechEvent(ev: {
  resultIndex: number;
  results: SpeechResultList;
}): string {
  return speechChunkFromEvent(ev).text;
}

export function speechChunkFromEvent(ev: {
  resultIndex: number;
  results: SpeechResultList;
}): { text: string; isFinal: boolean } {
  let chunk = "";
  let isFinal = false;
  for (let i = ev.resultIndex; i < ev.results.length; i++) {
    const row = ev.results[i] ?? ev.results.item?.(i);
    chunk += row?.[0]?.transcript ?? "";
    if (row?.isFinal) isFinal = true;
  }
  return { text: chunk, isFinal };
}
