// Fade curve math. Pure, deterministic, no DOM, no store.
// Given a clip's audioFade and a frame inside the clip, return 0..1 attenuation.

import type { Clip } from "../project/schema";

export type FadeCurve = "equalPower" | "log" | "linear";

function clamp01(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t;
}

/** sin(t * π/2). At t=0.5 returns sin(π/4) ≈ 0.7071. */
export function equalPowerGain(t: number): number {
  return Math.sin(clamp01(t) * (Math.PI / 2));
}

/** Logarithmic fade in. Monotonic 0→1. Uses log10(1 + 9t) so endpoints are exact. */
export function logGain(t: number): number {
  return Math.log10(1 + 9 * clamp01(t));
}

/** Linear 0→1. */
export function linearGain(t: number): number {
  return clamp01(t);
}

function curveGain(curve: FadeCurve, t: number): number {
  switch (curve) {
    case "equalPower":
      return equalPowerGain(t);
    case "log":
      return logGain(t);
    case "linear":
      return linearGain(t);
  }
}

/**
 * Attenuation 0..1 applied by the clip's audioFade at a given frame inside the clip.
 * `frameInClip` is measured from the clip's `at` (0 = first frame of the clip).
 * Returns 1.0 when there is no fade or the frame is in the middle.
 */
export function fadeGainAtFrame(
  clip: Clip,
  frameInClip: number,
  fps: number,
): number {
  const fade = clip.audioFade;
  if (!fade) return 1;
  if (frameInClip < 0) return 0;

  const clipFrames = Math.max(0, clip.out - clip.in);
  if (clipFrames <= 0) return 0;
  if (frameInClip >= clipFrames) return 0;

  const framesPerMs = fps / 1000;
  const inFrames = Math.max(0, fade.inMs * framesPerMs);
  const outFrames = Math.max(0, fade.outMs * framesPerMs);

  let gIn = 1;
  if (inFrames > 0 && frameInClip < inFrames) {
    gIn = curveGain(fade.curve, frameInClip / inFrames);
  }

  let gOut = 1;
  if (outFrames > 0) {
    const fromEnd = clipFrames - frameInClip;
    if (fromEnd < outFrames) {
      gOut = curveGain(fade.curve, fromEnd / outFrames);
    }
  }

  return Math.min(gIn, gOut);
}
