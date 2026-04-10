/**
 * DiagramCard — Standard wrapper for ALL tutorial graphics.
 *
 * Static mountain image background (instant load, no video decode).
 * White/dark card on top. No PiP (was causing load times).
 */

import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { PANEL } from "../designTokens";

const EASE_OUT_EXPO = Easing.bezier(0.16, 1, 0.3, 1);
const ENTER_FRAMES = 16;
const CARD_MARGIN = 84;
const BROLL_IMG = "broll/mountains-frame.jpg";

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

export const DiagramCard: React.FC<DiagramCardProps> = ({
  children,
  padding = "56px 72px",
}) => {
  const { opacity, y, scale, blur, bgOpacity } = useEntrance();

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* Mountain background — static image, instant */}
      <AbsoluteFill style={{ opacity: bgOpacity }}>
        <Img
          src={staticFile(BROLL_IMG)}
          style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.7) saturate(0.5)" }}
        />
      </AbsoluteFill>

      {/* White card */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: CARD_MARGIN,
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
  padding = "56px 72px",
}) => {
  const { opacity, y, scale, blur, bgOpacity } = useEntrance();

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ opacity: bgOpacity }}>
        <Img
          src={staticFile(BROLL_IMG)}
          style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.7) saturate(0.5)" }}
        />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: CARD_MARGIN,
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
