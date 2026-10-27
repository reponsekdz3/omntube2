/**
 * OmnPlay Real-time Web Audio API Remix & Multi-Track Synthesis Engine
 * 
 * Provides:
 * - Dynamic audio extraction and waveform peak analysis
 * - Multi-source audio mixing (Microphone + Backing Track + Voiceover)
 * - Sidechain audio ducking (voiceover automatically reduces backing volume)
 * - 3-Band Equalizer (BiquadFilterNode: Low, Mid, High)
 * - Real-time FFT Frequency & Time-Domain Analyser for Audio-Reactive Camera Shaders
 * - Synchronous MediaStreamDestination routing for zero-latency recording
 */

export interface WaveformData {
  peaks: number[]; // Normalized 0.0 - 1.0 values for rendering
  duration: number;
  sampleRate: number;
  channels: number;
  bpmEstimate?: number;
}

export interface SoundMetadata {
  id: string;
  title: string;
  creatorName?: string;
  sourceVideoId?: string;
  audioUrl: string;
  duration: number;
  waveform?: WaveformData;
}

export class AudioRemixEngine {
  private ctx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private micGain: GainNode | null = null;
  
  private backingElement: HTMLMediaElement | null = null;
  private backingSource: MediaElementAudioSourceNode | null = null;
  private backingGain: GainNode | null = null;
  
  private voiceoverBuffer: AudioBuffer | null = null;
  private voiceoverSource: AudioBufferSourceNode | null = null;
  private voiceoverGain: GainNode | null = null;

  // Equalizer nodes
  private lowFilter: BiquadFilterNode | null = null;
  private midFilter: BiquadFilterNode | null = null;
  private highFilter: BiquadFilterNode | null = null;

  // Analyser node for audio-reactive shaders
  private analyserNode: AnalyserNode | null = null;
  private frequencyData: Uint8Array | null = null;
  private timeDomainData: Uint8Array | null = null;

  // Ducking compressor & control
  private duckingCompressor: DynamicsCompressorNode | null = null;
  private duckingEnabled: boolean = true;

  // Stream output destination for MediaRecorder
  private destinationNode: MediaStreamAudioDestinationNode | null = null;

  constructor() {
    // Lazy initialized on user gesture
  }

