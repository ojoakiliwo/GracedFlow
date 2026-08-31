export type OverlayDesignId =
  | "lower-third"
  | "verse"
  | "banner"
  | "news"
  | "prayer"
  | "title";

export type ProgrammeOverlay = {
  design: OverlayDesignId;
  headline: string;
  body: string;
  visible: boolean;
};

export const EMPTY_OVERLAY: ProgrammeOverlay = {
  design: "lower-third",
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
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
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
  return lines;
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
) {
  if (!overlay || !overlay.visible) return;
  const headline = overlay.headline.trim();
  const body = overlay.body.trim();
  if (!headline && !body) return;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = "none";
  ctx.textBaseline = "top";

  if (overlay.design === "lower-third") {
    const boxW = Math.min(720, width * 0.62);
    const x = 48;
    const y = height - 168;
    roundRect(ctx, x, y, boxW, 112, 16);
    ctx.fillStyle = "rgba(46, 16, 101, 0.92)";
    ctx.fill();
    ctx.fillStyle = "#c8912f";
    ctx.fillRect(x, y, 8, 112);
    ctx.font = "600 32px Fraunces, Georgia, serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(headline.slice(0, 48), x + 28, y + 22);
    ctx.font = "400 20px Inter, system-ui, sans-serif";
    ctx.fillStyle = "#e0bd6f";
    const lines = wrapText(ctx, body || "Infinitely Graced Church", boxW - 48);
    ctx.fillText(lines[0] ?? "", x + 28, y + 66);
  } else if (overlay.design === "verse") {
    const boxW = Math.min(900, width * 0.78);
    const x = (width - boxW) / 2;
    ctx.font = "400 28px Fraunces, Georgia, serif";
    const bodyLines = wrapText(ctx, body || headline, boxW - 80).slice(0, 6);
    const boxH = 92 + bodyLines.length * 36 + (headline ? 36 : 0);
    const y = (height - boxH) / 2;
    roundRect(ctx, x, y, boxW, boxH, 20);
    ctx.fillStyle = "rgba(20, 12, 40, 0.88)";
    ctx.fill();
    ctx.strokeStyle = "#c8912f";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#e0bd6f";
    ctx.font = "600 22px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(headline || "Holy Scripture", width / 2, y + 28);
    ctx.fillStyle = "#f8f5ff";
    ctx.font = "400 28px Fraunces, Georgia, serif";
    bodyLines.forEach((line, i) => {
      ctx.fillText(line, width / 2, y + 70 + i * 36);
    });
    ctx.textAlign = "left";
  } else if (overlay.design === "banner") {
    ctx.fillStyle = "rgba(46, 16, 101, 0.9)";
    ctx.fillRect(0, height - 132, width, 132);
    ctx.fillStyle = "#c8912f";
    ctx.fillRect(0, height - 136, width, 6);
    ctx.font = "600 34px Fraunces, Georgia, serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(headline.slice(0, 60), 40, height - 108);
    ctx.font = "400 22px Inter, system-ui, sans-serif";
    ctx.fillStyle = "#e8d9a8";
    const lines = wrapText(ctx, body, width - 80);
    ctx.fillText(lines[0] ?? "", 40, height - 60);
  } else if (overlay.design === "news") {
    ctx.fillStyle = "rgba(12, 8, 28, 0.86)";
    ctx.fillRect(0, 0, width, 72);
    ctx.fillStyle = "#c8912f";
    ctx.fillRect(0, 72, width, 4);
    ctx.font = "700 18px Inter, system-ui, sans-serif";
    ctx.fillStyle = "#c8912f";
    ctx.fillText("NEWS", 28, 24);
    ctx.font = "500 26px Inter, system-ui, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText([headline, body].filter(Boolean).join("  ·  ").slice(0, 90), 110, 22);
  } else if (overlay.design === "prayer") {
    const boxW = Math.min(820, width * 0.7);
    ctx.font = "italic 28px Fraunces, Georgia, serif";
    const lines = wrapText(ctx, body || headline, boxW - 60).slice(0, 5);
    const boxH = 80 + lines.length * 36;
    const x = (width - boxW) / 2;
    const y = height - boxH - 48;
    roundRect(ctx, x, y, boxW, boxH, 18);
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fill();
    ctx.textAlign = "center";
    ctx.fillStyle = "#6d28d9";
    ctx.font = "600 18px Inter, system-ui, sans-serif";
    ctx.fillText(headline || "Let us pray", width / 2, y + 20);
    ctx.fillStyle = "#2e1065";
    ctx.font = "italic 26px Fraunces, Georgia, serif";
    lines.forEach((line, i) => ctx.fillText(line, width / 2, y + 52 + i * 36));
    ctx.textAlign = "left";
  } else {
    ctx.textAlign = "center";
    ctx.font = "700 56px Fraunces, Georgia, serif";
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillText(headline.slice(0, 40), width / 2 + 3, height * 0.38 + 3);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(headline.slice(0, 40), width / 2, height * 0.38);
    if (body) {
      ctx.font = "400 26px Inter, system-ui, sans-serif";
      ctx.fillStyle = "#e0bd6f";
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
