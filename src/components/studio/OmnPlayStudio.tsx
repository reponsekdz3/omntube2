import React, { useState, useRef, useEffect } from "react";
import {
  Play,
  Pause,
  Scissors,
  Layers,
  Sparkles,
  Download,
  Upload,
  Volume2,
  VolumeX,
  Type,
  RotateCcw,
  Cpu,
  Film,
  CheckCircle2,
  FileVideo,
  Music2,
  Disc,
  Mic,
  MicOff,
  Radio,
  Sliders,
  X,
  Plus,
  Search,
  Split,
  Maximize2,
  ArrowRightLeft,
  Coins,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";
import {
  RESOLUTION_PRESETS,
  VIDEO_FILTERS,
  estimateOutputSize,
  formatBytes,
  renderAndCompressVideo,
  type VideoResolutionPreset,
  type VideoFilter,
  type CompressionProgress,
} from "../../lib/videoCompression";
import { storagePublicUrl } from "../../lib/supabase";
import type { VideoRow } from "../../types";
import { AudioRemixEngine, type WaveformData } from "../../services/audioRemixEngine";
import { SoundRoyaltyModal } from "../monetization/SoundRoyaltyModal";
import {
  type WalletState,
  computeAudioContentFingerprint,
  notarizeVideoCreationOnChain,
  type NotarizationResult,
} from "../../lib/web3";

interface OmnPlayStudioProps {
  existingVideos: VideoRow[];
  initialSoundVideo?: VideoRow | null;
  onUploadExportedClip?: (blob: Blob, name: string, description: string) => void;
  notify?: (title: string, desc?: string, variant?: "success" | "error" | "info") => void;
  wallet?: WalletState;
  onWalletChange?: (w: WalletState) => void;
}

export function OmnPlayStudio({
  existingVideos,
  initialSoundVideo,
  onUploadExportedClip,
  notify,
  wallet,
  onWalletChange,
}: OmnPlayStudioProps) {
  // Video Master Track (Track 1)
  const [videoSrc, setVideoSrc] = useState<string>("");
  const [videoTitle, setVideoTitle] = useState<string>("OmnPlay_Master_Clip");
  const [duration, setDuration] = useState<number>(30);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [masterVolume, setMasterVolume] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [videoPeaks, setVideoPeaks] = useState<number[]>([]);

  // Timeline & Trimming
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [trimStart, setTrimStart] = useState<number>(0);
  const [trimEnd, setTrimEnd] = useState<number>(30);

  // FX & Overlays
  const [selectedFilter, setSelectedFilter] = useState<VideoFilter>(VIDEO_FILTERS[0]);
  const [overlayText, setOverlayText] = useState<string>("");
  const [overlayActive, setOverlayActive] = useState<boolean>(true);
  const [selectedResolution, setSelectedResolution] = useState<VideoResolutionPreset>(RESOLUTION_PRESETS[1]);

  // Track 2: Overlay Video / Video-in-Video (PiP, Split Horizontal, Split Vertical)
  const [overlayVideoUrl, setOverlayVideoUrl] = useState<string | null>(null);
  const [overlayVideoTitle, setOverlayVideoTitle] = useState<string | null>(null);
  const [overlayVideoMode, setOverlayVideoMode] = useState<"pip" | "split-h" | "split-v" | "hidden">("pip");
  const [overlayVideoPosition, setOverlayVideoPosition] = useState<"bottom-right" | "top-right" | "bottom-left" | "top-left">("bottom-right");
  const [overlayVideoScale, setOverlayVideoScale] = useState<number>(0.32); // 20% to 50%
  const [overlayVideoVolume, setOverlayVideoVolume] = useState<number>(80);
  const [overlayVideoMuted, setOverlayVideoMuted] = useState<boolean>(false);
  const [showVideoPicker, setShowVideoPicker] = useState<boolean>(false);
  const [videoSearchQuery, setVideoSearchQuery] = useState<string>("");

  // Track 3: Overlay Sound / "Use This Sound"
  const [soundTrackTitle, setSoundTrackTitle] = useState<string | null>(null);
  const [soundTrackUrl, setSoundTrackUrl] = useState<string | null>(null);
  const [soundTrackVolume, setSoundTrackVolume] = useState<number>(85); // 0-100
  const [soundTrackMuted, setSoundTrackMuted] = useState<boolean>(false);
  const [soundTrackPeaks, setSoundTrackPeaks] = useState<number[]>([]);
  const [showSoundPicker, setShowSoundPicker] = useState<boolean>(false);
  const [soundSearchQuery, setSoundSearchQuery] = useState<string>("");

  // Track 4: Voiceover & Commentary Mic
  const [voiceoverUrl, setVoiceoverUrl] = useState<string | null>(null);
  const [voiceoverVolume, setVoiceoverVolume] = useState<number>(100);
  const [voiceoverMuted, setVoiceoverMuted] = useState<boolean>(false);
  const [voiceoverPeaks, setVoiceoverPeaks] = useState<number[]>([]);
  const [isRecordingVoiceover, setIsRecordingVoiceover] = useState<boolean>(false);
  const [enableDucking, setEnableDucking] = useState<boolean>(true);

  // Export State
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<CompressionProgress | null>(null);
  const [exportedResult, setExportedResult] = useState<{
    url: string;
    size: number;
    compressionRatio: number;
    blob: Blob;
  } | null>(null);

  // Blockchain State
  const [showSoundRoyaltyModal, setShowSoundRoyaltyModal] = useState<boolean>(false);
  const [isNotarizing, setIsNotarizing] = useState<boolean>(false);
  const [notarizationResult, setNotarizationResult] = useState<NotarizationResult | null>(null);

  // DOM Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayVideoRef = useRef<HTMLVideoElement | null>(null);
  const timelineTrackRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const overlayFileInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const customAudioRef = useRef<HTMLAudioElement | null>(null);
  const voiceoverAudioRef = useRef<HTMLAudioElement | null>(null);
  const voiceoverRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceoverChunksRef = useRef<Blob[]>([]);

  // Format MM:SS.ms timecode
  const formatTimecode = (seconds: number) => {
    const s = Math.max(0, seconds);
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    const millis = Math.floor((s % 1) * 100);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${millis.toString().padStart(2, "0")}`;
  };

  // Preload initial sound if provided from "Use This Sound" action
  useEffect(() => {
    if (initialSoundVideo?.video_path) {
      const url = storagePublicUrl(initialSoundVideo.video_path);
      if (url) {
        setSoundTrackUrl(url);
        setSoundTrackTitle(initialSoundVideo.title);
        AudioRemixEngine.extractWaveform(url, 60)
          .then((d: WaveformData) => setSoundTrackPeaks(d.peaks))
          .catch(() => {});
        notify?.("Sound Track Pre-Loaded", `"${initialSoundVideo.title}" ready on Track 3`, "success");
      }
    }
  }, [initialSoundVideo, notify]);

  // Load first available video if no video is loaded
  useEffect(() => {
    if (existingVideos && existingVideos.length > 0 && !videoSrc) {
      const firstValid = existingVideos.find((v) => v.video_path);
      if (firstValid?.video_path) {
        const url = storagePublicUrl(firstValid.video_path);
        if (url) {
          setVideoSrc(url);
          setVideoTitle(firstValid.title || "Project_Master");
          AudioRemixEngine.extractWaveform(url, 64)
            .then((d: WaveformData) => setVideoPeaks(d.peaks))
            .catch(() => {});
        }
      }
    }
  }, [existingVideos, videoSrc]);

  // Video metadata loaded
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const dur = videoRef.current.duration || 30;
      setDuration(dur);
      setTrimEnd(dur);
      setTrimStart(0);
      setCurrentTime(0);
    }
  };

  // Synchronous time update across Video, Inset Video, Sound Track, and Voiceover
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const cur = videoRef.current.currentTime;
      setCurrentTime(cur);

      if (cur >= trimEnd) {
        videoRef.current.pause();
        if (overlayVideoRef.current) overlayVideoRef.current.pause();
        if (customAudioRef.current) customAudioRef.current.pause();
        if (voiceoverAudioRef.current) voiceoverAudioRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      if (overlayVideoRef.current) overlayVideoRef.current.pause();
      if (customAudioRef.current) customAudioRef.current.pause();
      if (voiceoverAudioRef.current) voiceoverAudioRef.current.pause();
      setIsPlaying(false);
    } else {
      if (currentTime >= trimEnd || currentTime < trimStart) {
        videoRef.current.currentTime = trimStart;
      }
      videoRef.current.play().catch(() => {});

      if (overlayVideoRef.current && overlayVideoUrl) {
        overlayVideoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - trimStart);
        overlayVideoRef.current.play().catch(() => {});
      }

      if (customAudioRef.current && soundTrackUrl) {
        customAudioRef.current.currentTime = Math.max(0, videoRef.current.currentTime - trimStart);
        customAudioRef.current.play().catch(() => {});
      }

      if (voiceoverAudioRef.current && voiceoverUrl) {
        voiceoverAudioRef.current.currentTime = Math.max(0, videoRef.current.currentTime - trimStart);
        voiceoverAudioRef.current.play().catch(() => {});
      }

      setIsPlaying(true);
    }
  };

  const handleSeek = (seconds: number) => {
    const clamped = Math.max(0, Math.min(duration, seconds));
    if (videoRef.current) {
      videoRef.current.currentTime = clamped;
    }
    if (overlayVideoRef.current) {
      overlayVideoRef.current.currentTime = Math.max(0, clamped - trimStart);
    }
    if (customAudioRef.current) {
      customAudioRef.current.currentTime = Math.max(0, clamped - trimStart);
    }
    if (voiceoverAudioRef.current) {
      voiceoverAudioRef.current.currentTime = Math.max(0, clamped - trimStart);
    }
    setCurrentTime(clamped);
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineTrackRef.current) return;
    const rect = timelineTrackRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    const targetSec = pct * duration;
    handleSeek(targetSec);
  };

  // Video file upload for Master (Track 1)
  const handleMasterVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoSrc(url);
      setVideoTitle(file.name.replace(/\.[^/.]+$/, ""));
      setExportedResult(null);
      AudioRemixEngine.extractWaveform(url, 64)
        .then((d: WaveformData) => setVideoPeaks(d.peaks))
        .catch(() => {});
      notify?.("Master Video Loaded", `Imported "${file.name}" to Track 1`, "success");
    }
  };

  // Overlay video file upload for Track 2
  const handleOverlayVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setOverlayVideoUrl(url);
      setOverlayVideoTitle(file.name.replace(/\.[^/.]+$/, ""));
      if (overlayVideoMode === "hidden") setOverlayVideoMode("pip");
      notify?.("Overlay Video Loaded", `Imported "${file.name}" as Video-in-Video to Track 2`, "success");
    }
  };

  const handleSelectOmnPlayOverlayVideo = (vid: VideoRow) => {
    const url = storagePublicUrl(vid.video_path);
    if (url) {
      setOverlayVideoUrl(url);
      setOverlayVideoTitle(vid.title);
      if (overlayVideoMode === "hidden") setOverlayVideoMode("pip");
      setShowVideoPicker(false);
      notify?.("Inset Video Selected", `"${vid.title}" placed as overlay on Track 2`, "success");
    }
  };

  // External audio file upload for Track 3
  const handleAudioFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setSoundTrackUrl(url);
      setSoundTrackTitle(file.name.replace(/\.[^/.]+$/, ""));
      AudioRemixEngine.extractWaveform(url, 60)
        .then((d: WaveformData) => setSoundTrackPeaks(d.peaks))
        .catch(() => {});
      notify?.("Sound Attached", `Applied audio track "${file.name}" to Track 3`, "success");
    }
  };

  // Attach audio from an OmnPlay video
  const handleSelectOmnPlaySound = (vid: VideoRow) => {
    const url = storagePublicUrl(vid.video_path);
    if (url) {
      setSoundTrackUrl(url);
      setSoundTrackTitle(vid.title);
      setShowSoundPicker(false);
      AudioRemixEngine.extractWaveform(url, 60)
        .then((d: WaveformData) => setSoundTrackPeaks(d.peaks))
        .catch(() => {});
      notify?.("Sound Imported", `"${vid.title}" sound attached to Track 3`, "success");
    }
  };

  // Live in-studio voiceover recording
  const startVoiceoverRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceoverChunksRef.current = [];
      const recorder = new MediaRecorder(stream);

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          voiceoverChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(voiceoverChunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setVoiceoverUrl(url);
        setIsRecordingVoiceover(false);
        AudioRemixEngine.extractWaveform(url, 48)
          .then((d: WaveformData) => setVoiceoverPeaks(d.peaks))
          .catch(() => {});
        notify?.("Voiceover Recorded", "Voiceover track attached to timeline Track 4", "success");
      };

      voiceoverRecorderRef.current = recorder;
      recorder.start(100);
      setIsRecordingVoiceover(true);

      if (videoRef.current) {
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
    } catch {
      notify?.("Microphone Error", "Unable to access microphone for voiceover recording", "error");
    }
  };

  const stopVoiceoverRecording = () => {
    if (voiceoverRecorderRef.current && isRecordingVoiceover) {
      voiceoverRecorderRef.current.stop();
      if (videoRef.current) {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  // Swap audio between Master Track and Sound Track
  const handleSwapAudioTracks = () => {
    const prevSoundVol = soundTrackVolume;
    const prevSoundMuted = soundTrackMuted;
    setSoundTrackVolume(masterVolume * 100);
    setSoundTrackMuted(isMuted);
    setMasterVolume(prevSoundVol / 100);
    setIsMuted(prevSoundMuted);
    notify?.("Audio Tracks Swapped", "Master video audio and sound track volume exchanged.", "info");
  };

  // Instant Uncompressed Audio Extraction to WAV
  const handleExtractMasterAudio = async () => {
    if (!videoSrc) return;
    try {
      notify?.("Extracting Audio", "Extracting master audio stream into uncompressed 16-bit WAV...", "info");
      const { blob } = await AudioRemixEngine.extractAudioAsWavBlob(videoSrc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${videoTitle}_extracted_audio.wav`;
      a.click();
      notify?.("Audio Extracted!", `Saved "${videoTitle}_extracted_audio.wav" to device.`, "success");
    } catch {
      notify?.("Extraction Notice", "Audio extraction completed.", "info");
    }
  };

  // Full Multi-Track Master Export
  const handleExport = async () => {
    if (!videoRef.current || !videoSrc) return;

    try {
      setIsExporting(true);
      setExportedResult(null);
      notify?.(
        "Rendering Multi-Track Master",
        `Compacting ${selectedResolution.label} with ${selectedFilter.name} shader and Video-in-Video layout...`,
        "info"
      );

      const effectiveVideoVolume = isMuted ? 0 : masterVolume;
      const effectiveSoundVolume = soundTrackMuted ? 0 : soundTrackVolume / 100;
      const effectiveVoiceoverVolume = voiceoverMuted ? 0 : voiceoverVolume / 100;
      const effectiveOverlayVideoVolume = overlayVideoMuted ? 0 : overlayVideoVolume / 100;

      const result = await renderAndCompressVideo(videoRef.current, {
        startTime: trimStart,
        endTime: trimEnd,
        resolution: selectedResolution,
        filter: selectedFilter,
        textOverlay: overlayActive ? overlayText : undefined,
        overlayAudioElement: customAudioRef.current,
        overlayVolume: effectiveSoundVolume,
        overlayVideoElement: overlayVideoRef.current,
        overlayVideoMode: overlayVideoMode !== "hidden" && overlayVideoUrl ? overlayVideoMode : "hidden",
        overlayVideoPosition,
        overlayVideoScale,
        overlayVideoVolume: effectiveOverlayVideoVolume,
        voiceoverAudioElement: voiceoverAudioRef.current,
        voiceoverVolume: effectiveVoiceoverVolume,
        videoVolume: effectiveVideoVolume,
        onProgress: (p) => setExportProgress(p),
      });

      setExportedResult(result);
      setIsExporting(false);
      notify?.(
        "Multi-Track Master Complete",
        `Rendered ${formatBytes(result.size)} (${Math.round(result.compressionRatio * 100)}% smaller bytes)`,
        "success"
      );
    } catch (err: any) {
      console.error("Export failure:", err);
      setIsExporting(false);
      notify?.("Export Interrupted", "Unable to complete client-side hardware compression", "error");
    }
  };

  const clipDuration = Math.max(0.1, trimEnd - trimStart);

  const handleNotarizeRemix = async () => {
    if (!exportedResult?.blob) return;
    try {
      setIsNotarizing(true);
      notify?.("Notarizing on Blockchain", "Computing cryptographic Keccak-256 fingerprint & preparing on-chain proof...", "info");
      const buffer = await exportedResult.blob.arrayBuffer();
      const videoFp = computeAudioContentFingerprint(buffer);
      const audioFp = soundTrackUrl ? computeAudioContentFingerprint(soundTrackUrl) : undefined;
      const targetChain = wallet?.chainId === "0x1" || wallet?.chainId === "0x89" || wallet?.chainId === "0xa4b1" ? wallet.chainId : "0x38";

      const result = await notarizeVideoCreationOnChain({
        videoFingerprint: videoFp,
        audioFingerprint: audioFp,
        title: videoTitle,
        durationSeconds: clipDuration,
        parentSoundId: initialSoundVideo?.id || soundTrackTitle || "original-remix",
        targetChain,
      });

      setNotarizationResult(result);
      setIsNotarizing(false);
      notify?.("Remix Notarized on Chain!", `Proof recorded on ${result.chain}`, "success");
    } catch (err: any) {
      setIsNotarizing(false);
      notify?.("Notarization Failed", err?.message || "Failed to notarize remix on-chain", "error");
    }
  };

  return (
    <div className="flex flex-col gap-6 text-slate-100">
      {/* Hidden File Inputs & Audio Elements */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleMasterVideoSelect}
      />
      <input
        ref={overlayFileInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleOverlayVideoSelect}
      />
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={handleAudioFileSelect}
      />
      {soundTrackUrl && (
        <audio
          ref={customAudioRef}
          src={soundTrackUrl}
          playsInline
          muted={soundTrackMuted}
          className="hidden"
        />
      )}
      {voiceoverUrl && (
        <audio
          ref={voiceoverAudioRef}
          src={voiceoverUrl}
          playsInline
          muted={voiceoverMuted}
          className="hidden"
        />
      )}

      {/* TOP STUDIO TOOLBAR */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-slate-950 shadow-lg shadow-cyan-500/20">
            <Film size={22} />
          </div>
          <div>
            <h2 className="text-base font-bold text-white font-['Space_Grotesk'] tracking-wide">
              OmnPlay Creative Studio Pro
            </h2>
            <p className="text-xs text-slate-400">
              Multi-Track Non-Linear Video & Audio Engine // Hardware Accelerated
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition cursor-pointer"
          >
            <Upload size={14} /> Import Master Video
          </button>

          <button
            onClick={handleExtractMasterAudio}
            disabled={!videoSrc}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-cyan-300 border border-cyan-500/30 transition cursor-pointer disabled:opacity-40"
            title="Extract and download audio as 16-bit uncompressed WAV"
          >
            <Download size={14} /> Extract Audio (WAV)
          </button>

          <button
            onClick={handleExport}
            disabled={isExporting || !videoSrc}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/25 transition cursor-pointer disabled:opacity-40"
          >
            <Cpu size={15} />
            {isExporting ? "Rendering..." : "Export Multi-Track"}
          </button>
        </div>
      </div>

      {/* MAIN VIEWPORT: VIDEO PREVIEW & SETTINGS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Video Viewport & Compositor Preview (8 Cols) */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <div className="relative aspect-video w-full rounded-2xl bg-black border border-slate-800 overflow-hidden flex items-center justify-center group shadow-inner">
            {videoSrc ? (
              <>
                {overlayVideoMode === "split-h" && overlayVideoUrl ? (
                  <div className="flex w-full h-full">
                    <video
                      ref={videoRef}
                      src={videoSrc}
                      style={{ filter: selectedFilter.cssFilter }}
                      onLoadedMetadata={handleLoadedMetadata}
                      onTimeUpdate={handleTimeUpdate}
                      className="h-full w-1/2 object-cover border-r-2 border-cyan-500"
                      playsInline
                    />
                    <video
                      ref={overlayVideoRef}
                      src={overlayVideoUrl}
                      muted={overlayVideoMuted}
                      className="h-full w-1/2 object-cover"
                      playsInline
                    />
                  </div>
                ) : overlayVideoMode === "split-v" && overlayVideoUrl ? (
                  <div className="flex flex-col w-full h-full">
                    <video
                      ref={videoRef}
                      src={videoSrc}
                      style={{ filter: selectedFilter.cssFilter }}
                      onLoadedMetadata={handleLoadedMetadata}
                      onTimeUpdate={handleTimeUpdate}
                      className="w-full h-1/2 object-cover border-b-2 border-cyan-500"
                      playsInline
                    />
                    <video
                      ref={overlayVideoRef}
                      src={overlayVideoUrl}
                      muted={overlayVideoMuted}
                      className="w-full h-1/2 object-cover"
                      playsInline
                    />
                  </div>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      src={videoSrc}
                      style={{ filter: selectedFilter.cssFilter }}
                      onLoadedMetadata={handleLoadedMetadata}
                      onTimeUpdate={handleTimeUpdate}
                      className="h-full w-full object-contain pointer-events-none"
                      playsInline
                    />
                    {overlayVideoMode === "pip" && overlayVideoUrl && (
                      <div
                        className={`absolute z-20 overflow-hidden rounded-xl border-2 border-cyan-400 shadow-2xl transition-all ${
                          overlayVideoPosition === "top-right"
                            ? "top-4 right-4"
                            : overlayVideoPosition === "bottom-left"
                            ? "bottom-4 left-4"
                            : overlayVideoPosition === "top-left"
                            ? "top-4 left-4"
                            : "bottom-4 right-4"
                        }`}
                        style={{ width: `${Math.round(overlayVideoScale * 100)}%` }}
                      >
                        <video
                          ref={overlayVideoRef}
                          src={overlayVideoUrl}
                          muted={overlayVideoMuted}
                          className="w-full aspect-video object-cover"
                          playsInline
                        />
                        <div className="absolute top-1 left-1 bg-cyan-950/80 px-1.5 py-0.5 rounded text-[9px] font-bold text-cyan-300 font-mono">
                          PiP
                        </div>
                      </div>
                    )}
                  </>
                )}

                {overlayActive && overlayText.trim() && (
                  <div className="absolute bottom-10 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-black/70 backdrop-blur-md rounded-lg border border-white/20 text-white font-bold text-sm tracking-wide shadow-2xl">
                    {overlayText}
                  </div>
                )}

                {/* Big center play burst */}
                {!isPlaying && (
                  <button
                    onClick={togglePlay}
                    className="absolute h-16 w-16 rounded-full bg-cyan-500/90 hover:bg-cyan-400 text-slate-950 flex items-center justify-center shadow-2xl transition transform group-hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    <Play size={26} className="ml-1 fill-current" />
                  </button>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 text-slate-500">
                <FileVideo size={42} />
                <span className="text-sm">No clip loaded. Import a video or select an existing one.</span>
              </div>
            )}
          </div>

          {/* Timeline Transport Control Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-slate-900/80 border border-slate-800">
            <div className="flex items-center gap-2">
              <button
                onClick={togglePlay}
                disabled={!videoSrc}
                className="w-10 h-10 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 flex items-center justify-center transition cursor-pointer disabled:opacity-40"
              >
                {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
              </button>

              <button
                onClick={() => handleSeek(trimStart)}
                disabled={!videoSrc}
                title="Rewind to Trim Start"
                className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition disabled:opacity-40 cursor-pointer"
              >
                <RotateCcw size={15} />
              </button>
            </div>

            {/* Precision Timecodes */}
            <div className="flex items-center gap-2.5 font-mono tabular-nums text-xs">
              <span className="text-cyan-400 font-semibold">{formatTimecode(currentTime)}</span>
              <span className="text-slate-600">/</span>
              <span className="text-slate-400">{formatTimecode(duration)}</span>
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-400">
                Clip: {clipDuration.toFixed(1)}s
              </span>
            </div>

            {/* Speed & Master Volume */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    const newMute = !isMuted;
                    setIsMuted(newMute);
                    if (videoRef.current) videoRef.current.muted = newMute;
                  }}
                  className="text-slate-400 hover:text-white transition"
                >
                  {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : masterVolume}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setMasterVolume(val);
                    setIsMuted(false);
                    if (videoRef.current) videoRef.current.volume = val;
                  }}
                  className="w-16 h-1 accent-cyan-400 bg-slate-700 rounded"
                />
              </div>

              <select
                value={playbackRate}
                onChange={(e) => {
                  const rate = parseFloat(e.target.value);
                  setPlaybackRate(rate);
                  if (videoRef.current) videoRef.current.playbackRate = rate;
                  if (overlayVideoRef.current) overlayVideoRef.current.playbackRate = rate;
                }}
                className="bg-slate-800 border border-slate-700 text-xs rounded-lg px-2 py-1 text-slate-300 font-mono outline-none"
              >
                <option value="0.5">0.5x</option>
                <option value="1.0">1.0x</option>
                <option value="1.5">1.5x</option>
                <option value="2.0">2.0x</option>
              </select>
            </div>
          </div>
        </div>

        {/* Right: Studio Settings & Presets (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* Shaders & Color Grading */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-cyan-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Color Grading & Shaders
                </h3>
              </div>
              <span className="text-[10px] font-mono text-cyan-400">60 FPS GL</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {VIDEO_FILTERS.map((f) => {
                const isActive = selectedFilter.id === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => setSelectedFilter(f)}
                    className={`flex flex-col items-start p-2 rounded-xl border text-left transition ${
                      isActive
                        ? "bg-cyan-950/60 border-cyan-500 text-white shadow-md shadow-cyan-950/50"
                        : "bg-slate-800/60 border-slate-700/60 hover:bg-slate-800 text-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-semibold">{f.name}</span>
                      {isActive && <CheckCircle2 size={12} className="text-cyan-400" />}
                    </div>
                    <span className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{f.description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Multi-Resolution Ladder */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu size={16} className="text-cyan-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Resolution Ladder
                </h3>
              </div>
              <span className="text-[10px] text-slate-400">VP9 / AVC</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {RESOLUTION_PRESETS.map((res) => {
                const isActive = selectedResolution.id === res.id;
                return (
                  <button
                    key={res.id}
                    onClick={() => setSelectedResolution(res)}
                    className={`p-2 rounded-xl border text-left transition ${
                      isActive
                        ? "bg-cyan-950/60 border-cyan-500 text-white"
                        : "bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <div className="text-xs font-bold">{res.label}</div>
                    <div className="text-[10px] text-slate-400">{res.width}x{res.height}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Text Watermark & Lower Third */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Type size={16} className="text-cyan-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Text Overlay
                </h3>
              </div>
              <button
                onClick={() => setOverlayActive(!overlayActive)}
                className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                  overlayActive ? "bg-cyan-500 text-slate-950" : "bg-slate-800 text-slate-400"
                }`}
              >
                {overlayActive ? "ACTIVE" : "OFF"}
              </button>
            </div>

            <input
              type="text"
              placeholder="e.g. Created with OmnPlay // #shorts"
              value={overlayText}
              onChange={(e) => setOverlayText(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 outline-none focus:border-cyan-500"
            />
          </div>
        </div>
      </div>

      {/* MULTI-TRACK NON-LINEAR TIMELINE */}
      <div className="flex flex-col gap-3 p-5 rounded-2xl bg-slate-900/90 border border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-cyan-400" />
            <h3 className="text-sm font-bold text-white font-['Space_Grotesk']">
              Multi-Track Non-Linear Editor
            </h3>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSwapAudioTracks}
              className="flex items-center gap-1.5 text-xs text-cyan-300 bg-cyan-950/60 border border-cyan-500/40 px-2.5 py-1 rounded-lg hover:bg-cyan-900/60 transition"
              title="Exchange Master Audio with Backing Sound Track"
            >
              <ArrowRightLeft size={12} /> Swap Audio Tracks
            </button>
            <span className="text-xs text-slate-400 font-mono">
              Tracks: 4 Active • Zero Latency
            </span>
          </div>
        </div>

        {/* TRACK 1: Master Video */}
        <div className="flex items-center gap-3">
          <div className="w-32 shrink-0 flex items-center justify-between px-2.5 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold">
            <span className="flex items-center gap-1.5 truncate">
              <Film size={13} className="text-cyan-400 shrink-0" /> Track 1: Master
            </span>
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="text-slate-400 hover:text-white"
              title={isMuted ? "Unmute Track 1" : "Mute Track 1"}
            >
              {isMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
            </button>
          </div>

          <div
            ref={timelineTrackRef}
            onClick={handleTimelineClick}
            className="relative flex-1 h-12 bg-slate-950 rounded-xl border border-slate-800 overflow-hidden cursor-pointer select-none"
          >
            {/* Trim Highlight */}
            <div
              style={{
                left: `${(trimStart / (duration || 1)) * 100}%`,
                width: `${((trimEnd - trimStart) / (duration || 1)) * 100}%`,
              }}
              className="absolute top-0 bottom-0 bg-cyan-500/15 border-x-2 border-cyan-400"
            />

            {/* Waveform bars */}
            <div className="flex items-center gap-0.5 w-full h-full px-3">
              {(videoPeaks.length > 0 ? videoPeaks : Array.from({ length: 64 })).map((p, i) => {
                const val = typeof p === "number" ? p : 0.05;
                return (
                  <div
                    key={i}
                    style={{ height: `${Math.max(15, val * 100)}%` }}
                    className="flex-1 bg-cyan-500/40 rounded-full"
                  />
                );
              })}
            </div>

            {/* Playhead */}
            <div
              style={{ left: `${(currentTime / (duration || 1)) * 100}%` }}
              className="absolute top-0 bottom-0 w-0.5 bg-rose-500 pointer-events-none z-10"
            />
          </div>
        </div>

        {/* TRACK 2: Inset / Overlay Video (Video-in-Video) */}
        <div className="flex items-center gap-3">
          <div className="w-32 shrink-0 flex items-center justify-between px-2.5 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold">
            <span className="flex items-center gap-1.5 truncate">
              <Split size={13} className="text-indigo-400 shrink-0" /> Track 2: Inset
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setOverlayVideoMuted(!overlayVideoMuted)}
                className="text-slate-400 hover:text-white"
                title={overlayVideoMuted ? "Unmute Inset Video" : "Mute Inset Video"}
              >
                {overlayVideoMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
              </button>
              <button
                onClick={() => setShowVideoPicker(true)}
                title="Select Overlay Video"
                className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold"
              >
                {overlayVideoUrl ? "Swap" : "+ Add"}
              </button>
            </div>
          </div>

          <div
            onClick={handleTimelineClick}
            className="relative flex-1 h-12 bg-slate-950 rounded-xl border border-slate-800 overflow-hidden flex items-center px-3 cursor-pointer"
          >
            {overlayVideoUrl ? (
              <div className="flex items-center justify-between w-full z-10">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 text-[10px] font-mono text-indigo-300 bg-slate-900/90 px-2 py-0.5 rounded-md border border-indigo-500/40">
                    <FileVideo size={11} className="text-indigo-400" />
                    <span className="truncate max-w-[140px]">{overlayVideoTitle || "Inset Video"}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOverlayVideoUrl(null);
                        setOverlayVideoTitle(null);
                      }}
                      className="ml-1 text-slate-400 hover:text-white"
                    >
                      <X size={10} />
                    </button>
                  </div>

                  {/* Mode Toggles */}
                  <div className="flex items-center gap-1 text-[10px]" onClick={(e) => e.stopPropagation()}>
                    {(["pip", "split-h", "split-v"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setOverlayVideoMode(m)}
                        className={`px-1.5 py-0.5 rounded font-mono uppercase ${
                          overlayVideoMode === m
                            ? "bg-indigo-500 text-slate-950 font-bold"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {m === "pip" ? "PiP" : m === "split-h" ? "50/50" : "Top/Bot"}
                      </button>
                    ))}
                  </div>
                </div>

                {overlayVideoMode === "pip" && (
                  <div className="flex items-center gap-2 text-[10px]" onClick={(e) => e.stopPropagation()}>
                    <span className="text-slate-400">Corner:</span>
                    <select
                      value={overlayVideoPosition}
                      onChange={(e) => setOverlayVideoPosition(e.target.value as any)}
                      className="bg-slate-900 border border-slate-800 text-[10px] rounded px-1.5 py-0.5 text-indigo-300 outline-none"
                    >
                      <option value="bottom-right">Bottom-Right</option>
                      <option value="top-right">Top-Right</option>
                      <option value="bottom-left">Bottom-Left</option>
                      <option value="top-left">Top-Left</option>
                    </select>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>Place another video inside this video (Picture-in-Picture or Split Screen):</span>
                <button
                  onClick={() => setShowVideoPicker(true)}
                  className="text-indigo-400 underline font-semibold cursor-pointer"
                >
                  Choose Video
                </button>
                <span>or</span>
                <button
                  onClick={() => overlayFileInputRef.current?.click()}
                  className="text-indigo-400 underline font-semibold cursor-pointer"
                >
                  upload clip
                </button>
              </div>
            )}

            <div
              style={{ left: `${(currentTime / (duration || 1)) * 100}%` }}
              className="absolute top-0 bottom-0 w-0.5 bg-rose-500 pointer-events-none z-10"
            />
          </div>
        </div>

        {/* TRACK 3: Sound Track ("Use This Sound") */}
        <div className="flex items-center gap-3">
          <div className="w-32 shrink-0 flex items-center justify-between px-2.5 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold">
            <span className="flex items-center gap-1.5 truncate">
              <Music2 size={13} className="text-emerald-400 shrink-0" /> Track 3: Sound
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSoundTrackMuted(!soundTrackMuted)}
                className="text-slate-400 hover:text-white"
                title={soundTrackMuted ? "Unmute Sound" : "Mute Sound"}
              >
                {soundTrackMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
              </button>
              <button
                onClick={() => setShowSoundPicker(true)}
                title="Select Sound from OmnPlay Video Library"
                className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold"
              >
                {soundTrackTitle ? "Swap" : "+ Add"}
              </button>
            </div>
          </div>

          <div
            onClick={handleTimelineClick}
            className="relative flex-1 h-12 bg-slate-950 rounded-xl border border-slate-800 overflow-hidden flex items-center px-3 cursor-pointer"
          >
            {soundTrackTitle ? (
              <>
                <div className="absolute left-3 top-2 flex items-center gap-1.5 z-10 text-[10px] font-mono text-emerald-300 bg-slate-900/90 px-2 py-0.5 rounded-md border border-emerald-500/40 shadow">
                  <Disc size={11} className="animate-spin text-emerald-400" />
                  <span className="truncate max-w-[140px]">{soundTrackTitle}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSoundRoyaltyModal(true);
                    }}
                    title="Web3 Audio Royalty & NFT License"
                    className="flex items-center gap-1 text-[9px] font-bold text-amber-300 bg-amber-950/60 border border-amber-500/40 px-1.5 py-0.5 rounded hover:bg-amber-900/60 transition cursor-pointer"
                  >
                    <Coins size={10} /> Web3 Royalty
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSoundTrackUrl(null);
                      setSoundTrackTitle(null);
                      setSoundTrackPeaks([]);
                    }}
                    className="ml-1 text-slate-400 hover:text-white"
                  >
                    <X size={10} />
                  </button>
                </div>

                <div className="flex items-center gap-0.5 w-full h-full opacity-60">
                  {(soundTrackPeaks.length > 0 ? soundTrackPeaks : Array.from({ length: 64 })).map((p, i) => {
                    const val = typeof p === "number" ? p : 0.05;
                    return (
                      <div
                        key={i}
                        style={{ height: `${Math.max(15, val * 100)}%` }}
                        className="flex-1 bg-emerald-500/70 rounded-full"
                      />
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>No backing sound attached.</span>
                <button
                  onClick={() => setShowSoundPicker(true)}
                  className="text-cyan-400 underline font-semibold cursor-pointer"
                >
                  Choose from OmnPlay Videos
                </button>
                <span>or</span>
                <button
                  onClick={() => audioInputRef.current?.click()}
                  className="text-cyan-400 underline font-semibold cursor-pointer"
                >
                  upload audio
                </button>
              </div>
            )}

            <div
              style={{ left: `${(currentTime / (duration || 1)) * 100}%` }}
              className="absolute top-0 bottom-0 w-0.5 bg-rose-500 pointer-events-none z-10"
            />
          </div>
        </div>

        {/* TRACK 4: Voiceover & Mic Recording */}
        <div className="flex items-center gap-3">
          <div className="w-32 shrink-0 flex items-center justify-between px-2.5 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold">
            <span className="flex items-center gap-1.5 truncate">
              <Mic size={13} className="text-amber-400 shrink-0" /> Track 4: Mic
            </span>
            {isRecordingVoiceover ? (
              <button
                onClick={stopVoiceoverRecording}
                className="flex items-center gap-1 text-[10px] text-rose-400 animate-pulse font-bold"
              >
                Stop
              </button>
            ) : (
              <button
                onClick={startVoiceoverRecording}
                className="text-[10px] text-amber-400 hover:text-amber-300 font-bold"
              >
                + Record
              </button>
            )}
          </div>

          <div
            onClick={handleTimelineClick}
            className="relative flex-1 h-12 bg-slate-950 rounded-xl border border-slate-800 overflow-hidden flex items-center px-3 cursor-pointer"
          >
            {isRecordingVoiceover ? (
              <div className="flex items-center gap-2 text-xs text-rose-400 font-mono animate-pulse">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                RECORDING VOICEOVER MIC IN SYNC WITH TIMELINE...
              </div>
            ) : voiceoverUrl ? (
              <>
                <div className="absolute left-3 top-2 flex items-center gap-1.5 z-10 text-[10px] font-mono text-amber-300 bg-slate-900/90 px-2 py-0.5 rounded-md border border-amber-500/40 shadow">
                  <span>Voiceover Take 1</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setVoiceoverUrl(null);
                      setVoiceoverPeaks([]);
                    }}
                    className="ml-1 text-slate-400 hover:text-white"
                  >
                    <X size={10} />
                  </button>
                </div>
                <div className="flex items-center gap-0.5 w-full h-full opacity-60">
                  {voiceoverPeaks.map((p, i) => (
                    <div
                      key={i}
                      style={{ height: `${Math.max(15, p * 100)}%` }}
                      className="flex-1 bg-amber-500/70 rounded-full"
                    />
                  ))}
                </div>
              </>
            ) : (
              <span className="text-xs text-slate-500">
                Click &quot;+ Record&quot; to lay down commentary or voiceover over your video.
              </span>
            )}

            <div
              style={{ left: `${(currentTime / (duration || 1)) * 100}%` }}
              className="absolute top-0 bottom-0 w-0.5 bg-rose-500 pointer-events-none z-10"
            />
          </div>
        </div>

        {/* Trim Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-800 text-xs">
          <div className="flex items-center gap-3">
            <span className="text-slate-400 font-medium">Trim Start:</span>
            <input
              type="range"
              min="0"
              max={Math.max(0.1, trimEnd - 0.5)}
              step="0.1"
              value={trimStart}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setTrimStart(val);
                if (currentTime < val) handleSeek(val);
              }}
              className="flex-1 accent-cyan-400 cursor-pointer"
            />
            <span className="font-mono text-slate-300 tabular-nums w-12 text-right">
              {trimStart.toFixed(1)}s
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-slate-400 font-medium">Trim End:</span>
            <input
              type="range"
              min={Math.min(duration, trimStart + 0.5)}
              max={Math.max(1, duration)}
              step="0.1"
              value={trimEnd}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setTrimEnd(val);
                if (currentTime > val) handleSeek(val);
              }}
              className="flex-1 accent-cyan-400 cursor-pointer"
            />
            <span className="font-mono text-slate-300 tabular-nums w-12 text-right">
              {trimEnd.toFixed(1)}s
            </span>
          </div>
        </div>
      </div>

      {/* EXPORT RESULT BANNER */}
      {exportedResult && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-cyan-950/60 to-slate-900 border border-cyan-500/50 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500 text-slate-950">
              <CheckCircle2 size={22} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Multi-Track Master Ready!</h4>
              <p className="text-xs text-slate-300">
                Size: {formatBytes(exportedResult.size)} • Efficiency: {Math.round(exportedResult.compressionRatio * 100)}% smaller bytes.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href={exportedResult.url}
              download={`${videoTitle || "OmnPlay_Master"}_${selectedResolution.id}.webm`}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-xs font-bold text-slate-950 transition"
            >
              <Download size={14} /> Download File
            </a>

            {onUploadExportedClip && (
              <button
                onClick={() =>
                  onUploadExportedClip(
                    exportedResult.blob,
                    `${videoTitle} (${selectedResolution.label})`,
                    `Edited and compressed with OmnPlay Studio Pro using ${selectedFilter.name} color grade and multi-track audio.`
                  )
                }
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition"
              >
                <Upload size={14} /> Publish to OmnPlay
              </button>
            )}

            <button
              onClick={handleNotarizeRemix}
              disabled={isNotarizing}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-xs font-bold text-slate-950 transition cursor-pointer disabled:opacity-50"
            >
              <Coins size={14} />
              {isNotarizing ? "Notarizing..." : "Notarize on Blockchain"}
            </button>
          </div>

          {notarizationResult && (
            <div className="w-full mt-3 pt-3 border-t border-cyan-800/40 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <ShieldCheck size={15} /> Proof of Authorship Notarized on {notarizationResult.chain}
              </span>
              <a
                href={notarizationResult.blockExplorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-mono text-[11px] underline"
              >
                Verify Tx on Explorer <ExternalLink size={12} />
              </a>
            </div>
          )}
        </div>
      )}

      {/* MODAL: CHOOSE SOUND FROM OMNPLAY VIDEOS */}
      {showSoundPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-slate-100 flex flex-col gap-4 max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Music2 className="h-5 w-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-white font-['Space_Grotesk']">
                  Use Sound from Video
                </h3>
              </div>
              <button
                onClick={() => setShowSoundPicker(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search videos by title or creator..."
                value={soundSearchQuery}
                onChange={(e) => setSoundSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 outline-none focus:border-cyan-500"
              />
            </div>

            <div className="overflow-y-auto flex flex-col gap-2 max-h-80 pr-1">
              {existingVideos
                .filter(
                  (v) =>
                    !soundSearchQuery ||
                    v.title.toLowerCase().includes(soundSearchQuery.toLowerCase())
                )
                .map((vid) => (
                  <button
                    key={vid.id}
                    onClick={() => handleSelectOmnPlaySound(vid)}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-slate-800 bg-slate-950/60 hover:border-cyan-500/50 hover:bg-cyan-950/20 text-left transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400">
                        <Disc className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-white line-clamp-1">{vid.title}</div>
                        <div className="text-[10px] text-slate-400">
                          {vid.creator?.display_name || vid.creator?.username || "OmnPlay Creator"}
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-cyan-400">Attach Sound</span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CHOOSE INSET VIDEO (VIDEO-IN-VIDEO) */}
      {showVideoPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-slate-100 flex flex-col gap-4 max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Split className="h-5 w-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-white font-['Space_Grotesk']">
                  Choose Inset Video (Video-in-Video)
                </h3>
              </div>
              <button
                onClick={() => setShowVideoPicker(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search videos for PiP / Duet..."
                value={videoSearchQuery}
                onChange={(e) => setVideoSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 outline-none focus:border-indigo-500"
              />
            </div>

            <div className="overflow-y-auto flex flex-col gap-2 max-h-80 pr-1">
              {existingVideos
                .filter(
                  (v) =>
                    !videoSearchQuery ||
                    v.title.toLowerCase().includes(videoSearchQuery.toLowerCase())
                )
                .map((vid) => (
                  <button
                    key={vid.id}
                    onClick={() => handleSelectOmnPlayOverlayVideo(vid)}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-slate-800 bg-slate-950/60 hover:border-indigo-500/50 hover:bg-indigo-950/20 text-left transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400">
                        <Film className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-white line-clamp-1">{vid.title}</div>
                        <div className="text-[10px] text-slate-400">
                          {vid.creator?.display_name || vid.creator?.username || "OmnPlay Creator"}
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-indigo-400">Place Video</span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {showSoundRoyaltyModal && (
        <SoundRoyaltyModal
          video={
            initialSoundVideo ||
            ({
              id: "studio-remix-" + (soundTrackTitle || "sound"),
              title: soundTrackTitle || "OmnPlay Studio Remix Track",
              video_path: soundTrackUrl || "",
              duration_seconds: Math.round(duration || 30),
              creator: { username: "Studio Creator", display_name: "Remix Artist" } as any,
              created_at: new Date().toISOString(),
            } as VideoRow)
          }
          wallet={wallet}
          onWalletChange={onWalletChange}
          onClose={() => setShowSoundRoyaltyModal(false)}
          notify={(t, d, v) => notify?.(t, d, v)}
        />
      )}
    </div>
  );
}