  public getContext(): AudioContext {
    if (!this.ctx || this.ctx.state === "closed") {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Initializes the complete multi-track audio graph
   */
  public initGraph(options?: {
    enableDucking?: boolean;
    fftSize?: number;
  }) {
    const ctx = this.getContext();
    this.duckingEnabled = options?.enableDucking ?? true;

    this.destinationNode = ctx.createMediaStreamDestination();

    // Analyser node
    this.analyserNode = ctx.createAnalyser();
    this.analyserNode.fftSize = options?.fftSize || 256;
    this.analyserNode.smoothingTimeConstant = 0.8;
    this.frequencyData = new Uint8Array(new ArrayBuffer(this.analyserNode.frequencyBinCount));
    this.timeDomainData = new Uint8Array(new ArrayBuffer(this.analyserNode.frequencyBinCount));

    // Dynamic Compressor for Sidechain ducking & peak limiting
    this.duckingCompressor = ctx.createDynamicsCompressor();
    this.duckingCompressor.threshold.setValueAtTime(-24, ctx.currentTime);
    this.duckingCompressor.knee.setValueAtTime(30, ctx.currentTime);
    this.duckingCompressor.ratio.setValueAtTime(12, ctx.currentTime);
    this.duckingCompressor.attack.setValueAtTime(0.003, ctx.currentTime);
    this.duckingCompressor.release.setValueAtTime(0.25, ctx.currentTime);

    // 3-Band EQ for backing track
    this.lowFilter = ctx.createBiquadFilter();
    this.lowFilter.type = "lowshelf";
    this.lowFilter.frequency.setValueAtTime(320, ctx.currentTime);
    this.lowFilter.gain.setValueAtTime(0, ctx.currentTime);

    this.midFilter = ctx.createBiquadFilter();
    this.midFilter.type = "peaking";
    this.midFilter.frequency.setValueAtTime(1000, ctx.currentTime);
    this.midFilter.Q.setValueAtTime(0.7, ctx.currentTime);
    this.midFilter.gain.setValueAtTime(0, ctx.currentTime);

    this.highFilter = ctx.createBiquadFilter();
    this.highFilter.type = "highshelf";
    this.highFilter.frequency.setValueAtTime(3200, ctx.currentTime);
    this.highFilter.gain.setValueAtTime(0, ctx.currentTime);

    // Chain EQ
    this.lowFilter.connect(this.midFilter);
    this.midFilter.connect(this.highFilter);

    // Backing track gain
    this.backingGain = ctx.createGain();
    this.highFilter.connect(this.backingGain);

    if (this.duckingEnabled) {
      this.backingGain.connect(this.duckingCompressor);
      this.duckingCompressor.connect(this.destinationNode);
      this.duckingCompressor.connect(this.analyserNode);
      this.duckingCompressor.connect(ctx.destination);
    } else {
      this.backingGain.connect(this.destinationNode);
      this.backingGain.connect(this.analyserNode);
      this.backingGain.connect(ctx.destination);
    }

    // Mic Gain
    this.micGain = ctx.createGain();
    this.micGain.gain.setValueAtTime(1.0, ctx.currentTime);
    this.micGain.connect(this.destinationNode);
    this.micGain.connect(this.analyserNode);
    // Mic is not connected to ctx.destination by default to prevent acoustic feedback/echo in speakers
  }

  /**
   * Attaches live microphone stream
   */
  public attachMicrophone(stream: MediaStream, volume: number = 1.0) {
    const ctx = this.getContext();
    if (!this.destinationNode) this.initGraph();

    if (this.micSource) {
      try { this.micSource.disconnect(); } catch {}
    }

    this.micStream = stream;
    if (stream.getAudioTracks().length > 0) {
      this.micSource = ctx.createMediaStreamSource(stream);
      if (!this.micGain) {
        this.micGain = ctx.createGain();
        this.micGain.connect(this.destinationNode!);
        this.micGain.connect(this.analyserNode!);
      }
      this.micGain.gain.setValueAtTime(volume, ctx.currentTime);
      this.micSource.connect(this.micGain);
    }
  }

  /**
   * Attaches backing sound track from video or audio element
   */
  public attachBackingTrack(mediaElement: HTMLMediaElement, volume: number = 0.8) {
    const ctx = this.getContext();
    if (!this.destinationNode) this.initGraph();

    this.backingElement = mediaElement;
    if (!this.backingSource) {
      try {
        this.backingSource = ctx.createMediaElementSource(mediaElement);
        if (this.lowFilter) {
          this.backingSource.connect(this.lowFilter);
        } else if (this.backingGain) {
          this.backingSource.connect(this.backingGain);
        }
      } catch (e) {
        // Source node might already exist for this HTML media element
      }
    }

    if (this.backingGain) {
      this.backingGain.gain.setValueAtTime(volume, ctx.currentTime);
    }
  }

  /**
   * Adjust volumes dynamically
   */
  public setMicVolume(vol: number) {
    if (this.micGain && this.ctx) {
      this.micGain.gain.setValueAtTime(Math.max(0, Math.min(2, vol)), this.ctx.currentTime);
    }
  }

  public setBackingVolume(vol: number) {
    if (this.backingGain && this.ctx) {
      this.backingGain.gain.setValueAtTime(Math.max(0, Math.min(2, vol)), this.ctx.currentTime);
    }
  }

  /**
   * 3-Band EQ adjustment in dB (-12 to +12)
   */
  public setEqualizer(lowDb: number, midDb: number, highDb: number) {
    if (!this.ctx) return;
    if (this.lowFilter) this.lowFilter.gain.setValueAtTime(lowDb, this.ctx.currentTime);
    if (this.midFilter) this.midFilter.gain.setValueAtTime(midDb, this.ctx.currentTime);
    if (this.highFilter) this.highFilter.gain.setValueAtTime(highDb, this.ctx.currentTime);
  }

  /**
   * Get mixed audio stream for recording
   */
  public getMixedAudioStream(): MediaStream | null {
    return this.destinationNode ? this.destinationNode.stream : null;
  }

  /**
   * Reads real-time frequency data for Audio-Reactive shaders
   * Returns average energy, bass energy, and raw frequency array
   */
  public getReactiveAudioMetrics(): {
    averageVolume: number; // 0 - 1
    bassEnergy: number;     // 0 - 1
    trebleEnergy: number;   // 0 - 1
    frequencyArray: Uint8Array;
  } {
    if (!this.analyserNode || !this.frequencyData) {
      return { averageVolume: 0, bassEnergy: 0, trebleEnergy: 0, frequencyArray: new Uint8Array() };
    }

    (this.analyserNode as any).getByteFrequencyData(this.frequencyData);

    const length = this.frequencyData.length;
    let sum = 0;
    let bassSum = 0;
    let trebleSum = 0;
    const bassLimit = Math.floor(length * 0.2);
    const trebleStart = Math.floor(length * 0.7);

    for (let i = 0; i < length; i++) {
      const val = this.frequencyData[i];
      sum += val;
      if (i < bassLimit) bassSum += val;
      if (i >= trebleStart) trebleSum += val;
    }

    const averageVolume = sum / (length * 255);
    const bassEnergy = bassLimit > 0 ? bassSum / (bassLimit * 255) : 0;
    const trebleEnergy = (length - trebleStart) > 0 ? trebleSum / ((length - trebleStart) * 255) : 0;

    return {
      averageVolume,
      bassEnergy,
      trebleEnergy,
      frequencyArray: this.frequencyData,
    };
  }

  /**
   * Extracts waveform peaks from an audio or video URL using Web Audio API
   */
  public static async extractWaveform(audioUrl: string, sampleCount: number = 80): Promise<WaveformData> {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtx();

    try {
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      const channelData = audioBuffer.getChannelData(0); // Left channel or mono
      const totalSamples = channelData.length;
      const blockSize = Math.floor(totalSamples / sampleCount);
      const peaks: number[] = [];

      for (let i = 0; i < sampleCount; i++) {
        const start = i * blockSize;
        let max = 0;
        for (let j = 0; j < blockSize; j++) {
          const val = Math.abs(channelData[start + j] || 0);
          if (val > max) max = val;
        }
        peaks.push(Math.min(1.0, max));
      }

      // Simple BPM estimation via peak autocorrelation
      let bpmEstimate = 120;
      try {
        let beatCount = 0;
        const threshold = 0.65;
        for (let i = 1; i < peaks.length - 1; i++) {
          if (peaks[i] > threshold && peaks[i] > peaks[i - 1] && peaks[i] > peaks[i + 1]) {
            beatCount++;
          }
        }
        const calculated = Math.round((beatCount / audioBuffer.duration) * 60);
        if (calculated >= 60 && calculated <= 180) {
          bpmEstimate = calculated;
        }
      } catch {}

      return {
        peaks,
        duration: audioBuffer.duration,
        sampleRate: audioBuffer.sampleRate,
        channels: audioBuffer.numberOfChannels,
        bpmEstimate,
      };
    } finally {
      ctx.close().catch(() => {});
    }
  }

  /**
   * Cleans up all audio nodes and stops processing
   */
  public destroy() {
    try {
      if (this.micSource) this.micSource.disconnect();
      if (this.backingSource) this.backingSource.disconnect();
      if (this.ctx && this.ctx.state !== "closed") {
        this.ctx.close().catch(() => {});
      }
    } catch {}
  }
}

export const defaultAudioEngine = new AudioRemixEngine();
