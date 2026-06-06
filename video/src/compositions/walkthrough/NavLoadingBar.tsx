/**
 * NavLoadingBar — a browser-style top progress bar: the thin sliver that sweeps
 * across the top of the window on a page load (Chrome / YouTube nav loading), so a
 * cut between two screenshots reads as a real page navigation.
 *
 * Frame-driven, never CSS-animated: width and opacity are computed from
 * useCurrentFrame() over [startFrame, startFrame+durationFrames]. The bar eases
 * fast to ~90% early (EASE.out — the quick part of a real load), creeps the last
 * stretch, completes to 100% near the end, then fades out over the final ~4
 * frames. Before startFrame and after the fade it draws nothing.
 *
 * Brand: bar = GM Electric (#2D5BFF) by default.
 */

import React from "react";
import { useCurrentFrame, interpolate, Easing } from "remotion";

const GM_ELECTRIC = "#2D5BFF";

// EASE.out (GMStyle §7) — the quick early surge of a page load.
const OUT_EASE = Easing.bezier(0.16, 1, 0.3, 1);

const BAR_HEIGHT = 3; // px — the thin nav sliver
const FADE_FRAMES = 4; // frames the completed bar fades over

export const NavLoadingBar: React.FC<{
  top: number;
  left: number;
  width: number;
  startFrame: number;
  durationFrames: number;
  color?: string;
}> = ({ top, left, width, startFrame, durationFrames, color = GM_ELECTRIC }) => {
  const frame = useCurrentFrame();

  const local = frame - startFrame;
  if (local < 0 || local > durationFrames) return null;

  // Where the "complete to 100% + fade" phase begins.
  const completeAt = Math.max(0, durationFrames - FADE_FRAMES);

  // Progress: fast to ~90% over the first ~70% of the load, creep to ~98%, then
  // snap to 100% during the final fade.
  let progress: number;
  if (local <= completeAt) {
    const surgeEnd = completeAt * 0.7;
    if (local <= surgeEnd) {
      progress = interpolate(local, [0, surgeEnd], [0.02, 0.9], {
        easing: OUT_EASE,
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
    } else {
      progress = interpolate(local, [surgeEnd, completeAt], [0.9, 0.98], {
        easing: Easing.linear,
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
    }
  } else {
    progress = interpolate(local, [completeAt, durationFrames], [0.98, 1], {
      easing: OUT_EASE,
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }

  // Fade out only as the bar completes.
  const opacity = interpolate(
    local,
    [completeAt, durationFrames],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width: width * progress,
        height: BAR_HEIGHT,
        background: color,
        boxShadow: `0 0 8px ${color}`,
        opacity,
        pointerEvents: "none",
        zIndex: 8700,
      }}
    />
  );
};
