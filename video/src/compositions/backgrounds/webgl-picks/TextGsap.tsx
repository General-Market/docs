// Source: https://codepen.io/GreenSock/full/gagNeR
import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { interpolate as flubberInterpolate } from "flubber";

/**
 * 1:1 reproduction of GreenSock's MorphSVG : convertToPath() demo (gagNeR).
 *
 * The original: dark background (#0e100f), three SVG shapes — orange-gradient
 * triangle, square, and circle — centered in an SVG viewBox 0 0 760 400.
 * MorphSVGPlugin.convertToPath() turns <polygon>, <rect>, <circle> into <path>,
 * then a GSAP timeline morphs them sequentially into the letters A, B, C.
 * Timeline yoyos with power2.inOut easing. repeat: 20, repeatDelay: 0.5s,
 * initial delay: 0.5s. Default tween duration: 0.5s.
 *
 * Gradients: two linear (grad-1 for triangle, grad-2 for square) and one radial
 * (grad-3 for circle), all orange-toned (#f8dbb9 → #fb8305).
 */

// ── SVG Shape paths (convertToPath equivalents) ─────────────────────────────

const TRIANGLE_PATH = "M241,242 L283,157 L326,242 Z";
const RECT_PATH = "M363,157 L448,157 L448,242 L363,242 Z";
const CIRCLE_PATH = [
  "M487.5,200",
  "C487.5,176.528 506.528,157.5 530,157.5",
  "C553.472,157.5 572.5,176.528 572.5,200",
  "C572.5,223.472 553.472,242.5 530,242.5",
  "C506.528,242.5 487.5,223.472 487.5,200 Z",
].join(" ");

// ── Letter paths (exact from original pen's <defs>) ─────────────────────────

const LETTER_A =
  "M222.8 264.5c0-.7.2-1.6.6-2.8l48.4-134.1c.7-2.2 3.4-3.3 8.2-3.3h6c4.7 0 7.4 1.1 8 3.3l48.4 134.3c.5 1 .7 1.8.7 2.6 0 2.3-3 3.5-8.8 3.5h-1.7c-4.7 0-7.4-1-8.1-3.3l-12-33.4h-60l-11.7 33.4c-.7 2.2-3.4 3.3-8.2 3.3h-1c-5.8 0-8.8-1.2-8.8-3.5zm35.3-48.8H307L285.5 155l-2.7-11.8-3.2 11.8-21.5 60.8z";

const LETTER_B =
  "M364.6 262.9V132.3c0-4.1 2-6.2 6-6.2h36.6c14.9 0 26.2 3.3 34 9.8a32.5 32.5 0 0 1 11.7 26.4c0 6.8-2.2 13.2-6.7 19.4a29 29 0 0 1-15.7 11.6v.8a53.3 53.3 0 0 1 18.7 10.3c2.5 2.3 4.8 5.5 6.8 9.7s3 8.9 3 13.9c0 27.3-17.7 41-53.2 41h-35.1c-4 0-6.1-2-6.1-6.1zm18-75.1h23.6c8.2 0 15-2.3 20.2-7 5.3-4.6 8-10.5 8-17.6 0-7.2-2.3-12.5-7-16.1-4.6-3.6-12-5.4-22-5.4h-22.9v46zm0 65.7h29.7c9 0 16-2.3 20.8-7a25 25 0 0 0 7.4-19c0-7.8-2.7-13.8-8-18a38 38 0 0 0-23.6-6.2h-26.4v50.2z";

const LETTER_C =
  "M471.7 197.7c0-48.5 22-72.7 66.2-72.7a82 82 0 0 1 26.8 4.2c8.1 2.8 12.1 5.6 12.1 8.5 0 1.9-.8 4.3-2.5 7.3s-3.2 4.5-4.4 4.5c-.3 0-1.7-.8-4.4-2.3a59.3 59.3 0 0 0-27.2-6.7c-16.5 0-28.6 4.6-36.4 13.7-7.7 9.1-11.6 23.6-11.6 43.4s3.9 34.2 11.5 43.4c7.7 9.2 19.6 13.8 35.7 13.8a66.6 66.6 0 0 0 30-7.7 25 25 0 0 1 5-2.5c1.3 0 2.8 1.5 4.6 4.5 1.7 3 2.6 5.2 2.6 6.5 0 3.2-4.2 6.4-12.7 9.7-8.6 3.4-18.4 5-29.5 5-22.5 0-39-5.9-49.7-17.6-10.7-11.8-16-30.1-16-55z";

// ── Timing (at 30fps) ───────────────────────────────────────────────────────
// GSAP 3 default tween duration = 0.5s = 15 frames
// Timeline: sequential — triangle->A, then square->B, then circle->C

