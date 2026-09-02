import { useCallback, useContext, useEffect, useRef, useState, createContext, type ReactNode } from "react";
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
  type ProgrammeOverlay,
} from "./studioOverlays";
import {
  activeSoundProfile,
  getAudioPreset,
  loadSoundSettings,
  makeReverbImpulse,
  reverbDecayPower,
  reverbDurationSec,
  reverbWetDry,
  saveSoundSettings,
  type AudioPresetId,
  type ReverbSettings,
  type StudioSoundSettings,
} from "./studioSound";
import {
  getSpeechRecognitionCtor,
  speechChunkFromEvent,
  type StudioSpeechRecognition,
} from "./studioSpeech";
import { apiGet, apiPost } from "./api";
import { connectWhip } from "./studioWhip";
import type { RestreamHealth } from "./studioLive";
import {
  applyMediaUse,
  audioOnlyPicture,
  classifyMediaFile,
  ensureStudioCanvas,
  mediaReady,
  paintStudioMonitor,
  pictureFit,
  shouldAdaptExposure,
  shouldMirrorPicture,
  isLiveAudioTrack,
  PROGRAM_AUDIO_MISSING,
  RECORDING_AUDIO_MISSING,
  tracksToStop,
  type MediaSlot,
  type MediaUse,
  type PictureFrame,
  type PictureKind,
  type SoundKind,
  type StudioClip,
} from "./studioMedia";

export type StudioStatus = "idle" | "live" | "error";
export type { MediaSlot, MediaUse, PictureKind, SoundKind, StudioClip };

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
  const attempts: MediaStreamConstraints[] = [
    { audio: audioConstraintsFor(deviceId), video: false },
    {
      audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
      video: false,
    },
    { audio: true, video: false },
  ];
  let last: unknown;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      last = err;
    }
  }
  throw last instanceof Error ? last : new Error("Could not open an audio input.");
}

function pickMime(): string {
  const supported =
    typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported
      ? (type: string) => MediaRecorder.isTypeSupported(type)
      : () => false;
  return pickRecordingMime(supported) || "video/webm";
}

