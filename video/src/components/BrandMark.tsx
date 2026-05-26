import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";

type Surface = "dark" | "light";

const WORDMARK_FONT =
  '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Inter, sans-serif';

/**
 * The GeneralMarket corner mark — the same rounded-square + pill that sits
 * top-left on generalmarket.io. The icon is two-tone and opaque, so it reads on
 * any background: pass `surface` = the colour it sits on.
 *
 *   surface="dark"  → white box, dark pill (the inverted app icon)
 *   surface="light" → near-black box, white pill (the app icon as shipped)
 *
 * It sizes itself from the frame width, so one mark fits every format, and it
 * stays out of the way — small, top-left, non-interactive, painted above
 * everything in its parent.
 */
export const BrandMark: React.FC<{
  surface?: Surface;
  showWordmark?: boolean;
  opacity?: number;
}> = ({ surface = "dark", showWordmark = false, opacity = 0.9 }) => {
  const { width } = useVideoConfig();
  const box = Math.round(width * 0.03); // ~58px at 1920
  const margin = Math.round(width * 0.026); // ~50px
  const ink = surface === "dark" ? "#FFFFFF" : "#1D1D1F";
  const pill = surface === "dark" ? "#1D1D1F" : "#FFFFFF";

  return (
    <AbsoluteFill style={{ pointerEvents: "none", zIndex: 200 }}>
      <div
        style={{
          position: "absolute",
          top: margin,
          left: margin,
          display: "flex",
          alignItems: "center",
          gap: Math.round(box * 0.34),
          opacity,
        }}
      >
        <div
          style={{
            width: box,
            height: box,
            borderRadius: box * 0.226,
            background: ink,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: box * 0.5,
              height: Math.max(2, box * 0.105),
              borderRadius: box * 0.0525,
              background: pill,
            }}
          />
        </div>
        {showWordmark && (
          <span
            style={{
              fontFamily: WORDMARK_FONT,
              fontSize: Math.round(box * 0.7),
              fontWeight: 600,
              letterSpacing: "-0.022em",
              color: ink,
              lineHeight: 1,
            }}
          >
            general
          </span>
        )}
      </div>
    </AbsoluteFill>
  );
};
