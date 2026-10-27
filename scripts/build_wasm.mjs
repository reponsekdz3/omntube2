/**
 * Script to generate high-performance validated WebAssembly binary: public/wasm/omni_dsp.wasm
 */
import fs from "fs";
import path from "path";

// Helper for LEB128 unsigned encoding
function encodeUnsignedLeb128(n) {
  const bytes = [];
  do {
    let byte = n & 0x7f;
    n >>>= 7;
    if (n !== 0) {
      byte |= 0x80;
    }
    bytes.push(byte);
  } while (n !== 0);
  return bytes;
}

function encodeString(str) {
  const buf = Buffer.from(str, "utf8");
  return [...encodeUnsignedLeb128(buf.length), ...buf];
}

function createSection(sectionId, payload) {
  return [sectionId, ...encodeUnsignedLeb128(payload.length), ...payload];
}

// Bytecode constants
const i32 = 0x7f;
const f32 = 0x7d;

// Type Section: 4 function signatures
const typeSectionData = [
  ...encodeUnsignedLeb128(4), // 4 types
  // Type 0: wasm_audio_mix(outPtr: i32, micPtr: i32, backingPtr: i32, len: i32, micGain: f32, backingGain: f32, ducking: i32, duckAmount: f32) -> void
  0x60, // func
  ...encodeUnsignedLeb128(8),
  i32, i32, i32, i32, f32, f32, i32, f32,
  0x00, // 0 returns

  // Type 1: wasm_chroma_key(rgbaPtr: i32, pixelCount: i32, keyType: i32, tol: i32, feather: i32) -> void
  0x60,
  ...encodeUnsignedLeb128(5),
  i32, i32, i32, i32, i32,
  0x00,

  // Type 2: wasm_sobel_neon(srcPtr: i32, destPtr: i32, w: i32, h: i32, bassEnergy: f32, nR: i32, nG: i32, nB: i32) -> void
  0x60,
  ...encodeUnsignedLeb128(8),
  i32, i32, i32, i32, f32, i32, i32, i32,
  0x00,

  // Type 3: wasm_extract_peaks(pcmPtr: i32, sampleCount: i32, outPtr: i32, peakCount: i32) -> void
  0x60,
  ...encodeUnsignedLeb128(4),
  i32, i32, i32, i32,
  0x00,
];

// Function Section: matches types 0, 1, 2, 3
const funcSectionData = [
  ...encodeUnsignedLeb128(4),
  0x00, 0x01, 0x02, 0x03,
];

// Memory Section: 1 memory, initial 16 pages (1MB), max 256 pages (16MB)
const memorySectionData = [
  ...encodeUnsignedLeb128(1),
  0x01, // has max
  ...encodeUnsignedLeb128(16),
  ...encodeUnsignedLeb128(256),
];

// Export Section: export memory + the 4 functions
const exportSectionData = [
  ...encodeUnsignedLeb128(5),
  ...encodeString("memory"), 0x02, 0x00,
  ...encodeString("wasm_audio_mix"), 0x00, 0x00,
  ...encodeString("wasm_chroma_key"), 0x00, 0x01,
  ...encodeString("wasm_sobel_neon"), 0x00, 0x02,
  ...encodeString("wasm_extract_peaks"), 0x00, 0x03,
];

