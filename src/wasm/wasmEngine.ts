/**
 * OmnPlay WebAssembly (WASM) & C++ Real-Time DSP / Pixel Acceleration Engine
 * 
 * Loads `public/wasm/omni_dsp.wasm` compiled from `src/wasm/dsp_engine.cpp` into
 * WebAssembly linear memory. Provides near-native C++ performance for audio mixing,
 * chroma keying, Sobel edge glow, and peak extraction.
 */

export interface WasmInstanceExports {
  memory: WebAssembly.Memory;
  wasm_audio_mix: (
    outPtr: number,
    micPtr: number,
    backingPtr: number,
    sampleCount: number,
    micGain: number,
    backingGain: number,
    duckingEnabled: number,
    duckingAmount: number
  ) => void;
  wasm_chroma_key: (
    rgbaPtr: number,
    pixelCount: number,
    keyType: number,
    tolerance: number,
    feather: number
  ) => void;
  wasm_sobel_neon: (
    srcPtr: number,
    destPtr: number,
    width: number,
    height: number,
    bassEnergy: number,
    neonR: number,
    neonG: number,
    neonB: number
  ) => void;
  wasm_extract_peaks: (
    pcmPtr: number,
    sampleCount: number,
    outPtr: number,
    peakCount: number
  ) => void;
}

export class WasmDspEngine {
  private static instance: WasmDspEngine | null = null;
  private wasmExports: WasmInstanceExports | null = null;
  private isLoaded: boolean = false;
  private memoryBuffer: ArrayBuffer | null = null;

  // Static singleton accessor
  public static getInstance(): WasmDspEngine {
    if (!WasmDspEngine.instance) {
      WasmDspEngine.instance = new WasmDspEngine();
    }
    return WasmDspEngine.instance;
  }

  constructor() {
    this.initWasm().catch((err) => {
      console.warn("[WASM Engine] Initialization warning (using JS fallback):", err?.message || err);
    });
  }

  /**
   * Initializes the WebAssembly module from /wasm/omni_dsp.wasm
   */
  public async initWasm(): Promise<boolean> {
    if (this.isLoaded && this.wasmExports) return true;

    try {
      if (typeof window === "undefined" || typeof WebAssembly === "undefined") {
        return false;
      }

      const response = await fetch("/wasm/omni_dsp.wasm");
      if (!response.ok) {
        throw new Error(`Failed to fetch /wasm/omni_dsp.wasm (HTTP ${response.status})`);
      }

      const wasmBytes = await response.arrayBuffer();
      const wasmModule = await WebAssembly.instantiate(wasmBytes, {});
      this.wasmExports = wasmModule.instance.exports as unknown as WasmInstanceExports;
      this.memoryBuffer = this.wasmExports.memory.buffer;
      this.isLoaded = true;
      console.log("[WASM Engine] omni_dsp.wasm loaded and compiled successfully. Hardware acceleration active.");
      return true;
    } catch (e: any) {
      console.warn("[WASM Engine] Falling back to JavaScript engine:", e?.message || e);
      this.isLoaded = false;
      return false;
    }
  }

  public isReady(): boolean {
    return this.isLoaded && this.wasmExports !== null;
  }

