export type OverlayDesignId =
  | "lower-third"
  | "verse"
  | "banner"
  | "news"
  | "prayer"
  | "title";

export type OverlayPaletteId =
  | "sanctuary"
  | "glory"
  | "linen"
  | "midnight"
  | "wine"
  | "emerald";

export type OverlayPalette = {
  id: OverlayPaletteId;
  label: string;
  hint: string;
  recommended?: boolean;
  bg: string;
  accent: string;
  text: string;
  muted: string;
};

export const OVERLAY_PALETTES: OverlayPalette[] = [
  {
    id: "sanctuary",
    label: "Sanctuary",
    hint: "Deep purple, gold edge, white type — our house look",
    recommended: true,
    bg: "rgba(20, 12, 40, 0.90)",
    accent: "#c8912f",
    text: "#ffffff",
    muted: "#e0bd6f",
  },
  {
    id: "glory",
    label: "Glory gold",
    hint: "Gold plate, royal ink — reads on bright cameras",
    recommended: true,
    bg: "rgba(200, 145, 47, 0.94)",
    accent: "#2e1065",
    text: "#1a1028",
    muted: "#4c1d95",
  },
  {
    id: "linen",
    label: "Linen prayer",
    hint: "Warm white, purple ink — choir and intercession",
    recommended: true,
    bg: "rgba(255, 250, 243, 0.94)",
    accent: "#c8912f",
    text: "#2e1065",
    muted: "#6d28d9",
  },
  {
    id: "midnight",
    label: "Midnight",
    hint: "Broadcast black, white type — news and titles",
    bg: "rgba(8, 8, 12, 0.90)",
    accent: "#e0bd6f",
    text: "#ffffff",
    muted: "#d9c7a0",
  },
  {
    id: "wine",
    label: "Altar wine",
    hint: "Crimson, cream type — communion and passion week",
    bg: "rgba(92, 18, 38, 0.92)",
    accent: "#e0bd6f",
    text: "#fff7ed",
    muted: "#f3d5a8",
  },
  {
    id: "emerald",
    label: "Olive grove",
    hint: "Deep green, cream type — thanksgiving and harvest",
    bg: "rgba(14, 46, 34, 0.92)",
    accent: "#e0bd6f",
    text: "#f4fff8",
    muted: "#c8e6c9",
  },
];

export function getOverlayPalette(id?: OverlayPaletteId | null): OverlayPalette {
  return OVERLAY_PALETTES.find((p) => p.id === id) ?? OVERLAY_PALETTES[0]!;
}

export type ProgrammeOverlay = {
  design: OverlayDesignId;
  palette: OverlayPaletteId;
  headline: string;
  body: string;
  visible: boolean;
};

export const EMPTY_OVERLAY: ProgrammeOverlay = {
  design: "lower-third",
  palette: "sanctuary",
  headline: "",
  body: "",
  visible: false,
};

export const OVERLAY_DESIGNS: {
  id: OverlayDesignId;
  label: string;
  hint: string;
  swatch: string;
}[] = [
  { id: "lower-third", label: "Lower third", hint: "Names, welcome, a short line", swatch: "#6d28d9" },
  { id: "verse", label: "Scripture card", hint: "Bible text in the centre", swatch: "#c8912f" },
  { id: "banner", label: "Announcement", hint: "News across the bottom", swatch: "#4c1d95" },
  { id: "news", label: "News bar", hint: "A slim strip at the top", swatch: "#7c3aed" },
  { id: "prayer", label: "Prayer", hint: "Soft, centred, unhurried", swatch: "#a78bfa" },
  { id: "title", label: "Title", hint: "A bold heading over the picture", swatch: "#e0bd6f" },
];

export const OVERLAY_DESIGN_WIDTH = 1280;
export const OVERLAY_DESIGN_HEIGHT = 720;