const FPS = 30;
const MORPH_DURATION = Math.round(0.5 * FPS); // 15 frames per morph
const INITIAL_DELAY = Math.round(0.5 * FPS); // 15 frames
const REPEAT_DELAY = Math.round(0.5 * FPS); // 15 frames
const FORWARD_DURATION = 3 * MORPH_DURATION; // 45 frames (1.5s)

// ── Easing: GSAP power2.inOut ────────────────────────────────────────────────

function power2InOut(t: number): number {
  if (t < 0.5) return 2 * t * t;
  return 1 - (-2 * t + 2) ** 2 / 2;
}

// ── Build flubber interpolators (memoized) ───────────────────────────────────

interface MorphSet {
  triangleToA: (t: number) => string;
  rectToB: (t: number) => string;
  circleToC: (t: number) => string;
}

function buildInterpolators(): MorphSet {
  return {
    triangleToA: flubberInterpolate(TRIANGLE_PATH, LETTER_A, {
      maxSegmentLength: 10,
    }),
    rectToB: flubberInterpolate(RECT_PATH, LETTER_B, {
      maxSegmentLength: 10,
    }),
    circleToC: flubberInterpolate(CIRCLE_PATH, LETTER_C, {
      maxSegmentLength: 10,
    }),
  };
}

// ── Main component ───────────────────────────────────────────────────────────

export const TextGsap: React.FC = () => {
  const frame = useCurrentFrame();
  const morphs = useMemo(() => buildInterpolators(), []);

  // Compute progress within the yoyo cycle
  // Structure: [delay] [forward] [repeatDelay] [backward] [repeatDelay] [forward] ...
  const effectiveFrame = frame - INITIAL_DELAY;

  // One full yoyo iteration = forward + repeatDelay + backward + repeatDelay
  const cycleLength = FORWARD_DURATION + REPEAT_DELAY + FORWARD_DURATION + REPEAT_DELAY;

  let timelineProgress = 0; // 0 = shapes, 1 = letters

  if (effectiveFrame < 0) {
    // In initial delay — show shapes
    timelineProgress = 0;
  } else {
    const cycleFrame = effectiveFrame % cycleLength;

    if (cycleFrame < FORWARD_DURATION) {
      // Forward pass: shapes -> letters
      timelineProgress = cycleFrame / FORWARD_DURATION;
    } else if (cycleFrame < FORWARD_DURATION + REPEAT_DELAY) {
      // Hold at letters
      timelineProgress = 1;
    } else if (cycleFrame < FORWARD_DURATION + REPEAT_DELAY + FORWARD_DURATION) {
      // Backward pass (yoyo): letters -> shapes
      const backFrame = cycleFrame - FORWARD_DURATION - REPEAT_DELAY;
      timelineProgress = 1 - backFrame / FORWARD_DURATION;
    } else {
      // Hold at shapes (repeatDelay before next cycle)
      timelineProgress = 0;
    }
  }

  // The timeline is sequential: 3 morphs, each taking 1/3 of the forward duration.
  // Map overall timelineProgress to per-shape progress with power2.inOut easing.
  const morphProgress = (shapeIndex: number): number => {
    const segmentStart = shapeIndex / 3;
    const segmentEnd = (shapeIndex + 1) / 3;
    const raw = interpolate(
      timelineProgress,
      [segmentStart, segmentEnd],
      [0, 1],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );
    return power2InOut(raw);
  };

  const progressA = morphProgress(0);
  const progressB = morphProgress(1);
  const progressC = morphProgress(2);

  const pathA = morphs.triangleToA(progressA);
  const pathB = morphs.rectToB(progressB);
  const pathC = morphs.circleToC(progressC);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0e100f",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 760 400"
        style={{ maxWidth: 1200, width: "100%" }}
      >
        <defs>
          <linearGradient
            id="grad-1"
            x1="200"
            y1="300"
            x2="255"
            y2="0"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#f8dbb9" />
            <stop offset="0.5" stopColor="#fb8305" />
          </linearGradient>

          <linearGradient
            id="grad-2"
            x1="340"
            y1="42"
            x2="240"
            y2="125"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0.1" stopColor="#f8dbb9" />
            <stop offset="0.5" stopColor="#fb8305" />
          </linearGradient>

          <radialGradient
            id="grad-3"
            cx="460"
            cy="280"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0.1" stopColor="#f8dbb9" />
            <stop offset="0.35" stopColor="#fb8305" />
          </radialGradient>
        </defs>

        <path d={pathA} fill="url(#grad-1)" />
        <path d={pathB} fill="url(#grad-2)" />
        <path d={pathC} fill="url(#grad-3)" />
      </svg>
    </AbsoluteFill>
  );
};
