import {
  drawProgrammeOverlay,
  type ProgrammeOverlay,
} from "./studioOverlays";
import type { VideoAutoState } from "./studioEngine";

export type PictureKind = "camera" | "file-video" | "still" | "black";
export type SoundKind = "mic" | "file-audio" | "file-video" | "silent";
export type MediaSlot = "video" | "picture" | "audio";
export type MediaUse = "picture" | "sound" | "both";

export const PROGRAM_AUDIO_MISSING =
  "Program has no audio track. Pick any audio input in Sources, send recorded sound, or choose Silent, then go live.";

export const RECORDING_AUDIO_MISSING =
  "Recording did not get an audio track. Pick any audio input, send recorded sound, or choose Silent, then record again.";

export type StudioClip = {
  name: string;
  url: string;
  durationSec: number | null;
};

export type MediaLoaded = {
  hasVideoFile: boolean;
  hasStill: boolean;
  hasAudioFile: boolean;
};

export type PictureLook = {
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number;
};

export type PictureFrame = {
  video: HTMLVideoElement | null;
  image: HTMLImageElement | null;
  mirror: boolean;
  fit: "fill" | "contain";
};

const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogv|mkv)$/i;
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;
const AUDIO_EXT = /\.(mp3|wav|m4a|aac|ogg|flac|opus|weba)$/i;

export function classifyMediaFile(file: { type?: string; name: string }): MediaSlot | null {
  const type = (file.type || "").toLowerCase();
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("image/")) return "picture";
  if (type.startsWith("audio/")) return "audio";
  if (VIDEO_EXT.test(file.name)) return "video";
  if (IMAGE_EXT.test(file.name)) return "picture";
  if (AUDIO_EXT.test(file.name)) return "audio";
  return null;
}

export function pictureFit(kind: PictureKind): "fill" | "contain" {
  return kind === "camera" ? "fill" : "contain";
}

export function shouldMirrorPicture(kind: PictureKind, lookMirror: boolean): boolean {
  return kind === "camera" && lookMirror;
}

export function shouldAdaptExposure(kind: PictureKind): boolean {
  return kind === "camera";
}

export function programNeedsCamera(kind: PictureKind): boolean {
  return kind === "camera";
}

export function programNeedsMic(kind: SoundKind): boolean {
  return kind === "mic";
}

export function pictureKindLabel(kind: PictureKind): string {
  if (kind === "file-video") return "Recorded video";
  if (kind === "still") return "Picture";
  if (kind === "black") return "Black frame";
  return "Camera";
}

export function soundKindLabel(kind: SoundKind): string {
  if (kind === "file-audio") return "Recorded audio";
  if (kind === "file-video") return "Video soundtrack";
  if (kind === "silent") return "Silent";
  return "Selected audio input";
}

export function formatClipClock(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "00:00";
  const whole = Math.floor(sec);
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function containRect(
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): { x: number; y: number; w: number; h: number } {
  if (srcW <= 0 || srcH <= 0 || dstW <= 0 || dstH <= 0) {
    return { x: 0, y: 0, w: Math.max(0, dstW), h: Math.max(0, dstH) };
  }
  const scale = Math.min(dstW / srcW, dstH / srcH);
  const w = srcW * scale;
  const h = srcH * scale;
  return { x: (dstW - w) / 2, y: (dstH - h) / 2, w, h };
}

export function mediaReady(
  picture: PictureKind,
  sound: SoundKind,
  loaded: MediaLoaded,
): { ok: true } | { ok: false; reason: string } {
  if (picture === "file-video" && !loaded.hasVideoFile) {
    return { ok: false, reason: "Choose a recorded video first." };
  }
  if (picture === "still" && !loaded.hasStill) {
    return { ok: false, reason: "Choose a picture first." };
  }
  if (sound === "file-audio" && !loaded.hasAudioFile) {
    return { ok: false, reason: "Choose recorded audio first." };
  }
  if (sound === "file-video" && !loaded.hasVideoFile) {
    return { ok: false, reason: "Choose a recorded video first." };
  }
  return { ok: true };
}

export function applyMediaUse(
  slot: MediaSlot,
  use: MediaUse,
  current: { picture: PictureKind; sound: SoundKind },
): { picture: PictureKind; sound: SoundKind } {
  if (slot === "video") {
    if (use === "both") return { picture: "file-video", sound: "file-video" };
    if (use === "picture") return { picture: "file-video", sound: current.sound };
    return { picture: current.picture, sound: "file-video" };
  }
  if (slot === "picture") {
    return { picture: "still", sound: current.sound };
  }
  return { picture: current.picture, sound: "file-audio" };
}

/** Audio-only from the media room: keep a still or video if loaded, otherwise a black frame. */
export function audioOnlyPicture(current: PictureKind): PictureKind {
  return current === "camera" ? "black" : current;
}

export function isLiveAudioTrack(track: { kind: string; readyState: string }): boolean {
  return track.kind === "audio" && track.readyState === "live";
}

/** Outgoing WHIP/record streams must not stop Program destination tracks. */
export function tracksToStop<T>(tracks: T[], preserve: Iterable<T>): T[] {
  const keep = new Set(preserve);
  return tracks.filter((track) => !keep.has(track));
}

export function ensureStudioCanvas(canvas: HTMLCanvasElement) {
  if (canvas.width < 960 || canvas.height < 540) {
    canvas.width = 1280;
    canvas.height = 720;
  }
}

function sourceSize(frame: PictureFrame): { w: number; h: number } | null {
  if (frame.image && frame.image.complete && frame.image.naturalWidth > 0) {
    return { w: frame.image.naturalWidth, h: frame.image.naturalHeight };
  }
  if (frame.video && frame.video.readyState >= 2 && frame.video.videoWidth > 0) {
    return { w: frame.video.videoWidth, h: frame.video.videoHeight };
  }
  return null;
}

function sourceElement(frame: PictureFrame): CanvasImageSource | null {
  if (frame.image && frame.image.complete && frame.image.naturalWidth > 0) return frame.image;
  if (frame.video && frame.video.readyState >= 2 && frame.video.videoWidth > 0) return frame.video;
  return null;
}

export function paintStudioMonitor(
  canvas: HTMLCanvasElement | null,
  frame: PictureFrame,
  overlay: ProgrammeOverlay,
  lookNow: PictureLook,
  auto: VideoAutoState,
  stage: boolean,
) {
  if (!canvas) return;
  ensureStudioCanvas(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const brightness = lookNow.brightness * auto.brightness;
  const contrast = lookNow.contrast * auto.contrast;
  ctx.fillStyle = "#0b0b10";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const el = sourceElement(frame);
  const size = sourceSize(frame);
  if (el && size) {
    ctx.save();
    if (frame.mirror) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.filter = `brightness(${brightness}) contrast(${contrast}) saturate(${lookNow.saturation}) sepia(${Math.max(0, lookNow.warmth) * 0.28})`;
    if (frame.fit === "fill") {
      ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
    } else {
      const box = containRect(size.w, size.h, canvas.width, canvas.height);
      ctx.drawImage(el, box.x, box.y, box.w, box.h);
    }
    ctx.restore();
    ctx.filter = "none";
  }
  drawProgrammeOverlay(ctx, canvas.width, canvas.height, overlay, { stage });
}
