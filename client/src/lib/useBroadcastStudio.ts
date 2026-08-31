import { useCallback, useEffect, useRef, useState } from "react";
import {
  INITIAL_AUDIO_STATE,
  INITIAL_VIDEO_AUTO,
  SPEECH_PROFILE,
  dbFromLinear,
  peakFromSamples,
  rmsFromSamples,
  soundProfile,
  tickAudio,
  nextVideoAuto,
  type AdaptiveAudioState,
  type SoundProfile,
  type VideoAutoState,
} from "./studioEngine";
import {
  audioConstraintsFor,
  decorateAudioLabel,
  keepDeviceId,
  pickRecordingMime,
  sortAudioDevices,
  videoConstraintsFor,
  deviceIdFromStream,
  type NamedDevice,
} from "./studioDevices";
import {
  fetchAdjacentVerse,
  fetchVerseText,
  liveVerseFromOverlay,
  mergeBibleHits,
  parseBibleReferences,
  type BibleHit,
} from "./bibleRefs";
import { appendSpokenWindow, searchQuotesLocal, searchQuotesRemote } from "./scriptureSearch";
import {
  EMPTY_OVERLAY,
  drawProgrammeOverlay,
  type ProgrammeOverlay,
} from "./studioOverlays";
import {
  getSpeechRecognitionCtor,
  speechChunkFromEvent,
  type StudioSpeechRecognition,
} from "./studioSpeech";

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

async function getAudioStream(deviceId: string): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: audioConstraintsFor(deviceId),
      video: false,
    });
  } catch {
    return await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
      video: false,
    });
  }
}

function pickMime(): string {
  const supported =
    typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported
      ? (type: string) => MediaRecorder.isTypeSupported(type)
      : () => false;
  return pickRecordingMime(supported) || "video/webm";
}

function ensureStudioCanvas(canvas: HTMLCanvasElement) {
  if (canvas.width < 960 || canvas.height < 540) {
    canvas.width = 1280;
    canvas.height = 720;
  }
}

