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
} from "lucide-react";
import { storagePublicUrl } from "../../lib/supabase";
import type { VideoRow } from "../../types";
import { AudioRemixEngine, type WaveformData } from "../../services/audioRemixEngine";

export type CameraFilterMode =
  | "none"
  | "chroma-key"      // Real Green/Blue screen backdrop removal
  | "neon-reactive"   // Audio-reactive dynamic neon aura & pulse
  | "cinema-35mm"     // 35mm film grain, anamorphic flare, cinematic LUT
  | "vhs-1989"        // VHS tape scanlines, chromatic drift, datecode
  | "cyber-glitch"    // RGB split channel displacement & HUD
  | "beauty-glam"     // Soft skin luminescence & iris catchlights
  | "noir-contrast";  // High dynamic range monochrome

export type DuetLayoutMode =
  | "solo"             // Full camera
  | "split-horizontal" // Side-by-side classic duet (50% / 50%)
  | "split-vertical"   // Top / Bottom duet
  | "pip"              // Picture-in-Picture floating viewport
  | "chroma-duet"      // Chroma keyed creator inside host video scene
  | "audio-only";      // Record camera while playing host video sound in sync

interface OmnPlayCameraSuiteProps {
  sourceSoundVideo?: VideoRow | null; // Selected video for "Use this sound" or Duet
  onClose: () => void;
  onClipRecorded: (blob: Blob, metadata: { title: string; soundTitle?: string; mode: string }) => void;
  onSendToStudio?: (blob: Blob, sourceVideo?: VideoRow | null) => void;
  notify?: (title: string, desc?: string, variant?: "success" | "error" | "info") => void;
}

