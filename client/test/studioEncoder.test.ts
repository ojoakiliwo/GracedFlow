import { describe, expect, it } from "vitest";
import {
  escapeFfmpegTeeUrl,
  ffmpegGoLiveCommand,
  ffmpegTeeSpec,
  unixGoLiveScript,
  windowsGoLiveBat,
} from "../src/lib/studioEncoder";

const targets = [
  { platform: "youtube", label: "YouTube", rtmp: "rtmps://a.rtmps.youtube.com/live2/yt-key" },
  { platform: "facebook", label: "Facebook", rtmp: "rtmps://live-api-s.facebook.com:443/rtmp/fb-key" },
];

describe("IGC Encoder", () => {
  it("builds one H264 encode that tees RTMP like OBS Custom stream", () => {
    const cmd = ffmpegGoLiveCommand("sermon.mp4", targets);
    expect(cmd).toContain("ffmpeg -hide_banner -re -i sermon.mp4");
    expect(cmd).toContain("libx264");
    expect(cmd).toContain("-f tee");
    expect(ffmpegTeeSpec(targets)).toContain(escapeFfmpegTeeUrl(targets[0]!.rtmp));
    expect(ffmpegTeeSpec(targets)).toContain("|");
  });

  it("writes a Windows Go live file that encodes on this computer", () => {
    const bat = windowsGoLiveBat(targets);
    expect(bat).toContain("winget install Gyan.FFmpeg");
    expect(bat).toContain("ffmpeg -hide_banner -re -i \"%~1\"");
    expect(bat).toContain("YouTube, Facebook");
    expect(bat).toContain("libx264");
  });

  it("writes a Mac Go live script", () => {
    const sh = unixGoLiveScript(targets);
    expect(sh.startsWith("#!/bin/sh")).toBe(true);
    expect(sh).toContain("brew install ffmpeg");
    expect(sh).toContain('ffmpeg -hide_banner -re -i "$1"');
  });

  it("refuses to build an encoder with no destinations", () => {
    expect(() => ffmpegGoLiveCommand("a.mp4", [])).toThrow(/destination/i);
  });
});
