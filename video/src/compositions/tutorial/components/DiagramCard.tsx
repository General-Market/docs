/**
 * DiagramCard — Wise design system.
 *
 * Layout: mountain video strips on LEFT and RIGHT sides (mirrored parallax),
 * white/dark card floating in the CENTER. B-roll behind everything.
 *
 * Ring shadow only. 30px radius. Cascade entrance.
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
const STRIP_W = 220; // width of each side video strip

interface DiagramCardProps {
  children: React.ReactNode;
  width?: number;
  padding?: string;
  position?: "center" | "bottom";
  broll?: "mountains" | "glacier";
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

const BROLL = {
  mountains: "broll/mountains-aerial.mp4",
  glacier: "broll/glacier-drone.mp4",
};

/**
 * Vertical mountain video strips on both sides — mirrored.
 * Left strip: mountain video scrolling slowly downward.
 * Right strip: same video, mirrored (scaleX: -1), scrolling upward.
 * Creates a parallax frame around the central card.
 */
const MountainStrips: React.FC<{ opacity: number; broll: "mountains" | "glacier" }> = ({
  opacity,
  broll,
}) => {
  if (opacity < 0.01) return null;

  const videoStyle: React.CSSProperties = {
    width: "100%",
    height: "200%", // oversized to allow vertical scroll via objectPosition
    objectFit: "cover",
    filter: "brightness(0.55) saturate(0.8)",
  };

  return (
    <>
      {/* Left strip */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: STRIP_W,
          height: "100%",
          overflow: "hidden",
          opacity: opacity * 0.7,
          borderRight: "1px solid rgba(14,15,12,0.08)",
        }}
      >
        <Video
          src={staticFile(BROLL[broll])}
          style={videoStyle}
          loop
          playbackRate={0.3}
          muted
        />
      </div>

      {/* Right strip — mirrored */}
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          width: STRIP_W,
          height: "100%",
          overflow: "hidden",
          opacity: opacity * 0.7,
          borderLeft: "1px solid rgba(14,15,12,0.08)",
          transform: "scaleX(-1)", // mirror
        }}
      >
        <Video
          src={staticFile(BROLL[broll])}
          style={videoStyle}
          loop
          playbackRate={0.3}
          muted
        />
      </div>
    </>
  );
};

export const DiagramCard: React.FC<DiagramCardProps> = ({
  children,
  width = 1200,
  padding = PANEL.white.padding,
  position = "center",
  broll = "mountains",
}) => {
  const { opacity, y, scale, blur, bgOpacity } = useEntrance();

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* Dark backdrop behind everything */}
      <AbsoluteFill
        style={{
          backgroundColor: "rgba(14, 15, 12, 0.5)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          opacity: bgOpacity,
        }}
      />

      {/* Mountain video strips on sides */}
      <MountainStrips opacity={bgOpacity} broll={broll} />

      {/* Central card */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: position === "center" ? "center" : "flex-end",
          justifyContent: "center",
          padding: position === "bottom" ? "0 0 48px 0" : 0,
          // Inset the card between the strips
          paddingLeft: STRIP_W + 24,
          paddingRight: STRIP_W + 24,
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
  width = 1200,
  padding = PANEL.dark.padding,
  position = "center",
  broll = "mountains",
}) => {
  const { opacity, y, scale, blur, bgOpacity } = useEntrance();

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill
        style={{
          backgroundColor: "rgba(14, 15, 12, 0.5)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          opacity: bgOpacity,
        }}
      />

      <MountainStrips opacity={bgOpacity} broll={broll} />

      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: position === "center" ? "center" : "flex-end",
          justifyContent: "center",
          padding: position === "bottom" ? "0 0 48px 0" : 0,
          paddingLeft: STRIP_W + 24,
          paddingRight: STRIP_W + 24,
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