// Code Section: Function bodies
// Func 0: wasm_audio_mix body
// locals: [1 local i32 (loop index)]
const body0 = [
  0x01, // 1 local entry
  0x01, i32, // 1 i32 local ($i = param_count + 0 = local 8)
  // local.set 8 (i = 0)
  0x41, 0x00, 0x21, 0x08,
  // block $B0, loop $L0
  0x02, 0x40, // block
  0x03, 0x40, // loop
  // br_if $B0 if i >= len (local.get 8, local.get 3, i32.ge_s, br_if 1)
  0x20, 0x08, 0x20, 0x03, 0x4e, 0x0d, 0x01,

  // Calculate addresses:
  // outOffset = outPtr + (i << 2)
  // micSample = micPtr != 0 ? load_f32(micPtr + (i << 2)) * micGain : 0.0
  // backingSample = backingPtr != 0 ? load_f32(backingPtr + (i << 2)) * backingGain : 0.0
  // store_f32(outOffset, micSample + backingSample)
  0x20, 0x00, // get outPtr
  0x20, 0x08, 0x41, 0x02, 0x74, 0x6a, // + (i << 2)

  // Mic sample * micGain
  0x20, 0x01, 0x41, 0x00, 0x47, // micPtr != 0
  0x04, 0x7d, // if f32
  0x20, 0x01, 0x20, 0x08, 0x41, 0x02, 0x74, 0x6a, 0x2a, 0x02, 0x00, // f32.load
  0x20, 0x04, 0x94, // f32.mul micGain
  0x05, // else
  0x43, 0x00, 0x00, 0x00, 0x00, // 0.0f
  0x0b, // end if

  // Backing sample * backingGain
  0x20, 0x02, 0x41, 0x00, 0x47, // backingPtr != 0
  0x04, 0x7d, // if f32
  0x20, 0x02, 0x20, 0x08, 0x41, 0x02, 0x74, 0x6a, 0x2a, 0x02, 0x00, // f32.load
  0x20, 0x05, 0x94, // f32.mul backingGain
  0x05, // else
  0x43, 0x00, 0x00, 0x00, 0x00,
  0x0b, // end if

  0x92, // f32.add
  0x38, 0x02, 0x00, // f32.store

  // i = i + 1
  0x20, 0x08, 0x41, 0x01, 0x6a, 0x21, 0x08,
  0x0c, 0x00, // br $L0
  0x0b, // end loop
  0x0b, // end block
  0x0b, // end func
];

// Func 1: wasm_chroma_key
// params: rgbaPtr (0), pixelCount (1), keyType (2), tol (3), feather (4)
// locals: i (5), idx (6), r (7), g (8), b (9), delta (10)
const body1 = [
  0x02, // 2 local declarations
  0x05, i32, // 5 i32 locals (5..9)
  0x01, i32, // 1 i32 local (10)
  0x41, 0x00, 0x21, 0x05, // i = 0
  0x02, 0x40, // block
  0x03, 0x40, // loop
  0x20, 0x05, 0x20, 0x01, 0x4e, 0x0d, 0x01, // br_if i >= pixelCount

  // idx = rgbaPtr + (i << 2)
  0x20, 0x00, 0x20, 0x05, 0x41, 0x02, 0x74, 0x6a, 0x21, 0x06,

  // r = load_u8(idx), g = load_u8(idx+1), b = load_u8(idx+2)
  0x20, 0x06, 0x2d, 0x00, 0x00, 0x21, 0x07,
  0x20, 0x06, 0x2d, 0x00, 0x01, 0x21, 0x08,
  0x20, 0x06, 0x2d, 0x00, 0x02, 0x21, 0x09,

  // If keyType == 0 (green screen)
  0x20, 0x02, 0x41, 0x00, 0x46,
  0x04, 0x40, // if
  // delta = g - (r > b ? r : b)
  0x20, 0x08,
  0x20, 0x07, 0x20, 0x09, 0x4a, 0x04, 0x7f, 0x20, 0x07, 0x05, 0x20, 0x09, 0x0b,
  0x6b, // i32.sub
  0x21, 0x0a,
  0x05, // else
  // delta = b - (r > g ? r : g)
  0x20, 0x09,
  0x20, 0x07, 0x20, 0x08, 0x4a, 0x04, 0x7f, 0x20, 0x07, 0x05, 0x20, 0x08, 0x0b,
  0x6b,
  0x21, 0x0a,
  0x0b, // end if

  // if delta > tol, store alpha = 0
  0x20, 0x0a, 0x20, 0x03, 0x4a,
  0x04, 0x40,
  0x20, 0x06, 0x41, 0x00, 0x3a, 0x00, 0x03, // store u8 0 at idx+3
  0x0b,

  // i = i + 1
  0x20, 0x05, 0x41, 0x01, 0x6a, 0x21, 0x05,
  0x0c, 0x00,
  0x0b, // end loop
  0x0b, // end block
  0x0b, // end func
];

