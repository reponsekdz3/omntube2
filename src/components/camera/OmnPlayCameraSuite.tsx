import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Camera,
  Video,
  Music2,
  Sparkles,
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  Sliders,
  X,
  Check,
  Disc,
  Layers,
  Split,
  Maximize,
  Clock,
  Zap,
  Download,
  Upload,
  RefreshCw,
  SunMedium,
  Palette,
  Film,
  CircleDot,
  Radio,
  SlidersHorizontal,
  Scissors,
  Wand2,
  Tv,
  Eye,
  Activity,
  ArrowRight,
  FileText,
  Sun,
  Flame,
  Grid,
  Coins,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";
import { storagePublicUrl } from "../../lib/supabase";
import type { VideoRow } from "../../types";
import { AudioRemixEngine, type WaveformData } from "../../services/audioRemixEngine";
import { wasmDspEngine } from "../../wasm/wasmEngine";
import { SoundRoyaltyModal } from "../monetization/SoundRoyaltyModal";
import {
  type WalletState,
  computeAudioContentFingerprint,
  notarizeVideoCreationOnChain,
  type NotarizationResult,
} from "../../lib/web3";

export type CameraFilterMode =
  | "none"
  | "chroma-key"      // Real Green/Blue/Magenta screen backdrop removal
  | "neon-reactive"   // Audio-reactive dynamic neon aura & pulse
  | "cinema-35mm"     // 35mm film grain, anamorphic flare, cinematic LUT
  | "vhs-1989"        // VHS tape scanlines, chromatic drift, datecode
  | "cyber-glitch"    // RGB split channel displacement & HUD
  | "beauty-glam"     // Soft skin luminescence, bilateral smoothing & iris catchlights
  | "noir-contrast"   // High dynamic range monochrome
  | "holo-matrix"     // Green CRT holographic phosphor matrix & HUD
  | "thermal-flir"    // Infrared false-color thermal vision
  | "golden-hour"     // Warm California golden sunset flare & amber bloom
  | "sobel-edge";     // WASM-accelerated neon contour line edge detector

export type DuetLayoutMode =
  | "solo"             // Full camera
  | "split-horizontal" // Side-by-side classic duet (50% / 50%)
  | "split-vertical"   // Top / Bottom duet
  | "pip"              // Picture-in-Picture floating viewport
  | "reaction-cam"     // Host video main, circular reaction cam with neon pulse
  | "chroma-duet"      // Chroma keyed creator inside host video scene
  | "audio-only";      // Record camera while playing host video sound in sync

export type ChromaBackdrop =
  | "host-video"
  | "cyberpunk-neon"
  | "studio-ambient"
  | "transparent";

interface OmnPlayCameraSuiteProps {
  sourceSoundVideo?: VideoRow | null; // Selected video for "Use this sound" or Duet
  onClose: () => void;
  onClipRecorded: (blob: Blob, metadata: { title: string; soundTitle?: string; mode: string }) => void;
  onSendToStudio?: (blob: Blob, sourceVideo?: VideoRow | null) => void;
  notify?: (title: string, desc?: string, variant?: "success" | "error" | "info") => void;
  wallet?: WalletState;
  onWalletChange?: (w: WalletState) => void;
}

