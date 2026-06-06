/**
 * Cursor — the macOS arrow that glides between walkthrough targets.
 *
 * Frame-driven, never CSS-animated: every transform and the click ripple are
 * computed from useCurrentFrame() so the same picture renders in Studio and in
 * a headless render. Before startFrame it rests at `from`; over
 * [startFrame, startFrame+moveDuration] it travels the bezierArc with an eased t
 * (EASE.inOut — the house "main move"); after that it holds at `to`. Around an
 * optional clickFrame it dips (a brief press) and emits one expanding, fading
 * ring drawn with interpolate.
 *
 * Brand: the ring is GM Electric (#2D5BFF). Geometry/path lifted from the demo
 * cursor (scenes/DemoAnimations/shared/Cursor.tsx), scaled up for the 1920×1080
 * canvas so it reads against a screenshot.
 */

import React from "react";
import { useCurrentFrame, interpolate, Easing } from "remotion";
import { bezierArc, type Point } from "./cursorPath";

const GM_ELECTRIC = "#2D5BFF";

// House "main move" easing (GMStyle §7 inOut). Used to ease t along the arc so
// the cursor accelerates out of rest and settles into the target.
const MOVE_EASE = Easing.bezier(0.87, 0, 0.13, 1);

const CURSOR_SIZE = 40; // px on the 1920×1080 canvas — larger than the 24px demo
const RING_DURATION = 12; // frames the click ring lives
const RING_MAX = 64; // px diameter the ring expands to
const DIP_DURATION = 6; // frames the press dip lasts

export const Cursor: React.FC<{
  from: Point;
  to: Point;
  startFrame: number;
  moveDuration: number;
  clickFrame?: number;
}> = ({ from, to, startFrame, moveDuration, clickFrame }) => {
  const frame = useCurrentFrame();

  // Position along the arc.
  let pos: Point;
  if (frame <= startFrame) {
    pos = from;
  } else if (frame >= startFrame + moveDuration) {
    pos = to;
  } else {
    const raw = (frame - startFrame) / moveDuration;
    const t = MOVE_EASE(raw);
    pos = bezierArc(from, to, t);
  }

  // Press dip: a few frames of scale-down centred on clickFrame, then back.
  let dip = 1;
  if (clickFrame !== undefined) {
    const d = frame - clickFrame;
    if (d >= 0 && d <= DIP_DURATION) {
      // Dip down to 0.85 at the start of the press, ease back to 1.
      dip = interpolate(d, [0, DIP_DURATION], [0.85, 1], {
        easing: Easing.out(Easing.quad),
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
    }
  }

  // Click ring: one expanding circle that fades out over RING_DURATION frames.
  let ring: { size: number; opacity: number; width: number } | null = null;
  if (clickFrame !== undefined) {
    const d = frame - clickFrame;
    if (d >= 0 && d <= RING_DURATION) {
      const p = d / RING_DURATION;
      ring = {
        size: interpolate(p, [0, 1], [10, RING_MAX], {
          easing: Easing.out(Easing.cubic),
        }),
        opacity: interpolate(p, [0, 1], [0.55, 0], {
          easing: Easing.out(Easing.quad),
        }),
        width: interpolate(p, [0, 1], [3, 1]),
      };
    }
  }

  return (
    <div
      style={{
        position: "absolute",
        left: pos.x,
        top: pos.y,
        pointerEvents: "none",
        zIndex: 9000,
      }}
    >
      {/* Click ring — centred on the cursor hotspot (the SVG tip ≈ origin). */}
      {ring && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: ring.size,
            height: ring.size,
            marginLeft: -ring.size / 2,
            marginTop: -ring.size / 2,
            borderRadius: "50%",
            border: `${ring.width}px solid ${GM_ELECTRIC}`,
            opacity: ring.opacity,
          }}
        />
      )}

      {/* Arrow body — frame-driven dip via transform scale (no CSS transition). */}
      <svg
        width={CURSOR_SIZE}
        height={CURSOR_SIZE}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        style={{
          display: "block",
          filter: "drop-shadow(0 2px 5px rgba(0,0,0,0.35))",
          transform: `scale(${dip})`,
          transformOrigin: "5px 3px", // the SVG tip — the cursor hotspot
        }}
      >
        <path
          d="M5 3L19 12L12 13L9 20L5 3Z"
          fill="#FFFFFF"
          stroke="#1D1D1F"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};
