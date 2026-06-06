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
 * It MUST cover the static figure underneath: a solid mask rect is painted over
 * `rect` expanded by `bgInset` px on every side (a tiny bleed) so no static digits
 * peek out at the edges during the roll, then the rolling number is drawn on top at
 * the exact `rect`. tabular-nums keeps the glyph width stable so the count doesn't
 * jitter, and the value is clamped so it never overshoots `to`.
 *
 * To read as NATIVE to the screenshot — not pasted on top — pass `style`, the
 * computed style captured from the real element: its fontFamily / fontSize /
 * fontWeight / color / letterSpacing / textAlign drive the glyphs, and its
 * `background` becomes the exact mask colour so the patch blends into the card.
 * `style` always wins; the loose `fontSize`/`color`/`bg`/`align` props remain as
 * fallbacks for callers that have no captured style.
 *
 * Brand fallbacks: text near-black #1D1D1F; mono = Commit Mono; mask = white.
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
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  bg?: string;
  align?: "left" | "center" | "right";
  bgInset?: number;
  /**
   * Computed style captured from the real screenshot element. When present, each
   * field overrides its loose-prop equivalent so the rolling number matches the
   * card exactly. `background` is the mask colour painted behind the digits.
   */
  style?: {
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: number | string;
    color?: string;
    letterSpacing?: string;
    textAlign?: "left" | "right" | "center";
    background?: string;
  };
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
  style,
}) => {
  const frame = useCurrentFrame();

  // Captured style wins over the loose props; loose props are the fallback.
  const resolvedFontFamily = style?.fontFamily ?? monoFont;
  const resolvedFontSize = style?.fontSize ?? fontSize ?? 38;
  const resolvedFontWeight = style?.fontWeight ?? fontWeight;
  const resolvedColor = style?.color ?? color;
  const resolvedLetterSpacing = style?.letterSpacing;
  const resolvedAlign = style?.textAlign ?? align;
  const resolvedMask = style?.background ?? bg;

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
    resolvedAlign === "left"
      ? "flex-start"
      : resolvedAlign === "right"
        ? "flex-end"
        : "center";

  return (
    <>
      {/* Mask — the card's own background, bled out by bgInset on every side so no
          static digit underneath peeks at the edges during the roll. */}
      <div
        style={{
          position: "absolute",
          left: rect.x - bgInset,
          top: rect.y - bgInset,
          width: rect.w + bgInset * 2,
          height: rect.h + bgInset * 2,
          background: resolvedMask,
          pointerEvents: "none",
          zIndex: 8500,
        }}
      />
      {/* Rolling number — at the exact rect so it lands where the screenshot's
          static figure sits, rendered in the screenshot's own glyphs. */}
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
          fontFamily: resolvedFontFamily,
          fontSize: resolvedFontSize,
          fontWeight: resolvedFontWeight,
          letterSpacing: resolvedLetterSpacing,
          fontVariantNumeric: "tabular-nums",
          color: resolvedColor,
          textAlign: resolvedAlign,
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
