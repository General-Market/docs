// Source: https://codepen.io/kirilbt/full/XWZojKG
//
// Original by kirilbt (2022-06-12). Extracted from Wayback Machine snapshot
// 20260225192721. The pen has exactly 5 `.text` divs inside a `.cursor`
// wrapper — the last one contains a <span> that fills it solid white while
// the other four are stroked outlines. GSAP animates all five to the mouse
// position with stagger: { each: -0.02, ease: "power2.inOut" }, so the last
// element (filled) leads and the first (stroked) trails.
//
// External resources:
//   JS:  https://unpkg.co/gsap@3/dist/gsap.min.js
//   CSS: https://use.typekit.net/kfu3rpe.css (venn-extended font)
//
// Remotion adaptation: Lissajous curve replaces mousemove. Per-element
// phase offsets reproduce the GSAP stagger. No requestAnimationFrame.

import React, { useMemo } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";

// ── Original constants ─────────────────────────────────────────────────────

const TEXT = "move";
const COPY_COUNT = 5; // original has exactly 5 .text divs
const BG = "#161616";
const STROKE_COLOR = "#fff";
const STROKE_WIDTH = 1; // -webkit-text-stroke: 1px #fff
const FONT_FAMILY = "venn-extended, sans-serif";
const FONT_WEIGHT = 700;
// GSAP stagger config from original
const STAGGER_EACH = 0.02; // seconds between elements
// Negative `each` → last element (index 4) arrives first, index 0 trails most.
// Total spread: 0.02 * (5-1) = 0.08 seconds.

// ── Lissajous cursor path ──────────────────────────────────────────────────

function cursorPosition(
  t: number,
  w: number,
  h: number,
): { x: number; y: number } {
  const x = w * (0.5 + 0.32 * Math.sin(t * 0.73 + 0.4));
  const y = h * (0.5 + 0.28 * Math.cos(t * 1.17 + 2.1));
  return { x, y };
}

// ── Stagger trail ──────────────────────────────────────────────────────────
// Negative stagger: element 0 has the MOST delay, element 4 has ZERO delay.
// We sample the cursor path at (time - delay_i) for each element.

interface TrailElement {
  x: number;
  y: number;
  isFilled: boolean; // last element has <span> = solid white fill
}

function computeTrail(
  time: number,
  w: number,
  h: number,
): TrailElement[] {
  const elements: TrailElement[] = [];
  for (let i = 0; i < COPY_COUNT; i++) {
    // Element 0 gets max delay, element (N-1) gets zero delay
    const delay = (COPY_COUNT - 1 - i) * STAGGER_EACH;
    const pos = cursorPosition(Math.max(0, time - delay), w, h);
    elements.push({
      x: pos.x,
      y: pos.y,
      isFilled: i === COPY_COUNT - 1,
    });
  }
  return elements;
}

// ── Component ──────────────────────────────────────────────────────────────

export const MouseTrail: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const time = frame / fps;

  // Original uses 6em which in a typical viewport (~16px base) is ~96px.
  // Scale proportionally to composition width for video.
  const fontSize = width * 0.07;

  const trail = useMemo(
    () => computeTrail(time, width, height),
    [time, width, height],
  );

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
            // GSAP sets transform: translate(Xpx, Ypx) on each .text element
            transform: `translate(${el.x}px, ${el.y}px)`,
            pointerEvents: "none",
            fontFamily: FONT_FAMILY,
            fontWeight: FONT_WEIGHT,
            fontStyle: "normal",
            fontSize,
            lineHeight: 1,
            // Stroked outline: text color matches background, stroke is white.
            // Last element (isFilled): the <span> overrides color to white.
            color: el.isFilled ? "#fff" : BG,
            WebkitTextStroke: el.isFilled
              ? undefined
              : `${STROKE_WIDTH}px ${STROKE_COLOR}`,
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