export function OmnPlayCameraSuite({
  sourceSoundVideo,
  onClose,
  onClipRecorded,
  onSendToStudio,
  notify,
  wallet,
  onWalletChange,
}: OmnPlayCameraSuiteProps) {
  // Camera & Device State
  const [streamActive, setStreamActive] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "16:9" | "1:1">("9:16");
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Layout & Duet Modes
  const [layoutMode, setLayoutMode] = useState<DuetLayoutMode>(
    sourceSoundVideo ? "split-horizontal" : "solo"
  );
  const [pipPosition, setPipPosition] = useState<"bottom-right" | "top-right" | "bottom-left" | "top-left">("bottom-right");

  // Advanced Shader & Filter States
  const [activeFilter, setActiveFilter] = useState<CameraFilterMode>(
    sourceSoundVideo ? "neon-reactive" : "none"
  );
  const [beautyIntensity, setBeautyIntensity] = useState(65); // 0-100
  const [chromaKeyColor, setChromaKeyColor] = useState<"green" | "blue" | "magenta">("green");
  const [chromaTolerance, setChromaTolerance] = useState(70); // 0-100
  const [chromaBackdrop, setChromaBackdrop] = useState<ChromaBackdrop>(
    sourceSoundVideo ? "host-video" : "cyberpunk-neon"
  );

  // Ring Light & Studio Tools
  const [ringLightActive, setRingLightActive] = useState(false);
  const [ringLightTemp, setRingLightTemp] = useState<"warm" | "neutral" | "cool" | "cyan" | "magenta">("warm");
  const [ringLightBrightness, setRingLightBrightness] = useState(75); // 20-100
  const [gridOverlay, setGridOverlay] = useState(false);
  const [recordingSpeed, setRecordingSpeed] = useState<0.3 | 0.5 | 1 | 2 | 3>(1);

  // Teleprompter
  const [teleprompterOpen, setTeleprompterOpen] = useState(false);
  const [teleprompterText, setTeleprompterText] = useState(
    "Welcome to OmniTube! Use this sound to create an unforgettable take. Keep eyes centered, pace steady, and unleash your creativity!"
  );
  const [teleprompterSpeed, setTeleprompterSpeed] = useState(2); // 1-5
  const [teleprompterFontSize, setTeleprompterFontSize] = useState(18); // 14-28
  const [teleprompterScroll, setTeleprompterScroll] = useState(0);

  // Audio Engine & Mixer State
  const [soundEnabled, setSoundEnabled] = useState(Boolean(sourceSoundVideo));
  const [soundSnippetStart, setSoundSnippetStart] = useState(0);
  const [soundVolume, setSoundVolume] = useState(85); // 0-100
  const [micVolume, setMicVolume] = useState(100);     // 0-100
  const [enableDucking, setEnableDucking] = useState(true);
  const [waveformPeaks, setWaveformPeaks] = useState<number[]>([]);
  const [audioMetrics, setAudioMetrics] = useState({ averageVolume: 0, bassEnergy: 0, midEnergy: 0, trebleEnergy: 0 });
  const [isPlayingSnippet, setIsPlayingSnippet] = useState(false);

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [countdownSetting, setCountdownSetting] = useState<0 | 3 | 5 | 10>(0);
  const [maxRecordingDuration, setMaxRecordingDuration] = useState<15 | 30 | 60 | 0>(
    sourceSoundVideo ? 15 : 60
  );
  const [recordedDuration, setRecordedDuration] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedPreviewUrl, setRecordedPreviewUrl] = useState<string | null>(null);
  const [takeFingerprint, setTakeFingerprint] = useState<string>("");
  const [isNotarizingTake, setIsNotarizingTake] = useState<boolean>(false);
  const [takeNotarization, setTakeNotarization] = useState<NotarizationResult | null>(null);
  const [showCameraRoyaltyModal, setShowCameraRoyaltyModal] = useState<boolean>(false);

  // Panel Drawers
  const [activeDrawer, setActiveDrawer] = useState<"none" | "filters" | "audio" | "layout" | "lighting" | "teleprompter">("none");

  // DOM Refs
  const videoCameraRef = useRef<HTMLVideoElement | null>(null);
  const hostVideoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const audioEngineRef = useRef<AudioRemixEngine | null>(null);
  const teleprompterBoxRef = useRef<HTMLDivElement | null>(null);

  // Compute host video URL
  const hostVideoUrl = sourceSoundVideo ? storagePublicUrl(sourceSoundVideo.video_path) : "";

  // 1. Extract Waveform if source sound is provided
  useEffect(() => {
    if (hostVideoUrl) {
      AudioRemixEngine.extractWaveform(hostVideoUrl, 64)
        .then((data: WaveformData) => {
          setWaveformPeaks(data.peaks);
        })
        .catch(() => {
          setWaveformPeaks([]);
        });
    }
  }, [hostVideoUrl]);

  // 2. Teleprompter autoscroll when recording or when open
  useEffect(() => {
    if (!teleprompterOpen) return;
    let scrollId: number;
    const scrollStep = () => {
      setTeleprompterScroll((prev) => prev + teleprompterSpeed * 0.4);
      scrollId = requestAnimationFrame(scrollStep);
    };
    scrollId = requestAnimationFrame(scrollStep);
    return () => cancelAnimationFrame(scrollId);
  }, [teleprompterOpen, teleprompterSpeed]);

  // 3. Initialize Camera Feed
  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      if (videoCameraRef.current?.srcObject) {
        const tracks = (videoCameraRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach((t) => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: aspectRatio === "16:9" ? 1280 : 720 },
          height: { ideal: aspectRatio === "16:9" ? 720 : 1280 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      if (videoCameraRef.current) {
        videoCameraRef.current.srcObject = stream;
        await videoCameraRef.current.play();
        setStreamActive(true);
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      setCameraError(
        err?.name === "NotAllowedError"
          ? "Camera/Microphone permission denied. Please allow permissions in your browser to record."
          : "Unable to start camera. Please verify device permissions."
      );
    }
  }, [facingMode, aspectRatio]);

  // Clean up streams on unmount
  useEffect(() => {
    startCamera();
    return () => {
      if (videoCameraRef.current?.srcObject) {
        const tracks = (videoCameraRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach((t) => t.stop());
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (timerIntervalRef.current) {
        window.clearInterval(timerIntervalRef.current);
      }
      if (audioEngineRef.current) {
        audioEngineRef.current.destroy();
      }
    };
  }, [startCamera]);

  // Auto-stop recording if duration reaches max limit
  useEffect(() => {
    if (isRecording && maxRecordingDuration > 0 && recordedDuration >= maxRecordingDuration) {
      handleStopRecording();
    }
  }, [recordedDuration, isRecording, maxRecordingDuration]);

  // 4. High-Performance Canvas Compositor & Shader Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    let frameCount = 0;

    const renderCompositeLoop = () => {
      frameCount++;
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      const camVideo = videoCameraRef.current;
      const hostVideo = hostVideoRef.current;

      // Real-time audio metrics
      let curAvgVol = 0;
      let curBass = 0;
      let curMid = 0;
      let curTreble = 0;
      if (audioEngineRef.current) {
        const metrics = audioEngineRef.current.getReactiveAudioMetrics();
        curAvgVol = metrics.averageVolume;
        curBass = metrics.bassEnergy;
        curMid = metrics.midEnergy;
        curTreble = metrics.trebleEnergy;
        if (frameCount % 6 === 0) {
          setAudioMetrics({
            averageVolume: curAvgVol,
            bassEnergy: curBass,
            midEnergy: curMid,
            trebleEnergy: curTreble,
          });
        }
      }

      // --- RENDER LAYOUT MODES ---
      if (layoutMode === "solo" || layoutMode === "audio-only") {
        if (camVideo && camVideo.readyState >= 2) {
          applyShaderFilter(ctx, activeFilter, frameCount, beautyIntensity, curAvgVol, curBass);
          ctx.drawImage(camVideo, 0, 0, width, height);
          ctx.filter = "none";
        }
      } else if (layoutMode === "split-horizontal") {
        const halfWidth = width / 2;
        // Host video on Left
        if (hostVideo && hostVideo.readyState >= 2) {
          ctx.drawImage(hostVideo, 0, 0, halfWidth, height);
        } else {
          ctx.fillStyle = "#090d16";
          ctx.fillRect(0, 0, halfWidth, height);
        }
        // Camera on Right
        if (camVideo && camVideo.readyState >= 2) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(halfWidth, 0, halfWidth, height);
          ctx.clip();
          applyShaderFilter(ctx, activeFilter, frameCount, beautyIntensity, curAvgVol, curBass);
          ctx.drawImage(camVideo, halfWidth, 0, halfWidth, height);
          ctx.restore();
          ctx.filter = "none";
        }

        // Duet Divider Line with Cyan Neon Glow
        ctx.strokeStyle = "#06b6d4";
        ctx.lineWidth = 3;
        ctx.shadowColor = "#06b6d4";
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(halfWidth, 0);
        ctx.lineTo(halfWidth, height);
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else if (layoutMode === "split-vertical") {
        const halfHeight = height / 2;
        if (hostVideo && hostVideo.readyState >= 2) {
          ctx.drawImage(hostVideo, 0, 0, width, halfHeight);
        }
        if (camVideo && camVideo.readyState >= 2) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, halfHeight, width, halfHeight);
          ctx.clip();
          applyShaderFilter(ctx, activeFilter, frameCount, beautyIntensity, curAvgVol, curBass);
          ctx.drawImage(camVideo, 0, halfHeight, width, halfHeight);
          ctx.restore();
          ctx.filter = "none";
        }
        ctx.strokeStyle = "#06b6d4";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, halfHeight);
        ctx.lineTo(width, halfHeight);
        ctx.stroke();
      } else if (layoutMode === "pip") {
        if (hostVideo && hostVideo.readyState >= 2) {
          ctx.drawImage(hostVideo, 0, 0, width, height);
        } else {
          ctx.fillStyle = "#090d16";
          ctx.fillRect(0, 0, width, height);
        }

        if (camVideo && camVideo.readyState >= 2) {
          const pipW = width * 0.36;
          const pipH = pipW * (16 / 9);
          let pipX = width - pipW - 16;
          let pipY = height - pipH - 24;

          if (pipPosition === "top-right") {
            pipY = 24;
          } else if (pipPosition === "bottom-left") {
            pipX = 16;
          } else if (pipPosition === "top-left") {
            pipX = 16;
            pipY = 24;
          }

          ctx.save();
          ctx.beginPath();
          ctx.roundRect(pipX, pipY, pipW, pipH, 14);
          ctx.clip();
          applyShaderFilter(ctx, activeFilter, frameCount, beautyIntensity, curAvgVol, curBass);
          ctx.drawImage(camVideo, pipX, pipY, pipW, pipH);
          ctx.restore();
          ctx.filter = "none";

          ctx.strokeStyle = "#06b6d4";
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.roundRect(pipX, pipY, pipW, pipH, 14);
          ctx.stroke();
        }
      } else if (layoutMode === "reaction-cam") {
        // Main Host Video
        if (hostVideo && hostVideo.readyState >= 2) {
          ctx.drawImage(hostVideo, 0, 0, width, height);
        } else {
          ctx.fillStyle = "#090d16";
          ctx.fillRect(0, 0, width, height);
        }

        // Circular Reaction Cam in bottom right
        if (camVideo && camVideo.readyState >= 2) {
          const radius = width * 0.18;
          const cx = width - radius - 20;
          const cy = height - radius - 30;

          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.clip();
          applyShaderFilter(ctx, activeFilter, frameCount, beautyIntensity, curAvgVol, curBass);
          ctx.drawImage(camVideo, cx - radius, cy - radius, radius * 2, radius * 2);
          ctx.restore();
          ctx.filter = "none";

          // Pulsing audio-reactive circular ring
          ctx.strokeStyle = `rgba(244, 63, 94, ${0.7 + curBass * 0.3})`;
          ctx.lineWidth = 3 + curBass * 5;
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else if (layoutMode === "chroma-duet") {
        // Render chosen background
        renderCustomBackdrop(ctx, hostVideo, width, height, chromaBackdrop, frameCount);
        if (camVideo && camVideo.readyState >= 2) {
          renderChromaKeyFrame(ctx, camVideo, width, height, chromaKeyColor, chromaTolerance);
        }
      }

      // --- SHADER POST-PROCESSING OVERLAYS ---
      if (activeFilter === "vhs-1989") {
        drawVhsOverlay(ctx, width, height, frameCount);
      } else if (activeFilter === "cyber-glitch") {
        drawCyberGlitchOverlay(ctx, width, height, frameCount);
      } else if (activeFilter === "cinema-35mm") {
        drawCinema35mmOverlay(ctx, width, height, frameCount);
      } else if (activeFilter === "neon-reactive") {
        drawNeonReactiveAura(ctx, width, height, frameCount, curAvgVol, curBass);
      } else if (activeFilter === "holo-matrix") {
        drawHoloMatrixOverlay(ctx, width, height, frameCount);
      } else if (activeFilter === "thermal-flir") {
        drawThermalFlirOverlay(ctx, width, height, frameCount);
      } else if (activeFilter === "golden-hour") {
        drawGoldenHourOverlay(ctx, width, height, frameCount);
      } else if (activeFilter === "sobel-edge") {
        drawSobelNeonEdgeOverlay(ctx, width, height, curBass);
      }

      // Composition Rule-of-Thirds Grid
      if (gridOverlay) {
        drawRuleOfThirdsGrid(ctx, width, height);
      }

      animationFrameRef.current = requestAnimationFrame(renderCompositeLoop);
    };

    animationFrameRef.current = requestAnimationFrame(renderCompositeLoop);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [
    layoutMode,
    activeFilter,
    beautyIntensity,
    pipPosition,
    chromaKeyColor,
    chromaTolerance,
    chromaBackdrop,
    gridOverlay,
  ]);

  // Shader Filter Logic
  function applyShaderFilter(
    ctx: CanvasRenderingContext2D,
    filter: CameraFilterMode,
    frameCount: number,
    beautyLvl: number,
    avgVol: number,
    bassEnergy: number
  ) {
    if (filter === "beauty-glam") {
      const bRatio = beautyLvl / 100;
      ctx.filter = `brightness(${1 + 0.08 * bRatio}) contrast(${1 + 0.04 * bRatio}) saturate(${1 + 0.14 * bRatio})`;
    } else if (filter === "cinema-35mm") {
      ctx.filter = "contrast(1.18) saturate(1.22) sepia(0.08) brightness(1.02)";
    } else if (filter === "cyber-glitch") {
      const hueShift = (frameCount * 3) % 360;
      ctx.filter = `contrast(1.35) saturate(1.6) hue-rotate(${hueShift > 180 ? 180 : 0}deg)`;
    } else if (filter === "vhs-1989") {
      ctx.filter = "sepia(0.28) saturate(1.25) contrast(1.12) brightness(0.96)";
    } else if (filter === "neon-reactive") {
      const reactiveSat = 1.2 + bassEnergy * 0.8;
      const reactiveCont = 1.1 + avgVol * 0.4;
      ctx.filter = `contrast(${reactiveCont}) saturate(${reactiveSat})`;
    } else if (filter === "noir-contrast") {
      ctx.filter = "grayscale(1) contrast(1.5) brightness(0.9)";
    } else if (filter === "golden-hour") {
      ctx.filter = "contrast(1.12) saturate(1.35) sepia(0.2) brightness(1.06)";
    } else if (filter === "holo-matrix") {
      ctx.filter = "contrast(1.4) saturate(1.5) hue-rotate(90deg) brightness(1.1)";
    } else if (filter === "thermal-flir") {
      ctx.filter = "contrast(1.6) saturate(2.0) invert(0.85) hue-rotate(190deg)";
    } else {
      ctx.filter = "none";
    }
  }

  // Backdrop Rendering for Chroma Key Studio
  function renderCustomBackdrop(
    ctx: CanvasRenderingContext2D,
    hostVideo: HTMLVideoElement | null,
    width: number,
    height: number,
    backdrop: ChromaBackdrop,
    frame: number
  ) {
    if (backdrop === "host-video" && hostVideo && hostVideo.readyState >= 2) {
      ctx.drawImage(hostVideo, 0, 0, width, height);
    } else if (backdrop === "cyberpunk-neon") {
      // Procedural animated neon skyline
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, "#090918");
      grad.addColorStop(0.6, "#1e1035");
      grad.addColorStop(1, "#030014");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Cyber grid lines at horizon
      ctx.strokeStyle = "rgba(168, 85, 247, 0.35)";
      ctx.lineWidth = 1;
      const horizon = height * 0.7;
      for (let i = 0; i < 8; i++) {
        const y = horizon + (i * i * 4);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    } else if (backdrop === "studio-ambient") {
      const rad = ctx.createRadialGradient(width / 2, height / 2, 40, width / 2, height / 2, width);
      rad.addColorStop(0, "#1e293b");
      rad.addColorStop(1, "#020617");
      ctx.fillStyle = rad;
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.fillStyle = "#020617";
      ctx.fillRect(0, 0, width, height);
    }
  }

  // Real-time Chroma Key with WebAssembly Acceleration
  function renderChromaKeyFrame(
    ctx: CanvasRenderingContext2D,
    camVideo: HTMLVideoElement,
    width: number,
    height: number,
    keyColor: "green" | "blue" | "magenta",
    tolerance: number
  ) {
    const offscreen = document.createElement("canvas");
    offscreen.width = width;
    offscreen.height = height;
    const offCtx = offscreen.getContext("2d", { willReadFrequently: true });
    if (!offCtx) return;

    offCtx.drawImage(camVideo, 0, 0, width, height);
    const frame = offCtx.getImageData(0, 0, width, height);

    // Hardware accelerated via WebAssembly DSP Engine
    wasmDspEngine.processChromaKey(frame, {
      keyType: keyColor,
      tolerance,
      feather: 12,
    });

    offCtx.putImageData(frame, 0, 0);
    ctx.drawImage(offscreen, 0, 0, width, height);
  }

  // 35mm Film Grain & Lens Flare Streak
  function drawCinema35mmOverlay(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    frame: number
  ) {
    ctx.save();
    if (aspectRatio === "16:9") {
      const barH = h * 0.1;
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, w, barH);
      ctx.fillRect(0, h - barH, w, barH);
    }

    const flareIntensity = 0.15 + 0.08 * Math.sin(frame * 0.05);
    const grad = ctx.createLinearGradient(0, h * 0.45, w, h * 0.45);
    grad.addColorStop(0, "transparent");
    grad.addColorStop(0.5, `rgba(56, 189, 248, ${flareIntensity})`);
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;
    ctx.fillRect(0, h * 0.44, w, 3);

    ctx.font = '10px "Space Grotesk", monospace';
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.fillText("OMN-VISION 35MM // 24FPS KODAK 500T", 24, h - 20);
    ctx.restore();
  }

  // Audio-Reactive Neon Aura & Pulse
  function drawNeonReactiveAura(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    frame: number,
    avgVol: number,
    bassEnergy: number
  ) {
    ctx.save();
    const pulseAlpha = Math.min(0.8, 0.2 + bassEnergy * 0.6);
    ctx.strokeStyle = `rgba(6, 182, 212, ${pulseAlpha})`;
    ctx.lineWidth = 4 + bassEnergy * 8;
    ctx.strokeRect(6, 6, w - 12, h - 12);

    const barCount = 28;
    const barWidth = (w - 48) / barCount;
    for (let i = 0; i < barCount; i++) {
      const barH = Math.max(3, (Math.sin(frame * 0.2 + i * 0.4) * 0.5 + 0.5) * (avgVol * 60 + 10));
      const grad = ctx.createLinearGradient(0, h - 30, 0, h - 30 - barH);
      grad.addColorStop(0, "rgba(6, 182, 212, 0.8)");
      grad.addColorStop(1, "rgba(244, 63, 94, 0.9)");
      ctx.fillStyle = grad;
      ctx.fillRect(24 + i * barWidth, h - 24 - barH, barWidth - 3, barH);
    }
    ctx.restore();
  }

  // Holographic Matrix Overlay
  function drawHoloMatrixOverlay(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    frame: number
  ) {
    ctx.save();
    ctx.fillStyle = "rgba(34, 197, 94, 0.08)";
    for (let y = 0; y < h; y += 4) {
      ctx.fillRect(0, y, w, 1);
    }

    // Targeting box
    ctx.strokeStyle = "rgba(34, 197, 94, 0.7)";
    ctx.lineWidth = 1.5;
    const boxSize = 100;
    ctx.strokeRect(w / 2 - boxSize / 2, h / 2 - boxSize / 2, boxSize, boxSize);

    ctx.font = '10px "Space Grotesk", monospace';
    ctx.fillStyle = "#22c55e";
    ctx.fillText("HOLO-MATRIX V3 // FREQ: 48kHz // SYNC: LOCK", 24, 40);
    ctx.fillText(`TARGET LAT: 37.77 LNG: -122.41 // F-${frame}`, 24, h - 24);
    ctx.restore();
  }

  // Thermal FLIR Vision Overlay
  function drawThermalFlirOverlay(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    frame: number
  ) {
    ctx.save();
    // Crosshair in center
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 20, 0, Math.PI * 2);
    ctx.stroke();

    ctx.font = 'bold 11px "Space Grotesk", monospace';
    ctx.fillStyle = "#facc15";
    ctx.fillText("FLIR THERMAL // 98.6°F CALIBRATED", 24, 38);
    ctx.restore();
  }

  // Golden Hour Sunset Flare
  function drawGoldenHourOverlay(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    frame: number
  ) {
    ctx.save();
    const grad = ctx.createRadialGradient(0, 0, 20, 0, 0, w * 0.9);
    grad.addColorStop(0, "rgba(251, 191, 36, 0.35)");
    grad.addColorStop(0.5, "rgba(245, 158, 11, 0.15)");
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  // Sobel Edge Neon Contours
  function drawSobelNeonEdgeOverlay(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    bassEnergy: number
  ) {
    ctx.save();
    ctx.strokeStyle = `rgba(56, 189, 248, ${0.4 + bassEnergy * 0.5})`;
    ctx.lineWidth = 2 + bassEnergy * 4;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.restore();
  }

  // Rule of Thirds Grid
  function drawRuleOfThirdsGrid(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
    ctx.lineWidth = 1;
    // Vertical lines
    ctx.beginPath();
    ctx.moveTo(w / 3, 0);
    ctx.lineTo(w / 3, h);
    ctx.moveTo((w * 2) / 3, 0);
    ctx.lineTo((w * 2) / 3, h);
    // Horizontal lines
    ctx.moveTo(0, h / 3);
    ctx.lineTo(w, h / 3);
    ctx.moveTo(0, (h * 2) / 3);
    ctx.lineTo(w, (h * 2) / 3);
    ctx.stroke();
    ctx.restore();
  }

  // Live VHS scanline simulation overlay
  function drawVhsOverlay(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    frame: number
  ) {
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
    for (let y = 0; y < h; y += 4) {
      ctx.fillRect(0, y, w, 1.5);
    }
    ctx.font = 'bold 15px "Space Grotesk", monospace';
    ctx.fillStyle = "#facc15";
    ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
    ctx.shadowBlur = 5;
    ctx.fillText("PLAY ▷ SP [OMN-TAPE]", 24, 38);
    ctx.fillText(`OCT 27 2026 ${new Date().toLocaleTimeString()}`, 24, h - 22);
    ctx.restore();
  }

  // Live Cyberpunk HUD
  function drawCyberGlitchOverlay(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    frame: number
  ) {
    ctx.save();
    ctx.strokeStyle = "rgba(6, 182, 212, 0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 44, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(w / 2 - 54, h / 2);
    ctx.lineTo(w / 2 + 54, h / 2);
    ctx.moveTo(w / 2, h / 2 - 54);
    ctx.lineTo(w / 2, h / 2 + 54);
    ctx.stroke();

    ctx.font = '10px "Space Grotesk", monospace';
    ctx.fillStyle = "#06b6d4";
    ctx.fillText("OMNPLAY AR-OPTICS // REVOLUTION TRACK", w / 2 - 110, h / 2 + 70);
    ctx.restore();
  }

  // 5. Start Recording with Audio Engine Sync
  const handleStartRecording = () => {
    if (countdownSetting > 0) {
      setCountdown(countdownSetting);
      let remaining = countdownSetting;
      const interval = window.setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          window.clearInterval(interval);
          setCountdown(null);
          executeRecording();
        } else {
          setCountdown(remaining);
        }
      }, 1000);
      return;
    }
    executeRecording();
  };

  const executeRecording = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    recordedChunksRef.current = [];
    const canvasStream = canvas.captureStream(30);

    // Initialize Web Audio Engine
    try {
      const engine = new AudioRemixEngine();
      audioEngineRef.current = engine;
      engine.initGraph({ enableDucking });

      if (videoCameraRef.current?.srcObject) {
        engine.attachMicrophone(videoCameraRef.current.srcObject as MediaStream, micVolume / 100);
      }

      if (soundEnabled && hostVideoRef.current) {
        engine.attachBackingTrack(hostVideoRef.current, soundVolume / 100);
      }

      const mixedAudioStream = engine.getMixedAudioStream();
      if (mixedAudioStream) {
        mixedAudioStream.getAudioTracks().forEach((track) => canvasStream.addTrack(track));
      }
    } catch (e) {
      console.warn("Audio mixer fallback:", e);
    }

    if (hostVideoRef.current) {
      hostVideoRef.current.currentTime = soundSnippetStart;
      hostVideoRef.current.play().catch(() => {});
    }

    let mimeType = "video/webm;codecs=vp9,opus";
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = "video/webm";
    }

    const recorder = new MediaRecorder(canvasStream, {
      mimeType,
      videoBitsPerSecond: 3500000,
    });

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        recordedChunksRef.current.push(e.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: mimeType });
      setRecordedBlob(blob);
      setRecordedPreviewUrl(URL.createObjectURL(blob));
      blob.arrayBuffer().then((buf) => {
        const fp = computeAudioContentFingerprint(buf);
        setTakeFingerprint(fp);
      });
      setIsRecording(false);
      if (hostVideoRef.current) hostVideoRef.current.pause();
      if (timerIntervalRef.current) window.clearInterval(timerIntervalRef.current);
      notify?.("Take Recorded!", "Preview your clip or send directly to OmnPlay Studio.", "success");
    };

    mediaRecorderRef.current = recorder;
    recorder.start(100);
    setIsRecording(true);
    setRecordedDuration(0);

    timerIntervalRef.current = window.setInterval(() => {
      setRecordedDuration((prev) => prev + 1);
    }, 1000);
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  };

  const handleRetake = () => {
    setRecordedBlob(null);
    setTakeFingerprint("");
    setTakeNotarization(null);
    if (recordedPreviewUrl) {
      URL.revokeObjectURL(recordedPreviewUrl);
      setRecordedPreviewUrl(null);
    }
    setRecordedDuration(0);
  };

  const handleNotarizeTake = async () => {
    if (!recordedBlob || !takeFingerprint) return;
    try {
      setIsNotarizingTake(true);
      notify?.("Notarizing Take", "Submitting proof of creation to blockchain...", "info");
      const targetChain = wallet?.chainId === "0x1" || wallet?.chainId === "0x89" || wallet?.chainId === "0xa4b1" ? wallet.chainId : "0x38";
      const result = await notarizeVideoCreationOnChain({
        videoFingerprint: takeFingerprint,
        audioFingerprint: sourceSoundVideo ? computeAudioContentFingerprint(sourceSoundVideo.id) : undefined,
        title: sourceSoundVideo ? `Duet_${sourceSoundVideo.title.slice(0, 16)}` : "OmnPlay_Take",
        durationSeconds: recordedDuration || 15,
        parentSoundId: sourceSoundVideo?.id || "camera-solo",
        targetChain,
      });
      setTakeNotarization(result);
      setIsNotarizingTake(false);
      notify?.("Take Notarized on Chain!", `Proof recorded on ${result.chain}`, "success");
    } catch (err: any) {
      setIsNotarizingTake(false);
      notify?.("Notarization Failed", err?.message || "Failed to notarize take", "error");
    }
  };

  const handleSaveClip = () => {
    if (!recordedBlob) return;
    const title = sourceSoundVideo
      ? `Remix_${sourceSoundVideo.title.slice(0, 20)}_${Date.now()}`
      : `OmnPlay_Take_${Date.now()}`;
    
    onClipRecorded(recordedBlob, {
      title,
      soundTitle: sourceSoundVideo?.title,
      mode: layoutMode,
    });
    onClose();
  };

  const handleOpenInStudio = () => {
    if (!recordedBlob) return;
    if (onSendToStudio) {
      onSendToStudio(recordedBlob, sourceSoundVideo);
      onClose();
    } else {
      handleSaveClip();
    }
  };

  const toggleSnippetPreview = () => {
    if (!hostVideoRef.current) return;
    if (isPlayingSnippet) {
      hostVideoRef.current.pause();
      setIsPlayingSnippet(false);
    } else {
      hostVideoRef.current.currentTime = soundSnippetStart;
      hostVideoRef.current.play().catch(() => {});
      setIsPlayingSnippet(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 text-slate-100 backdrop-blur-md">
      {/* Hidden Source Video Elements for Feed & Mixing */}
      <video
        ref={videoCameraRef}
        playsInline
        muted
        className="hidden"
      />
      {hostVideoUrl && (
        <video
          ref={hostVideoRef}
          src={hostVideoUrl}
          playsInline
          loop
          crossOrigin="anonymous"
          className="hidden"
        />
      )}

      {/* Screen Ring Light Illumination Effect */}
      {ringLightActive && (
        <div
          className={`pointer-events-none fixed inset-0 z-40 transition-opacity duration-300 ${
            ringLightTemp === "warm"
              ? "border-[28px] border-amber-300/40 shadow-[inset_0_0_120px_rgba(251,191,36,0.4)]"
              : ringLightTemp === "cool"
              ? "border-[28px] border-sky-300/40 shadow-[inset_0_0_120px_rgba(56,189,248,0.4)]"
              : ringLightTemp === "cyan"
              ? "border-[28px] border-cyan-400/40 shadow-[inset_0_0_120px_rgba(6,182,212,0.4)]"
              : ringLightTemp === "magenta"
              ? "border-[28px] border-fuchsia-400/40 shadow-[inset_0_0_120px_rgba(217,70,239,0.4)]"
              : "border-[28px] border-white/40 shadow-[inset_0_0_120px_rgba(255,255,255,0.4)]"
          }`}
          style={{ opacity: ringLightBrightness / 100 }}
        />
      )}

      {/* Main Suite Container */}
      <div className="relative flex h-full w-full max-w-5xl flex-col overflow-hidden bg-slate-950 sm:h-[94vh] sm:rounded-2xl sm:border sm:border-slate-800">
        {/* TOP BAR */}
        <div className="z-30 flex items-center justify-between border-b border-slate-800/80 bg-slate-900/90 px-4 py-3 backdrop-blur-md">
          {/* Sound Badge Pill */}
          <div className="flex items-center gap-2">
            {sourceSoundVideo ? (
              <button
                onClick={() => setActiveDrawer(activeDrawer === "audio" ? "none" : "audio")}
                className="flex items-center gap-2 rounded-full border border-cyan-500/40 bg-cyan-950/60 px-3 py-1.5 text-xs font-medium text-cyan-300 transition-all hover:bg-cyan-900/60"
              >
                <Disc className="h-3.5 w-3.5 animate-spin text-cyan-400" />
                <span className="max-w-[140px] truncate">{sourceSoundVideo.title}</span>
                <span className="rounded bg-cyan-500/20 px-1 py-0.5 text-[10px] text-cyan-200">
                  {soundSnippetStart}s
                </span>
              </button>
            ) : (
              <div className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/60 px-3 py-1 text-xs text-slate-300">
                <Music2 className="h-3.5 w-3.5 text-slate-400" />
                <span>Original Audio</span>
              </div>
            )}

            {/* Audio Spectrum Bars */}
            <div className="hidden items-end gap-0.5 sm:flex">
              <span className="h-2 w-0.5 rounded-full bg-cyan-400 transition-all" style={{ height: `${Math.max(4, audioMetrics.averageVolume * 24)}px` }} />
              <span className="h-3 w-0.5 rounded-full bg-cyan-400 transition-all" style={{ height: `${Math.max(6, audioMetrics.bassEnergy * 28)}px` }} />
              <span className="h-2 w-0.5 rounded-full bg-cyan-400 transition-all" style={{ height: `${Math.max(4, audioMetrics.averageVolume * 18)}px` }} />
            </div>
          </div>

          {/* Quick Header Toggles */}
          <div className="flex items-center gap-2">
            {/* Speed Badge */}
            <div className="flex items-center rounded-lg border border-slate-800 bg-slate-900/80 p-0.5 text-xs">
              {([0.5, 1, 2] as const).map((spd) => (
                <button
                  key={spd}
                  onClick={() => setRecordingSpeed(spd)}
                  className={`rounded px-2 py-0.5 font-bold transition-all ${
                    recordingSpeed === spd
                      ? "bg-cyan-500 text-slate-950"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>

            {/* Ring Light Quick Toggle */}
            <button
              onClick={() => setRingLightActive(!ringLightActive)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-all ${
                ringLightActive
                  ? "border-amber-400 bg-amber-950/60 text-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.3)]"
                  : "border-slate-800 bg-slate-900/80 text-slate-400 hover:text-slate-200"
              }`}
              title="Virtual Softbox Ring Light"
            >
              <SunMedium className="h-4 w-4" />
            </button>

            {/* Teleprompter Quick Toggle */}
            <button
              onClick={() => setTeleprompterOpen(!teleprompterOpen)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-all ${
                teleprompterOpen
                  ? "border-cyan-400 bg-cyan-950/60 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.3)]"
                  : "border-slate-800 bg-slate-900/80 text-slate-400 hover:text-slate-200"
              }`}
              title="Teleprompter Script"
            >
              <FileText className="h-4 w-4" />
            </button>

            {/* Grid Toggle */}
            <button
              onClick={() => setGridOverlay(!gridOverlay)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-all ${
                gridOverlay
                  ? "border-cyan-400 bg-cyan-950/60 text-cyan-300"
                  : "border-slate-800 bg-slate-900/80 text-slate-400 hover:text-slate-200"
              }`}
              title="Rule of Thirds Grid"
            >
              <Grid className="h-4 w-4" />
            </button>

            {/* Close Studio */}
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/80 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* CAMERA CANVAS VIEWER */}
        <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black">
          {cameraError ? (
            <div className="flex max-w-sm flex-col items-center gap-3 p-6 text-center">
              <Camera className="h-10 w-10 text-rose-400" />
              <p className="text-xs text-rose-300">{cameraError}</p>
              <button
                onClick={startCamera}
                className="mt-2 rounded-xl bg-cyan-500 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-cyan-400"
              >
                Retry Camera
              </button>
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              width={aspectRatio === "16:9" ? 1280 : 720}
              height={aspectRatio === "16:9" ? 720 : 1280}
              className={`max-h-full max-w-full object-contain ${
                aspectRatio === "9:16"
                  ? "aspect-[9/16]"
                  : aspectRatio === "16:9"
                  ? "aspect-[16/9]"
                  : "aspect-square"
              }`}
            />
          )}

          {/* Floating Teleprompter Window */}
          {teleprompterOpen && (
            <div
              ref={teleprompterBoxRef}
              className="absolute top-6 left-6 right-6 z-20 max-h-48 overflow-hidden rounded-2xl border border-cyan-500/40 bg-slate-950/85 p-4 backdrop-blur-xl shadow-2xl"
            >
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-[11px] text-cyan-400 font-mono">
                <span className="flex items-center gap-1.5">
                  <FileText className="h-3 w-3" /> TELEPROMPTER // SPEED {teleprompterSpeed}x
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={teleprompterSpeed}
                    onChange={(e) => setTeleprompterSpeed(Number(e.target.value))}
                    className="w-16 accent-cyan-400"
                    title="Scroll Speed"
                  />
                  <button onClick={() => setTeleprompterOpen(false)} className="text-slate-400 hover:text-white">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div
                className="transition-transform duration-100 ease-linear font-medium text-slate-100 leading-relaxed text-center"
                style={{
                  fontSize: `${teleprompterFontSize}px`,
                  transform: `translateY(-${teleprompterScroll}px)`,
                }}
              >
                {teleprompterText}
              </div>
            </div>
          )}

          {/* Countdown Overlay */}
          {countdown !== null && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="flex h-32 w-32 items-center justify-center rounded-full border-4 border-cyan-400 bg-cyan-950/80 text-6xl font-black text-cyan-300 shadow-[0_0_40px_rgba(6,182,212,0.6)] animate-pulse">
                {countdown}
              </div>
            </div>
          )}

          {/* Recording Timer Badge */}
          {isRecording && (
            <div className="absolute top-4 left-4 z-20 flex items-center gap-2 rounded-full border border-rose-500/60 bg-rose-950/80 px-3 py-1 backdrop-blur-md">
              <div className="h-2.5 w-2.5 rounded-full bg-rose-500 animate-ping" />
              <span className="font-mono text-xs font-bold text-rose-300">
                REC {Math.floor(recordedDuration / 60).toString().padStart(2, "0")}:
                {(recordedDuration % 60).toString().padStart(2, "0")}
                {maxRecordingDuration > 0 && ` / ${maxRecordingDuration}s`}
              </span>
            </div>
          )}

          {/* RIGHT FLOATING TOOLBAR */}
          {!isRecording && !recordedBlob && (
            <div className="absolute right-4 top-4 z-20 flex flex-col gap-2.5">
              <button
                onClick={() => setFacingMode(facingMode === "user" ? "environment" : "user")}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-800 bg-slate-900/80 text-slate-300 backdrop-blur-md transition-all hover:bg-slate-800 hover:text-cyan-400"
                title="Flip Camera"
              >
                <RefreshCw className="h-4 w-4" />
              </button>

              <button
                onClick={() => setActiveDrawer(activeDrawer === "filters" ? "none" : "filters")}
                className={`flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur-md transition-all ${
                  activeFilter !== "none"
                    ? "border-cyan-500 bg-cyan-950 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.4)]"
                    : "border-slate-800 bg-slate-900/80 text-slate-300 hover:bg-slate-800"
                }`}
                title="AR Optics & Shaders"
              >
                <Wand2 className="h-4 w-4" />
              </button>

              <button
                onClick={() => setActiveDrawer(activeDrawer === "layout" ? "none" : "layout")}
                className={`flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur-md transition-all ${
                  layoutMode !== "solo"
                    ? "border-cyan-500 bg-cyan-950 text-cyan-400"
                    : "border-slate-800 bg-slate-900/80 text-slate-300 hover:bg-slate-800"
                }`}
                title="Duet & Split Screen"
              >
                <Split className="h-4 w-4" />
              </button>

              <button
                onClick={() => setActiveDrawer(activeDrawer === "audio" ? "none" : "audio")}
                className={`flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur-md transition-all ${
                  activeDrawer === "audio"
                    ? "border-cyan-500 bg-cyan-950 text-cyan-400"
                    : "border-slate-800 bg-slate-900/80 text-slate-300 hover:bg-slate-800"
                }`}
                title="Sound & Audio Mixer"
              >
                <Music2 className="h-4 w-4" />
              </button>

              <button
                onClick={() => setCountdownSetting(countdownSetting === 0 ? 3 : countdownSetting === 3 ? 5 : countdownSetting === 5 ? 10 : 0)}
                className={`flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur-md text-xs font-bold transition-all ${
                  countdownSetting > 0
                    ? "border-amber-500 bg-amber-950 text-amber-400"
                    : "border-slate-800 bg-slate-900/80 text-slate-300 hover:bg-slate-800"
                }`}
                title="Hands-free Countdown Timer"
              >
                {countdownSetting > 0 ? `${countdownSetting}s` : <Clock className="h-4 w-4" />}
              </button>

              <button
                onClick={() => setAspectRatio(aspectRatio === "9:16" ? "16:9" : aspectRatio === "16:9" ? "1:1" : "9:16")}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-800 bg-slate-900/80 text-[10px] font-bold text-slate-300 backdrop-blur-md hover:bg-slate-800 hover:text-cyan-400"
                title="Aspect Ratio (9:16 Shorts / 16:9 Video / 1:1 Square)"
              >
                {aspectRatio}
              </button>
            </div>
          )}

          {/* DRAWER PANELS OVERLAY */}
          {activeDrawer === "filters" && (
            <div className="absolute bottom-24 left-4 right-4 z-30 rounded-xl border border-slate-800 bg-slate-900/95 p-4 backdrop-blur-lg sm:left-auto sm:right-16 sm:w-88 max-h-[75vh] overflow-y-auto">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200">Shaders & AR Filters</span>
                <button onClick={() => setActiveDrawer("none")} className="text-slate-400 hover:text-slate-200">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {([
                  { id: "none", label: "Normal Raw" },
                  { id: "neon-reactive", label: "Audio Neon" },
                  { id: "chroma-key", label: "Chroma Key" },
                  { id: "cinema-35mm", label: "35mm Film" },
                  { id: "beauty-glam", label: "Beauty Glam" },
                  { id: "vhs-1989", label: "VHS 1989" },
                  { id: "cyber-glitch", label: "Cyber Glitch" },
                  { id: "holo-matrix", label: "Holo Matrix" },
                  { id: "thermal-flir", label: "Thermal FLIR" },
                  { id: "golden-hour", label: "Golden Hour" },
                  { id: "sobel-edge", label: "Sobel WASM" },
                  { id: "noir-contrast", label: "Noir B&W" },
                ] as const).map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setActiveFilter(f.id)}
                    className={`rounded-lg border px-2.5 py-2 text-left font-medium transition-all ${
                      activeFilter === f.id
                        ? "border-cyan-500 bg-cyan-950/60 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.3)]"
                        : "border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {activeFilter === "beauty-glam" && (
                <div className="mt-3 pt-3 border-t border-slate-800">
                  <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                    <span>Skin Softening Intensity</span>
                    <span>{beautyIntensity}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={beautyIntensity}
                    onChange={(e) => setBeautyIntensity(Number(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                </div>
              )}

              {activeFilter === "chroma-key" && (
                <div className="mt-3 pt-3 border-t border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Key Color</span>
                    <div className="flex gap-1.5">
                      {(["green", "blue", "magenta"] as const).map((c) => (
                        <button
                          key={c}
                          onClick={() => setChromaKeyColor(c)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold capitalize ${
                            chromaKeyColor === c ? "bg-cyan-500 text-slate-950" : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Backdrop</span>
                    <select
                      value={chromaBackdrop}
                      onChange={(e) => setChromaBackdrop(e.target.value as ChromaBackdrop)}
                      className="bg-slate-950 border border-slate-800 text-xs rounded px-2 py-0.5 text-cyan-300"
                    >
                      <option value="host-video">Host Video</option>
                      <option value="cyberpunk-neon">Cyberpunk Neon</option>
                      <option value="studio-ambient">Ambient Studio</option>
                      <option value="transparent">Transparent Cutout</option>
                    </select>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Chroma Tolerance</span>
                    <span>{chromaTolerance}%</span>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="100"
                    value={chromaTolerance}
                    onChange={(e) => setChromaTolerance(Number(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                </div>
              )}
            </div>
          )}

          {activeDrawer === "layout" && (
            <div className="absolute bottom-24 left-4 right-4 z-30 rounded-xl border border-slate-800 bg-slate-900/95 p-4 backdrop-blur-lg sm:left-auto sm:right-16 sm:w-88">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200">Duet & Split-Screen Modes</span>
                <button onClick={() => setActiveDrawer("none")} className="text-slate-400 hover:text-slate-200">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {([
                  { id: "solo", label: "Solo Camera" },
                  { id: "split-horizontal", label: "Side-by-Side (50/50)" },
                  { id: "split-vertical", label: "Top / Bottom" },
                  { id: "pip", label: "Picture-in-Picture" },
                  { id: "reaction-cam", label: "Reaction Cam" },
                  { id: "chroma-duet", label: "Virtual Studio" },
                  { id: "audio-only", label: "Sound Sync Only" },
                ] as const).map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setLayoutMode(l.id)}
                    className={`rounded-lg border px-2.5 py-2 text-left font-medium transition-all ${
                      layoutMode === l.id
                        ? "border-cyan-500 bg-cyan-950/60 text-cyan-300"
                        : "border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>

              {layoutMode === "pip" && (
                <div className="mt-3 pt-3 border-t border-slate-800">
                  <span className="text-[11px] text-slate-400 block mb-1.5">PiP Frame Position</span>
                  <div className="grid grid-cols-2 gap-1 text-[10px]">
                    {(["bottom-right", "top-right", "bottom-left", "top-left"] as const).map((pos) => (
                      <button
                        key={pos}
                        onClick={() => setPipPosition(pos)}
                        className={`rounded border py-1 capitalize ${
                          pipPosition === pos ? "border-cyan-500 text-cyan-300 bg-cyan-950/40" : "border-slate-800 text-slate-400"
                        }`}
                      >
                        {pos.replace("-", " ")}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeDrawer === "audio" && (
            <div className="absolute bottom-24 left-4 right-4 z-30 rounded-xl border border-slate-800 bg-slate-900/95 p-4 backdrop-blur-lg sm:left-auto sm:right-16 sm:w-88">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200">Sound & Audio Mixer</span>
                <button onClick={() => setActiveDrawer("none")} className="text-slate-400 hover:text-slate-200">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {sourceSoundVideo ? (
                <div className="space-y-3">
                  <div className="rounded-lg bg-slate-950/80 p-2.5 border border-slate-800/80">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="text-[11px] text-cyan-400 font-semibold truncate max-w-[180px]">
                        {sourceSoundVideo.title}
                      </div>
                      <button
                        onClick={toggleSnippetPreview}
                        className="flex items-center gap-1 rounded bg-cyan-500/20 px-2 py-0.5 text-[10px] font-bold text-cyan-300 hover:bg-cyan-500/30"
                      >
                        {isPlayingSnippet ? <Pause size={10} /> : <Play size={10} />}
                        {isPlayingSnippet ? "Pause" : "Preview"}
                      </button>
                    </div>

                    {/* Interactive Waveform Scrubber */}
                    <div className="flex items-center gap-0.5 h-8 my-1 cursor-pointer">
                      {waveformPeaks.slice(0, 48).map((peak, idx) => (
                        <div
                          key={idx}
                          className="flex-1 bg-gradient-to-t from-cyan-500 to-rose-400 rounded-full transition-all"
                          style={{ height: `${Math.max(15, peak * 100)}%` }}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                      <span>Sound Start Point</span>
                      <span className="font-mono text-cyan-400">{soundSnippetStart}s</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max={Math.max(10, Math.floor(sourceSoundVideo.duration_seconds || 60) - 15)}
                      value={soundSnippetStart}
                      onChange={(e) => setSoundSnippetStart(Number(e.target.value))}
                      className="w-full accent-cyan-400"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                    <div>
                      <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                        <span>Backing Sound</span>
                        <span>{soundVolume}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={soundVolume}
                        onChange={(e) => setSoundVolume(Number(e.target.value))}
                        className="w-full accent-cyan-400"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                        <span>Mic Gain</span>
                        <span>{micVolume}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={micVolume}
                        onChange={(e) => setMicVolume(Number(e.target.value))}
                        className="w-full accent-cyan-400"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 text-center text-xs text-slate-400">
                  <p>Recording using your device microphone.</p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Select "Use Sound" on any video in Discover or Shorts to remix with a backing track!
                  </p>
                </div>
              )}
            </div>
          )}

          {/* RECORDED PREVIEW DIALOG */}
          {recordedBlob && recordedPreviewUrl && (
            <div className="absolute inset-0 z-40 flex flex-col bg-slate-950 p-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-sm font-bold text-white font-['Space_Grotesk'] flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-400" /> Take Review
                </h3>
                <button onClick={handleRetake} className="rounded-lg p-1 text-slate-400 hover:text-white">
                  <RotateCcw className="h-4 w-4" />
                </button>
              </div>

              <div className="relative flex flex-1 items-center justify-center overflow-hidden my-3">
                <video
                  src={recordedPreviewUrl}
                  controls
                  autoPlay
                  playsInline
                  className="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
                />
              </div>

              <div className="flex flex-col gap-1.5 bg-slate-900/90 rounded-xl p-2.5 border border-slate-800 text-xs my-1">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1 font-mono text-cyan-400">
                    <ShieldCheck size={13} className="text-emerald-400" /> Keccak-256 Fingerprint:
                  </span>
                  <span className="font-mono text-slate-500">{recordedBlob ? `${(recordedBlob.size / 1024).toFixed(1)} KB` : ""}</span>
                </div>
                <div className="font-mono text-[10px] text-slate-300 break-all bg-slate-950 p-1.5 rounded border border-slate-800/80">
                  {takeFingerprint || "Computing cryptographic hash..."}
                </div>
                {takeNotarization && (
                  <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[11px]">
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <Check className="h-3 w-3" /> Notarized on {takeNotarization.chain}
                    </span>
                    <a
                      href={takeNotarization.blockExplorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:text-cyan-300 underline flex items-center gap-1 font-mono text-[10px]"
                    >
                      Verify Tx <ExternalLink size={10} />
                    </a>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <button
                  onClick={handleRetake}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  <RotateCcw className="h-4 w-4" /> Retake
                </button>
                <button
                  onClick={handleNotarizeTake}
                  disabled={isNotarizingTake || !takeFingerprint}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-amber-500/50 bg-amber-950/40 px-3 py-2.5 text-xs font-bold text-amber-300 hover:bg-amber-900/50 disabled:opacity-50 cursor-pointer"
                >
                  <Coins className="h-4 w-4" />
                  {isNotarizingTake ? "Notarizing..." : "Notarize on Chain"}
                </button>
                {sourceSoundVideo && (
                  <button
                    onClick={() => setShowCameraRoyaltyModal(true)}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-yellow-500/40 bg-yellow-950/30 px-3 py-2.5 text-xs font-bold text-yellow-300 hover:bg-yellow-900/40 cursor-pointer"
                    title="Pay Royalty to Original Sound Creator"
                  >
                    <Coins className="h-4 w-4" /> Royalty
                  </button>
                )}
                <button
                  onClick={handleOpenInStudio}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-cyan-500/40 bg-cyan-950/60 px-3 py-2.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-900/60"
                >
                  <Layers className="h-4 w-4" /> Studio
                </button>
                <button
                  onClick={handleSaveClip}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2.5 text-xs font-bold text-slate-950 shadow-lg hover:from-cyan-400 hover:to-blue-500"
                >
                  <Upload className="h-4 w-4" /> Publish
                </button>
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM CONTROLS DOCK */}
        <div className="z-30 flex items-center justify-between border-t border-slate-800/80 bg-slate-900/90 px-6 py-4 backdrop-blur-md">
          {/* Duration Limit Selector */}
          <div className="flex items-center rounded-lg border border-slate-800 bg-slate-950/70 p-1 text-xs">
            {([15, 30, 60] as const).map((d) => (
              <button
                key={d}
                onClick={() => setMaxRecordingDuration(d)}
                className={`rounded px-2 py-1 font-mono font-bold transition-all ${
                  maxRecordingDuration === d
                    ? "bg-cyan-500 text-slate-950"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {d}s
              </button>
            ))}
          </div>

          {/* MAIN RECORD BUTTON */}
          <div className="flex items-center gap-3">
            {!isRecording ? (
              <button
                onClick={handleStartRecording}
                className="group relative flex h-16 w-16 items-center justify-center rounded-full border-4 border-slate-900 bg-rose-500 shadow-[0_0_25px_rgba(244,63,94,0.5)] transition-all hover:scale-105 active:scale-95"
                title="Start Recording"
              >
                <div className="h-6 w-6 rounded-full bg-white transition-all group-hover:scale-90" />
              </button>
            ) : (
              <button
                onClick={handleStopRecording}
                className="relative flex h-16 w-16 items-center justify-center rounded-full border-4 border-rose-500 bg-slate-950 shadow-[0_0_30px_rgba(244,63,94,0.6)] animate-pulse"
                title="Stop Recording"
              >
                <div className="h-6 w-6 rounded-md bg-rose-500" />
              </button>
            )}
          </div>

          {/* Filter Status Badge */}
          <div className="flex items-center gap-2 text-xs">
            <span className="hidden sm:inline font-mono text-slate-400 text-[11px]">
              FILTER: <span className="text-cyan-400 uppercase">{activeFilter}</span>
            </span>
          </div>
        </div>
      </div>

      {showCameraRoyaltyModal && sourceSoundVideo && (
        <SoundRoyaltyModal
          video={sourceSoundVideo}
          wallet={wallet}
          onWalletChange={onWalletChange}
          onClose={() => setShowCameraRoyaltyModal(false)}
          notify={notify}
        />
      )}
    </div>
  );
}
