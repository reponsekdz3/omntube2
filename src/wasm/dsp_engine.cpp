/**
 * OmnPlay Real-time WebAssembly / C++ DSP & Computer Vision Processing Engine
 * 
 * Provides:
 * 1. Ultra-fast zero-latency audio sample mixing with sidechain ducking & soft limiter.
 * 2. High-performance Chroma Key segmentation with color-space distance, feathering, and spill suppression.
 * 3. Sobel convolution neon contour filter for audio-reactive camera shaders.
 * 4. Parallel peak envelope extractor for instant waveform generation.
 * 
 * Designed to compile to WebAssembly (WASM) via clang / emscripten / wasi-sdk,
 * executing within browser WebAssembly linear memory at near-native C++ speeds.
 */

#include <stdint.h>
#include <stddef.h>
#include <math.h>

#ifndef WASM_EXPORT
#define WASM_EXPORT __attribute__((visibility("default")))
#endif

extern "C" {

/**
 * Fast cubic soft-clipper to prevent harsh digital clipping
 * f(x) = x - (x^3)/3 for -1 <= x <= 1
 */
static inline float soft_clip(float x) {
    if (x > 1.5f) return 1.0f;
    if (x < -1.5f) return -1.0f;
    if (x > 1.0f) return 1.0f - (1.5f - x) * (1.5f - x) * 0.5f;
    if (x < -1.0f) return -1.0f + (1.5f + x) * (1.5f + x) * 0.5f;
    return x - (x * x * x) * 0.33333333f;
}

/**
 * 1. Audio Sample Mixer with Sidechain Ducking
 * 
 * Mixes microphone audio with backing audio track.
 * When microphone energy exceeds the ducking threshold, backing track gain is smoothly attenuated.
 */
WASM_EXPORT
void wasm_audio_mix(
    float* outBuffer,
    const float* micBuffer,
    const float* backingBuffer,
    int sampleCount,
    float micGain,
    float backingGain,
    int duckingEnabled,
    float duckingAmount // 0.0 to 1.0 (e.g. 0.4 reduces backing track to 40% when speech detected)
) {
    float duckingGain = 1.0f;
    const float duckingAttack = 0.05f;
    const float duckingRelease = 0.002f;
    const float speechThreshold = 0.08f;

    for (int i = 0; i < sampleCount; ++i) {
        float micSample = micBuffer ? (micBuffer[i] * micGain) : 0.0f;
        float backingSample = backingBuffer ? (backingBuffer[i] * backingGain) : 0.0f;

        if (duckingEnabled && micBuffer) {
            float micEnergy = fabsf(micSample);
            if (micEnergy > speechThreshold) {
                // Speech active -> duck backing track
                duckingGain += (duckingAmount - duckingGain) * duckingAttack;
            } else {
                // Speech silent -> recover backing track
                duckingGain += (1.0f - duckingGain) * duckingRelease;
            }
            backingSample *= duckingGain;
        }

        // Sum and soft-clip output to prevent distortion
        float mixed = micSample + backingSample;
        outBuffer[i] = soft_clip(mixed);
    }
}

/**
 * 2. High-Speed Studio Chroma Keyer (Green / Blue / Magenta removal)
 * 
 * Processes RGBA pixel buffer directly in linear memory.
 * Computes color distance in RGB space with edge feathering and green/blue spill suppression.
 * 
 * keyType: 0 = Green, 1 = Blue, 2 = Magenta
 */
WASM_EXPORT
void wasm_chroma_key(
    uint8_t* rgba,
    int pixelCount,
    int keyType,
    int tolerance,   // 0 to 255
    int feather      // 0 to 50
) {
    const float tol = (float)tolerance;
    const float fthr = (float)(feather > 0 ? feather : 1);

    for (int i = 0; i < pixelCount; ++i) {
        int idx = i * 4;
        uint8_t r = rgba[idx];
        uint8_t g = rgba[idx + 1];
        uint8_t b = rgba[idx + 2];

        float delta = 0.0f;
        if (keyType == 0) {
            // Green Screen: Difference between Green and max of (Red, Blue)
            int maxRB = r > b ? r : b;
            delta = (float)(g - maxRB);
        } else if (keyType == 1) {
            // Blue Screen: Difference between Blue and max of (Red, Green)
            int maxRG = r > g ? r : g;
            delta = (float)(b - maxRG);
        } else {
            // Magenta Screen: Difference between min(Red, Blue) and Green
            int minRB = r < b ? r : b;
            delta = (float)(minRB - g);
        }

        if (delta > tol + fthr) {
            // Fully transparent background
            rgba[idx + 3] = 0;
        } else if (delta > tol) {
            // Edge feather transition
            float alphaFactor = 1.0f - ((delta - tol) / fthr);
            if (alphaFactor < 0.0f) alphaFactor = 0.0f;
            if (alphaFactor > 1.0f) alphaFactor = 1.0f;
            rgba[idx + 3] = (uint8_t)((float)rgba[idx + 3] * alphaFactor);

            // Spill suppression on edges: reduce excess key color
            if (keyType == 0 && g > r && g > b) {
                rgba[idx + 1] = (uint8_t)((r + b) / 2);
            } else if (keyType == 1 && b > r && b > g) {
                rgba[idx + 2] = (uint8_t)((r + g) / 2);
            }
        }
    }
}

/**
 * 3. Fast Sobel Neon Edge Detector
 * 
 * Computes gradient magnitude of frame, producing electric neon contours
 * modulated by audio bass energy.
 */
WASM_EXPORT
void wasm_sobel_neon(
    const uint8_t* src,
    uint8_t* dest,
    int width,
    int height,
    float bassEnergy,
    uint8_t neonR,
    uint8_t neonG,
    uint8_t neonB
) {
    int rowStride = width * 4;
    float gain = 1.0f + bassEnergy * 2.5f;

    for (int y = 1; y < height - 1; ++y) {
        int yPrev = (y - 1) * rowStride;
        int yCurr = y * rowStride;
        int yNext = (y + 1) * rowStride;

        for (int x = 1; x < width - 1; ++x) {
            int xPrev = (x - 1) * 4;
            int xCurr = x * 4;
            int xNext = (x + 1) * 4;

            // Compute luminance of 3x3 neighborhood
            #define LUMA(row, col) (int)(src[(row) + (col)] * 77 + src[(row) + (col) + 1] * 150 + src[(row) + (col) + 2] * 29) >> 8

            int p00 = LUMA(yPrev, xPrev);
            int p01 = LUMA(yPrev, xCurr);
            int p02 = LUMA(yPrev, xNext);

            int p10 = LUMA(yCurr, xPrev);
            int p12 = LUMA(yCurr, xNext);

            int p20 = LUMA(yNext, xPrev);
            int p21 = LUMA(yNext, xCurr);
            int p22 = LUMA(yNext, xNext);

            #undef LUMA

            // Sobel kernels
            int gx = (p02 + 2 * p12 + p22) - (p00 + 2 * p10 + p20);
            int gy = (p20 + 2 * p21 + p22) - (p00 + 2 * p01 + p02);

            int mag = (int)(sqrtf((float)(gx * gx + gy * gy)) * gain);
            if (mag > 255) mag = 255;

            int destIdx = yCurr + xCurr;
            if (mag > 40) {
                // Neon glow line
                float factor = (float)mag / 255.0f;
                dest[destIdx] = (uint8_t)(neonR * factor);
                dest[destIdx + 1] = (uint8_t)(neonG * factor);
                dest[destIdx + 2] = (uint8_t)(neonB * factor);
                dest[destIdx + 3] = (uint8_t)mag;
            } else {
                dest[destIdx] = 0;
                dest[destIdx + 1] = 0;
                dest[destIdx + 2] = 0;
                dest[destIdx + 3] = 0;
            }
        }
    }
}

/**
 * 4. Fast Waveform Peak Extractor
 * 
 * Decimates PCM audio buffer into N normalized peaks for UI waveform rendering.
 */
WASM_EXPORT
void wasm_extract_peaks(
    const float* pcm,
    int sampleCount,
    float* outPeaks,
    int peakCount
) {
    if (sampleCount <= 0 || peakCount <= 0) return;
    int blockSize = sampleCount / peakCount;
    if (blockSize < 1) blockSize = 1;

    for (int p = 0; p < peakCount; ++p) {
        int start = p * blockSize;
        int end = start + blockSize;
        if (end > sampleCount) end = sampleCount;

        float maxVal = 0.0f;
        for (int i = start; i < end; ++i) {
            float v = fabsf(pcm[i]);
            if (v > maxVal) maxVal = v;
        }

        // Clamp 0.0 to 1.0
        if (maxVal > 1.0f) maxVal = 1.0f;
        outPeaks[p] = maxVal;
    }
}

} // extern "C"