/** Keep overlay geometry proportional on 720p / 540p / 360p Program frames. */
export function overlayScale(width: number, height: number): number {
  if (width <= 0 || height <= 0) return 1;
  return Math.min(width / OVERLAY_DESIGN_WIDTH, height / OVERLAY_DESIGN_HEIGHT);
}

function scaled(n: number, scale: number, min = 1): number {
  return Math.max(min, Math.round(n * scale));
}

function breakLongToken(
  ctx: CanvasRenderingContext2D,
  token: string,
  maxWidth: number,
): string[] {
  if (maxWidth <= 0 || ctx.measureText(token).width <= maxWidth) return [token];
  const parts: string[] = [];
  let chunk = "";
  for (const ch of token) {
    const trial = chunk + ch;
    if (chunk && ctx.measureText(trial).width > maxWidth) {
      parts.push(chunk);
      chunk = ch;
    } else {
      chunk = trial;
    }
  }
  if (chunk) parts.push(chunk);
  return parts.length ? parts : [token];
}

export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const paragraphs = text.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length === 0) return [];
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;
    let line = "";
    for (const word of words) {
      for (const piece of breakLongToken(ctx, word, maxWidth)) {
        const next = line ? `${line} ${piece}` : piece;
        if (line && ctx.measureText(next).width > maxWidth) {
          lines.push(line);
          line = piece;
        } else {
          line = next;
        }
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

/** Shrink the font until every line of copy fits in the box. */
export function fitWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxHeight: number,
  fontFamily: string,
  opts?: { maxFont?: number; minFont?: number },
): { lines: string[]; fontSize: number; lineHeight: number } {
  const maxFont = Math.max(8, Math.round(opts?.maxFont ?? 28));
  const minFont = Math.max(8, Math.round(opts?.minFont ?? Math.min(12, maxFont)));
  const widthOk = (lines: string[]) =>
    lines.every((line) => ctx.measureText(line).width <= maxWidth + 0.5);
  let chosen = {
    lines: [] as string[],
    fontSize: minFont,
    lineHeight: Math.max(minFont + 2, Math.round(minFont * 1.32)),
  };
  for (let fontSize = maxFont; fontSize >= minFont; fontSize--) {
    const lineHeight = Math.max(fontSize + 2, Math.round(fontSize * 1.32));
    ctx.font = `400 ${fontSize}px ${fontFamily}`;
    const lines = wrapText(ctx, text, maxWidth);
    chosen = { lines, fontSize, lineHeight };
    if (widthOk(lines) && lines.length * lineHeight <= maxHeight) return chosen;
  }
  const maxLines = Math.max(1, Math.floor(maxHeight / chosen.lineHeight));
  const lines = chosen.lines.slice(0, maxLines);
  if (chosen.lines.length > maxLines && lines.length) {
    const last = lines[maxLines - 1]!.replace(/\s+\S*$/, "").trimEnd();
    lines[maxLines - 1] = `${last || lines[maxLines - 1]}…`;
  }
  return { ...chosen, lines };
}

export function verseCardLayout(width: number, height: number) {
  const scale = overlayScale(width, height);
  const margin = scaled(28, scale, 12);
  const padX = scaled(36, scale, 14);
  const padY = scaled(22, scale, 10);
  const titleSize = scaled(20, scale, 11);
  const titleGap = scaled(14, scale, 8);
  const boxW = Math.min(scaled(1040, scale, 160), Math.round(width * 0.88));
  const x = (width - boxW) / 2;
  const maxBoxH = Math.max(scaled(120, scale, 64), height - margin * 2);
  const innerW = Math.max(40, boxW - padX * 2);
  const headerH = titleSize + titleGap;
  const innerH = Math.max(titleSize, maxBoxH - padY * 2 - headerH);
  return {
    scale,
    margin,
    padX,
    padY,
    titleSize,
    titleGap,
    boxW,
    x,
    maxBoxH,
    innerW,
    headerH,
    innerH,
  };
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

export function drawProgrammeOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  overlay: ProgrammeOverlay | null,
  opts?: { stage?: boolean },
) {
  if (!overlay) return;
  const headline = overlay.headline.trim();
  const body = overlay.body.trim();
  const show = opts?.stage ? Boolean(headline || body) : overlay.visible;
  if (!show || (!headline && !body)) return;
  const pal = getOverlayPalette(overlay.palette);

  const s = overlayScale(width, height);
  const px = (n: number, min = 1) => scaled(n, s, min);

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = "none";
  ctx.textBaseline = "top";

  if (overlay.design === "lower-third") {
    const boxW = Math.min(px(720, 200), width * 0.62);
    const boxH = px(112, 56);
    const x = px(48, 16);
    const y = Math.max(px(8, 4), height - boxH - px(56, 16));
    const accentW = px(8, 4);
    const inset = x + px(28, 12);
    const maxCopy = Math.max(40, boxW - px(48, 20));
    roundRect(ctx, x, y, boxW, boxH, px(16, 8));
    ctx.fillStyle = pal.bg;
    ctx.fill();
    ctx.fillStyle = pal.accent;
    ctx.fillRect(x, y, accentW, boxH);
    ctx.font = `600 ${px(32, 14)}px Fraunces, Georgia, serif`;
    ctx.fillStyle = pal.text;
    const head = wrapText(ctx, headline, maxCopy)[0] ?? headline;
    ctx.fillText(head, inset, y + px(22, 10));
    ctx.font = `400 ${px(20, 11)}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = pal.muted;
    const lines = wrapText(ctx, body || "Infinitely Graced Church", maxCopy);
    ctx.fillText(lines[0] ?? "", inset, y + px(66, 32));
  } else if (overlay.design === "verse") {
    const layout = verseCardLayout(width, height);
    const copy = body || headline;
    const family = "Fraunces, Georgia, serif";
    const fitted = fitWrappedText(ctx, copy, layout.innerW, layout.innerH, family, {
      maxFont: scaled(28, layout.scale, 12),
      minFont: scaled(12, layout.scale, 8),
    });
    const contentH = layout.headerH + fitted.lines.length * fitted.lineHeight;
    const boxH = Math.min(layout.maxBoxH, layout.padY * 2 + contentH);
    const y = Math.max(layout.margin, (height - boxH) / 2);
    roundRect(ctx, layout.x, y, layout.boxW, boxH, px(20, 10));
    ctx.fillStyle = pal.bg;
    ctx.fill();
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = Math.max(2, px(3, 2));
    ctx.stroke();
    ctx.save();
    roundRect(ctx, layout.x, y, layout.boxW, boxH, px(20, 10));
    if (typeof ctx.clip === "function") ctx.clip();
    ctx.textAlign = "center";
    ctx.fillStyle = pal.muted;
    ctx.font = `600 ${layout.titleSize}px Inter, system-ui, sans-serif`;
    ctx.fillText(headline || "Holy Scripture", width / 2, y + layout.padY);
    ctx.fillStyle = pal.text;
    ctx.font = `400 ${fitted.fontSize}px ${family}`;
    const bodyTop = y + layout.padY + layout.headerH;
    fitted.lines.forEach((line, i) => {
      ctx.fillText(line, width / 2, bodyTop + i * fitted.lineHeight);
    });
    ctx.restore();
  } else if (overlay.design === "banner") {
    const barH = px(132, 64);
    const inset = px(40, 16);
    const maxCopy = Math.max(40, width - px(80, 32));
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, height - barH, width, barH);
    ctx.fillStyle = pal.accent;
    ctx.fillRect(0, height - barH - px(4, 2), width, px(6, 3));
    ctx.font = `600 ${px(34, 16)}px Fraunces, Georgia, serif`;
    ctx.fillStyle = pal.text;
    const head = wrapText(ctx, headline, maxCopy)[0] ?? headline;
    ctx.fillText(head, inset, height - barH + px(24, 10));
    ctx.font = `400 ${px(22, 12)}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = pal.muted;
    const lines = wrapText(ctx, body, maxCopy);
    ctx.fillText(lines[0] ?? "", inset, height - barH + px(72, 34));
  } else if (overlay.design === "news") {
    const barH = px(72, 40);
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, width, barH);
    ctx.fillStyle = pal.accent;
    ctx.fillRect(0, barH, width, px(4, 2));
    ctx.font = `700 ${px(18, 11)}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = pal.accent;
    ctx.fillText("NEWS", px(28, 12), px(24, 12));
    ctx.font = `500 ${px(26, 13)}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = pal.text;
    const news = wrapText(ctx, [headline, body].filter(Boolean).join("  ·  "), width - px(140, 60));
    ctx.fillText(news[0] ?? "", px(110, 52), px(22, 11));
  } else if (overlay.design === "prayer") {
    const boxW = Math.min(px(820, 220), width * 0.7);
    const family = "Fraunces, Georgia, serif";
    const innerW = Math.max(40, boxW - px(60, 24));
    const fitted = fitWrappedText(ctx, body || headline, innerW, px(180, 80), family, {
      maxFont: px(26, 13),
      minFont: px(14, 9),
    });
    const boxH = px(80, 40) + fitted.lines.length * fitted.lineHeight;
    const x = (width - boxW) / 2;
    const y = Math.max(px(16, 8), height - boxH - px(48, 16));
    roundRect(ctx, x, y, boxW, boxH, px(18, 8));
    ctx.fillStyle = pal.bg;
    ctx.fill();
    ctx.save();
    roundRect(ctx, x, y, boxW, boxH, px(18, 8));
    if (typeof ctx.clip === "function") ctx.clip();
    ctx.textAlign = "center";
    ctx.fillStyle = pal.muted;
    ctx.font = `600 ${px(18, 11)}px Inter, system-ui, sans-serif`;
    ctx.fillText(headline || "Let us pray", width / 2, y + px(20, 10));
    ctx.fillStyle = pal.text;
    ctx.font = `italic ${fitted.fontSize}px ${family}`;
    fitted.lines.forEach((line, i) => {
      ctx.fillText(line, width / 2, y + px(52, 26) + i * fitted.lineHeight);
    });
    ctx.restore();
  } else {
    ctx.textAlign = "center";
    const maxCopy = width * 0.9;
    ctx.font = `700 ${px(56, 22)}px Fraunces, Georgia, serif`;
    const head = wrapText(ctx, headline, maxCopy)[0] ?? headline;
    const y = height * 0.38;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillText(head, width / 2 + 3, y + 3);
    ctx.fillStyle = pal.text;
    ctx.fillText(head, width / 2, y);
    if (body) {
      ctx.font = `400 ${px(26, 13)}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = pal.muted;
      const sub = wrapText(ctx, body, maxCopy)[0] ?? body;
      ctx.fillText(sub, width / 2, y + px(72, 32));
    }
    ctx.textAlign = "left";
  }
  ctx.restore();
}

export function suggestDesigns(headline: string, body: string): OverlayDesignId[] {
  const h = headline.trim();
  const b = body.trim();
  const text = `${h} ${b}`.toLowerCase();
  if (!h && !b) return ["lower-third", "banner", "title"];
  if (/\b(john|psalm|genesis|romans|matthew|luke|acts|corinthians|verse)\b/.test(text) || /^\d/.test(b)) {
    return ["verse", "lower-third", "prayer"];
  }
  if (/\b(pray|prayer|intercede)\b/.test(text)) return ["prayer", "lower-third", "title"];
  if (h.length <= 28 && !b) return ["title", "news", "lower-third"];
  if (h.length > 40 || b.length > 80) return ["banner", "news", "verse"];
  return ["lower-third", "banner", "news"];
}
