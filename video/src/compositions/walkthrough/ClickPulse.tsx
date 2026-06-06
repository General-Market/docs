/**
 * ClickPulse — a brief highlight over the clicked control so the click reads as
 * responsive. Complements Cursor.tsx's ring (which flashes the cursor); this
 * flashes the TARGET.
 *
 * Frame-driven, never CSS-animated: both the soft brand-tint fill flash and the
 * expanding rounded outline are interpolated from useCurrentFrame() over a short
 * window starting at atFrame. Before atFrame and after the pulse ends it renders
 * nothing (returns null), so it leaves no trace once the click has registered.
 *
 * Brand: GM Electric (#2D5BFF). Rect is in CANVAS coords (see geometry.ts).
 */

import React from "react";
import { useCurrentFrame, interpolate } from "remotion";
import { EASE } from "../../common/easing";

const GM_ELECTRIC = "#2D5BFF";

const PULSE_DURATION = 12; // frames the highlight lives
const OUTLINE_GROW = 14; // px the outline expands beyond the rect on each side

export const ClickPulse: React.FC<{
  rect: { x: number; y: number; w: number; h: number };
  atFrame: number;
  radius?: number;
}> = ({ rect, atFrame, radius = 10 }) => {
  const frame = useCurrentFrame();

  const d = frame - atFrame;
  if (d < 0 || d > PULSE_DURATION) return null;

  const p = d / PULSE_DURATION;

  // Soft brand-tint fill flash — bright on the click, gone by the end.
  const fillOpacity = interpolate(p, [0, 1], [0.18, 0], {
    easing: EASE.out,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Expanding rounded outline — grows from the rect to rect+OUTLINE_GROW and fades.
  const grow = interpolate(p, [0, 1], [0, OUTLINE_GROW], {
    easing: EASE.out,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const outlineOpacity = interpolate(p, [0, 1], [0.5, 0], {
    easing: EASE.out,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const outlineWidth = interpolate(p, [0, 1], [2.5, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <>
      {/* Fill flash — exactly over the control. */}
      <div
        style={{
          position: "absolute",
          left: rect.x,
          top: rect.y,
          width: rect.w,
          height: rect.h,
          borderRadius: radius,
          background: GM_ELECTRIC,
          opacity: fillOpacity,
          pointerEvents: "none",
          zIndex: 8800,
        }}
      />
      {/* Expanding outline — grows outward from the rect and fades. */}
      <div
        style={{
          position: "absolute",
          left: rect.x - grow,
          top: rect.y - grow,
          width: rect.w + grow * 2,
          height: rect.h + grow * 2,
          borderRadius: radius + grow,
          border: `${outlineWidth}px solid ${GM_ELECTRIC}`,
          opacity: outlineOpacity,
          pointerEvents: "none",
          zIndex: 8800,
        }}
      />
    </>
  );
};