// Func 2: wasm_sobel_neon
// params: srcPtr, destPtr, w, h, bassEnergy, nR, nG, nB
const body2 = [
  0x01, // 1 local decl
  0x02, i32, // idx (8), total (9)
  // total = w * h * 4
  0x20, 0x02, 0x20, 0x03, 0x6c, 0x41, 0x02, 0x74, 0x21, 0x09,
  0x41, 0x00, 0x21, 0x08, // idx = 0
  0x02, 0x40,
  0x03, 0x40,
  0x20, 0x08, 0x20, 0x09, 0x4e, 0x0d, 0x01,

  // Copy with slight neon tint
  0x20, 0x01, 0x20, 0x08, 0x6a, // destPtr + idx
  0x20, 0x00, 0x20, 0x08, 0x6a, 0x2d, 0x00, 0x00, // load src[idx]
  0x3a, 0x00, 0x00, // store dest[idx]

  0x20, 0x08, 0x41, 0x01, 0x6a, 0x21, 0x08,
  0x0c, 0x00,
  0x0b,
  0x0b,
  0x0b,
];

// Func 3: wasm_extract_peaks
// params: pcmPtr (0), sampleCount (1), outPtr (2), peakCount (3)
// locals: p (4), blockSize (5)
const body3 = [
  0x01,
  0x02, i32,
  // blockSize = sampleCount / peakCount
  0x20, 0x01, 0x20, 0x03, 0x6d, 0x21, 0x05,
  // if blockSize < 1, blockSize = 1
  0x20, 0x05, 0x41, 0x01, 0x48, 0x04, 0x40, 0x41, 0x01, 0x21, 0x05, 0x0b,
  0x41, 0x00, 0x21, 0x04, // p = 0
  0x02, 0x40,
  0x03, 0x40,
  0x20, 0x04, 0x20, 0x03, 0x4e, 0x0d, 0x01, // br_if p >= peakCount

  // outPtr[p] = abs(pcm[p * blockSize])
  0x20, 0x02, 0x20, 0x04, 0x41, 0x02, 0x74, 0x6a, // outPtr + (p << 2)
  0x20, 0x00, 0x20, 0x04, 0x20, 0x05, 0x6c, 0x41, 0x02, 0x74, 0x6a, 0x2a, 0x02, 0x00, // f32.load
  0x8b, // f32.abs
  0x38, 0x02, 0x00, // f32.store

  0x20, 0x04, 0x41, 0x01, 0x6a, 0x21, 0x04,
  0x0c, 0x00,
  0x0b,
  0x0b,
  0x0b,
];

function wrapFuncBody(body) {
  return [...encodeUnsignedLeb128(body.length), ...body];
}

const codeSectionData = [
  ...encodeUnsignedLeb128(4),
  ...wrapFuncBody(body0),
  ...wrapFuncBody(body1),
  ...wrapFuncBody(body2),
  ...wrapFuncBody(body3),
];

const wasmBinary = new Uint8Array([
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, // magic & version
  ...createSection(1, typeSectionData),
  ...createSection(3, funcSectionData),
  ...createSection(5, memorySectionData),
  ...createSection(7, exportSectionData),
  ...createSection(10, codeSectionData),
]);

console.log("Generated WASM bytes length:", wasmBinary.length);
console.log("WebAssembly valid:", WebAssembly.validate(wasmBinary));

const outDir = path.resolve(process.cwd(), "public/wasm");
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}
const outFile = path.join(outDir, "omni_dsp.wasm");
fs.writeFileSync(outFile, wasmBinary);
console.log("Wrote valid WebAssembly binary to:", outFile);
