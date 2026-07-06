// Faithful port of the Aaron Iker / Adam Argyle pastel shimmer button.
// Locked into the active/hover state for the whole scene so the conic
// shimmer arc rotates continuously (one rotation per second) and the
// text shine wash sweeps on a 0.66s loop.
//
// Tradeoff: the original sets the text's background-color to var(--bg)
// which is undefined and falls back to transparent — meaning the text
// only shows when the shine wash passes. On a video that flickers
// unreadably, so we tint the base fill a faint pink (#ffd4ee at ~35%)
// so the kana stay legible while the brighter wash still reads as a
// sweep across them. The shine geometry, timing, and gradient stops
// are otherwise unchanged from the source CSS.

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";

const BG_GRADIENT =
  "radial-gradient(circle at 50% 0%, rgb(67,54,74) 16.4%, rgb(47,48,67) 68.2%, rgb(27,23,36) 99.1%)";

const GLOW_HUE = 222;
const SHADOW_HUE = 180;

// Original CSS: animation: shimmer 1s linear infinite.
const SHIMMER_PERIOD_S = 1.0;
// Original CSS text-shine: 0.66s loop.
const SHINE_PERIOD_S = 0.66;

export const ShimmerButton: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;

  // Conic gradient mask rotates one full turn per second.
  const shimmerAngle = ((t / SHIMMER_PERIOD_S) * 360) % 360;

  // Shine wash slides background-position from 100% to -100% over 0.66s.
  const shinePhase = (t % SHINE_PERIOD_S) / SHINE_PERIOD_S;
  const textBgPos = interpolate(shinePhase, [0, 1], [100, -100]);

  // Entrance + exit fades.
  const enter = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });
  const exit = interpolate(
    frame,
    [durationInFrames - 20, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Geometry. CSS uses --inset:40px on a ~1em-padded button. We scale
  // up roughly 6x so the kana read at 1080p.
  const INSET = 40; // px — matches CSS --inset
  const FONT_SIZE = 96;
  const BUTTON_BG =
    "linear-gradient(315deg, #ffc4ec -10%, #efdbfd 50%, #ffedd6 110%)";

  // Shine wash gradient — verbatim from the CSS.
  const shineImage =
    `linear-gradient(120deg, ` +
    `transparent, ` +
    `hsla(${GLOW_HUE},100%,80%,0.66) 40%, ` +
    `hsla(${GLOW_HUE},100%,90%,.9) 50%, ` +
    `transparent 52%)`;

  // Conic mask — verbatim from the CSS, with frame-driven `from` angle.
  const conicMask =
    `conic-gradient(from ${shimmerAngle}deg, ` +
    `transparent 0%, transparent 20%, ` +
    `black 36%, black 45%, ` +
    `transparent 50%, transparent 70%, ` +
    `black 85%, black 95%, ` +
    `transparent 100%)`;

  return (
    <AbsoluteFill
      style={{
        background: BG_GRADIENT,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: enter * exit,
      }}
    >
      {/* The button. scale:1.2 is the locked active state. */}
      <div
        style={{
          position: "relative",
          isolation: "isolate",
          transform: "scale(1.2)",
          padding: "0.8em 1.4em",
          fontSize: FONT_SIZE,
          fontWeight: 600,
          fontFamily:
            "'SF Pro Display', 'Inter', 'Helvetica Neue', sans-serif",
          borderRadius: "0.66em",
          backgroundImage: BUTTON_BG,
          boxShadow:
            `0 2px 3px 1px hsl(${GLOW_HUE} 50% 20% / 50%), ` +
            `inset 0 -10px 20px -10px hsla(${SHADOW_HUE},10%,90%,95%)`,
          color: "transparent",
        }}
      >
        {/* Text with shine wash. Base fill is a faint pink so it stays
            readable — see header comment. */}
        <span
          style={{
            position: "relative",
            zIndex: 3,
            display: "inline-block",
            color: "transparent",
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundColor: "#ffd4ee59",
            backgroundImage: shineImage,
            backgroundRepeat: "no-repeat",
            backgroundSize: "300% 300%",
            backgroundPosition: `${textBgPos}% center`,
          }}
        >
          きみのてできりさいて
        </span>

        {/* Shimmer arc — conic-masked plus-lighter pane.
            The mask carves the rotating arc; the body of the pane is a
            bright halo that the mask reveals. */}
        <div
          style={{
            position: "absolute",
            inset: -INSET,
            borderRadius: "inherit",
            pointerEvents: "none",
            mixBlendMode: "plus-lighter",
            WebkitMaskImage: conicMask,
            maskImage: conicMask,
            // Pane body — a soft blue-white that the conic mask shapes
            // into the rotating arc.
            background: `radial-gradient(closest-side, hsl(${GLOW_HUE} 100% 85% / 0.95), hsl(${GLOW_HUE} 100% 70% / 0.55) 60%, transparent 80%)`,
            boxShadow: `inset 0 0 60px 12px hsl(${GLOW_HUE} 100% 75% / 0.9)`,
          }}
        />

        {/* Outer halo — mirrors .shimmer::before */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "inherit",
            pointerEvents: "none",
            zIndex: -1,
            boxShadow:
              `0 0 4px 2px hsl(${GLOW_HUE} 20% 95%), ` +
              `0 0 7.2px 4px hsl(${GLOW_HUE} 20% 80%), ` +
              `0 0 13.2px 4px hsl(${GLOW_HUE} 50% 70%), ` +
              `0 0 26.4px 5px hsl(${GLOW_HUE} 100% 70%)`,
          }}
        />

        {/* Inner ring — mirrors .shimmer::after */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "inherit",
            pointerEvents: "none",
            zIndex: 2,
            boxShadow:
              `inset 0 0 0 1px hsl(${GLOW_HUE} 70% 95%), ` +
              `inset 0 0 2px 1px hsl(${GLOW_HUE} 100% 80%), ` +
              `inset 0 0 5px 2px hsl(${GLOW_HUE} 100% 70%)`,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
