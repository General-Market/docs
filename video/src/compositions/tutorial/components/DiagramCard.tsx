/**
 * DiagramCard — Standard wrapper for ALL tutorial graphics.
 *
 * Mountain b-roll video behind everything. White/dark card on top.
 * PiP of talking head bottom-right.
 */

import React from "react";
import {
  AbsoluteFill,
  Easing,
  OffthreadVideo,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { PANEL } from "../designTokens";

const EASE_OUT_EXPO = Easing.bezier(0.16, 1, 0.3, 1);
const ENTER_FRAMES = 16;
const PIP_W = 320;
const PIP_H = 240;
const CARD_MARGIN = 84;
const BROLL_SRC = "broll/mountains-aerial.mp4";
const MAIN_VIDEO = "tutorial-raw.mp4";

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

/** PiP of talking head — Wise-style square card */
const TalkingHeadPip: React.FC<{ opacity: number }> = ({ opacity }) => {
  if (opacity < 0.01) return null;
  return (
    <div
      style={{
        position: "absolute",
        bottom: CARD_MARGIN + 12,
        right: CARD_MARGIN + 12,
        width: PIP_W,
        height: PIP_H,
        borderRadius: 20,
        overflow: "hidden",
        border: "2px solid rgba(14,15,12,0.12)",
        boxShadow: "rgba(14,15,12,0.12) 0px 0px 0px 1px, 0 8px 24px rgba(0,0,0,0.2)",
        opacity,
        zIndex: 10,
      }}
    >
      <OffthreadVideo
        src={staticFile(MAIN_VIDEO)}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
        volume={0}
      />
    </div>
  );
};

export const DiagramCard: React.FC<DiagramCardProps> = ({
  children,
  padding = "56px 72px",
}) => {
  const { opacity, y, scale, blur, bgOpacity } = useEntrance();

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* Mountain b-roll — full screen behind card */}
      <AbsoluteFill style={{ opacity: bgOpacity }}>
        <OffthreadVideo
          src={staticFile(BROLL_SRC)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "brightness(0.7) saturate(0.5)",
          }}
          volume={0}
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

      {/* PiP — talking head bottom right */}
      <TalkingHeadPip opacity={bgOpacity} />
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
        <OffthreadVideo
          src={staticFile(BROLL_SRC)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "brightness(0.7) saturate(0.5)",
          }}
          volume={0}
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

      <TalkingHeadPip opacity={bgOpacity} />
    </AbsoluteFill>
  );
};