function paintStudioMonitor(
  canvas: HTMLCanvasElement | null,
  video: HTMLVideoElement | null,
  overlay: ProgrammeOverlay,
  lookNow: VideoLook,
  auto: VideoAutoState,
  stage: boolean,
) {
  if (!canvas) return;
  ensureStudioCanvas(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const brightness = lookNow.brightness * auto.brightness;
  const contrast = lookNow.contrast * auto.contrast;
  const livePicture = Boolean(video && video.readyState >= 2);
  if (livePicture && video) {
    ctx.save();
    if (lookNow.mirror) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.filter = `brightness(${brightness}) contrast(${contrast}) saturate(${lookNow.saturation}) sepia(${Math.max(0, lookNow.warmth) * 0.28})`;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();
    ctx.filter = "none";
  } else {
    ctx.fillStyle = "#0b0b10";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  drawProgrammeOverlay(ctx, canvas.width, canvas.height, overlay, { stage });
}

export function useBroadcastStudio() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const programmeAudioRef = useRef<HTMLAudioElement | null>(null);
  const overlayRef = useRef<ProgrammeOverlay>({ ...EMPTY_OVERLAY });
  const programOverlayRef = useRef<ProgrammeOverlay>({ ...EMPTY_OVERLAY });
  const audioState = useRef<AdaptiveAudioState>({ ...INITIAL_AUDIO_STATE });
  const videoAuto = useRef<VideoAutoState>({ ...INITIAL_VIDEO_AUTO });
  const lookRef = useRef<VideoLook>({ ...DEFAULT_LOOK });
  const statusRef = useRef<StudioStatus>("idle");
  const monitorRef = useRef(false);
  const bibleHitsRef = useRef<BibleHit[]>([]);
  const speechHitsRef = useRef<BibleHit[]>([]);
  const overlayHitsRef = useRef<BibleHit[]>([]);
  const spokenBufferRef = useRef("");
  const quoteTimerRef = useRef<number | null>(null);
  const quoteSearchGen = useRef(0);
  const listenRef = useRef(false);
  const musicFilterRef = useRef(false);
  const liveVerseRef = useRef<BibleHit | null>(null);
  const recognitionRef = useRef<StudioSpeechRecognition | null>(null);
  const nodes = useRef<{
    ctx?: AudioContext;
    source?: MediaStreamAudioSourceNode;
    highpass?: BiquadFilterNode;
    lowShelf?: BiquadFilterNode;
    highShelf?: BiquadFilterNode;
    hum?: BiquadFilterNode;
    gate?: GainNode;
    agc?: GainNode;
    compressor?: DynamicsCompressorNode;
    limiter?: DynamicsCompressorNode;
    programmeGain?: GainNode;
    analyserIn?: AnalyserNode;
    analyserOut?: AnalyserNode;
    dest?: MediaStreamAudioDestinationNode;
    rawVideo?: MediaStream;
    rawAudio?: MediaStream;
    recorder?: MediaRecorder;
    chunks?: Blob[];
    raf?: number;
    mixed?: MediaStream;
  }>({});
  const meterTimer = useRef<number | null>(null);
  const lumaTimer = useRef<number | null>(null);
  const metersLumaRef = useRef(120);

  const [status, setStatus] = useState<StudioStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<DeviceOption[]>([]);
  const [mics, setMics] = useState<DeviceOption[]>([]);
  const [cameraId, setCameraIdState] = useState("");
  const [micId, setMicIdState] = useState("");
  const [look, setLook] = useState<VideoLook>({ ...DEFAULT_LOOK });
  const [meters, setMeters] = useState<StudioMeters>({
    inputRms: 0,
    outputRms: 0,
    peak: 0,
    noiseFloor: 0,
    gate: 1,
    agcDb: 0,
    compressorDb: -8,
    luma: 120,
  });
  const [recording, setRecording] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [monitor, setMonitorState] = useState(false);
  const [busySource, setBusySource] = useState<"camera" | "mic" | null>(null);
  const [overlay, setOverlay] = useState<ProgrammeOverlay>({ ...EMPTY_OVERLAY });
  const [programOverlay, setProgramOverlay] = useState<ProgrammeOverlay>({ ...EMPTY_OVERLAY });
  const [bibleHits, setBibleHits] = useState<BibleHit[]>([]);
  const [listening, setListening] = useState(false);
  const [postingVerse, setPostingVerse] = useState(false);
  const [searchingQuotes, setSearchingQuotes] = useState(false);
  const [selectedVerseRefs, setSelectedVerseRefs] = useState<string[]>([]);
  const [musicFilter, setMusicFilterState] = useState(false);
  const [liveVerse, setLiveVerse] = useState<BibleHit | null>(null);
  const [steppingVerse, setSteppingVerse] = useState(false);

  lookRef.current = look;
  overlayRef.current = overlay;
  programOverlayRef.current = programOverlay;
  statusRef.current = status;
  monitorRef.current = monitor;
  musicFilterRef.current = musicFilter;

  const attachProgrammeAudio = useCallback((stream: MediaStream | undefined) => {
    const el = programmeAudioRef.current;
    if (!el) return;
    el.srcObject = stream ?? null;
    el.muted = !monitorRef.current;
    el.volume = 1;
    if (stream) void el.play().catch(() => undefined);
  }, []);

  const publishBibleHits = useCallback(() => {
    bibleHitsRef.current = mergeBibleHits(speechHitsRef.current, overlayHitsRef.current);
    setBibleHits([...bibleHitsRef.current]);
    setSelectedVerseRefs((prev) => prev.filter((id) => bibleHitsRef.current.some((h) => h.display === id)));
  }, []);

  const searchSpokenQuotes = useCallback(
    async (spoken: string) => {
      const local = searchQuotesLocal(spoken);
      if (local.length) {
        speechHitsRef.current = mergeBibleHits(speechHitsRef.current, local);
        publishBibleHits();
      }
      const gen = ++quoteSearchGen.current;
      setSearchingQuotes(true);
      try {
        const remote = await searchQuotesRemote(spoken);
        if (gen !== quoteSearchGen.current) return;
        if (remote.length) {
          speechHitsRef.current = mergeBibleHits(speechHitsRef.current, remote);
          publishBibleHits();
        }
      } finally {
        if (gen === quoteSearchGen.current) setSearchingQuotes(false);
      }
    },
    [publishBibleHits],
  );

  const scheduleQuoteSearch = useCallback(
    (spoken: string) => {
      if (quoteTimerRef.current != null) window.clearTimeout(quoteTimerRef.current);
      quoteTimerRef.current = window.setTimeout(() => {
        void searchSpokenQuotes(spoken);
      }, 500);
    },
    [searchSpokenQuotes],
  );

  const ingestTranscript = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const found = parseBibleReferences(trimmed);
    if (found.length) {
      speechHitsRef.current = mergeBibleHits(speechHitsRef.current, found);
      publishBibleHits();
    }
    spokenBufferRef.current = appendSpokenWindow(spokenBufferRef.current, trimmed);
    scheduleQuoteSearch(spokenBufferRef.current);
  }, [publishBibleHits, scheduleQuoteSearch]);

  const ingestOverlayText = useCallback((headline: string, body: string) => {
    const combined = `${headline} ${body}`.trim();
    overlayHitsRef.current = mergeBibleHits(
      parseBibleReferences(combined),
      searchQuotesLocal(combined),
    );
    publishBibleHits();
    if (combined.split(/\s+/).length >= 6) scheduleQuoteSearch(combined);
  }, [publishBibleHits, scheduleQuoteSearch]);

  const stopListening = useCallback(() => {
    listenRef.current = false;
    setListening(false);
    try {
      recognitionRef.current?.stop();
    } catch {
      /* already stopped */
    }
    recognitionRef.current = null;
  }, []);

  const startListening = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setError("This browser cannot listen for spoken verses. Type a reference, or use Chrome / Edge.");
      return;
    }
    stopListening();
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (ev) => ingestTranscript(speechChunkFromEvent(ev).text);
    rec.onerror = () => {
      /* keep the toggle available; the operator can stop listening */
    };
    rec.onend = () => {
      if (listenRef.current) {
        try {
          rec.start();
        } catch {
          listenRef.current = false;
          setListening(false);
        }
      }
    };
    recognitionRef.current = rec;
    listenRef.current = true;
    setListening(true);
    try {
      rec.start();
    } catch (e) {
      listenRef.current = false;
      setListening(false);
      setError(e instanceof Error ? e.message : "Could not start speech recognition.");
    }
  }, [ingestTranscript, stopListening]);

  const stopGraph = useCallback(() => {
    const n = nodes.current;
    if (n.raf) cancelAnimationFrame(n.raf);
    if (meterTimer.current != null) window.clearInterval(meterTimer.current);
    if (lumaTimer.current != null) window.clearInterval(lumaTimer.current);
    meterTimer.current = null;
    lumaTimer.current = null;
    if (n.recorder?.state === "recording") n.recorder.stop();
    n.rawVideo?.getTracks().forEach((t) => t.stop());
    n.rawAudio?.getTracks().forEach((t) => t.stop());
    n.mixed?.getTracks().forEach((t) => t.stop());
    void n.ctx?.close();
    nodes.current = {};
    audioState.current = { ...INITIAL_AUDIO_STATE };
    videoAuto.current = { ...INITIAL_VIDEO_AUTO };
    attachProgrammeAudio(undefined);
  }, [attachProgrammeAudio]);

  const listDevices = useCallback(async (prefer?: { camera?: string; mic?: string }) => {
    const all = await navigator.mediaDevices.enumerateDevices();
    const cam = all
      .filter((d) => d.kind === "videoinput")
      .map((d, i) => ({
        deviceId: d.deviceId,
        label: d.label || `Camera ${i + 1}`,
      }));
    const mic = sortAudioDevices(
      all
        .filter((d) => d.kind === "audioinput")
        .map((d, i) => ({
          deviceId: d.deviceId,
          label: decorateAudioLabel(d.label, i),
        })),
    );
    setCameras(cam);
    setMics(mic);
    setCameraIdState((id) => keepDeviceId(prefer?.camera || id, cam));
    setMicIdState((id) => keepDeviceId(prefer?.mic || id, mic as NamedDevice[]));
  }, []);

  const paint = useCallback(() => {
    const video = videoRef.current;
    const n = nodes.current;
    const lookNow = lookRef.current;
    const auto = lookNow.auto ? videoAuto.current : { brightness: 1, contrast: 1 };
    paintStudioMonitor(previewCanvasRef.current, video, overlayRef.current, lookNow, auto, true);
    paintStudioMonitor(canvasRef.current, video, programOverlayRef.current, lookNow, auto, false);
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
    audioState.current = tickAudio(
      audioState.current,
      rms,
      peak,
      soundProfile(musicFilterRef.current ? "music" : "speech"),
    );
    const s = audioState.current;
    if (n.gate) n.gate.gain.setTargetAtTime(s.gate, n.ctx!.currentTime, 0.08);
    if (n.agc) n.agc.gain.setTargetAtTime(s.agcGain, n.ctx!.currentTime, 0.18);
    if (n.compressor) {
      n.compressor.threshold.setTargetAtTime(s.compressorThresholdDb, n.ctx!.currentTime, 0.12);
      n.compressor.ratio.setTargetAtTime(s.compressorRatio, n.ctx!.currentTime, 0.12);
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

  const applySoundProfile = useCallback((profile: SoundProfile) => {
    const n = nodes.current;
    const ctx = n.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    n.highpass?.frequency.setTargetAtTime(profile.highpassHz, t, 0.08);
    if (n.lowShelf) {
      n.lowShelf.frequency.setTargetAtTime(profile.lowShelfHz, t, 0.08);
      n.lowShelf.gain.setTargetAtTime(profile.lowShelfDb, t, 0.08);
    }
    if (n.highShelf) {
      n.highShelf.frequency.setTargetAtTime(profile.highShelfHz, t, 0.08);
      n.highShelf.gain.setTargetAtTime(profile.highShelfDb, t, 0.08);
    }
    n.programmeGain?.gain.setTargetAtTime(profile.programmeGain, t, 0.08);
    if (n.limiter) n.limiter.threshold.setTargetAtTime(profile.limiterThresholdDb, t, 0.08);
    if (n.compressor) {
      n.compressor.threshold.setTargetAtTime(profile.compressorThresholdDb, t, 0.08);
      n.compressor.ratio.setTargetAtTime(profile.compressorRatio, t, 0.08);
      n.compressor.attack.setTargetAtTime(profile.compressorAttack, t, 0.08);
      n.compressor.release.setTargetAtTime(profile.compressorRelease, t, 0.08);
    }
  }, []);

  const setMusicFilter = useCallback(
    (on: boolean) => {
      musicFilterRef.current = on;
      setMusicFilterState(on);
      applySoundProfile(soundProfile(on ? "music" : "speech"));
    },
    [applySoundProfile],
  );

  const connectAudioSource = useCallback((ctx: AudioContext, stream: MediaStream) => {
    const n = nodes.current;
    n.source?.disconnect();
    const source = ctx.createMediaStreamSource(stream);
    if (n.highpass) source.connect(n.highpass);
    n.source = source;
    n.rawAudio?.getTracks().forEach((t) => t.stop());
    n.rawAudio = stream;
  }, []);

  const start = useCallback(async () => {
    setError(null);
    stopGraph();
    if (recordingUrl) {
      URL.revokeObjectURL(recordingUrl);
      setRecordingUrl(null);
    }
    let videoStream: MediaStream | undefined;
    let audioStream: MediaStream | undefined;
    try {
      videoStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: videoConstraintsFor(cameraId),
      });
      audioStream = await getAudioStream(micId);
      const liveCam = deviceIdFromStream(videoStream, "video") || cameraId;
      const liveMic = deviceIdFromStream(audioStream, "audio") || micId;
      setCameraIdState(liveCam);
      setMicIdState(liveMic);
      await listDevices({ camera: liveCam, mic: liveMic });
      const ctx = new AudioContext({ latencyHint: "interactive" });
      if (ctx.state === "suspended") await ctx.resume();
      const highpass = ctx.createBiquadFilter();
      highpass.type = "highpass";
      highpass.frequency.value = SPEECH_PROFILE.highpassHz;
      highpass.Q.value = 0.7;
      const lowShelf = ctx.createBiquadFilter();
      lowShelf.type = "lowshelf";
      lowShelf.frequency.value = SPEECH_PROFILE.lowShelfHz;
      lowShelf.gain.value = SPEECH_PROFILE.lowShelfDb;
      const highShelf = ctx.createBiquadFilter();
      highShelf.type = "highshelf";
      highShelf.frequency.value = SPEECH_PROFILE.highShelfHz;
      highShelf.gain.value = SPEECH_PROFILE.highShelfDb;
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
      agc.gain.value = 1;
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = SPEECH_PROFILE.compressorThresholdDb;
      compressor.knee.value = 12;
      compressor.ratio.value = SPEECH_PROFILE.compressorRatio;
      compressor.attack.value = SPEECH_PROFILE.compressorAttack;
      compressor.release.value = SPEECH_PROFILE.compressorRelease;
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = SPEECH_PROFILE.limiterThresholdDb;
      limiter.knee.value = 4;
      limiter.ratio.value = 12;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.12;
      const programmeGain = ctx.createGain();
      programmeGain.gain.value = SPEECH_PROFILE.programmeGain;
      const analyserOut = ctx.createAnalyser();
      analyserOut.fftSize = 2048;
      const dest = ctx.createMediaStreamDestination();

      highpass.connect(lowShelf);
      lowShelf.connect(highShelf);
      highShelf.connect(hum);
      hum.connect(analyserIn);
      analyserIn.connect(gate);
      gate.connect(agc);
      agc.connect(compressor);
      compressor.connect(limiter);
      limiter.connect(programmeGain);
      programmeGain.connect(analyserOut);
      analyserOut.connect(dest);

      nodes.current = {
        ctx,
        highpass,
        lowShelf,
        highShelf,
        hum,
        gate,
        agc,
        compressor,
        limiter,
        programmeGain,
        analyserIn,
        analyserOut,
        dest,
        rawVideo: videoStream,
      };
      connectAudioSource(ctx, audioStream);
      applySoundProfile(soundProfile(musicFilterRef.current ? "music" : "speech"));
      attachProgrammeAudio(dest.stream);

      if (videoRef.current) {
        videoRef.current.srcObject = videoStream;
        await videoRef.current.play().catch(() => undefined);
      }
      for (const canvas of [canvasRef.current, previewCanvasRef.current]) {
        if (canvas) {
          canvas.width = 1280;
          canvas.height = 720;
        }
      }
      paint();
      meterTimer.current = window.setInterval(tickMeters, 50);
      lumaTimer.current = window.setInterval(sampleLuma, 220);
      setStatus("live");
      setElapsedSec(0);
    } catch (e) {
      videoStream?.getTracks().forEach((t) => t.stop());
      audioStream?.getTracks().forEach((t) => t.stop());
      stopGraph();
      setStatus("error");
      setError(studioStartMessage(e));
    }
  }, [
    applySoundProfile,
    attachProgrammeAudio,
    cameraId,
    connectAudioSource,
    listDevices,
    micId,
    paint,
    recordingUrl,
    sampleLuma,
    stopGraph,
    tickMeters,
  ]);

  const stop = useCallback(() => {
    stopListening();
    stopGraph();
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus("idle");
    setRecording(false);
    setElapsedSec(0);
  }, [stopGraph, stopListening]);

  const selectCamera = useCallback(
    async (id: string) => {
      setCameraIdState(id);
      if (statusRef.current !== "live") return;
      setBusySource("camera");
      setError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: videoConstraintsFor(id),
        });
        nodes.current.rawVideo?.getTracks().forEach((t) => t.stop());
        nodes.current.rawVideo = stream;
        setCameraIdState(deviceIdFromStream(stream, "video") || id);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        await listDevices({ camera: deviceIdFromStream(stream, "video") || id });
      } catch (e) {
        setError(studioStartMessage(e));
      } finally {
        setBusySource(null);
      }
    },
    [listDevices],
  );

  const selectMic = useCallback(
    async (id: string) => {
      setMicIdState(id);
      if (statusRef.current !== "live" || !nodes.current.ctx) return;
      setBusySource("mic");
      setError(null);
      try {
        const stream = await getAudioStream(id);
        connectAudioSource(nodes.current.ctx, stream);
        setMicIdState(deviceIdFromStream(stream, "audio") || id);
        if (nodes.current.dest) attachProgrammeAudio(nodes.current.dest.stream);
        await listDevices({ mic: deviceIdFromStream(stream, "audio") || id });
      } catch (e) {
        setError(studioStartMessage(e));
      } finally {
        setBusySource(null);
      }
    },
    [attachProgrammeAudio, connectAudioSource, listDevices],
  );

  const setMonitor = useCallback((on: boolean) => {
    setMonitorState(on);
    monitorRef.current = on;
    const el = programmeAudioRef.current;
    if (el) el.muted = !on;
  }, []);

  const startRecording = useCallback(() => {
    const canvas = canvasRef.current;
    const dest = nodes.current.dest;
    if (!canvas || !dest || statusRef.current !== "live") return;
    if (nodes.current.ctx?.state === "suspended") {
      void nodes.current.ctx.resume();
    }
    const mixed = canvas.captureStream(30);
    const audioTracks = dest.stream.getAudioTracks().filter((t) => t.readyState === "live");
    if (audioTracks.length === 0) {
      setError("Recording did not get an audio track. Choose the Yamaha USB input, then record again.");
      return;
    }
    for (const track of audioTracks) mixed.addTrack(track);
    nodes.current.mixed = mixed;
    attachProgrammeAudio(dest.stream);

    const chunks: Blob[] = [];
    const mime = pickMime();
    const recorder = new MediaRecorder(mixed, {
      mimeType: mime || undefined,
      audioBitsPerSecond: 192_000,
      videoBitsPerSecond: 3_500_000,
    });
    recorder.ondataavailable = (ev) => {
      if (ev.data.size) chunks.push(ev.data);
    };
    recorder.onerror = () => {
      setError("Recording failed. Try Chrome or Edge, and confirm the mixer is selected.");
      setRecording(false);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mime || "video/webm" });
      if (recordingUrl) URL.revokeObjectURL(recordingUrl);
      setRecordingUrl(URL.createObjectURL(blob));
      setRecording(false);
    };
    nodes.current.recorder = recorder;
    nodes.current.chunks = chunks;
    recorder.start(250);
    setRecording(true);
  }, [attachProgrammeAudio, recordingUrl]);

  const stopRecording = useCallback(() => {
    const rec = nodes.current.recorder;
    if (rec && rec.state === "recording") rec.stop();
  }, []);

  const paintIdlePreview = useCallback(() => {
    if (statusRef.current === "live") return;
    const lookNow = lookRef.current;
    const auto = lookNow.auto ? videoAuto.current : { brightness: 1, contrast: 1 };
    paintStudioMonitor(previewCanvasRef.current, videoRef.current, overlayRef.current, lookNow, auto, true);
    paintStudioMonitor(canvasRef.current, videoRef.current, programOverlayRef.current, lookNow, auto, false);
  }, []);

  const updateOverlay = useCallback((patch: Partial<ProgrammeOverlay>) => {
    setOverlay((prev) => {
      const next = { ...prev, ...patch };
      if (patch.headline != null || patch.body != null) {
        ingestOverlayText(next.headline, next.body);
      }
      return next;
    });
  }, [ingestOverlayText]);

  const takeToLive = useCallback(() => {
    const draft = overlayRef.current;
    if (!draft.headline.trim() && !draft.body.trim()) return;
    const verse = liveVerseFromOverlay(draft.headline, draft.body);
    liveVerseRef.current = verse;
    setLiveVerse(verse);
    setProgramOverlay({ ...draft, visible: true });
    setOverlay((prev) => ({ ...EMPTY_OVERLAY, palette: prev.palette }));
    overlayHitsRef.current = [];
    bibleHitsRef.current = mergeBibleHits(speechHitsRef.current, []);
    setBibleHits([...bibleHitsRef.current]);
    setSelectedVerseRefs([]);
  }, []);

  const clearLive = useCallback(() => {
    liveVerseRef.current = null;
    setLiveVerse(null);
    setProgramOverlay((prev) => ({ ...prev, visible: false }));
  }, []);

  const putOverlayOnAir = takeToLive;
  const clearOverlay = clearLive;

  const stepLiveVerse = useCallback(async (direction: 1 | -1) => {
    const current =
      liveVerseRef.current ||
      liveVerseFromOverlay(programOverlayRef.current.headline, programOverlayRef.current.body);
    if (!current) return;
    setSteppingVerse(true);
    try {
      const next = await fetchAdjacentVerse(current, direction);
      if (!next) return;
      liveVerseRef.current = next.hit;
      setLiveVerse(next.hit);
      setProgramOverlay((prev) => ({
        ...prev,
        visible: true,
        design: "verse",
        headline: next.hit.display,
        body: next.text ? `${next.hit.display} — ${next.text}` : next.hit.display,
      }));
    } finally {
      setSteppingVerse(false);
    }
  }, []);

  const postBibleVerses = useCallback(async () => {
    const selected = new Set(selectedVerseRefs);
    const pending = bibleHitsRef.current.filter((h) => selected.has(h.display));
    if (!pending.length) return;
    setPostingVerse(true);
    try {
      const lines: string[] = [];
      for (const hit of pending) {
        const payload = await fetchVerseText(hit);
        lines.push(payload.text ? `${hit.display} — ${payload.text}` : hit.snippet || hit.display);
      }
      setOverlay((prev) => ({
        ...prev,
        visible: true,
        design: "verse",
        headline: pending.length === 1 ? pending[0]!.display : "Scripture",
        body: lines.join("\n\n"),
      }));
    } finally {
      setPostingVerse(false);
    }
  }, [selectedVerseRefs]);

  const toggleVerseHit = useCallback((display: string) => {
    setSelectedVerseRefs((prev) =>
      prev.includes(display) ? prev.filter((id) => id !== display) : [...prev, display],
    );
  }, []);

  const dismissBibleHits = useCallback(() => {
    speechHitsRef.current = [];
    overlayHitsRef.current = [];
    bibleHitsRef.current = [];
    spokenBufferRef.current = "";
    setBibleHits([]);
    setSelectedVerseRefs([]);
  }, []);

  useEffect(() => {
    void listDevices().catch(() => undefined);
    const onChange = () => void listDevices().catch(() => undefined);
    navigator.mediaDevices?.addEventListener?.("devicechange", onChange);
    return () => {
      navigator.mediaDevices?.removeEventListener?.("devicechange", onChange);
      stopListening();
      stopGraph();
      if (quoteTimerRef.current != null) window.clearTimeout(quoteTimerRef.current);
    };
  }, [listDevices, stopGraph, stopListening]);

  useEffect(() => {
    if (status !== "live") return;
    const t = window.setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [status]);

  useEffect(() => {
    overlayRef.current = overlay;
    programOverlayRef.current = programOverlay;
    paintIdlePreview();
  }, [overlay, programOverlay, status, paintIdlePreview]);

  return {
    videoRef,
    canvasRef,
    previewCanvasRef,
    programmeAudioRef,
    status,
    error,
    cameras,
    mics,
    cameraId,
    micId,
    selectCamera,
    selectMic,
    look,
    setLook,
    meters,
    recording,
    recordingUrl,
    elapsedSec,
    monitor,
    setMonitor,
    busySource,
    overlay,
    programOverlay,
    bibleHits,
    selectedVerseRefs,
    liveVerse,
    steppingVerse,
    musicFilter,
    setMusicFilter,
    listening,
    postingVerse,
    searchingQuotes,
    refreshDevices: listDevices,
    start,
    stop,
    startRecording,
    stopRecording,
    updateOverlay,
    takeToLive,
    clearLive,
    stepLiveVerse,
    putOverlayOnAir,
    clearOverlay,
    postBibleVerses,
    toggleVerseHit,
    startListening,
    stopListening,
    dismissBibleHits,
  };
}
