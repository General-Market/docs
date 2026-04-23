// Peaks resampler. Synthetic sine. Small.

import { describe, expect, it } from "vitest";
import { chooseTier, resamplePeaks, type PeaksSource } from "./peaks";

function synthSine(rateHz: number, durationSec: number, freqHz: number): PeaksSource {
  const n = Math.round(rateHz * durationSec);
  const mins = new Float32Array(n);
  const maxs = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / rateHz;
    const v = Math.sin(2 * Math.PI * freqHz * t);
    mins[i] = -Math.abs(v);
    maxs[i] = Math.abs(v);
  }
  return { mins, maxs, rateHz };
}

describe("resamplePeaks", () => {
  it("returns pxCount samples", () => {
    const peaks = synthSine(200, 2, 5);
    const r = resamplePeaks({
      peaks,
      inFrame: 0,
      outFrame: 120,
      sourceFps: 60,
      pxCount: 64,
    });
    expect(r.mins.length).toBe(64);
    expect(r.maxs.length).toBe(64);
  });

  it("preserves bounded amplitude on a sine", () => {
    const peaks = synthSine(1000, 1, 10);
    const r = resamplePeaks({
      peaks,
      inFrame: 0,
      outFrame: 60,
      sourceFps: 60,
      pxCount: 50,
    });
    for (let i = 0; i < r.maxs.length; i++) {
      expect(r.maxs[i]).toBeLessThanOrEqual(1);
      expect(r.mins[i]).toBeGreaterThanOrEqual(-1);
    }
    let sawPositive = false;
    let sawNegative = false;
    for (let i = 0; i < r.maxs.length; i++) {
      if (r.maxs[i] > 0.5) sawPositive = true;
      if (r.mins[i] < -0.5) sawNegative = true;
    }
    expect(sawPositive).toBe(true);
    expect(sawNegative).toBe(true);
  });

  it("returns zeros on empty source", () => {
    const peaks: PeaksSource = { mins: new Float32Array(0), maxs: new Float32Array(0), rateHz: 200 };
    const r = resamplePeaks({ peaks, inFrame: 0, outFrame: 60, sourceFps: 60, pxCount: 10 });
    expect(r.mins.length).toBe(10);
    expect(r.maxs.length).toBe(10);
    for (let i = 0; i < 10; i++) {
      expect(r.mins[i]).toBe(0);
      expect(r.maxs[i]).toBe(0);
    }
  });

  it("slices by clip in/out", () => {
    const peaks = synthSine(1000, 4, 4); // 4 s of a 4 Hz sine
    const left = resamplePeaks({ peaks, inFrame: 0, outFrame: 60, sourceFps: 60, pxCount: 10 });
    const right = resamplePeaks({ peaks, inFrame: 180, outFrame: 240, sourceFps: 60, pxCount: 10 });
    let sumL = 0;
    let sumR = 0;
    for (let i = 0; i < 10; i++) {
      sumL += left.maxs[i];
      sumR += right.maxs[i];
    }
    expect(sumL).toBeGreaterThan(0);
    expect(sumR).toBeGreaterThan(0);
  });
});

describe("chooseTier", () => {
  it("picks low below 2 px/frame", () => {
    expect(chooseTier(0.5)).toBe("low");
    expect(chooseTier(1.99)).toBe("low");
  });
  it("picks high at or above 2 px/frame", () => {
    expect(chooseTier(2)).toBe("high");
    expect(chooseTier(8)).toBe("high");
  });
});
