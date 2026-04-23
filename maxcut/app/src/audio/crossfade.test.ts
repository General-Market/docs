import { describe, expect, it } from "vitest";
import { equalPowerGain, linearGain, logGain } from "./crossfade";
import { gainAtFrame } from "./gainEnvelope";

describe("crossfade curves", () => {
  it("equal power at t=0.5 ≈ sin(π/4) ≈ 0.7071", () => {
    expect(equalPowerGain(0.5)).toBeCloseTo(Math.SQRT1_2, 6);
  });

  it("linear at t=0.5 = 0.5", () => {
    expect(linearGain(0.5)).toBe(0.5);
  });

  it("endpoints are exact for all three curves", () => {
    expect(equalPowerGain(0)).toBe(0);
    expect(equalPowerGain(1)).toBeCloseTo(1, 10);
    expect(linearGain(0)).toBe(0);
    expect(linearGain(1)).toBe(1);
    expect(logGain(0)).toBe(0);
    expect(logGain(1)).toBeCloseTo(1, 10);
  });
});

describe("gainAtFrame", () => {
  it("returns 0 dB for empty envelope", () => {
    expect(gainAtFrame([], 12)).toBe(0);
  });

  it("interpolates linearly between two keyframes", () => {
    const env = [
      { frame: 0, db: 0 },
      { frame: 100, db: -12 },
    ];
    expect(gainAtFrame(env, 0)).toBe(0);
    expect(gainAtFrame(env, 50)).toBeCloseTo(-6, 10);
    expect(gainAtFrame(env, 100)).toBe(-12);
    // Before/after extrema clamp to endpoints.
    expect(gainAtFrame(env, -20)).toBe(0);
    expect(gainAtFrame(env, 200)).toBe(-12);
  });
});
