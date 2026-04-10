/**
 * DiagramCard — Wise design system.
 *
 * Mountain video strips on sides (mirrored). Card fills the center.
 * Ring shadow. 30px radius. Cascade entrance.
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
const STRIP_W = 180;

interface DiagramCardProps {
  children: React.ReactNode;
  width?: number;
  padding?: string;
  position?: "center" | "bottom";
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
    y: interpolate(p, [0, 1], [18, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    scale: interpolate(p, [0, 1], [0.95, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    blur: interpolate(p, [0, 1], [2, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    bgOpacity: interpolate(frame, [0, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_OUT_EXPO }),
  };
}

const BROLL_SRC = "broll/mountains-aerial.mp4";

/** Snow mountain video strips on left and right — mirrored for parallax. */
const MountainStrips: React.FC<{ opacity: number }> = ({ opacity }) => {
  if (opacity < 0.01) return null;

  const style: React.CSSProperties = {
    width: "100%",
    height: "120%",
    objectFit: "cover",
    filter: "brightness(0.5) saturate(0.7)",
  };

  return (
    <>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: STRIP_W,
          height: "100%",
          overflow: "hidden",
          opacity: opacity * 0.8,
        }}
      >
        <Video src={staticFile(BROLL_SRC)} style={style} loop playbackRate={0.25} muted />
      </div>
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          width: STRIP_W,
          height: "100%",
          overflow: "hidden",
          opacity: opacity * 0.8,
          transform: "scaleX(-1)",
        }}
      >
        <Video src={staticFile(BROLL_SRC)} style={style} loop playbackRate={0.25} muted />
      </div>
    </>
  );
};

// Card fills available space between the strips
const CARD_MAX_W = 1920 - STRIP_W * 2 - 48; // 1920 - 360 - 48 = 1512

export const DiagramCard: React.FC<DiagramCardProps> = ({
  children,
  width = CARD_MAX_W,
  padding = "48px 56px",
  position = "center",
}) => {
  const { opacity, y, scale, blur, bgOpacity } = useEntrance();

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* Dark backdrop blur */}
      <AbsoluteFill
        style={{
          backgroundColor: "rgba(14, 15, 12, 0.55)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          opacity: bgOpacity,
        }}
      />

      {/* Mountain strips on sides */}
      <MountainStrips opacity={bgOpacity} />

      {/* Card — fills between strips */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: position === "center" ? "center" : "flex-end",
          justifyContent: "center",
          paddingLeft: STRIP_W + 24,
          paddingRight: STRIP_W + 24,
          paddingBottom: position === "bottom" ? 48 : 0,
        }}
      >
        <div
          style={{
            width,
            maxWidth: "100%",
            background: PANEL.white.background,
            borderRadius: PANEL.white.borderRadius,
            border: PANEL.white.border,
            boxShadow: PANEL.white.boxShadow,
            padding,
            opacity,
            transform: `translateY(${y}px) scale(${scale})`,
            filter: blur > 0.05 ? `blur(${blur}px)` : "none",
            overflow: "hidden",
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
  width = CARD_MAX_W,
  padding = "48px 56px",
  position = "center",
}) => {
  const { opacity, y, scale, blur, bgOpacity } = useEntrance();

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill
        style={{
          backgroundColor: "rgba(14, 15, 12, 0.55)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          opacity: bgOpacity,
        }}
      />

      <MountainStrips opacity={bgOpacity} />

      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: position === "center" ? "center" : "flex-end",
          justifyContent: "center",
          paddingLeft: STRIP_W + 24,
          paddingRight: STRIP_W + 24,
          paddingBottom: position === "bottom" ? 48 : 0,
        }}
      >
        <div
          style={{
            width,
            maxWidth: "100%",
            background: PANEL.dark.background,
            borderRadius: PANEL.dark.borderRadius,
            border: PANEL.dark.border,
            boxShadow: "rgba(14,15,12,0.12) 0px 0px 0px 1px",
            padding,
            opacity,
            transform: `translateY(${y}px) scale(${scale})`,
            filter: blur > 0.05 ? `blur(${blur}px)` : "none",
            overflow: "hidden",
          }}
        >
          {children}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
