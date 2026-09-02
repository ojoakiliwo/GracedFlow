export const PROGRAM_OUTPUT_NAME = "igc-program";
export const PROGRAM_OUTPUT_TITLE = "IGC Program";

export function programOutputHtml(): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${PROGRAM_OUTPUT_TITLE}</title>
<style>
  html, body { margin: 0; background: #000; height: 100%; overflow: hidden; }
  canvas { display: block; width: 100vw; height: 100vh; object-fit: contain; background: #000; }
</style>
</head>
<body>
<canvas id="igc-program" width="1280" height="720"></canvas>
</body>
</html>`;
}

export function openProgramOutputWindow(existing?: Window | null): Window | null {
  if (typeof window === "undefined") return null;
  if (existing && !existing.closed) {
    try {
      existing.close();
    } catch {
      // Replace a leftover empty popup.
    }
  }
  const url = URL.createObjectURL(new Blob([programOutputHtml()], { type: "text/html" }));
  const next = window.open(
    url,
    PROGRAM_OUTPUT_NAME,
    "popup=yes,width=1280,height=720,menubar=no,toolbar=no,location=no,status=no",
  );
  if (!next) {
    URL.revokeObjectURL(url);
    return null;
  }
  next.addEventListener("load", () => URL.revokeObjectURL(url), { once: true });
  return next;
}

export function paintProgramOutputWindow(win: Window | null | undefined, source: HTMLCanvasElement | null): boolean {
  if (!win || win.closed) return false;
  const dest = win.document.getElementById("igc-program") as HTMLCanvasElement | null;
  if (!dest || !source) return true;
  const ctx = dest.getContext("2d");
  if (!ctx) return true;
  ctx.drawImage(source, 0, 0, dest.width, dest.height);
  return true;
}

/** OBS Custom RTMP uses Stream URL and key separately. A full rtmps URL pasted as the key becomes the server. */
export function obsEncoderBlock(platformLabel: string, ingestUrl: string, streamKey: string): string {
  const server = ingestUrl.trim().replace(/\/+$/, "");
  const key = streamKey.trim();
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
