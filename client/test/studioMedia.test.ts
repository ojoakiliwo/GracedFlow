import { describe, expect, it } from "vitest";
import {
  applyMediaUse,
  audioOnlyPicture,
  classifyMediaFile,
  containRect,
  formatClipClock,
  mediaReady,
  pictureFit,
  pictureKindLabel,
  programNeedsCamera,
  programNeedsMic,
  shouldAdaptExposure,
  shouldMirrorPicture,
  soundKindLabel,
} from "../src/lib/studioMedia";

describe("Recorded media room", () => {
  it("classifies video, picture, and audio independently from type or name", () => {
    expect(classifyMediaFile({ type: "video/mp4", name: "sermon.mp4" })).toBe("video");
    expect(classifyMediaFile({ type: "image/png", name: "slide.png" })).toBe("picture");
    expect(classifyMediaFile({ type: "audio/mpeg", name: "worship.mp3" })).toBe("audio");
    expect(classifyMediaFile({ type: "", name: "announcement.webm" })).toBe("video");
    expect(classifyMediaFile({ type: "", name: "banner.JPEG" })).toBe("picture");
    expect(classifyMediaFile({ type: "", name: "bed.m4a" })).toBe("audio");
    expect(classifyMediaFile({ type: "", name: "notes.txt" })).toBeNull();
  });

  it("sends a recorded video as picture, sound, or both without forcing the other slot", () => {
    const desk = { picture: "camera" as const, sound: "mic" as const };
    expect(applyMediaUse("video", "picture", desk)).toEqual({ picture: "file-video", sound: "mic" });
    expect(applyMediaUse("video", "sound", desk)).toEqual({ picture: "camera", sound: "file-video" });
    expect(applyMediaUse("video", "both", desk)).toEqual({ picture: "file-video", sound: "file-video" });
  });

  it("lets a still and recorded audio go to Program independently", () => {
    const desk = { picture: "camera" as const, sound: "mic" as const };
    const withStill = applyMediaUse("picture", "picture", desk);
    expect(withStill).toEqual({ picture: "still", sound: "mic" });
    expect(applyMediaUse("audio", "sound", withStill)).toEqual({ picture: "still", sound: "file-audio" });
    expect(applyMediaUse("audio", "sound", desk)).toEqual({ picture: "camera", sound: "file-audio" });
  });

  it("uses a black frame for audio-only when the camera is not the intended picture", () => {
    expect(audioOnlyPicture("camera")).toBe("black");
    expect(audioOnlyPicture("still")).toBe("still");
    expect(audioOnlyPicture("file-video")).toBe("file-video");
    expect(audioOnlyPicture("black")).toBe("black");
  });

  it("does not ask for a camera or desk mic when Program is file or silent", () => {
    expect(programNeedsCamera("camera")).toBe(true);
    expect(programNeedsCamera("still")).toBe(false);
    expect(programNeedsCamera("file-video")).toBe(false);
    expect(programNeedsCamera("black")).toBe(false);
    expect(programNeedsMic("mic")).toBe(true);
    expect(programNeedsMic("file-audio")).toBe(false);
    expect(programNeedsMic("file-video")).toBe(false);
    expect(programNeedsMic("silent")).toBe(false);
  });

  it("blocks going to Program until the chosen file is loaded", () => {
    const empty = { hasVideoFile: false, hasStill: false, hasAudioFile: false };
    expect(mediaReady("file-video", "silent", empty).ok).toBe(false);
    expect(mediaReady("still", "silent", empty).ok).toBe(false);
    expect(mediaReady("black", "file-audio", empty).ok).toBe(false);
    expect(mediaReady("black", "silent", empty)).toEqual({ ok: true });
    expect(
      mediaReady("still", "file-audio", { hasVideoFile: false, hasStill: true, hasAudioFile: true }),
    ).toEqual({ ok: true });
  });

  it("letterboxes recorded pictures instead of stretching them", () => {
    expect(pictureFit("camera")).toBe("fill");
    expect(pictureFit("still")).toBe("contain");
    expect(pictureFit("file-video")).toBe("contain");
    const box = containRect(1920, 1080, 1280, 720);
    expect(box).toEqual({ x: 0, y: 0, w: 1280, h: 720 });
    const portrait = containRect(1080, 1920, 1280, 720);
    expect(portrait.w).toBeCloseTo(405, 0);
    expect(portrait.h).toBeCloseTo(720, 0);
    expect(portrait.x).toBeGreaterThan(400);
    expect(containRect(0, 0, 1280, 720)).toEqual({ x: 0, y: 0, w: 1280, h: 720 });
  });

  it("mirrors and auto-exposes only the live camera", () => {
    expect(shouldMirrorPicture("camera", true)).toBe(true);
    expect(shouldMirrorPicture("still", true)).toBe(false);
    expect(shouldMirrorPicture("file-video", true)).toBe(false);
    expect(shouldAdaptExposure("camera")).toBe(true);
    expect(shouldAdaptExposure("still")).toBe(false);
  });

  it("labels sources for the operator", () => {
    expect(pictureKindLabel("file-video")).toBe("Recorded video");
    expect(soundKindLabel("file-audio")).toBe("Recorded audio");
    expect(soundKindLabel("silent")).toBe("Silent");
    expect(formatClipClock(125)).toBe("02:05");
    expect(formatClipClock(-1)).toBe("00:00");
  });
});
