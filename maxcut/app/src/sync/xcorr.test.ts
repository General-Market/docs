import { describe, it, expect } from "vitest";
import { normalizedXcorr } from "./xcorr";

// Build a deterministic-ish envelope with enough variance that the peak is unambiguous.
function synth(n: number): Float32Array {
  const a = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    a[i] =
      0.6 * Math.sin((i / n) * Math.PI * 4) +
      0.3 * Math.sin((i / n) * Math.PI * 13) +
      0.1 * Math.cos((i / n) * Math.PI * 29);
  }
  return a;
}

function shift(a: Float32Array, k: number): Float32Array {
  const b = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) {
    const src = i - k;
    b[i] = src >= 0 && src < a.length ? a[src] : 0;
  }
  return b;
}

describe("normalizedXcorr", () => {
  it("recovers a +5 sample shift", () => {
    const a = synth(400);
    const b = shift(a, 5);
    const { lag, correlation } = normalizedXcorr(a, b, 40);
    expect(lag).toBe(5);
    expect(correlation).toBeGreaterThan(0.9);
  });

  it("recovers a −7 sample shift", () => {
    const a = synth(400);
    const b = shift(a, -7);
    const { lag, correlation } = normalizedXcorr(a, b, 40);
    expect(lag).toBe(-7);
    expect(correlation).toBeGreaterThan(0.9);
  });

  it("returns zero on flat inputs", () => {
    const a = new Float32Array(200);
    const b = new Float32Array(200);
    const { correlation } = normalizedXcorr(a, b, 20);
    expect(correlation).toBe(0);
  });
});
