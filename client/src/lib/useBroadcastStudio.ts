import { useCallback, useEffect, useRef, useState } from "react";
import {
  INITIAL_AUDIO_STATE,
  INITIAL_VIDEO_AUTO,
  dbFromLinear,
  peakFromSamples,
  rmsFromSamples,
  tickAudio,
  nextVideoAuto,
  type AdaptiveAudioState,
  type VideoAutoState,
} from "./studioEngine";

export type StudioStatus = "idle" | "live" | "error";

export interface DeviceOption {
  deviceId: string;
  label: string;
}

export interface StudioMeters {
  inputRms: number;
  outputRms: number;
  peak: number;
  noiseFloor: number;
  gate: number;
  agcDb: number;
  compressorDb: number;
  luma: number;
}

export interface VideoLook {
  auto: boolean;
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number;
  mirror: boolean;
}

const DEFAULT_LOOK: VideoLook = {
  auto: true,
  brightness: 1,
  contrast: 1,
  saturation: 1.05,
  warmth: 0,
  mirror: true,
};

function studioStartMessage(err: unknown): string {
  const name = (err as { name?: string })?.name;
  if (name === "NotAllowedError") {
    return "Allow camera and microphone in the browser, then start again.";
  }
  if (name === "NotFoundError") {
    return "No camera or microphone was found on this computer. Plug one in and start again.";
  }
  if (name === "NotReadableError") {
    return "The camera or microphone is already in use by another app.";
  }
  if (name === "OverconstrainedError") {
    return "That camera or microphone is not available. Pick another source or start again.";
  }
  return (err as Error)?.message || "Could not start the studio.";
}