export function useBroadcastStudioEngine() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileVideoRef = useRef<HTMLVideoElement | null>(null);
  const fileAudioRef = useRef<HTMLAudioElement | null>(null);
  const stillImageRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
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
  const soundSettingsRef = useRef<StudioSoundSettings>(loadSoundSettings());
  const liveVerseRef = useRef<BibleHit | null>(null);
  const recognitionRef = useRef<StudioSpeechRecognition | null>(null);
  const nodes = useRef<{
    ctx?: AudioContext;
    source?: AudioNode;
    highpass?: BiquadFilterNode;
    lowShelf?: BiquadFilterNode;
    highShelf?: BiquadFilterNode;
    hum?: BiquadFilterNode;
    gate?: GainNode;
    agc?: GainNode;
    compressor?: DynamicsCompressorNode;
    limiter?: DynamicsCompressorNode;
    programmeGain?: GainNode;
    dryGain?: GainNode;
    wetGain?: GainNode;
    preDelay?: DelayNode;
    convolver?: ConvolverNode;
    reverbSum?: GainNode;
    analyserIn?: AnalyserNode;
    analyserOut?: AnalyserNode;
    dest?: MediaStreamAudioDestinationNode;
    hold?: GainNode;
    elementAudio?: Map<HTMLMediaElement, MediaElementAudioSourceNode>;
    rawVideo?: MediaStream;
    rawAudio?: MediaStream;
    recorder?: MediaRecorder;
    chunks?: Blob[];
    raf?: number;
    mixed?: MediaStream;
    whip?: RTCPeerConnection;
    whipStream?: MediaStream;
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
  const [busySource, setBusySource] = useState<"camera" | "mic" | "media" | null>(null);
  const [overlay, setOverlay] = useState<ProgrammeOverlay>({ ...EMPTY_OVERLAY });
  const [programOverlay, setProgramOverlay] = useState<ProgrammeOverlay>({ ...EMPTY_OVERLAY });
  const [bibleHits, setBibleHits] = useState<BibleHit[]>([]);
  const [listening, setListening] = useState(false);
  const [postingVerse, setPostingVerse] = useState(false);
  const [searchingQuotes, setSearchingQuotes] = useState(false);
  const [socialLive, setSocialLive] = useState(false);
  const [socialConnecting, setSocialConnecting] = useState(false);
  const [socialPlatforms, setSocialPlatforms] = useState<string[]>([]);
  const [restreamHealth, setRestreamHealth] = useState<RestreamHealth | null>(null);
  const [outputFocus, setOutputFocus] = useState(false);
  const [selectedVerseRefs, setSelectedVerseRefs] = useState<string[]>([]);
  const [musicFilter, setMusicFilterState] = useState(false);
  const [soundSettings, setSoundSettingsState] = useState<StudioSoundSettings>(() => loadSoundSettings());
  const [liveVerse, setLiveVerse] = useState<BibleHit | null>(null);
  const [steppingVerse, setSteppingVerse] = useState(false);
  const [pictureKind, setPictureKindState] = useState<PictureKind>("camera");
  const [soundKind, setSoundKindState] = useState<SoundKind>("mic");
  const [videoClip, setVideoClip] = useState<StudioClip | null>(null);
  const [stillClip, setStillClip] = useState<StudioClip | null>(null);
  const [audioClip, setAudioClip] = useState<StudioClip | null>(null);
  const [mediaLoop, setMediaLoopState] = useState(true);
  const [mediaPlaying, setMediaPlaying] = useState(false);
  const pictureKindRef = useRef<PictureKind>("camera");
  const soundKindRef = useRef<SoundKind>("mic");
  const videoClipRef = useRef<StudioClip | null>(null);
  const stillClipRef = useRef<StudioClip | null>(null);
  const audioClipRef = useRef<StudioClip | null>(null);
  const mediaLoopRef = useRef(true);
  const preferredMicLabelRef = useRef("");

  lookRef.current = look;
  overlayRef.current = overlay;
  programOverlayRef.current = programOverlay;
  statusRef.current = status;
  monitorRef.current = monitor;
  musicFilterRef.current = musicFilter;
  soundSettingsRef.current = soundSettings;
  pictureKindRef.current = pictureKind;
  soundKindRef.current = soundKind;
  videoClipRef.current = videoClip;
  stillClipRef.current = stillClip;
  audioClipRef.current = audioClip;
  mediaLoopRef.current = mediaLoop;

  const attachProgrammeAudio = useCallback((stream: MediaStream | undefined) => {
    const el = programmeAudioRef.current;
    if (!el) return;
    const prev = el.srcObject;
    if (prev instanceof MediaStream) {
      prev.getTracks().forEach((t) => t.stop());
    }
    el.srcObject = stream ? stream.clone() : null;
    el.muted = !monitorRef.current;
    el.volume = 1;
    if (stream) void el.play().catch(() => undefined);
  }, []);

  const stopOutgoing = useCallback((stream?: MediaStream) => {
    const preserve = nodes.current.dest?.stream.getTracks() ?? [];
    for (const track of tracksToStop(stream?.getTracks() ?? [], preserve)) {
      track.stop();
    }
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

  const stopGraph = useCallback((closeCtx = false) => {
    const n = nodes.current;
    if (n.raf) cancelAnimationFrame(n.raf);
    n.raf = undefined;
    if (meterTimer.current != null) window.clearInterval(meterTimer.current);
    if (lumaTimer.current != null) window.clearInterval(lumaTimer.current);
    meterTimer.current = null;
    lumaTimer.current = null;
    if (n.recorder?.state === "recording") n.recorder.stop();
    n.whip?.close();
    stopOutgoing(n.whipStream);
    n.rawVideo?.getTracks().forEach((t) => t.stop());
    n.rawAudio?.getTracks().forEach((t) => t.stop());
    stopOutgoing(n.mixed);
    n.source?.disconnect();
    n.source = undefined;
    n.whip = undefined;
    n.whipStream = undefined;
    n.rawVideo = undefined;
    n.rawAudio = undefined;
    n.mixed = undefined;
    n.recorder = undefined;
    n.chunks = undefined;
    attachProgrammeAudio(undefined);
    setSocialLive(false);
    setSocialConnecting(false);
    setSocialPlatforms([]);
    setRestreamHealth(null);
    setOutputFocus(false);
    setMediaPlaying(false);
    if (closeCtx) {
      void n.ctx?.close();
      nodes.current = {};
      audioState.current = { ...INITIAL_AUDIO_STATE };
      videoAuto.current = { ...INITIAL_VIDEO_AUTO };
    }
  }, [attachProgrammeAudio, stopOutgoing]);

  const listDevices = useCallback(async (prefer?: { camera?: string; mic?: string; micLabel?: string }) => {
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
    if (prefer?.micLabel) preferredMicLabelRef.current = prefer.micLabel;
    setMicIdState((id) => keepDeviceId(prefer?.mic || id, mic as NamedDevice[], preferredMicLabelRef.current));
  }, []);

  const currentFrame = useCallback((): PictureFrame => {
    const kind = pictureKindRef.current;
    return {
      video: kind === "file-video" ? fileVideoRef.current : kind === "camera" ? videoRef.current : null,
      image: kind === "still" ? stillImageRef.current : null,
      mirror: shouldMirrorPicture(kind, lookRef.current.mirror),
      fit: pictureFit(kind),
    };
  }, []);

  const paint = useCallback(() => {
    const n = nodes.current;
    const lookNow = lookRef.current;
    const frame = currentFrame();
    const auto =
      lookNow.auto && shouldAdaptExposure(pictureKindRef.current)
        ? videoAuto.current
        : { brightness: 1, contrast: 1 };
    paintStudioMonitor(captureCanvasRef.current, frame, programOverlayRef.current, lookNow, auto, false);
    paintStudioMonitor(previewCanvasRef.current, frame, overlayRef.current, lookNow, auto, true);
    paintStudioMonitor(canvasRef.current, frame, programOverlayRef.current, lookNow, auto, false);
    n.raf = requestAnimationFrame(paint);
  }, [currentFrame]);

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
    const settings = soundSettingsRef.current;
    const profile = activeSoundProfile(settings, musicFilterRef.current);
    audioState.current = tickAudio(
      audioState.current,
      rms,
      peak,
      profile,
      settings.auto,
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
    const canvas = captureCanvasRef.current || canvasRef.current;
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
    if (lookRef.current.auto && shouldAdaptExposure(pictureKindRef.current)) {
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

  const applyReverbSettings = useCallback((reverb: ReverbSettings, rebuildImpulse = true) => {
    const n = nodes.current;
    const ctx = n.ctx;
    if (!ctx || !n.dryGain || !n.wetGain || !n.preDelay) return;
    const t = ctx.currentTime;
    const mix = reverbWetDry(reverb.mix, reverb.enabled);
    n.dryGain.gain.setTargetAtTime(mix.dry, t, 0.06);
    n.wetGain.gain.setTargetAtTime(mix.wet, t, 0.06);
    n.preDelay.delayTime.setTargetAtTime(reverb.preDelayMs / 1000, t, 0.06);
    if (rebuildImpulse && n.convolver) {
      n.convolver.buffer = makeReverbImpulse(
        ctx,
        reverbDurationSec(reverb.roomSize),
        reverbDecayPower(reverb.decay),
      );
    }
  }, []);

  const applyActiveSound = useCallback(() => {
    const settings = soundSettingsRef.current;
    applySoundProfile(activeSoundProfile(settings, musicFilterRef.current));
    applyReverbSettings(settings.reverb);
  }, [applyReverbSettings, applySoundProfile]);

  const persistSoundSettings = useCallback(
    (next: StudioSoundSettings, rebuildImpulse = true) => {
      soundSettingsRef.current = next;
      setSoundSettingsState(next);
      saveSoundSettings(next);
      applySoundProfile(activeSoundProfile(next, musicFilterRef.current));
      applyReverbSettings(next.reverb, rebuildImpulse);
    },
    [applyReverbSettings, applySoundProfile],
  );

  const setSoundAuto = useCallback(
    (auto: boolean) => {
      persistSoundSettings({ ...soundSettingsRef.current, auto });
    },
    [persistSoundSettings],
  );

  const setAudioPreset = useCallback(
    (preset: AudioPresetId) => {
      const pack = getAudioPreset(preset);
      persistSoundSettings({
        auto: false,
        preset,
        reverb: { ...pack.reverb },
      });
    },
    [persistSoundSettings],
  );

  const setReverb = useCallback(
    (patch: Partial<ReverbSettings>) => {
      const current = soundSettingsRef.current;
      const rebuildImpulse = patch.roomSize != null || patch.decay != null || patch.enabled === true;
      persistSoundSettings(
        {
          ...current,
          reverb: { ...current.reverb, ...patch },
        },
        rebuildImpulse,
      );
    },
    [persistSoundSettings],
  );

  const setMusicFilter = useCallback(
    (on: boolean) => {
      musicFilterRef.current = on;
      setMusicFilterState(on);
      if (soundSettingsRef.current.auto) {
        applySoundProfile(soundProfile(on ? "music" : "speech"));
      }
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

  const connectElementAudio = useCallback((ctx: AudioContext, el: HTMLMediaElement) => {
    const n = nodes.current;
    n.source?.disconnect();
    n.rawAudio?.getTracks().forEach((t) => t.stop());
    n.rawAudio = undefined;
    if (!n.elementAudio) n.elementAudio = new Map();
    let source = n.elementAudio.get(el);
    if (!source) {
      try {
        source = ctx.createMediaElementSource(el);
        n.elementAudio.set(el, source);
      } catch {
        const capture = (el as unknown as { captureStream?: () => MediaStream }).captureStream;
        const captured = typeof capture === "function" ? capture.call(el) : undefined;
        const audio = captured?.getAudioTracks().filter(isLiveAudioTrack) ?? [];
        if (audio.length === 0) throw new Error("Could not take audio from that file.");
        const stream = new MediaStream(audio);
        const fromFile = ctx.createMediaStreamSource(stream);
        if (n.highpass) fromFile.connect(n.highpass);
        n.source = fromFile;
        n.rawAudio = stream;
        return;
      }
    }
    if (n.highpass) source.connect(n.highpass);
    n.source = source;
  }, []);

  const playFileElement = useCallback(async (el: HTMLMediaElement | null, wantSound: boolean) => {
    if (!el) return;
    el.volume = 1;
    try {
      el.muted = !wantSound;
      await el.play();
    } catch {
      try {
        el.muted = true;
        await el.play();
      } catch {
        return;
      }
    }
    if (wantSound) el.muted = false;
  }, []);

  const ensureLiveProgrammeDest = useCallback(async () => {
    const n = nodes.current;
    const ctx = n.ctx;
    if (!ctx || ctx.state === "closed") return null;
    if (ctx.state === "suspended") await ctx.resume();
    const live = n.dest?.stream.getAudioTracks().filter(isLiveAudioTrack) ?? [];
    if (n.dest && live.length > 0) return n.dest;
    const dest = ctx.createMediaStreamDestination();
    n.analyserOut?.connect(dest);
    n.dest = dest;
    attachProgrammeAudio(dest.stream);
    return dest;
  }, [attachProgrammeAudio]);

  const disconnectProgramAudio = useCallback(() => {
    const n = nodes.current;
    n.source?.disconnect();
    n.source = undefined;
    n.rawAudio?.getTracks().forEach((t) => t.stop());
    n.rawAudio = undefined;
  }, []);

  const loadedMedia = useCallback(
    () => ({
      hasVideoFile: Boolean(videoClipRef.current),
      hasStill: Boolean(stillClipRef.current),
      hasAudioFile: Boolean(audioClipRef.current),
    }),
    [],
  );

  const sizeProgramCanvases = useCallback(() => {
    for (const canvas of [captureCanvasRef.current, canvasRef.current, previewCanvasRef.current]) {
      if (canvas) {
        canvas.width = 1280;
        canvas.height = 720;
        ensureStudioCanvas(canvas);
      }
    }
  }, []);

  const startMonitors = useCallback(() => {
    const n = nodes.current;
    if (n.raf) cancelAnimationFrame(n.raf);
    if (meterTimer.current != null) window.clearInterval(meterTimer.current);
    if (lumaTimer.current != null) window.clearInterval(lumaTimer.current);
    sizeProgramCanvases();
    paint();
    meterTimer.current = window.setInterval(tickMeters, 50);
    lumaTimer.current = window.setInterval(sampleLuma, 220);
  }, [paint, sampleLuma, sizeProgramCanvases, tickMeters]);

  const ensureGraph = useCallback(async () => {
    const existing = nodes.current.ctx;
    if (existing && existing.state !== "closed") {
      if (existing.state === "suspended") await existing.resume();
      return;
    }
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
    const dryGain = ctx.createGain();
    dryGain.gain.value = 1;
    const wetGain = ctx.createGain();
    wetGain.gain.value = 0;
    const preDelay = ctx.createDelay(1);
    preDelay.delayTime.value = 0.018;
    const convolver = ctx.createConvolver();
    convolver.normalize = true;
    const reverbSum = ctx.createGain();
    reverbSum.gain.value = 1;
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
    programmeGain.connect(dryGain);
    programmeGain.connect(preDelay);
    preDelay.connect(convolver);
    convolver.connect(wetGain);
    dryGain.connect(reverbSum);
    wetGain.connect(reverbSum);
    reverbSum.connect(analyserOut);
    analyserOut.connect(dest);
    const hold = ctx.createGain();
    hold.gain.value = 0;
    analyserOut.connect(hold);
    hold.connect(ctx.destination);

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
      dryGain,
      wetGain,
      preDelay,
      convolver,
      reverbSum,
      analyserIn,
      analyserOut,
      dest,
      hold,
      elementAudio: new Map(),
    };
    applyActiveSound();
    attachProgrammeAudio(dest.stream);
  }, [applyActiveSound, attachProgrammeAudio]);

  const applyProgramSources = useCallback(async () => {
    const picture = pictureKindRef.current;
    const sound = soundKindRef.current;
    const ready = mediaReady(picture, sound, loadedMedia());
    if (!ready.ok) throw new Error(ready.reason);
    await ensureGraph();
    const ctx = nodes.current.ctx;
    if (!ctx) throw new Error("Could not start the studio.");

    if (picture === "camera") {
      const liveTrack = nodes.current.rawVideo?.getVideoTracks()[0];
      if (!liveTrack || liveTrack.readyState !== "live") {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: videoConstraintsFor(cameraId),
        });
        nodes.current.rawVideo?.getTracks().forEach((t) => t.stop());
        nodes.current.rawVideo = stream;
        const liveCam = deviceIdFromStream(stream, "video") || cameraId;
        setCameraIdState(liveCam);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        await listDevices({ camera: liveCam });
      }
    } else {
      nodes.current.rawVideo?.getTracks().forEach((t) => t.stop());
      nodes.current.rawVideo = undefined;
      if (videoRef.current) videoRef.current.srcObject = null;
    }

    const videoEl = fileVideoRef.current;
    const audioEl = fileAudioRef.current;
    const loop = mediaLoopRef.current;
    if (videoEl) {
      videoEl.loop = loop;
      videoEl.muted = sound !== "file-video";
    }
    if (audioEl) audioEl.loop = loop;

    if (picture === "file-video" || sound === "file-video") {
      await playFileElement(videoEl, sound === "file-video");
    } else if (videoEl) {
      videoEl.pause();
    }
    if (sound === "file-audio") {
      await playFileElement(audioEl, true);
    } else if (audioEl) {
      audioEl.pause();
    }

    if (sound === "mic") {
      const stream = await getAudioStream(micId);
      connectAudioSource(ctx, stream);
      const liveMic = deviceIdFromStream(stream, "audio") || micId;
      if (liveMic) preferredMicLabelRef.current = "";
      setMicIdState(liveMic);
      await listDevices({ mic: liveMic });
    } else if (sound === "file-audio" && audioEl) {
      connectElementAudio(ctx, audioEl);
    } else if (sound === "file-video" && videoEl) {
      connectElementAudio(ctx, videoEl);
    } else {
      disconnectProgramAudio();
    }

    if (nodes.current.dest) attachProgrammeAudio(nodes.current.dest.stream);
    setMediaPlaying(
      (picture === "file-video" || sound === "file-video" || sound === "file-audio") &&
        !(videoEl?.paused && audioEl?.paused),
    );
  }, [
    attachProgrammeAudio,
    cameraId,
    connectAudioSource,
    connectElementAudio,
    disconnectProgramAudio,
    ensureGraph,
    listDevices,
    loadedMedia,
    micId,
    playFileElement,
  ]);

  const opChain = useRef(Promise.resolve());
  const runStudioOp = useCallback((fn: () => Promise<void>) => {
    const run = opChain.current.then(fn, fn);
    opChain.current = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }, []);

  const start = useCallback(async () => {
    await runStudioOp(async () => {
      setError(null);
      stopGraph(false);
      if (recordingUrl) {
        URL.revokeObjectURL(recordingUrl);
        setRecordingUrl(null);
      }
      try {
        await applyProgramSources();
        await ensureLiveProgrammeDest();
        startMonitors();
        statusRef.current = "live";
        setStatus("live");
        setElapsedSec(0);
      } catch (e) {
        stopGraph(false);
        statusRef.current = "error";
        setStatus("error");
        setError(studioStartMessage(e));
      }
    });
  }, [applyProgramSources, ensureLiveProgrammeDest, recordingUrl, runStudioOp, startMonitors, stopGraph]);

  const stop = useCallback(() => {
    stopListening();
    stopGraph(false);
    if (videoRef.current) videoRef.current.srcObject = null;
    fileVideoRef.current?.pause();
    fileAudioRef.current?.pause();
    setMediaPlaying(false);
    statusRef.current = "idle";
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
        pictureKindRef.current = "camera";
        setPictureKindState("camera");
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
      const chosen = mics.find((m) => m.deviceId === id);
      preferredMicLabelRef.current = chosen?.label || preferredMicLabelRef.current;
      setMicIdState(id);
      if (statusRef.current !== "live" || !nodes.current.ctx) return;
      setBusySource("mic");
      setError(null);
      try {
        soundKindRef.current = "mic";
        setSoundKindState("mic");
        const stream = await getAudioStream(id);
        connectAudioSource(nodes.current.ctx, stream);
        const liveMic = deviceIdFromStream(stream, "audio") || id;
        setMicIdState(liveMic);
        if (nodes.current.dest) attachProgrammeAudio(nodes.current.dest.stream);
        await listDevices({ mic: liveMic, micLabel: preferredMicLabelRef.current });
      } catch (e) {
        setError(studioStartMessage(e));
      } finally {
        setBusySource(null);
      }
    },
    [attachProgrammeAudio, connectAudioSource, listDevices, mics],
  );

  const setMonitor = useCallback((on: boolean) => {
    setMonitorState(on);
    monitorRef.current = on;
    const el = programmeAudioRef.current;
    if (el) el.muted = !on;
  }, []);

  const programmeMix = useCallback(async (): Promise<MediaStream | null> => {
    const canvas = captureCanvasRef.current || canvasRef.current;
    if (!canvas || statusRef.current !== "live") return null;
    const dest = await ensureLiveProgrammeDest();
    if (!dest) return null;
    const mixed = canvas.captureStream(30);
    const audioTracks = dest.stream.getAudioTracks().filter(isLiveAudioTrack);
    for (const track of audioTracks) mixed.addTrack(track.clone());
    return mixed;
  }, [ensureLiveProgrammeDest]);

  const startRecording = useCallback(() => {
    void (async () => {
      const canvas = captureCanvasRef.current || canvasRef.current;
      if (!canvas || statusRef.current !== "live") return;
      const dest = await ensureLiveProgrammeDest();
      if (!dest) return;
      const mixed = canvas.captureStream(30);
      const audioTracks = dest.stream.getAudioTracks().filter(isLiveAudioTrack);
      if (audioTracks.length === 0) {
        setError(RECORDING_AUDIO_MISSING);
        return;
      }
      for (const track of audioTracks) mixed.addTrack(track.clone());
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
        setError("Recording failed. Try Chrome or Edge, and confirm an audio input is selected.");
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
    })();
  }, [attachProgrammeAudio, ensureLiveProgrammeDest, recordingUrl]);

  const stopRecording = useCallback(() => {
    const rec = nodes.current.recorder;
    if (rec && rec.state === "recording") rec.stop();
  }, []);

  const stopSocialLive = useCallback(() => {
    const n = nodes.current;
    n.whip?.close();
    n.whip = undefined;
    stopOutgoing(n.whipStream);
    n.whipStream = undefined;
    setSocialLive(false);
    setSocialConnecting(false);
    setSocialPlatforms([]);
    setRestreamHealth(null);
  }, [stopOutgoing]);

  const startSocialLive = useCallback(async () => {
    if (statusRef.current !== "live") {
      setError("Send a video, picture or audio to Program first, then go live.");
      return;
    }
    const mixed = await programmeMix();
    if (!mixed || mixed.getVideoTracks().length === 0) {
      stopOutgoing(mixed ?? undefined);
      setError("Program has no picture yet. Send a video or picture to Program, then go live.");
      return;
    }
    if (mixed.getAudioTracks().filter(isLiveAudioTrack).length === 0) {
      stopOutgoing(mixed);
      setError(PROGRAM_AUDIO_MISSING);
      return;
    }
    setSocialConnecting(true);
    setError(null);
    setRestreamHealth(null);
    try {
      const session = await apiPost<{ mode: string; whipUrl: string; platforms: string[] }>(
        "/studio/live/session",
      );
      const pc = await connectWhip(mixed, session.whipUrl);
      nodes.current.whip?.close();
      stopOutgoing(nodes.current.whipStream);
      nodes.current.whip = pc;
      nodes.current.whipStream = mixed;
      setSocialPlatforms(session.platforms ?? []);
      setSocialLive(true);
    } catch (e) {
      stopOutgoing(mixed);
      setSocialLive(false);
      setError((e as Error).message || "Could not go live to social.");
    } finally {
      setSocialConnecting(false);
    }
  }, [programmeMix, stopOutgoing]);

  const syncSocialPlatforms = useCallback((platforms: string[]) => {
    setSocialPlatforms(platforms);
  }, []);

  const goLiveToAir = useCallback(async () => {
    await runStudioOp(async () => {
      if (statusRef.current !== "live") {
        setError(null);
        stopGraph(false);
        try {
          await applyProgramSources();
          await ensureLiveProgrammeDest();
          startMonitors();
          statusRef.current = "live";
          setStatus("live");
          setElapsedSec(0);
        } catch (e) {
          stopGraph(false);
          statusRef.current = "error";
          setStatus("error");
          setError(studioStartMessage(e));
        }
      }
    });
    if (statusRef.current !== "live") return;
    await startSocialLive();
  }, [
    applyProgramSources,
    ensureLiveProgrammeDest,
    runStudioOp,
    startMonitors,
    startSocialLive,
    stopGraph,
  ]);

  const paintIdlePreview = useCallback(() => {
    if (statusRef.current === "live") return;
    const lookNow = lookRef.current;
    const frame = currentFrame();
    const auto =
      lookNow.auto && shouldAdaptExposure(pictureKindRef.current)
        ? videoAuto.current
        : { brightness: 1, contrast: 1 };
    paintStudioMonitor(captureCanvasRef.current, frame, programOverlayRef.current, lookNow, auto, false);
    paintStudioMonitor(previewCanvasRef.current, frame, overlayRef.current, lookNow, auto, true);
    paintStudioMonitor(canvasRef.current, frame, programOverlayRef.current, lookNow, auto, false);
  }, [currentFrame]);

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

  const setMediaLoop = useCallback((on: boolean) => {
    mediaLoopRef.current = on;
    setMediaLoopState(on);
    if (fileVideoRef.current) fileVideoRef.current.loop = on;
    if (fileAudioRef.current) fileAudioRef.current.loop = on;
  }, []);

  const loadStudioFile = useCallback(async (slot: MediaSlot, file: File) => {
    const kind = classifyMediaFile(file);
    if (kind && kind !== slot) {
      setError(`That file is ${kind}, not ${slot}. Choose a matching file.`);
      return;
    }
    if (!kind) {
      setError("Use a video, picture, or audio file.");
      return;
    }
    setError(null);
    const url = URL.createObjectURL(file);
    const clip: StudioClip = { name: file.name, url, durationSec: null };
    if (slot === "video") {
      if (videoClipRef.current?.url) URL.revokeObjectURL(videoClipRef.current.url);
      videoClipRef.current = clip;
      setVideoClip(clip);
      const el = fileVideoRef.current;
      if (el) {
        el.src = url;
        el.loop = mediaLoopRef.current;
        el.onloadedmetadata = () => {
          const duration = Number.isFinite(el.duration) ? el.duration : null;
          const next = { ...clip, durationSec: duration };
          videoClipRef.current = next;
          setVideoClip(next);
        };
      }
    } else if (slot === "picture") {
      if (stillClipRef.current?.url) URL.revokeObjectURL(stillClipRef.current.url);
      stillClipRef.current = clip;
      setStillClip(clip);
      const img = stillImageRef.current;
      if (img) {
        img.onload = () => paintIdlePreview();
        img.src = url;
      }
    } else {
      if (audioClipRef.current?.url) URL.revokeObjectURL(audioClipRef.current.url);
      audioClipRef.current = clip;
      setAudioClip(clip);
      const el = fileAudioRef.current;
      if (el) {
        el.src = url;
        el.loop = mediaLoopRef.current;
        el.onloadedmetadata = () => {
          const duration = Number.isFinite(el.duration) ? el.duration : null;
          const next = { ...clip, durationSec: duration };
          audioClipRef.current = next;
          setAudioClip(next);
        };
      }
    }
    paintIdlePreview();
  }, [paintIdlePreview]);

  const clearStudioFile = useCallback(
    async (slot: MediaSlot) => {
      if (slot === "video") {
        if (videoClipRef.current?.url) URL.revokeObjectURL(videoClipRef.current.url);
        videoClipRef.current = null;
        setVideoClip(null);
        if (fileVideoRef.current) {
          fileVideoRef.current.removeAttribute("src");
          fileVideoRef.current.load();
        }
        if (pictureKindRef.current === "file-video") {
          pictureKindRef.current = "black";
          setPictureKindState("black");
        }
        if (soundKindRef.current === "file-video") {
          soundKindRef.current = "silent";
          setSoundKindState("silent");
        }
      } else if (slot === "picture") {
        if (stillClipRef.current?.url) URL.revokeObjectURL(stillClipRef.current.url);
        stillClipRef.current = null;
        setStillClip(null);
        if (stillImageRef.current) stillImageRef.current.removeAttribute("src");
        if (pictureKindRef.current === "still") {
          pictureKindRef.current = "black";
          setPictureKindState("black");
        }
      } else {
        if (audioClipRef.current?.url) URL.revokeObjectURL(audioClipRef.current.url);
        audioClipRef.current = null;
        setAudioClip(null);
        if (fileAudioRef.current) {
          fileAudioRef.current.removeAttribute("src");
          fileAudioRef.current.load();
        }
        if (soundKindRef.current === "file-audio") {
          soundKindRef.current = "silent";
          setSoundKindState("silent");
        }
      }
      paintIdlePreview();
      if (statusRef.current === "live") {
        await applyProgramSources().catch((e) => setError(studioStartMessage(e)));
      }
    },
    [applyProgramSources, paintIdlePreview],
  );

  const commitSources = useCallback(
    async (next: { picture: PictureKind; sound: SoundKind }) => {
      const ready = mediaReady(next.picture, next.sound, loadedMedia());
      if (!ready.ok) {
        setError(ready.reason);
        return;
      }
      setError(null);
      pictureKindRef.current = next.picture;
      soundKindRef.current = next.sound;
      setPictureKindState(next.picture);
      setSoundKindState(next.sound);
      if (statusRef.current !== "live") {
        await start();
        return;
      }
      await applyProgramSources();
      startMonitors();
    },
    [applyProgramSources, loadedMedia, start, startMonitors],
  );

  const useStudioMedia = useCallback(
    async (slot: MediaSlot, use: MediaUse) => {
      setBusySource("media");
      try {
        let next = applyMediaUse(slot, use, {
          picture: pictureKindRef.current,
          sound: soundKindRef.current,
        });
        if (slot === "audio" && statusRef.current !== "live") {
          next = { ...next, picture: audioOnlyPicture(next.picture) };
        }
        if (use === "picture" && statusRef.current !== "live" && next.sound === "mic") {
          next = { ...next, sound: "silent" };
        }
        await commitSources(next);
      } catch (e) {
        setError(studioStartMessage(e));
      } finally {
        setBusySource(null);
      }
    },
    [commitSources],
  );

  const useCameraPicture = useCallback(async () => {
    setBusySource("media");
    try {
      await commitSources({ picture: "camera", sound: soundKindRef.current });
    } catch (e) {
      setError(studioStartMessage(e));
    } finally {
      setBusySource(null);
    }
  }, [commitSources]);

  const useDeskMic = useCallback(async () => {
    setBusySource("media");
    try {
      await commitSources({ picture: pictureKindRef.current, sound: "mic" });
    } catch (e) {
      setError(studioStartMessage(e));
    } finally {
      setBusySource(null);
    }
  }, [commitSources]);

  const useBlackFrame = useCallback(async () => {
    setBusySource("media");
    try {
      await commitSources({ picture: "black", sound: soundKindRef.current });
    } catch (e) {
      setError(studioStartMessage(e));
    } finally {
      setBusySource(null);
    }
  }, [commitSources]);

  const useSilentSound = useCallback(async () => {
    setBusySource("media");
    try {
      await commitSources({ picture: pictureKindRef.current, sound: "silent" });
    } catch (e) {
      setError(studioStartMessage(e));
    } finally {
      setBusySource(null);
    }
  }, [commitSources]);

  const playStudioMedia = useCallback(async () => {
    const picture = pictureKindRef.current;
    const sound = soundKindRef.current;
    try {
      if (picture === "file-video" || sound === "file-video") {
        await fileVideoRef.current?.play();
      }
      if (sound === "file-audio") await fileAudioRef.current?.play();
      setMediaPlaying(true);
    } catch (e) {
      setError(studioStartMessage(e));
    }
  }, []);

  const pauseStudioMedia = useCallback(() => {
    fileVideoRef.current?.pause();
    fileAudioRef.current?.pause();
    setMediaPlaying(false);
  }, []);

  const seekStudioMedia = useCallback((seconds: number) => {
    const picture = pictureKindRef.current;
    const sound = soundKindRef.current;
    if ((picture === "file-video" || sound === "file-video") && fileVideoRef.current) {
      fileVideoRef.current.currentTime = seconds;
    }
    if (sound === "file-audio" && fileAudioRef.current) {
      fileAudioRef.current.currentTime = seconds;
    }
  }, []);

  useEffect(() => {
    void listDevices().catch(() => undefined);
    const onChange = () => void listDevices().catch(() => undefined);
    navigator.mediaDevices?.addEventListener?.("devicechange", onChange);
    return () => {
      navigator.mediaDevices?.removeEventListener?.("devicechange", onChange);
      stopListening();
      stopGraph(true);
      if (quoteTimerRef.current != null) window.clearTimeout(quoteTimerRef.current);
      for (const clip of [videoClipRef.current, stillClipRef.current, audioClipRef.current]) {
        if (clip?.url) URL.revokeObjectURL(clip.url);
      }
    };
  }, [listDevices, stopGraph, stopListening]);

  useEffect(() => {
    if (status !== "live") return;
    const t = window.setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [status]);

  useEffect(() => {
    if (!socialLive) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const health = await apiGet<RestreamHealth>("/studio/live/health");
        if (!cancelled) setRestreamHealth(health);
      } catch {
        if (!cancelled) setRestreamHealth(null);
      }
    };
    void tick();
    const timer = window.setInterval(() => void tick(), 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [socialLive]);

  useEffect(() => {
    overlayRef.current = overlay;
    programOverlayRef.current = programOverlay;
    paintIdlePreview();
  }, [overlay, programOverlay, status, pictureKind, stillClip, videoClip, paintIdlePreview]);

  return {
    videoRef,
    fileVideoRef,
    fileAudioRef,
    stillImageRef,
    canvasRef,
    previewCanvasRef,
    captureCanvasRef,
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
    soundSettings,
    setSoundAuto,
    setAudioPreset,
    setReverb,
    listening,
    postingVerse,
    searchingQuotes,
    refreshDevices: listDevices,
    start,
    stop,
    startRecording,
    stopRecording,
    startSocialLive,
    goLiveToAir,
    stopSocialLive,
    syncSocialPlatforms,
    socialLive,
    socialConnecting,
    socialPlatforms,
    restreamHealth,
    outputFocus,
    setOutputFocus,
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
    pictureKind,
    soundKind,
    videoClip,
    stillClip,
    audioClip,
    mediaLoop,
    setMediaLoop,
    mediaPlaying,
    loadStudioFile,
    clearStudioFile,
    useStudioMedia,
    useCameraPicture,
    useDeskMic,
    useBlackFrame,
    useSilentSound,
    playStudioMedia,
    pauseStudioMedia,
    seekStudioMedia,
  };
}

const BroadcastStudioContext = createContext<ReturnType<typeof useBroadcastStudioEngine> | null>(null);

export function BroadcastStudioProvider({ children }: { children: ReactNode }) {
  const studio = useBroadcastStudioEngine();
  return (
    <BroadcastStudioContext.Provider value={studio}>
      <audio ref={studio.programmeAudioRef} className="hidden" />
      <video ref={studio.videoRef} className="hidden" playsInline muted />
      <video
        ref={studio.fileVideoRef}
        playsInline
        className="pointer-events-none fixed left-[-2000px] top-0 h-px w-px"
      />
      <audio
        ref={studio.fileAudioRef}
        className="pointer-events-none fixed left-[-2000px] top-0 h-px w-px"
      />
      <img ref={studio.stillImageRef} alt="" className="hidden" />
      <canvas
        ref={studio.captureCanvasRef}
        width={1280}
        height={720}
        aria-hidden
        className="pointer-events-none fixed left-[-2000px] top-0 h-[720px] w-[1280px]"
      />
      {children}
    </BroadcastStudioContext.Provider>
  );
}

export function useBroadcastStudio() {
  const ctx = useContext(BroadcastStudioContext);
  if (!ctx) {
    throw new Error("useBroadcastStudio must be used inside BroadcastStudioProvider");
  }
  return ctx;
}
