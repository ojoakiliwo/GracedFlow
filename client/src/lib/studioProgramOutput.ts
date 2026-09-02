export const PROGRAM_OUTPUT_NAME = "igc-program";
export const PROGRAM_OUTPUT_TITLE = "IGC Program";

export function prepareProgramOutputDocument(doc: Document): HTMLCanvasElement {
  doc.open();
  doc.write(`<!doctype html>
<title>${PROGRAM_OUTPUT_TITLE}</title>
<style>
  html, body { margin: 0; background: #000; height: 100%; overflow: hidden; }
  canvas { display: block; width: 100vw; height: 100vh; object-fit: contain; background: #000; }
</style>
<canvas id="igc-program" width="1280" height="720"></canvas>`);
  doc.close();
  return doc.getElementById("igc-program") as HTMLCanvasElement;
}

export function openProgramOutputWindow(existing?: Window | null): Window | null {
  if (typeof window === "undefined") return null;
  if (existing && !existing.closed) {
    existing.focus();
    if (!existing.document.getElementById("igc-program")) {
      prepareProgramOutputDocument(existing.document);
    }
    return existing;
  }
  const next = window.open(
    "",
    PROGRAM_OUTPUT_NAME,
    "popup=yes,width=1280,height=720,menubar=no,toolbar=no,location=no,status=no",
  );
  if (!next) return null;
  prepareProgramOutputDocument(next.document);
  next.addEventListener("load", () => {
    if (!next.document.getElementById("igc-program")) prepareProgramOutputDocument(next.document);
  });
  return next;
}

export function paintProgramOutputWindow(win: Window | null | undefined, source: HTMLCanvasElement | null): boolean {
  if (!win || win.closed) return false;
  let dest = win.document.getElementById("igc-program") as HTMLCanvasElement | null;
  if (!dest) dest = prepareProgramOutputDocument(win.document);
  if (!dest || !source) return Boolean(dest);
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
