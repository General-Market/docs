import { describe, it, expect } from "vitest";
import { detectFirstOnset } from "./onset";

function flatThenSpike(n: number, spikeAt: number, floor = 0.001, spike = 0.9): {
  mins: Float32Array;
  maxs: Float32Array;
} {
  const mins = new Float32Array(n);
  const maxs = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    mins[i] = -floor;
    maxs[i] = floor;
  }
  for (let i = spikeAt; i < Math.min(n, spikeAt + 8); i++) {
    mins[i] = -spike;
    maxs[i] = spike;
  }
  return { mins, maxs };
}

describe("detectFirstOnset", () => {
  it("finds the spike sample", () => {
    const { mins, maxs } = flatThenSpike(200, 80);
    const idx = detectFirstOnset(mins, maxs);
    expect(idx).toBe(80);
  });

  it("returns null when nothing exceeds the threshold", () => {
    const mins = new Float32Array(200);
    const maxs = new Float32Array(200);
    for (let i = 0; i < 200; i++) {
      mins[i] = -0.02;
      maxs[i] = 0.02;
    }
    expect(detectFirstOnset(mins, maxs)).toBeNull();
  });

  it("ignores small rises that are loud but gradual", () => {
    const n = 200;
    const mins = new Float32Array(n);
    const maxs = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const v = 0.05 + (i / n) * 0.6; // slow ramp to ~0.65 (~−3.7 dBFS)
      mins[i] = -v;
      maxs[i] = v;
    }
    // Gradual rise over hundreds of samples; 5-sample window shows only a tiny jump.
    expect(detectFirstOnset(mins, maxs)).toBeNull();
  });
});