  /**
   * High-Performance Chroma Key Filter
   * Removes green, blue, or magenta background in real-time.
   */
  public processChromaKey(
    frameData: ImageData,
    options: {
      keyType: "green" | "blue" | "magenta";
      tolerance: number; // 0 - 100
      feather?: number;  // 0 - 50
    }
  ): void {
    const { keyType, tolerance, feather = 10 } = options;
    const pixelCount = frameData.width * frameData.height;
    const data = frameData.data;

    const keyTypeCode = keyType === "green" ? 0 : keyType === "blue" ? 1 : 2;
    const tolScaled = Math.round((tolerance / 100) * 120);

    // If WASM is ready and buffer fits within memory (64KB page * 16 = 1MB+)
    if (this.wasmExports && data.byteLength <= this.wasmExports.memory.buffer.byteLength) {
      try {
        const memU8 = new Uint8Array(this.wasmExports.memory.buffer);
        // Copy frameData into WASM linear memory at offset 0
        memU8.set(data, 0);

        // Run C++/WASM chroma key
        this.wasmExports.wasm_chroma_key(0, pixelCount, keyTypeCode, tolScaled, feather);

        // Copy back modified frame
        data.set(memU8.subarray(0, data.byteLength));
        return;
      } catch (err) {
        // Fallback to JS loop below if WASM invocation has any bounds error
      }
    }

    // High-speed JavaScript Fallback
    const len = pixelCount * 4;
    for (let i = 0; i < len; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      let delta = 0;
      if (keyTypeCode === 0) {
        delta = g - Math.max(r, b);
      } else if (keyTypeCode === 1) {
        delta = b - Math.max(r, g);
      } else {
        delta = Math.min(r, b) - g;
      }

      if (delta > tolScaled + feather) {
        data[i + 3] = 0;
      } else if (delta > tolScaled) {
        const alpha = 1.0 - (delta - tolScaled) / feather;
        data[i + 3] = Math.round(data[i + 3] * Math.max(0, Math.min(1, alpha)));
      }
    }
  }

  /**
   * Audio Sample Multi-Track Mixer with Sidechain Ducking
   */
  public mixAudioBuffers(
    outBuffer: Float32Array,
    micBuffer: Float32Array | null,
    backingBuffer: Float32Array | null,
    options: {
      micGain?: number;
      backingGain?: number;
      enableDucking?: boolean;
      duckingAmount?: number;
    }
  ): void {
    const {
      micGain = 1.0,
      backingGain = 0.85,
      enableDucking = true,
      duckingAmount = 0.35,
    } = options;
    const len = outBuffer.length;

    // Fast SIMD/C++ algorithm via WASM if memory fits
    if (this.wasmExports && len * 4 * 3 <= this.wasmExports.memory.buffer.byteLength) {
      try {
        const memF32 = new Float32Array(this.wasmExports.memory.buffer);
        const outPtr = 0;
        const micPtr = len;
        const backingPtr = len * 2;

        if (micBuffer) memF32.set(micBuffer, micPtr);
        if (backingBuffer) memF32.set(backingBuffer, backingPtr);

        this.wasmExports.wasm_audio_mix(
          outPtr * 4,
          micBuffer ? micPtr * 4 : 0,
          backingBuffer ? backingPtr * 4 : 0,
          len,
          micGain,
          backingGain,
          enableDucking ? 1 : 0,
          duckingAmount
        );

        outBuffer.set(memF32.subarray(outPtr, outPtr + len));
        return;
      } catch (e) {}
    }

    // High-performance JavaScript fallback
    let duckingGain = 1.0;
    const speechThreshold = 0.08;

    for (let i = 0; i < len; i++) {
      const mic = micBuffer ? micBuffer[i] * micGain : 0.0;
      let backing = backingBuffer ? backingBuffer[i] * backingGain : 0.0;

      if (enableDucking && micBuffer) {
        if (Math.abs(mic) > speechThreshold) {
          duckingGain += (duckingAmount - duckingGain) * 0.05;
        } else {
          duckingGain += (1.0 - duckingGain) * 0.002;
        }
        backing *= duckingGain;
      }

      // Soft limiting
      const sum = mic + backing;
      outBuffer[i] = Math.max(-1.0, Math.min(1.0, sum));
    }
  }

  /**
   * Fast Waveform Peak Extractor
   */
  public extractWaveformPeaks(pcmData: Float32Array, peakCount: number = 64): number[] {
    const sampleCount = pcmData.length;
    if (sampleCount === 0 || peakCount === 0) return [];

    const peaks = new Float32Array(peakCount);
    const blockSize = Math.max(1, Math.floor(sampleCount / peakCount));

    for (let p = 0; p < peakCount; p++) {
      const start = p * blockSize;
      const end = Math.min(sampleCount, start + blockSize);
      let max = 0;
      for (let i = start; i < end; i++) {
        const absVal = Math.abs(pcmData[i]);
        if (absVal > max) max = absVal;
      }
      peaks[p] = Math.min(1.0, max);
    }

    return Array.from(peaks);
  }
}

export const wasmDspEngine = WasmDspEngine.getInstance();
