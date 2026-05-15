import React from "react";
import { AbsoluteFill, Easing, interpolate, staticFile } from "remotion";

export type EndCardProps = {
  /** 0..1 — 0 = fully hidden, 1 = fully revealed. */
  progress: number;
};

const DISPLAY_STACK =
  '"SF Pro Display", -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif';
const TEXT_STACK =
  '"SF Pro Text", -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif';

const EASE_OUT = Easing.bezier(0.25, 0.1, 0.3, 1);

export const EndCard: React.FC<EndCardProps> = ({ progress }) => {
  const clamped = Math.max(0, Math.min(1, progress));

  const bgOpacity = interpolate(clamped, [0, 0.3], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const reveal = interpolate(clamped, [0, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE_OUT,
  });

  const logoScale = interpolate(reveal, [0, 1], [0.85, 1]);

  // Skip rendering entirely until the crossfade actually begins. The
  // outer wrapper otherwise covers the lavender stage with a black
  // fill, blanking every preceding beat.
  if (clamped <= 0) return null;

  return (
    <AbsoluteFill style={{ opacity: clamped, pointerEvents: "none" }}>
      <AbsoluteFill style={{ background: "#000000" }} />
      {/* Radial deep-purple background, fades in first */}
      <AbsoluteFill
        style={{
          opacity: bgOpacity,
          background:
            "radial-gradient(ellipse at center, #1a0d2e 0%, #0a0517 75%)",
        }}
      />

      {/* Centered stack: logo, wordmark, tagline */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: reveal,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 48,
          }}
        >
          {/* Logo with soft purple glow */}
          <div
            style={{
              width: 320,
              height: 320,
              position: "relative",
              transform: `scale(${logoScale})`,
              willChange: "transform",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: -40,
                borderRadius: "50%",
                background:
                  "radial-gradient(circle, rgba(149,93,255,0.45) 0%, rgba(149,93,255,0) 65%)",
                filter: "blur(20px)",
              }}
            />
            <img
              src={staticFile("gm-logo-white.svg")}
              alt=""
              style={{
                position: "relative",
                width: 320,
                height: 320,
                display: "block",
              }}
            />
          </div>

          {/* Wordmark */}
          <div
            style={{
              fontFamily: DISPLAY_STACK,
              fontSize: 64,
              fontWeight: 700,
              letterSpacing: "-0.022em",
              color: "#FFFFFF",
              lineHeight: 1,
            }}
          >
            GENERALMARKET.IO
          </div>

          {/* Tagline */}
          <div
            style={{
              fontFamily: TEXT_STACK,
              fontSize: 20,
              fontWeight: 400,
              letterSpacing: 0,
              color: "#FFFFFF",
              opacity: 0.6,
              lineHeight: 1,
            }}
          >
            /explorer
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
