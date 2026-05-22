import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as loadInterTight } from "@remotion/google-fonts/InterTight";

const { fontFamily: INTER } = loadInterTight("normal", {
  weights: ["400", "500", "600", "700"],
});

const TEXT = "#F5F6F8";
const DIM = "#9095A0";

export type HeaderProps = {
  eyebrow: string;
  date: string;
  hookLine: string;
  underLine: string;
  width: number;
};

export const Header: React.FC<HeaderProps> = ({
  eyebrow,
  date,
  hookLine,
  underLine,
  width,
}) => {
  const frame = useCurrentFrame();
  const config = useVideoConfig();

  const eyebrowEnter = spring({
    frame: frame - 6,
    fps: config.fps,
    config: { damping: 200, mass: 0.7 },
    durationInFrames: 40,
  });
  const eyebrowOpacity = interpolate(eyebrowEnter, [0, 1], [0, 1]);
  const eyebrowLift = interpolate(eyebrowEnter, [0, 1], [40, 0]);

  const hookEnter = spring({
    frame: frame - 22,
    fps: config.fps,
    config: { damping: 200, mass: 0.8 },
    durationInFrames: 56,
  });
  const hookOpacity = interpolate(hookEnter, [0, 1], [0, 1]);
  const hookLift = interpolate(hookEnter, [0, 1], [90, 0]);
  const hookBlur = interpolate(hookEnter, [0, 1], [14, 0]);

  const underEnter = spring({
    frame: frame - 36,
    fps: config.fps,
    config: { damping: 200, mass: 0.7 },
    durationInFrames: 48,
  });
  const underOpacity = interpolate(underEnter, [0, 1], [0, 1]);
  const underLift = interpolate(underEnter, [0, 1], [50, 0]);

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width,
        paddingTop: 160,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 36,
        textAlign: "center",
        fontFamily: INTER,
        color: TEXT,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          opacity: eyebrowOpacity,
          transform: `translateY(${eyebrowLift}px)`,
          display: "flex",
          alignItems: "center",
          gap: 28,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "12px 26px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.06)",
            fontSize: 36,
            fontWeight: 500,
            letterSpacing: "-0.01em",
            color: TEXT,
          }}
        >
          {/* Morpho chevron mark — single blue tile, plain SVG. */}
          <svg width="42" height="42" viewBox="0 0 40 40">
            <rect width="40" height="40" rx="9" fill="#2470FF" />
            <path
              d="M11 27 L11 13 L20 22 L29 13 L29 27"
              stroke="#FFFFFF"
              strokeWidth="3.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
          {eyebrow}
        </div>
        <div
          style={{
            fontSize: 34,
            fontWeight: 400,
            letterSpacing: "0.005em",
            color: DIM,
          }}
        >
          {date}
        </div>
      </div>

      <div
        style={{
          opacity: hookOpacity,
          transform: `translateY(${hookLift}px)`,
          filter: `blur(${hookBlur}px)`,
          fontSize: 168,
          fontWeight: 700,
          letterSpacing: "-0.045em",
          lineHeight: 0.92,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {hookLine}
      </div>

      <div
        style={{
          opacity: underOpacity,
          transform: `translateY(${underLift}px)`,
          fontSize: 50,
          fontWeight: 500,
          letterSpacing: "-0.018em",
          color: DIM,
          lineHeight: 1,
        }}
      >
        {underLine}
      </div>
    </div>
  );
};
