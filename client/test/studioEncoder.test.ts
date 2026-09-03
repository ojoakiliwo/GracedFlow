import { describe, expect, it } from "vitest";
import {
  escapeFfmpegTeeUrl,
  ffmpegGoLiveCommand,
  ffmpegTeeSpec,
  ffmpegVideoFlags,
  unixCameraScript,
  unixGoLiveScript,
  windowsCameraBat,
  windowsGoLiveBat,
  youtubeOnly,
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
    expect(cmd).toContain("ultrafast");
    expect(cmd).toContain("zerolatency");
    expect(cmd).toContain("-bf 0");
    expect(cmd).toContain("-b:v 1500k");
    expect(cmd).toContain("-map 0:v:0");
    expect(cmd).toContain("-map 0:a:0?");
    expect(cmd).toContain("-f tee");
    expect(ffmpegTeeSpec(targets)).toContain("[f=flv:onfail=ignore]");
    expect(ffmpegTeeSpec(targets)).toContain(escapeFfmpegTeeUrl(targets[0]!.rtmp));
    expect(ffmpegTeeSpec(targets)).toContain("|");
  });

  it("writes a Windows Go live file that opens a picker and encodes on this computer", () => {
    const bat = windowsGoLiveBat(targets);
    expect(bat).toContain("winget install Gyan.FFmpeg");
    expect(bat).toContain("OpenFileDialog");
    expect(bat).toContain("powershell -STA");
    expect(bat).toContain("drag the video onto");
    expect(bat).toContain('ffmpeg -hide_banner -re -i "%VIDEO%"');
    expect(bat).toContain("YouTube, Facebook");
    expect(bat).toContain("-map 0:v:0");
    expect(bat).toContain("-map \"0:a:0?\"");
    expect(bat).toContain("libx264");
    expect(bat).toContain("IGC Encoder 3");
    expect(bat).toContain("already running");
  });

  it("writes a Windows camera encoder that lists DirectShow devices", () => {
    const bat = windowsCameraBat(targets);
    expect(bat).toContain("-f dshow");
    expect(bat).toContain("-list_devices true");
    expect(bat).toContain('video="%CAM%":audio="%MIC%"');
    expect(bat).toContain("-f tee");
  });

  it("writes a Mac Go live script that can pick a file", () => {
    const sh = unixGoLiveScript(targets);
    expect(sh.startsWith("#!/bin/sh")).toBe(true);
    expect(sh).toContain("brew install ffmpeg");
    expect(sh).toContain("choose file");
    expect(sh).toContain("-map 0:v:0");
    expect(sh).toContain('ffmpeg -hide_banner -re -i "$FILE"');
  });

  it("writes a Mac camera encoder that lists AVFoundation devices", () => {
    const sh = unixCameraScript(targets);
    expect(sh).toContain("-f avfoundation");
    expect(sh).toContain("-list_devices true");
    expect(sh).toContain('"$VIDEO_DEV:$AUDIO_DEV"');
  });

  it("can send YouTube only at Low when the church upload buffers", () => {
    expect(ffmpegVideoFlags("low")).toContain("854x480");
    const yt = youtubeOnly(targets);
    expect(yt).toHaveLength(1);
    expect(windowsGoLiveBat(yt, "low")).toContain("854x480");
    expect(windowsGoLiveBat(yt, "low")).not.toContain("facebook.com");
    expect(() => youtubeOnly([{ platform: "facebook", label: "Facebook", rtmp: "rtmps://x/fb" }])).toThrow(
      /YouTube/i,
    );
  });

  it("refuses to build an encoder with no destinations", () => {
    expect(() => ffmpegGoLiveCommand("a.mp4", [])).toThrow(/destination/i);
    expect(() => windowsGoLiveBat([])).toThrow(/destination/i);
    expect(() => windowsCameraBat([])).toThrow(/destination/i);
  });
});
