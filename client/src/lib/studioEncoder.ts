export type EncoderTarget = {
  platform: string;
  label: string;
  rtmp: string;
};

const FFMPEG_VIDEO =
  "-c:v libx264 -preset veryfast -pix_fmt yuv420p -s 1280x720 -r 30 -g 60 -b:v 2500k -maxrate 2800k -bufsize 5000k";
const FFMPEG_AUDIO = "-c:a aac -ar 44100 -ac 2 -b:a 160k";
/** tee does not auto-select streams; without this FFmpeg says "Output file does not contain any stream". */
const FFMPEG_MAP = '-map 0:v:0 -map "0:a:0?"';

/** tee muxer treats `\ ' :` as control characters. */
export function escapeFfmpegTeeUrl(url: string): string {
  return url.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/:/g, "\\:");
}

export function ffmpegTeeSpec(targets: EncoderTarget[]): string {
  return targets.map((row) => `[f=flv:onfail=ignore]${escapeFfmpegTeeUrl(row.rtmp)}`).join("|");
}

export function ffmpegGoLiveArgs(inputPath: string, targets: EncoderTarget[]): string[] {
  if (targets.length === 0) {
    throw new Error("Turn On a destination with a key, Save, then download IGC Encoder again.");
  }
  return [
    "-hide_banner",
    "-re",
    "-i",
    inputPath,
    ...FFMPEG_VIDEO.split(" "),
    ...FFMPEG_AUDIO.split(" "),
    "-map",
    "0:v:0",
    "-map",
    "0:a:0?",
    "-f",
    "tee",
    ffmpegTeeSpec(targets),
  ];
}

export function ffmpegGoLiveCommand(inputPath: string, targets: EncoderTarget[]): string {
  return ["ffmpeg", ...ffmpegGoLiveArgs(inputPath, targets)].join(" ");
}

function requireTargets(targets: EncoderTarget[]): EncoderTarget[] {
  if (targets.length === 0) {
    throw new Error("Turn On a destination with a key, Save, then download IGC Encoder again.");
  }
  return targets;
}

function batTeeSpec(targets: EncoderTarget[]): string {
  return ffmpegTeeSpec(requireTargets(targets)).replace(/%/g, "%%");
}

