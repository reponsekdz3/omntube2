# OmnPlay: Bi-Directional 'Use This Sound' Pipeline, Modern AR Camera Suite & High-Performance Rendering

## 1. Overview & Objectives
Transform OmnPlay into an industry-grade, ultra-responsive multimedia ecosystem featuring:
1. **Bi-Directional "Use This Sound" Audio & Video Mixing**:
   - Extract audio stems from any long-form video or Short with precise waveform visualization and trim markers.
   - Dual-flow placement:
     - **Flow A (Camera Remix)**: Launch the in-app camera with the source audio preloaded as a live guide track, supporting Duet (split-screen / side-by-side), PiP (corner floating), and Green-Screen / Chroma-Key background insertion.
     - **Flow B (Studio Timeline Swapper / Overlayer)**: Seamlessly inject, replace, or blend the extracted audio into an existing uploaded video with real-time Web Audio API volume balancing, ducking, and latency compensation.
2. **Cutting-Edge AR Camera & Real-Time Shader Effects**:
   - WebGL 2.0 fragment shader pipeline executing directly on the 60fps video canvas:
     - **Chroma Key Green Screen**: Real-time background replacement using user-selected background video or canvas backdrop with edge feathering and spill suppression.
     - **Cyberpunk Hologram & Edge Neon**: Sobel edge detection with pulsing neon chromatic aberration.
     - **Cinematic 35mm & Anamorphic Flare**: Authentic film grain noise generator, vignette, and horizontal blue anamorphic streak flares.
     - **Audio-Reactive Bloom**: Shader dynamic luminosity pulsating to the live audio FFT spectrum analyser.
     - **Vintage VHS & CRT Glitch**: Scanlines, RGB channel displacement, tape static distortion, and timestamp watermark.
     - **Beauty Portrait**: Bilateral filter for smooth skin texture retention and tone enhancement.
   - Live camera recording controls: Multi-speed ramp (0.3x, 0.5x, 1x, 2x, 3x), hands-free countdown timer (3s, 10s), flash/torch simulator, grid lines, and aspect-ratio switching (9:16 Shorts, 16:9 Long, 1:1 Square).
3. **High-Performance Python, WASM & WebCodecs Rendering**:
   - Client-side Web Audio API + MediaStreamDestination multiplexer for synchronous, zero-lag recording of mixed microphone and backing tracks.
   - Client-side WASM-assisted chunking and audio extraction.
   - Server-side Python transcoding ladder (`transcode_pipeline.py`) supporting multi-bitrate ladder (1080p60, 720p, 480p, 360p, audio stem WAV/AAC extraction) with secure signed streaming endpoints.
   - WebRTC streaming and instant real-time player synchronizer.

---

## 2. Technical Architecture & File Changes

### A. Core Engine & Audio Mixing (`src/services/audioRemixEngine.ts`)
- Web Audio API `AudioContext` graph managing:
  - Source audio loading & decoding from any video URL (`AudioBufferSourceNode`).
  - Microphone live capture input with noise gate and gain control.
  - `DynamicsCompressorNode` to eliminate clipping when combining vocal capture with the source track.
  - `AnalyserNode` feeding real-time 128-bin frequency data directly to WebGL camera shaders for audio-reactive visuals.
  - `MediaStreamAudioDestinationNode` feeding the mixed audio track into `MediaRecorder`.

### B. AR Camera Suite Upgrades (`src/components/OmnPlayCameraSuite.tsx`)
- Extended WebGL fragment shaders:
  - `chromaKey`: Smooth tolerance, key color picker (green, blue, custom), background video layer compositor.
  - `audioReactiveNeon`: Real-time spectrum uniform binding `u_audio_level` modulating bloom intensity and RGB shift.
  - `cinematic35mm`: Procedural grain, vignette, warm film LUT curve, and anamorphic flare.
  - `glitchCRT`: Horizontal sync scanlines, RGB split, and noise burst.
  - `beautySmooth`: Multi-pass gaussian/bilateral smoothing.
- Layout modes for "Use This Sound":
  - **Duet Side-by-Side** (Left: Reference video, Right: Camera feed).
  - **Duet Top-and-Bottom** (Top: Reference video, Bottom: Camera feed).
  - **Picture-in-Picture** (Floating draggable/resizable video badge over live camera).
  - **Green Screen** (Reference video plays as background, user keyed in foreground).
- Waveform scrubber for selecting sound segment offset (0s to length of audio).

### C. OmnPlay Studio Audio Swapper & Duet Placer (`src/components/OmnPlayStudio.tsx`)
- Multi-track timeline integration for sound replacement:
  - Replace original audio with selected sound.
  - Overlay mode: Blend original audio + selected sound with independent volume sliders (0-200%), fade-in/fade-out, and audio ducking.
  - Export composite through Canvas & Web Audio recorder with resolution presets (4K UHD, 1080p, 720p).

### D. Video Player & Shorts Feed ("Use This Sound" Quick Actions)
- `src/components/OmnPlayPlayer.tsx`:
  - Prominent "Use This Sound" button with spinning vinyl animation, track waveform preview modal, and immediate routing to Camera Duet or Studio Timeline.
- `src/components/OmnPlayShorts.tsx`:
  - Quick-action rail with animated sound badge, one-click "Record with this Sound" (preloads audio into AR camera) and "Remix in Studio".
- `src/components/OmnPlayFeed.tsx`:
  - Contextual action menu on video cards to "Use Sound in Camera" or "Replace Track in Studio".

### E. Backend Python & API Enhancements (`server.ts`, `transcode_pipeline.py`)
- `/api/media/extract-audio`: Python-backed endpoint extracting high-fidelity MP3/AAC/WAV audio stems and generating JSON waveform peaks data from any video.
- `/api/media/transcode`: Extended Python pipeline generating adaptive bitrate ladder and muxing video with replacement audio stems.
- High-level security headers (CSP, CORS, frame protections, token verification).

---

## 3. Verification & Testing Steps
1. Verify client compilation (`compile_applet`) with zero TypeScript and lint errors.
2. Test "Use This Sound" button from both Shorts and Long-form player.
3. Test AR Camera suite with all 6 shader filters (Green Screen, Neon Cyberpunk, 35mm Film, Audio-Reactive Bloom, VHS CRT, Beauty).
4. Verify audio waveform extraction, trimming, and multi-track recording synchronization.
5. Verify Python transcode pipeline response for audio stems and video muxing.
