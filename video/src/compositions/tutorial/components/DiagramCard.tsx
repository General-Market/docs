/**
 * DiagramCard — Standard wrapper for ALL tutorial graphics.
 *
 * B-roll: single mountain video, CSS-mirrored for symmetry.
 * White/dark card on top. PiP of talking head bottom-right.
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
const PIP_W = 320;
const PIP_H = 240;
const CARD_MARGIN = 56;

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

/**
 * Static mountain background — using Img instead of Video to avoid
 * multi-Video performance issues. We grab a frame from the b-roll
 * and use a subtle CSS animation for movement illusion.
 *
 * If the b-roll image doesn't exist, falls back to a gradient.
 */
const MountainBg: React.FC<{ opacity: number }> = ({ opacity }) => {
  const frame = useCurrentFrame();
  // Slow pan effect via translateX
  const panX = interpolate(frame, [0, 900], [0, -40], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  if (opacity < 0.01) return null;

  return (
    <AbsoluteFill style={{ opacity, background: "#1a2e1a" }}>
      {/* Gradient fallback that always works */}
      <AbsoluteFill
        style={{
          background: "linear-gradient(135deg, #1a3a2a 0%, #0d1f15 40%, #1a2e1a 70%, #0a1a0f 100%)",
        }}
      />
      {/* Try to load b-roll as static image — if it fails, gradient shows */}
      <AbsoluteFill style={{ overflow: "hidden" }}>
        <Img
          src={staticFile("broll/mountains-aerial.mp4")}
          style={{
            width: "110%",
            height: "110%",
            objectFit: "cover",
            filter: "brightness(0.65) saturate(0.4)",
            transform: `translateX(${panX}px)`,
          }}
          onError={() => {}}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** PiP of talking head — Wise-style square card, bottom right */
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
        background: "#000",
      }}
    >
      {/* Placeholder — the actual talking head video plays underneath in TutorialVideo.tsx */}
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(255,255,255,0.3)",
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        LIVE
      </div>
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
      {/* Dark nature-toned background */}
      <AbsoluteFill
        style={{
          background: "linear-gradient(135deg, #1a3a2a 0%, #0d1f15 40%, #1a2e1a 70%, #0a1a0f 100%)",
          opacity: bgOpacity,
        }}
      />

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
      <AbsoluteFill
        style={{
          background: "linear-gradient(135deg, #1a3a2a 0%, #0d1f15 40%, #1a2e1a 70%, #0a1a0f 100%)",
          opacity: bgOpacity,
        }}
      />

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
