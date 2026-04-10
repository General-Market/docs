/**
 * DiagramCard — Standard wrapper for ALL graphics.
 *
 * Full-screen white card on snow mountain b-roll.
 * NO talking head visible. B-roll covers everything.
 * Card has generous margins. Clean, bold, Wise.
 */

import React from "react";
import {
  AbsoluteFill,
  Easing,
  Video,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { PANEL } from "../designTokens";

const EASE_OUT_EXPO = Easing.bezier(0.16, 1, 0.3, 1);
const ENTER_FRAMES = 16;

interface DiagramCardProps {
  children: React.ReactNode;
  padding?: string;
}

function useEntrance() {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [0, ENTER_FRAMES], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE_OUT_EXPO,
  });
  return {
    opacity: p,
    y: interpolate(p, [0, 1], [24, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    scale: interpolate(p, [0, 1], [0.97, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    blur: interpolate(p, [0, 1], [3, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    bgOpacity: interpolate(frame, [0, 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_OUT_EXPO }),
  };
}

const BROLL_SRC = "broll/mountains-aerial.mp4";

export const DiagramCard: React.FC<DiagramCardProps> = ({
  children,
  padding = "64px 80px",
}) => {
  const { opacity, y, scale, blur, bgOpacity } = useEntrance();

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* Full-screen b-roll — completely covers the talking head */}
      <AbsoluteFill style={{ opacity: bgOpacity }}>
        <Video
          src={staticFile(BROLL_SRC)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "brightness(0.85) saturate(0.6)",
          }}
          loop
          playbackRate={0.25}
          muted
        />
      </AbsoluteFill>

      {/* Full-screen white card with generous margins */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 48px",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            background: PANEL.white.background,
            borderRadius: PANEL.white.borderRadius,
            border: PANEL.white.border,
            boxShadow: PANEL.white.boxShadow,
            padding,
            opacity,
            transform: `translateY(${y}px) scale(${scale})`,
            filter: blur > 0.05 ? `blur(${blur}px)` : "none",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          {children}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const DiagramCardDark: React.FC<DiagramCardProps> = ({
  children,
  padding = "64px 80px",
}) => {
  const { opacity, y, scale, blur, bgOpacity } = useEntrance();

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ opacity: bgOpacity }}>
        <Video
          src={staticFile(BROLL_SRC)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "brightness(0.85) saturate(0.6)",
          }}
          loop
          playbackRate={0.25}
          muted
        />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 48px",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            background: PANEL.dark.background,
            borderRadius: PANEL.dark.borderRadius,
            border: PANEL.dark.border,
            boxShadow: "rgba(14,15,12,0.12) 0px 0px 0px 1px",
            padding,
            opacity,
            transform: `translateY(${y}px) scale(${scale})`,
            filter: blur > 0.05 ? `blur(${blur}px)` : "none",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          {children}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