function shTeeSpec(targets: EncoderTarget[]): string {
  return ffmpegTeeSpec(requireTargets(targets)).replace(/'/g, "'\\''");
}

function destinationLine(targets: EncoderTarget[]): string {
  return requireTargets(targets)
    .map((row) => row.label)
    .join(", ");
}

export function windowsGoLiveBat(targets: EncoderTarget[]): string {
  const spec = batTeeSpec(targets);
  const names = destinationLine(targets);
  return [
    "@echo off",
    "title IGC Encoder",
    "setlocal EnableDelayedExpansion",
    "where ffmpeg >nul 2>&1",
    "if errorlevel 1 (",
    "  echo Install FFmpeg first: winget install Gyan.FFmpeg",
    "  echo Or download https://www.gyan.dev/ffmpeg/builds/ and add ffmpeg.exe to PATH.",
    "  pause",
    "  exit /b 1",
    ")",
    'set "VIDEO=%~1"',
    'if "%VIDEO%"=="" (',
    "  echo IGC Encoder is the OBS job for a recorded file: encode on this computer, then RTMP.",
    `  echo Destinations: ${names}`,
    "  echo Opening a file picker. You can also drag a video onto this file.",
    "  for /f \"delims=\" %%I in ('powershell -NoProfile -Command \"Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.OpenFileDialog; $f.Filter = 'Video|*.mp4;*.mov;*.mkv;*.webm;*.avi|All|*.*'; $f.Title = 'IGC Encoder — choose the recording'; if ($f.ShowDialog() -eq 'OK') { $f.FileName }\"') do set \"VIDEO=%%I\"",
    ")",
    'if "%VIDEO%"=="" (',
    "  echo No file chosen.",
    "  pause",
    "  exit /b 1",
    ")",
    "echo Starting IGC Encoder. Leave YouTube waiting for encoder. Open Facebook Live Producer.",
    "echo Stay in this window until the service ends.",
    `ffmpeg -hide_banner -re -i "%VIDEO%" ${FFMPEG_VIDEO} ${FFMPEG_AUDIO} ${FFMPEG_MAP} -f tee "${spec}"`,
    "echo.",
    "echo Encoder stopped.",
    "pause",
    "",
  ].join("\r\n");
}

export function windowsCameraBat(targets: EncoderTarget[]): string {
  const spec = batTeeSpec(targets);
  const names = destinationLine(targets);
  return [
    "@echo off",
    "title IGC Encoder — camera",
    "setlocal EnableDelayedExpansion",
    "where ffmpeg >nul 2>&1",
    "if errorlevel 1 (",
    "  echo Install FFmpeg first: winget install Gyan.FFmpeg",
    "  pause",
    "  exit /b 1",
    ")",
    "echo IGC Encoder camera is the OBS job for a live camera: encode on this computer, then RTMP.",
    `echo Destinations: ${names}`,
    "echo.",
    "echo Listing cameras and microphones. Copy the names exactly.",
    "ffmpeg -hide_banner -list_devices true -f dshow -i dummy",
    "echo.",
    "set /p CAM=Camera name: ",
    "set /p MIC=Microphone name (blank for video only): ",
    'if "%CAM%"=="" (',
    "  echo No camera name entered.",
    "  pause",
    "  exit /b 1",
    ")",
    "echo Starting IGC Encoder. Leave YouTube waiting for encoder. Open Facebook Live Producer.",
    'if "%MIC%"=="" (',
    `  ffmpeg -hide_banner -f dshow -rtbufsize 100M -i video="%CAM%" ${FFMPEG_VIDEO} ${FFMPEG_AUDIO} ${FFMPEG_MAP} -f tee "${spec}"`,
    ") else (",
    `  ffmpeg -hide_banner -f dshow -rtbufsize 100M -i video="%CAM%":audio="%MIC%" ${FFMPEG_VIDEO} ${FFMPEG_AUDIO} ${FFMPEG_MAP} -f tee "${spec}"`,
    ")",
    "echo.",
    "echo Encoder stopped.",
    "pause",
    "",
  ].join("\r\n");
}

export function unixGoLiveScript(targets: EncoderTarget[]): string {
  const spec = shTeeSpec(targets);
  const names = destinationLine(targets);
  return [
    "#!/bin/sh",
    "set -e",
    "if ! command -v ffmpeg >/dev/null 2>&1; then",
    '  echo "Install FFmpeg first (brew install ffmpeg, or your package manager)."',
    "  exit 1",
    "fi",
    'FILE="$1"',
    'if [ -z "$FILE" ]; then',
    '  echo "IGC Encoder is the OBS job for a recorded file: encode on this computer, then RTMP."',
    `  echo "Destinations: ${names}"`,
    "  FILE=$(osascript -e 'POSIX path of (choose file with prompt \"IGC Encoder — choose the recording\")' 2>/dev/null || true)",
    "fi",
    'if [ -z "$FILE" ]; then',
    '  echo "No file chosen. Usage: ./igc-go-live.sh /path/sermon.mp4"',
    "  exit 1",
    "fi",
    'echo "Starting IGC Encoder. Leave YouTube waiting for encoder. Open Facebook Live Producer."',
    `ffmpeg -hide_banner -re -i "$FILE" ${FFMPEG_VIDEO} ${FFMPEG_AUDIO} ${FFMPEG_MAP} -f tee '${spec}'`,
    "",
  ].join("\n");
}

export function unixCameraScript(targets: EncoderTarget[]): string {
  const spec = shTeeSpec(targets);
  const names = destinationLine(targets);
  return [
    "#!/bin/sh",
    "set -e",
    "if ! command -v ffmpeg >/dev/null 2>&1; then",
    '  echo "Install FFmpeg first (brew install ffmpeg, or your package manager)."',
    "  exit 1",
    "fi",
    'echo "IGC Encoder camera is the OBS job for a live camera: encode on this computer, then RTMP."',
    `echo "Destinations: ${names}"`,
    'echo "Listing cameras and microphones. Use the index numbers (often 0:0)."',
    "ffmpeg -hide_banner -f avfoundation -list_devices true -i \"\" || true",
    'printf "Video device index: "',
    "read VIDEO_DEV",
    'printf "Audio device index (blank for video only): "',
    "read AUDIO_DEV",
    'if [ -z "$VIDEO_DEV" ]; then',
    '  echo "No video device entered."',
    "  exit 1",
    "fi",
    'echo "Starting IGC Encoder. Leave YouTube waiting for encoder. Open Facebook Live Producer."',
    'if [ -z "$AUDIO_DEV" ]; then',
    `  ffmpeg -hide_banner -f avfoundation -framerate 30 -i "$VIDEO_DEV" ${FFMPEG_VIDEO} ${FFMPEG_AUDIO} ${FFMPEG_MAP} -f tee '${spec}'`,
    "else",
    `  ffmpeg -hide_banner -f avfoundation -framerate 30 -i "$VIDEO_DEV:$AUDIO_DEV" ${FFMPEG_VIDEO} ${FFMPEG_AUDIO} ${FFMPEG_MAP} -f tee '${spec}'`,
    "fi",
    "",
  ].join("\n");
}

export function downloadTextFile(name: string, body: string) {
  const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
