/**
 * EndScreen — Final closing card.
 *
 * Green-tinted mountain footage fills the frame with a dark overlay.
 * Centered GM logo + "General Market" label.
 *
 * Appears after the preceding content grows and fades out.
 * Accepts `progress` (0 → 1) for its own entrance: background fades in,
 * logo grows and settles into place.
 */

import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  Video,
  interpolate,
  staticFile,
} from "remotion";
import { FONT } from "../tutorial/designTokens";

const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);

export const EndScreen: React.FC<{
  /** 0 = hidden, 1 = fully visible */
  progress?: number;
}> = ({ progress = 1 }) => {
  const bgOpacity = interpolate(progress, [0, 0.5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE_OUT,
  });

  const logoEntrance = interpolate(progress, [0.3, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE_OUT,
  });

  const logoScale = interpolate(logoEntrance, [0, 1], [0.7, 1]);
  const logoOpacity = logoEntrance;

  return (
    <AbsoluteFill style={{ background: "#0a1a0a", opacity: bgOpacity }}>
      {/* Background footage — green tinted */}
      <AbsoluteFill>
        <Video
          src={staticFile("broll/mountains-aerial.mp4")}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "saturate(0) brightness(0.55) contrast(1.2)",
          }}
          loop
          volume={0}
          playbackRate={0.25}
        />
      </AbsoluteFill>

      {/* Green color overlay — duotone effect */}
      <AbsoluteFill
        style={{
          background: "rgba(30, 80, 40, 0.55)",
          mixBlendMode: "multiply",
        }}
      />

      {/* Additional green tint on top */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(0,25,5,0.25) 0%, rgba(0,15,3,0.45) 100%)",
        }}
      />

      {/* Subtle vignette */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.6) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Centered logo + text */}
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 28,
          opacity: logoOpacity,
          transform: `scale(${logoScale})`,
        }}
      >
        {/* Logo in a green-tinted circular badge */}
        <div
          style={{
            width: 156,
            height: 156,
            borderRadius: "50%",
            background: "rgba(159, 232, 112, 0.18)",
            border: "2px solid rgba(159, 232, 112, 0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 40px rgba(159, 232, 112, 0.25)",
          }}
        >
          <Img
            src={staticFile("gm-logo.svg")}
            style={{ width: 96, height: 96 }}
          />
        </div>

        <span
          style={{
            fontFamily: FONT.display,
            fontSize: 88,
            fontWeight: 800,
            color: "#ffffff",
            letterSpacing: "-0.02em",
            lineHeight: 1,
            textShadow: "0 2px 24px rgba(0,0,0,0.6)",
          }}
        >
          General Market
        </span>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
