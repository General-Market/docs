/**
 * NumberRoll — a number that counts up to a target, masking the screenshot's
 * static figure so the animated value lands exactly on the printed one.
 *
 * Frame-driven, never CSS-animated: the displayed value is interpolated from
 * useCurrentFrame() over [startFrame, startFrame+durationFrames] with an ease-out
 * (EASE.out — the house reveal curve) so it slows into the target. Before
 * startFrame it shows `from`; after the window it shows `to` exactly, so once the
 * roll finishes the overlay matches the screenshot seamlessly and can unmount.
 *
 * It MUST cover the static figure underneath: a solid `bg` rect is painted over
 * `rect` expanded by `bgInset` px on every side (a tiny bleed) so no static digits
 * peek out at the edges during the roll, then the rolling number is drawn on top at
 * the exact `rect`. Commit Mono + tabular-nums keep the glyph width stable so the
 * count doesn't jitter, and the value is clamped so it never overshoots `to`.
 *
 * Brand: text near-black #1D1D1F by default; mono = Commit Mono.
 */

import React from "react";
import { useCurrentFrame, interpolate, Easing } from "remotion";
import { monoFont } from "../../common/fonts";

const NEAR_BLACK = "#1D1D1F";

// EASE.out (GMStyle §7) — reveals/counters decelerate into their resting value.
const OUT_EASE = Easing.bezier(0.16, 1, 0.3, 1);

function formatNumber(value: number, decimals: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export const NumberRoll: React.FC<{
  rect: { x: number; y: number; w: number; h: number };
  to: number;
  from?: number;
  startFrame: number;
  durationFrames: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  fontSize: number;
  fontWeight?: number;
  color?: string;
  bg?: string;
  align?: "left" | "center" | "right";
  bgInset?: number;
}> = ({
  rect,
  to,
  from = 0,
  startFrame,
  durationFrames,
  prefix = "",
  suffix = "",
  decimals = 0,
  fontSize,
  fontWeight = 700,
  color = NEAR_BLACK,
  bg = "#FFFFFF",
  align = "left",
  bgInset = 3,
}) => {
  const frame = useCurrentFrame();

  const local = frame - startFrame;
  let value: number;
  if (local <= 0) {
    value = from;
  } else if (local >= durationFrames) {
    value = to; // exact target — matches the screenshot
  } else {
    value = interpolate(local, [0, durationFrames], [from, to], {
      easing: OUT_EASE,
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    // Never overshoot the target in either direction (no distracting over-count).
    value = to >= from ? Math.min(value, to) : Math.max(value, to);
  }

  const justify =
    align === "left"
      ? "flex-start"
      : align === "right"
        ? "flex-end"
        : "center";

  return (
    <>
      {/* Mask — bg rect bled out by bgInset on every side so no static digit
          underneath peeks at the edges during the roll. */}
      <div
        style={{
          position: "absolute",
          left: rect.x - bgInset,
          top: rect.y - bgInset,
          width: rect.w + bgInset * 2,
          height: rect.h + bgInset * 2,
          background: bg,
          pointerEvents: "none",
          zIndex: 8500,
        }}
      />
      {/* Rolling number — at the exact rect so it lands where the screenshot's
          static figure sits. */}
      <div
        style={{
          position: "absolute",
          left: rect.x,
          top: rect.y,
          width: rect.w,
          height: rect.h,
          display: "flex",
          alignItems: "center",
          justifyContent: justify,
          boxSizing: "border-box",
          pointerEvents: "none",
          zIndex: 8501,
          fontFamily: monoFont,
          fontSize,
          fontWeight,
          fontVariantNumeric: "tabular-nums",
          color,
          lineHeight: 1,
          whiteSpace: "pre",
          overflow: "hidden",
        }}
      >
        {prefix}
        {formatNumber(value, decimals)}
        {suffix}
      </div>
    </>
  );
};
