// Source: https://codepen.io/kirilbt/full/XWZojKG
import React, { useMemo } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";

/**
 * 1:1 reproduction of kirilbt's "Text Trail Effect on Mousemove" CodePen.
 *
 * Original: ~20 copies of the word "move" in a bold extended font, stroked
 * white on black, all position: absolute. A mousemove listener feeds GSAP
 * `.to()` with stagger: { each: -0.02, ease: "power2.inOut" }, animating
 * every copy toward (clientX, clientY). The negative stagger means the last
 * element leads and the first trails — producing a ghostly cascading wake
 * of hollow text chasing the cursor.
 *
 * Here: mouse position replaced by a Lissajous curve driven by frame count.
 * GSAP stagger delay reproduced via per-element phase offsets in the trail.
 * All animation derived from useCurrentFrame(). No requestAnimationFrame.
 */

// ── Config ──────────────────────────────────────────────────────────────────

const TEXT = "move";
const COPY_COUNT = 20;
const BG = "#0a0a0a";
const STROKE_COLOR = "#ffffff";
const STROKE_WIDTH = 1;
const FONT_SIZE_VW = 12; // vw-ish — percentage of width
const FONT_WEIGHT = 700;
const FONT_FAMILY =
  '"Venn Extended", "DM Sans", "Inter", "Helvetica Neue", Helvetica, Arial, sans-serif';

// Original GSAP stagger: each: -0.02 with power2.inOut on ~20 elements.
// Total stagger spread: 0.02 * 19 = 0.38 seconds. The negative sign means
// the last element in DOM order arrives first; the first element trails most.
const STAGGER_SECONDS = 0.02;

// ── Lissajous cursor path ──────────────────────────────────────────────────
// Two irrational-ratio frequencies → non-repeating, organic-feeling path.
// Stays within the central region where text movement looks natural.

function lissajousMouse(
  t: number,
  w: number,
  h: number,
): { x: number; y: number } {
  const x = w * (0.5 + 0.32 * Math.sin(t * 0.73 + 0.4));
  const y = h * (0.5 + 0.28 * Math.cos(t * 1.17 + 2.1));
  return { x, y };
}

// ── Simulate GSAP stagger trail ─────────────────────────────────────────────
// Each copy has a phase delay. When the "cursor" moves, the first copy
// (i=0) reacts last (most trailing), the last copy (i=COPY_COUNT-1) reacts
// first. This mirrors the negative stagger direction.
//
// We sample the cursor path at (time - delay_i) for each copy. Because the
// path is continuous, sampling at offset times produces the exact visual:
// a smooth trailing cascade — no explicit easing function needed.

interface TrailElement {
  x: number;
  y: number;
  opacity: number;
}

function computeTrail(
  time: number,
  w: number,
  h: number,
): TrailElement[] {
  const elements: TrailElement[] = [];

  for (let i = 0; i < COPY_COUNT; i++) {
    // Negative stagger: element 0 has maximum delay, element N-1 has zero.
    // This means the last DOM element snaps to cursor first.
    const delay = (COPY_COUNT - 1 - i) * STAGGER_SECONDS;
    const delayedTime = time - delay;

    // Sample the cursor position at the delayed time
    const pos = lissajousMouse(Math.max(0, delayedTime), w, h);

    // Opacity: front elements (near cursor) are brightest, trailing ones fade.
    // The original has uniform opacity (all stroked white), but the visual
    // perception is that trailing copies overlap creating depth. We keep
    // opacity uniform to match — the layering does the rest.
    const opacity = 1.0;

    elements.push({ x: pos.x, y: pos.y, opacity });
  }

  return elements;
}

// ── Component ───────────────────────────────────────────────────────────────

export const MouseTrail: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const time = frame / fps;

  const fontSize = (FONT_SIZE_VW / 100) * width;

  // Compute trail positions for all copies
  const trail = useMemo(
    () => computeTrail(time, width, height),
    [time, width, height],
  );

  // Entrance: fade in over the first 15 frames
  const masterOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.ease,
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BG,
        overflow: "hidden",
        opacity: masterOpacity,
      }}
    >
      {trail.map((el, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            transform: `translate(${el.x - fontSize * 1.2}px, ${el.y - fontSize * 0.5}px)`,
            pointerEvents: "none",
            fontFamily: FONT_FAMILY,
            fontWeight: FONT_WEIGHT,
            fontSize: `${fontSize}px`,
            lineHeight: 1,
            color: "transparent",
            WebkitTextStroke: `${STROKE_WIDTH}px ${STROKE_COLOR}`,
            opacity: el.opacity,
            whiteSpace: "nowrap",
            userSelect: "none",
          }}
        >
          {TEXT}
        </div>
      ))}
    </AbsoluteFill>
  );
};
