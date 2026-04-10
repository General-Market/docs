/**
 * DiagramCard — Standard wrapper for ALL tutorial graphics.
 *
 * B-roll: mountain video split at center and mirrored (symmetrical).
 * White/dark card on top. PiP of talking head in bottom-right.
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
const PIP_SIZE = 180;
const BROLL_SRC = "broll/mountains-aerial.mp4";
const MAIN_VIDEO = "tutorial-raw.mp4";
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
 * Symmetrical mountain b-roll — video split at center, right half mirrored.
 * Creates a kaleidoscope/nature-symmetry effect.
 */
const SymmetricBroll: React.FC<{ opacity: number }> = ({ opacity }) => {
  if (opacity < 0.01) return null;

  const videoStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    filter: "brightness(0.7) saturate(0.5)",
  };

  return (
    <AbsoluteFill style={{ opacity }}>
      {/* Left half — normal */}
      <div style={{ position: "absolute", left: 0, top: 0, width: "50%", height: "100%", overflow: "hidden" }}>
        <Video
          src={staticFile(BROLL_SRC)}
          style={{ ...videoStyle, width: "200%", marginLeft: 0 }}
          loop
          playbackRate={0.25}
          muted
        />
      </div>
      {/* Right half — mirrored */}
      <div style={{ position: "absolute", right: 0, top: 0, width: "50%", height: "100%", overflow: "hidden", transform: "scaleX(-1)" }}>
        <Video
          src={staticFile(BROLL_SRC)}
          style={{ ...videoStyle, width: "200%", marginLeft: 0 }}
          loop
          playbackRate={0.25}
          muted
        />
      </div>
    </AbsoluteFill>
  );
};

/** Small circular PiP of the talking head — bottom right */
const TalkingHeadPip: React.FC<{ opacity: number }> = ({ opacity }) => {
  if (opacity < 0.01) return null;
  return (
    <div
      style={{
        position: "absolute",
        bottom: CARD_MARGIN + 8,
        right: CARD_MARGIN + 8,
        width: PIP_SIZE,
        height: PIP_SIZE,
        borderRadius: "50%",
        overflow: "hidden",
        border: "3px solid rgba(255,255,255,0.9)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
        opacity,
        zIndex: 10,
      }}
    >
      <Video
        src={staticFile(MAIN_VIDEO)}
        style={{
          width: PIP_SIZE * 2.5,
          height: PIP_SIZE * 2.5,
          objectFit: "cover",
          marginLeft: -PIP_SIZE * 0.75,
          marginTop: -PIP_SIZE * 0.3,
        }}
        muted
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
      <SymmetricBroll opacity={bgOpacity} />

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
      <SymmetricBroll opacity={bgOpacity} />

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