export function useBroadcastStudio() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioState = useRef<AdaptiveAudioState>({ ...INITIAL_AUDIO_STATE });
  const videoAuto = useRef<VideoAutoState>({ ...INITIAL_VIDEO_AUTO });
  const lookRef = useRef<VideoLook>({ ...DEFAULT_LOOK });
  const nodes = useRef<{
    ctx?: AudioContext;
    source?: MediaStreamAudioSourceNode;
    highpass?: BiquadFilterNode;
    hum?: BiquadFilterNode;
    gate?: GainNode;
    agc?: GainNode;
    compressor?: DynamicsCompressorNode;
    limiter?: DynamicsCompressorNode;
    analyserIn?: AnalyserNode;
    analyserOut?: AnalyserNode;
    dest?: MediaStreamAudioDestinationNode;
    raw?: MediaStream;
    processed?: MediaStream;
    recorder?: MediaRecorder;
    chunks?: Blob[];
    raf?: number;
  }>({});
  const meterTimer = useRef<number | null>(null);
  const lumaTimer = useRef<number | null>(null);

  const [status, setStatus] = useState<StudioStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<DeviceOption[]>([]);
  const [mics, setMics] = useState<DeviceOption[]>([]);
  const [cameraId, setCameraId] = useState("");
  const [micId, setMicId] = useState("");
  const [look, setLook] = useState<VideoLook>({ ...DEFAULT_LOOK });
  const [meters, setMeters] = useState<StudioMeters>({
    inputRms: 0,
    outputRms: 0,
    peak: 0,
    noiseFloor: 0,
    gate: 1,
    agcDb: 0,
    compressorDb: -14,
    luma: 120,
  });
  const [recording, setRecording] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const metersLumaRef = useRef(120);

  lookRef.current = look;

  const stopGraph = useCallback(() => {
    const n = nodes.current;
    if (n.raf) cancelAnimationFrame(n.raf);
    if (meterTimer.current != null) window.clearInterval(meterTimer.current);
    if (lumaTimer.current != null) window.clearInterval(lumaTimer.current);
    meterTimer.current = null;
    lumaTimer.current = null;
    if (n.recorder?.state === "recording") n.recorder.stop();
    n.raw?.getTracks().forEach((t) => t.stop());
    n.processed?.getTracks().forEach((t) => t.stop());
    void n.ctx?.close();
    nodes.current = {};
    audioState.current = { ...INITIAL_AUDIO_STATE };
    videoAuto.current = { ...INITIAL_VIDEO_AUTO };
  }, []);

  const listDevices = useCallback(async () => {
    const all = await navigator.mediaDevices.enumerateDevices();
    const cam = all
      .filter((d) => d.kind === "videoinput")
      .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` }));
    const mic = all
      .filter((d) => d.kind === "audioinput")
      .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${i + 1}` }));
    setCameras(cam);
    setMics(mic);
    setCameraId((id) => id || cam[0]?.deviceId || "");
    setMicId((id) => id || mic[0]?.deviceId || "");
  }, []);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const n = nodes.current;
    if (!canvas || !video || video.readyState < 2) {
      n.raf = requestAnimationFrame(paint);
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      n.raf = requestAnimationFrame(paint);
      return;
    }
    const lookNow = lookRef.current;
    const auto = lookNow.auto ? videoAuto.current : { brightness: 1, contrast: 1 };
    const brightness = lookNow.brightness * auto.brightness;
    const contrast = lookNow.contrast * auto.contrast;
    const warmth = lookNow.warmth;
    ctx.save();
    if (lookNow.mirror) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.filter = `brightness(${brightness}) contrast(${contrast}) saturate(${lookNow.saturation}) sepia(${Math.max(0, warmth) * 0.28})`;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();
    n.raf = requestAnimationFrame(paint);
  }, []);

  const tickMeters = useCallback(() => {
    const n = nodes.current;
    const analyserIn = n.analyserIn;
    const analyserOut = n.analyserOut;
    if (!analyserIn || !analyserOut) return;
    const bufIn = new Float32Array(analyserIn.fftSize);
    const bufOut = new Float32Array(analyserOut.fftSize);
    analyserIn.getFloatTimeDomainData(bufIn);
    analyserOut.getFloatTimeDomainData(bufOut);
    const rms = rmsFromSamples(bufIn);
    const peak = peakFromSamples(bufIn);
    audioState.current = tickAudio(audioState.current, rms, peak);
    const s = audioState.current;
    if (n.gate) n.gate.gain.setTargetAtTime(Math.max(0.02, s.gate), n.ctx!.currentTime, 0.04);
    if (n.agc) n.agc.gain.setTargetAtTime(s.agcGain, n.ctx!.currentTime, 0.05);
    if (n.compressor) {
      n.compressor.threshold.setTargetAtTime(s.compressorThresholdDb, n.ctx!.currentTime, 0.08);
      n.compressor.ratio.setTargetAtTime(s.compressorRatio, n.ctx!.currentTime, 0.08);
    }
    setMeters({
      inputRms: rms,
      outputRms: rmsFromSamples(bufOut),
      peak,
      noiseFloor: s.noiseFloor,
      gate: s.gate,
      agcDb: dbFromLinear(s.agcGain),
      compressorDb: s.compressorThresholdDb,
      luma: metersLumaRef.current,
    });
  }, []);

  const sampleLuma = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = 48;
    const h = 27;
    const snap = ctx.getImageData(0, 0, Math.min(w, canvas.width), Math.min(h, canvas.height));
    let sum = 0;
    const data = snap.data;
    for (let i = 0; i < data.length; i += 16) {
      sum += data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722;
    }
    const luma = sum / (data.length / 16);
    metersLumaRef.current = luma;
    if (lookRef.current.auto) {
      videoAuto.current = nextVideoAuto(luma, videoAuto.current);
    }
  }, []);

  const start = useCallback(async () => {
    setError(null);
    stopGraph();
    if (recordingUrl) {
      URL.revokeObjectURL(recordingUrl);
      setRecordingUrl(null);
    }
    let stream: MediaStream | undefined;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: micId ? { exact: micId } : undefined,
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: {
          deviceId: cameraId ? { exact: cameraId } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
      });
      await listDevices();
      const ctx = new AudioContext();
      if (ctx.state === "suspended") await ctx.resume();
      const source = ctx.createMediaStreamSource(stream);
      const highpass = ctx.createBiquadFilter();
      highpass.type = "highpass";
      highpass.frequency.value = 80;
      highpass.Q.value = 0.7;
      const hum = ctx.createBiquadFilter();
      hum.type = "notch";
      hum.frequency.value = 50;
      hum.Q.value = 8;
      const analyserIn = ctx.createAnalyser();
      analyserIn.fftSize = 2048;
      analyserIn.smoothingTimeConstant = 0.3;
      const gate = ctx.createGain();
      gate.gain.value = 1;
      const agc = ctx.createGain();
      agc.gain.value = 1.4;
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -14;
      compressor.knee.value = 8;
      compressor.ratio.value = 3;
      compressor.attack.value = 0.008;
      compressor.release.value = 0.18;
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -1.5;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.002;
      limiter.release.value = 0.05;
      const analyserOut = ctx.createAnalyser();
      analyserOut.fftSize = 2048;
      const dest = ctx.createMediaStreamDestination();

      source.connect(highpass);
      highpass.connect(hum);
      hum.connect(analyserIn);
      analyserIn.connect(gate);
      gate.connect(agc);
      agc.connect(compressor);
      compressor.connect(limiter);
      limiter.connect(analyserOut);
      analyserOut.connect(dest);

      nodes.current = {
        ctx,
        source,
        highpass,
        hum,
        gate,
        agc,
        compressor,
        limiter,
        analyserIn,
        analyserOut,
        dest,
        raw: stream,
        processed: dest.stream,
      };

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = 1280;
        canvas.height = 720;
      }
      paint();
      meterTimer.current = window.setInterval(tickMeters, 50);
      lumaTimer.current = window.setInterval(sampleLuma, 220);
      setStatus("live");
      setElapsedSec(0);
    } catch (e) {
      stream?.getTracks().forEach((t) => t.stop());
      stopGraph();
      setStatus("error");
      setError(studioStartMessage(e));
    }
  }, [cameraId, listDevices, micId, paint, recordingUrl, sampleLuma, stopGraph, tickMeters]);

  const stop = useCallback(() => {
    stopGraph();
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus("idle");
    setRecording(false);
    setElapsedSec(0);
  }, [stopGraph]);

  const startRecording = useCallback(() => {
    const canvas = canvasRef.current;
    const audio = nodes.current.dest?.stream;
    if (!canvas || !audio || status !== "live") return;
    const videoStream = canvas.captureStream(30);
    const mixed = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...audio.getAudioTracks(),
    ]);
    const chunks: Blob[] = [];
    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : "video/webm";
    const recorder = new MediaRecorder(mixed, { mimeType: mime, videoBitsPerSecond: 3_500_000 });
    recorder.ondataavailable = (ev) => {
      if (ev.data.size) chunks.push(ev.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mime });
      if (recordingUrl) URL.revokeObjectURL(recordingUrl);
      setRecordingUrl(URL.createObjectURL(blob));
      setRecording(false);
    };
    nodes.current.recorder = recorder;
    nodes.current.chunks = chunks;
    recorder.start(500);
    setRecording(true);
  }, [recordingUrl, status]);

  const stopRecording = useCallback(() => {
    const rec = nodes.current.recorder;
    if (rec && rec.state === "recording") rec.stop();
  }, []);

  useEffect(() => {
    void listDevices().catch(() => undefined);
    return () => {
      stopGraph();
    };
  }, [listDevices, stopGraph]);

  useEffect(() => {
    if (status !== "live") return;
    const t = window.setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [status]);

  return {
    videoRef,
    canvasRef,
    status,
    error,
    cameras,
    mics,
    cameraId,
    micId,
    setCameraId,
    setMicId,
    look,
    setLook,
    meters,
    recording,
    recordingUrl,
    elapsedSec,
    start,
    stop,
    startRecording,
    stopRecording,
  };
}
