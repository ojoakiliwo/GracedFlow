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
    let line = words[0]!;
    for (let i = 1; i < words.length; i++) {
      const next = `${line} ${words[i]}`;
      if (ctx.measureText(next).width <= maxWidth) line = next;
      else {
        lines.push(line);
        line = words[i]!;
      }
    }
    lines.push(line);
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
): { lines: string[]; fontSize: number; lineHeight: number } {
  const sizes = [28, 24, 20, 18, 16, 14];
  let chosen = { lines: [] as string[], fontSize: 14, lineHeight: 20 };
  for (const fontSize of sizes) {
    const lineHeight = Math.round(fontSize * 1.3);
    ctx.font = `400 ${fontSize}px ${fontFamily}`;
    const lines = wrapText(ctx, text, maxWidth);
    chosen = { lines, fontSize, lineHeight };
    if (lines.length * lineHeight <= maxHeight) return chosen;
  }
  const maxLines = Math.max(1, Math.floor(maxHeight / chosen.lineHeight));
  return { ...chosen, lines: chosen.lines.slice(0, maxLines) };
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

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = "none";
  ctx.textBaseline = "top";

  if (overlay.design === "lower-third") {
    const boxW = Math.min(720, width * 0.62);
    const x = 48;
    const y = height - 168;
    roundRect(ctx, x, y, boxW, 112, 16);
    ctx.fillStyle = pal.bg;
    ctx.fill();
    ctx.fillStyle = pal.accent;
    ctx.fillRect(x, y, 8, 112);
    ctx.font = "600 32px Fraunces, Georgia, serif";
    ctx.fillStyle = pal.text;
    ctx.fillText(headline.slice(0, 48), x + 28, y + 22);
    ctx.font = "400 20px Inter, system-ui, sans-serif";
    ctx.fillStyle = pal.muted;
    const lines = wrapText(ctx, body || "Infinitely Graced Church", boxW - 48);
    ctx.fillText(lines[0] ?? "", x + 28, y + 66);
  } else if (overlay.design === "verse") {
    const boxW = Math.min(1040, width * 0.88);
    const x = (width - boxW) / 2;
    const copy = body || headline;
    const family = "Fraunces, Georgia, serif";
    const maxTextH = height * 0.62;
    const fitted = fitWrappedText(ctx, copy, boxW - 72, maxTextH, family);
    const boxH = Math.min(height - 48, 80 + fitted.lines.length * fitted.lineHeight + 20);
    const y = Math.max(24, (height - boxH) / 2);
    roundRect(ctx, x, y, boxW, boxH, 20);
    ctx.fillStyle = pal.bg;
    ctx.fill();
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = pal.muted;
    ctx.font = "600 20px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(headline || "Holy Scripture", width / 2, y + 18);
    ctx.fillStyle = pal.text;
    ctx.font = `400 ${fitted.fontSize}px ${family}`;
    fitted.lines.forEach((line, i) => {
      ctx.fillText(line, width / 2, y + 52 + i * fitted.lineHeight);
    });
    ctx.textAlign = "left";
  } else if (overlay.design === "banner") {
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, height - 132, width, 132);
    ctx.fillStyle = pal.accent;
    ctx.fillRect(0, height - 136, width, 6);
    ctx.font = "600 34px Fraunces, Georgia, serif";
    ctx.fillStyle = pal.text;
    ctx.fillText(headline.slice(0, 60), 40, height - 108);
    ctx.font = "400 22px Inter, system-ui, sans-serif";
    ctx.fillStyle = pal.muted;
    const lines = wrapText(ctx, body, width - 80);
    ctx.fillText(lines[0] ?? "", 40, height - 60);
  } else if (overlay.design === "news") {
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, width, 72);
    ctx.fillStyle = pal.accent;
    ctx.fillRect(0, 72, width, 4);
    ctx.font = "700 18px Inter, system-ui, sans-serif";
    ctx.fillStyle = pal.accent;
    ctx.fillText("NEWS", 28, 24);
    ctx.font = "500 26px Inter, system-ui, sans-serif";
    ctx.fillStyle = pal.text;
    ctx.fillText([headline, body].filter(Boolean).join("  ·  ").slice(0, 90), 110, 22);
  } else if (overlay.design === "prayer") {
    const boxW = Math.min(820, width * 0.7);
    ctx.font = "italic 28px Fraunces, Georgia, serif";
    const lines = wrapText(ctx, body || headline, boxW - 60).slice(0, 5);
    const boxH = 80 + lines.length * 36;
    const x = (width - boxW) / 2;
    const y = height - boxH - 48;
    roundRect(ctx, x, y, boxW, boxH, 18);
    ctx.fillStyle = pal.bg;
    ctx.fill();
    ctx.textAlign = "center";
    ctx.fillStyle = pal.muted;
    ctx.font = "600 18px Inter, system-ui, sans-serif";
    ctx.fillText(headline || "Let us pray", width / 2, y + 20);
    ctx.fillStyle = pal.text;
    ctx.font = "italic 26px Fraunces, Georgia, serif";
    lines.forEach((line, i) => ctx.fillText(line, width / 2, y + 52 + i * 36));
    ctx.textAlign = "left";
  } else {
    ctx.textAlign = "center";
    ctx.font = "700 56px Fraunces, Georgia, serif";
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillText(headline.slice(0, 40), width / 2 + 3, height * 0.38 + 3);
    ctx.fillStyle = pal.text;
    ctx.fillText(headline.slice(0, 40), width / 2, height * 0.38);
    if (body) {
      ctx.font = "400 26px Inter, system-ui, sans-serif";
      ctx.fillStyle = pal.muted;
      ctx.fillText(body.slice(0, 80), width / 2, height * 0.38 + 72);
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
