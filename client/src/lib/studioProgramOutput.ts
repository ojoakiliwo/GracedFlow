export const PROGRAM_OUTPUT_NAME = "igc-program";
export const PROGRAM_OUTPUT_TITLE = "IGC Program";

export function prepareProgramOutputDocument(doc: Document): HTMLCanvasElement {
  doc.title = PROGRAM_OUTPUT_TITLE;
  const body = doc.body;
  body.style.margin = "0";
  body.style.background = "#000";
  body.style.overflow = "hidden";
  let canvas = doc.getElementById("igc-program") as HTMLCanvasElement | null;
  if (!canvas) {
    body.replaceChildren();
    canvas = doc.createElement("canvas");
    canvas.id = "igc-program";
    canvas.width = 1280;
    canvas.height = 720;
    canvas.style.display = "block";
    canvas.style.width = "100vw";
    canvas.style.height = "100vh";
    canvas.style.objectFit = "contain";
    canvas.style.background = "#000";
    body.appendChild(canvas);
  }
  return canvas;
}

export function openProgramOutputWindow(existing?: Window | null): Window | null {
  if (typeof window === "undefined") return null;
  if (existing && !existing.closed) {
    existing.focus();
    prepareProgramOutputDocument(existing.document);
    return existing;
  }
  const next = window.open(
    "about:blank",
    PROGRAM_OUTPUT_NAME,
    "popup=yes,width=1280,height=720,menubar=no,toolbar=no,location=no,status=no",
  );
  if (!next) return null;
  prepareProgramOutputDocument(next.document);
  return next;
}

export function paintProgramOutputWindow(win: Window | null | undefined, source: HTMLCanvasElement | null): boolean {
  if (!win || win.closed || !source) return false;
  const dest = win.document.getElementById("igc-program") as HTMLCanvasElement | null;
  if (!dest) return false;
  const ctx = dest.getContext("2d");
  if (!ctx) return false;
  ctx.drawImage(source, 0, 0, dest.width, dest.height);
  return true;
}

/** OBS Custom RTMP uses Stream URL and key separately. A full rtmps URL pasted as the key becomes the server. */
export function obsEncoderBlock(platformLabel: string, ingestUrl: string, streamKey: string): string {
  let server = ingestUrl.trim().replace(/\/+$/, "");
  let key = streamKey.trim();
  if (/^rtmps?:\/\//i.test(key)) {
    return [
      `OBS → Settings → Stream → Service: Custom`,
      `Server: ${key.replace(/\/+$/, "")}`,
      `Stream key: (leave empty — the key is already in the server URL)`,
    ].join("\n");
  }
  return [
    `OBS → Settings → Stream → Service: Custom`,
    `Server: ${server || "(paste the Stream URL from Destinations)"}`,
    `Stream key: ${key || `(paste the same key saved for ${platformLabel})`}`,
  ].join("\n");
}