export function OmnPlayCameraSuite({
  sourceSoundVideo,
  onClose,
  onClipRecorded,
  onSendToStudio,
  notify,
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
  const [chromaKeyColor, setChromaKeyColor] = useState<"green" | "blue">("green");
  const [chromaTolerance, setChromaTolerance] = useState(70); // 0-100
  const [ringLightActive, setRingLightActive] = useState(false);
  const [ringLightTemp, setRingLightTemp] = useState<"warm" | "neutral" | "cool">("warm");
  const [recordingSpeed, setRecordingSpeed] = useState<0.5 | 1 | 1.5 | 2>(1);

  // Audio Engine & Mixer State
  const [soundEnabled, setSoundEnabled] = useState(Boolean(sourceSoundVideo));
  const [soundSnippetStart, setSoundSnippetStart] = useState(0);
  const [soundVolume, setSoundVolume] = useState(85); // 0-100
  const [micVolume, setMicVolume] = useState(100);     // 0-100
  const [enableDucking, setEnableDucking] = useState(true);
  const [waveformPeaks, setWaveformPeaks] = useState<number[]>([]);
  const [audioMetrics, setAudioMetrics] = useState({ averageVolume: 0, bassEnergy: 0 });

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [countdownSetting, setCountdownSetting] = useState<0 | 3 | 10>(0);
  const [recordedDuration, setRecordedDuration] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedPreviewUrl, setRecordedPreviewUrl] = useState<string | null>(null);

  // Panel Drawers
  const [activeDrawer, setActiveDrawer] = useState<"none" | "filters" | "audio" | "layout" | "lighting">("none");

  // DOM Refs
  const videoCameraRef = useRef<HTMLVideoElement | null>(null);
  const hostVideoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const audioEngineRef = useRef<AudioRemixEngine | null>(null);

  // Compute host video URL
  const hostVideoUrl = sourceSoundVideo ? storagePublicUrl(sourceSoundVideo.video_path) : "";

  // 1. Extract Waveform if source sound is provided
  useEffect(() => {
    if (hostVideoUrl) {
      AudioRemixEngine.extractWaveform(hostVideoUrl, 60)
        .then((data: WaveformData) => {
          setWaveformPeaks(data.peaks);
        })
        .catch(() => {
          // Synthetic fallback waveform
          setWaveformPeaks(Array.from({ length: 60 }, (_, i) => 0.2 + 0.6 * Math.sin(i * 0.3) ** 2));
        });
    }
  }, [hostVideoUrl]);

  // 2. Initialize Camera Feed
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

  // 3. High-Performance Canvas Compositor & Shader Loop
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

      // Extract real-time audio energy if engine is active
      let curAvgVol = 0;
      let curBass = 0;
      if (audioEngineRef.current) {
        const metrics = audioEngineRef.current.getReactiveAudioMetrics();
        curAvgVol = metrics.averageVolume;
        curBass = metrics.bassEnergy;
        if (frameCount % 6 === 0) {
          setAudioMetrics({ averageVolume: curAvgVol, bassEnergy: curBass });
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
      } else if (layoutMode === "chroma-duet") {
        // Host video backdrop + live chroma keyed creator on top
        if (hostVideo && hostVideo.readyState >= 2) {
          ctx.drawImage(hostVideo, 0, 0, width, height);
        }
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
      }

      animationFrameRef.current = requestAnimationFrame(renderCompositeLoop);
    };

    animationFrameRef.current = requestAnimationFrame(renderCompositeLoop);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [layoutMode, activeFilter, beautyIntensity, pipPosition, chromaKeyColor, chromaTolerance]);

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
    } else {
      ctx.filter = "none";
    }
  }

  // Real-time Chroma Key Algorithm
  function renderChromaKeyFrame(
    ctx: CanvasRenderingContext2D,
    camVideo: HTMLVideoElement,
    width: number,
    height: number,
    keyColor: "green" | "blue",
    tolerance: number
  ) {
    // Create offscreen buffer
    const offscreen = document.createElement("canvas");
    offscreen.width = width;
    offscreen.height = height;
    const offCtx = offscreen.getContext("2d");
    if (!offCtx) return;

    offCtx.drawImage(camVideo, 0, 0, width, height);
    const frame = offCtx.getImageData(0, 0, width, height);
    const data = frame.data;
    const len = data.length;

    const tol = (tolerance / 100) * 110;

    for (let i = 0; i < len; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      if (keyColor === "green") {
        // Green screen detection: G dominates R and B
        if (g > 70 && g - r > tol && g - b > tol) {
          data[i + 3] = 0; // Alpha transparent
        }
      } else {
        // Blue screen detection: B dominates R and G
        if (b > 70 && b - r > tol && b - g > tol) {
          data[i + 3] = 0;
        }
      }
    }

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
    // Cinematic 2.39:1 scope letterbox if 16:9
    if (aspectRatio === "16:9") {
      const barH = h * 0.1;
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, w, barH);
      ctx.fillRect(0, h - barH, w, barH);
    }

    // Procedural Anamorphic Lens Flare streak across center
    const flareIntensity = 0.15 + 0.08 * Math.sin(frame * 0.05);
    const grad = ctx.createLinearGradient(0, h * 0.45, w, h * 0.45);
    grad.addColorStop(0, "transparent");
    grad.addColorStop(0.5, `rgba(56, 189, 248, ${flareIntensity})`);
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;
    ctx.fillRect(0, h * 0.44, w, 3);

    // Film stock watermark
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

    // Dynamic audio spectrum visualizer bar at bottom
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
    // VHS Timestamp Badge
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

    // Crosshairs
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

  // 4. Start Recording with Audio Engine Sync
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

      // Attach Mic
      if (videoCameraRef.current?.srcObject) {
        engine.attachMicrophone(videoCameraRef.current.srcObject as MediaStream, micVolume / 100);
      }

      // Attach Backing Track if present
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

    // Start Host Video Playback in sync
    if (hostVideoRef.current) {
      hostVideoRef.current.currentTime = soundSnippetStart;
      hostVideoRef.current.play().catch(() => {});
    }

    // Configure MediaRecorder
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
    if (recordedPreviewUrl) {
      URL.revokeObjectURL(recordedPreviewUrl);
      setRecordedPreviewUrl(null);
    }
    setRecordedDuration(0);
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
              ? "border-[24px] border-amber-300/40 shadow-[inset_0_0_90px_rgba(251,191,36,0.35)]"
              : ringLightTemp === "cool"
              ? "border-[24px] border-cyan-300/40 shadow-[inset_0_0_90px_rgba(6,182,212,0.35)]"
              : "border-[24px] border-white/40 shadow-[inset_0_0_90px_rgba(255,255,255,0.35)]"
          }`}
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
                  className={`rounded px-2 py-1 transition-colors ${
                    recordingSpeed === spd
                      ? "bg-cyan-500 text-slate-950 font-bold"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>

            {/* Ring Light */}
            <button
              onClick={() => setRingLightActive(!ringLightActive)}
              className={`rounded-lg border p-2 transition-colors ${
                ringLightActive
                  ? "border-amber-400 bg-amber-500/20 text-amber-300"
                  : "border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200"
              }`}
              title="Virtual Ring Light"
            >
              <SunMedium className="h-4 w-4" />
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* CENTER VIEWPORT / CANVAS */}
        <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black">
          {cameraError ? (
            <div className="max-w-md p-6 text-center">
              <Camera className="mx-auto mb-3 h-10 w-10 text-rose-500" />
              <h4 className="text-base font-semibold text-rose-400">Camera Unavailable</h4>
              <p className="mt-1 text-sm text-slate-400">{cameraError}</p>
              <button
                onClick={startCamera}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Retry Camera Access
              </button>
            </div>
          ) : recordedPreviewUrl ? (
            /* PREVIEW RECORDED CLIP */
            <div className="relative flex h-full w-full items-center justify-center">
              <video
                src={recordedPreviewUrl}
                controls
                autoPlay
                loop
                playsInline
                className="h-full max-h-full object-contain"
              />
              <div className="absolute top-4 left-4 rounded-md bg-slate-900/80 px-2.5 py-1 text-xs font-semibold text-cyan-400 backdrop-blur-md">
                Recorded Take • {recordedDuration}s
              </div>
            </div>
          ) : (
            /* LIVE CANVAS COMPOSITOR */
            <div className="relative flex h-full w-full items-center justify-center">
              <canvas
                ref={canvasRef}
                width={aspectRatio === "16:9" ? 1280 : 720}
                height={aspectRatio === "16:9" ? 720 : 1280}
                className={`max-h-full object-contain shadow-2xl transition-all ${
                  aspectRatio === "9:16" ? "aspect-[9/16] w-auto h-full" : "aspect-[16/9] w-full h-auto"
                }`}
              />

              {/* Countdown Overlay */}
              {countdown !== null && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                  <span className="font-mono text-8xl font-black text-cyan-400 animate-ping">
                    {countdown}
                  </span>
                </div>
              )}

              {/* Live Recording Pulsing Indicator */}
              {isRecording && (
                <div className="absolute top-4 left-4 flex items-center gap-2 rounded-full border border-rose-500/40 bg-rose-950/80 px-3 py-1 text-xs font-semibold text-rose-400 backdrop-blur-md">
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500" />
                  REC {Math.floor(recordedDuration / 60)}:{(recordedDuration % 60).toString().padStart(2, "0")}
                </div>
              )}
            </div>
          )}

          {/* RIGHT SIDE FLOATING TOOLBAR */}
          {!recordedPreviewUrl && (
            <div className="absolute top-4 right-4 z-30 flex flex-col gap-2">
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
                onClick={() => setCountdownSetting(countdownSetting === 0 ? 3 : countdownSetting === 3 ? 10 : 0)}
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
                onClick={() => setAspectRatio(aspectRatio === "9:16" ? "16:9" : "9:16")}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-800 bg-slate-900/80 text-[10px] font-bold text-slate-300 backdrop-blur-md hover:bg-slate-800 hover:text-cyan-400"
                title="Aspect Ratio (9:16 Shorts / 16:9 Video)"
              >
                {aspectRatio}
              </button>
            </div>
          )}

          {/* DRAWER PANELS OVERLAY */}
          {activeDrawer === "filters" && (
            <div className="absolute bottom-24 left-4 right-4 z-30 rounded-xl border border-slate-800 bg-slate-900/95 p-4 backdrop-blur-lg sm:left-auto sm:right-16 sm:w-80">
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
                  { id: "chroma-key", label: "Green Screen" },
                  { id: "cinema-35mm", label: "35mm Film" },
                  { id: "beauty-glam", label: "Beauty Glam" },
                  { id: "vhs-1989", label: "VHS 1989" },
                  { id: "cyber-glitch", label: "Cyber Glitch" },
                  { id: "noir-contrast", label: "Noir B&W" },
                ] as const).map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setActiveFilter(f.id)}
                    className={`rounded-lg border px-2.5 py-2 text-left font-medium transition-all ${
                      activeFilter === f.id
                        ? "border-cyan-500 bg-cyan-950/60 text-cyan-300"
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
                      <button
                        onClick={() => setChromaKeyColor("green")}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          chromaKeyColor === "green" ? "bg-emerald-500 text-slate-950" : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        Green
                      </button>
                      <button
                        onClick={() => setChromaKeyColor("blue")}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          chromaKeyColor === "blue" ? "bg-blue-500 text-white" : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        Blue
                      </button>
                    </div>
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
            <div className="absolute bottom-24 left-4 right-4 z-30 rounded-xl border border-slate-800 bg-slate-900/95 p-4 backdrop-blur-lg sm:left-auto sm:right-16 sm:w-80">
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
                    <div className="text-[11px] text-cyan-400 font-semibold truncate mb-1">
                      {sourceSoundVideo.title}
                    </div>
                    {/* Mini Waveform preview */}
                    <div className="flex items-center gap-0.5 h-6">
                      {waveformPeaks.slice(0, 40).map((peak, idx) => (
                        <div
                          key={idx}
                          className="flex-1 bg-cyan-500/70 rounded-full"
                          style={{ height: `${Math.max(15, peak * 100)}%` }}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                      <span>Sound Start Point</span>
                      <span>{soundSnippetStart}s</span>
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

                  <div>
                    <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                      <span>Backing Track Volume</span>
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
                </div>
              ) : (
                <div className="text-xs text-slate-400 mb-3">
                  Recording with device microphone only. Select a video from OmnPlay and click &quot;Use This Sound&quot; to remix with backing audio.
                </div>
              )}

              <div className="mt-3 pt-3 border-t border-slate-800 space-y-2">
                <div>
                  <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                    <span>Microphone Gain</span>
                    <span>{micVolume}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="150"
                    value={micVolume}
                    onChange={(e) => setMicVolume(Number(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-slate-300">Voiceover Audio Ducking</span>
                  <input
                    type="checkbox"
                    checked={enableDucking}
                    onChange={(e) => setEnableDucking(e.target.checked)}
                    className="rounded accent-cyan-400 h-4 w-4"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM CONTROLS & RECORD BUTTON */}
        <div className="z-30 flex items-center justify-between border-t border-slate-800/80 bg-slate-900/90 px-6 py-4 backdrop-blur-md">
          {recordedPreviewUrl ? (
            /* ACTIONS FOR RECORDED CLIP */
            <div className="flex w-full items-center justify-between">
              <button
                onClick={handleRetake}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-800/80 px-4 py-2.5 text-xs font-semibold text-slate-300 transition-colors hover:bg-slate-700"
              >
                <RotateCcw className="h-4 w-4" /> Retake
              </button>

              <div className="flex items-center gap-3">
                {onSendToStudio && (
                  <button
                    onClick={handleOpenInStudio}
                    className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-950/70 px-4 py-2.5 text-xs font-semibold text-cyan-300 transition-colors hover:bg-cyan-900/70"
                  >
                    <Layers className="h-4 w-4 text-cyan-400" /> Edit in Studio
                  </button>
                )}

                <button
                  onClick={handleSaveClip}
                  className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-5 py-2.5 text-xs font-bold text-slate-950 transition-transform active:scale-95 hover:bg-cyan-400"
                >
                  <Check className="h-4 w-4" /> Save & Publish
                </button>
              </div>
            </div>
          ) : (
            /* LIVE RECORDING CONTROLS */
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">
                  {layoutMode === "solo" ? "Live Camera" : `Duet: ${layoutMode}`}
                </span>
              </div>

              {/* Central Big Shutter Button */}
              <div className="flex items-center">
                {isRecording ? (
                  <button
                    onClick={handleStopRecording}
                    className="group relative flex h-16 w-16 items-center justify-center rounded-full border-4 border-rose-500 bg-slate-950 transition-all hover:scale-105 active:scale-95"
                    title="Stop Recording"
                  >
                    <div className="h-6 w-6 rounded bg-rose-500 group-hover:scale-110 transition-transform" />
                  </button>
                ) : (
                  <button
                    onClick={handleStartRecording}
                    className="group relative flex h-16 w-16 items-center justify-center rounded-full border-4 border-rose-500 bg-slate-950 transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(244,63,94,0.4)]"
                    title="Start Recording"
                  >
                    <div className="h-12 w-12 rounded-full bg-rose-500 group-hover:scale-95 transition-transform" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-cyan-400">
                  {Math.floor(recordedDuration / 60)}:{(recordedDuration % 60).toString().padStart(2, "0")}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
