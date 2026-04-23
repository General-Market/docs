// Binary peaks format. Two tiers, int16 min/max pairs.
// A tier is a sample rate. 200 Hz for panoramic zoom, 1 kHz when the cut becomes sample-accurate.
// The disk knows nothing of zoom. It only stores two resolutions and waits.

export const PEAKS_HZ = { low: 200, high: 1000 } as const;
export type PeaksTier = keyof typeof PEAKS_HZ;

const MAGIC = 0x4d43_5057; // "MCPW"
const VERSION = 1;
const HEADER_BYTES = 16; // magic(4) + version(2) + reserved(2) + count(4) + rateHz(4)

const INT16_MAX = 32767;

function clampInt16(n: number): number {
  if (n > INT16_MAX) return INT16_MAX;
  if (n < -INT16_MAX) return -INT16_MAX;
  return n | 0;
}

export function encodePeaks(mins: Float32Array, maxs: Float32Array, rateHz = PEAKS_HZ.low): Uint8Array {
  if (mins.length !== maxs.length) {
    throw new Error("encodePeaks: mins and maxs length mismatch");
  }
  const count = mins.length;
  const body = count * 4; // two int16 per sample
  const buf = new ArrayBuffer(HEADER_BYTES + body);
  const view = new DataView(buf);
  const little = true;

  view.setUint32(0, MAGIC, little);
  view.setUint16(4, VERSION, little);
  view.setUint16(6, 0, little);
  view.setUint32(8, count, little);
  view.setUint32(12, rateHz, little);

  let o = HEADER_BYTES;
  for (let i = 0; i < count; i++) {
    view.setInt16(o, clampInt16(Math.round(mins[i] * INT16_MAX)), little);
    view.setInt16(o + 2, clampInt16(Math.round(maxs[i] * INT16_MAX)), little);
    o += 4;
  }
  return new Uint8Array(buf);
}

export function decodePeaks(buf: ArrayBuffer): { mins: Float32Array; maxs: Float32Array; rateHz: number } {
  if (buf.byteLength < HEADER_BYTES) {
    throw new Error("decodePeaks: buffer too small");
  }
  const view = new DataView(buf);
  const little = true;
  const magic = view.getUint32(0, little);
  if (magic !== MAGIC) {
    throw new Error("decodePeaks: bad magic");
  }
  const version = view.getUint16(4, little);
  if (version !== VERSION) {
    throw new Error(`decodePeaks: unsupported version ${version}`);
  }
  const count = view.getUint32(8, little);
  const rateHz = view.getUint32(12, little);
  const expected = HEADER_BYTES + count * 4;
  if (buf.byteLength < expected) {
    throw new Error("decodePeaks: truncated body");
  }

  const mins = new Float32Array(count);
  const maxs = new Float32Array(count);
  let o = HEADER_BYTES;
  for (let i = 0; i < count; i++) {
    mins[i] = view.getInt16(o, little) / INT16_MAX;
    maxs[i] = view.getInt16(o + 2, little) / INT16_MAX;
    o += 4;
  }
  return { mins, maxs, rateHz };
}
