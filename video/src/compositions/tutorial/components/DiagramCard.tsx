/**
 * DiagramCard — shared wrapper for all tutorial diagrams.
 *
 * Backdrop: real mountain/glacier b-roll video (blurred, slow-mo) replaces
 * the talking head. Vertical strips of source brand videos scroll on sides.
 * Clean card floats in the center.
 *
 * Entrance matches frontend /source/ cascade:
 *   translateY(18px) + scale(0.95) + blur(2px) → resolved
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
import { TYPE, PANEL } from "../designTokens";

const EASE_OUT_EXPO = Easing.bezier(0.16, 1, 0.3, 1);
const ENTER_FRAMES = 16;

interface DiagramCardProps {
  children: React.ReactNode;
  width?: number;
  minHeight?: number;
  maxHeight?: number;
  padding?: string;
  backdrop?: boolean;
  position?: "center" | "bottom";
  stagger?: number;
  /** Which b-roll to use: "mountains" (default) or "glacier" */
  broll?: "mountains" | "glacier";
}

function useCardEntrance(stagger = 0) {
  const frame = useCurrentFrame();
  const local = Math.max(frame - stagger, 0);

  const progress = interpolate(local, [0, ENTER_FRAMES], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE_OUT_EXPO,
  });

  return {
    opacity: progress,
    translateY: interpolate(progress, [0, 1], [18, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
    scale: interpolate(progress, [0, 1], [0.95, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
    blur: interpolate(progress, [0, 1], [2, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
    backdropOpacity: interpolate(local, [0, 10], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: EASE_OUT_EXPO,
    }),
  };
}

// ── B-Roll Video Backdrop ───────────────────────────────────────────────────
// Real mountain/glacier footage behind the card, slowed down, blurred, darkened.

const BROLL_FILES = {
  mountains: "broll/mountains-aerial.mp4",
  glacier: "broll/glacier-drone.mp4",
};

const BRollBackdrop: React.FC<{
  opacity: number;
  broll: "mountains" | "glacier";
}> = ({ opacity, broll }) => {
  if (opacity < 0.01) return null;

  return (
    <AbsoluteFill style={{ opacity }}>
      {/* B-roll video — fills screen, blurred, darkened */}
      <AbsoluteFill>
        <Video
          src={staticFile(BROLL_FILES[broll])}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "blur(8px) brightness(0.4)",
          }}
          loop
          playbackRate={0.5}
          muted
        />
      </AbsoluteFill>

      {/* Extra dark overlay for contrast */}
      <AbsoluteFill
        style={{ backgroundColor: "rgba(0, 0, 0, 0.25)" }}
      />
    </AbsoluteFill>
  );
};

// ── Vertical B-Roll Strips ──────────────────────────────────────────────────
// Source brand color blocks scrolling vertically on sides (parallax).

const BRAND_COLORS = [
  "#EC0016", "#9146FF", "#1B2838", "#FF6B35", "#9fe870", "#2563EB",
  "#F59E0B", "#d03238", "#6366F1", "#0EA5E9", "#84CC16", "#EC4899",
];
const BRAND_LABELS = [
  "DB", "twitch", "STEAM", "pump.fun", "GM", "flights",
  "weather", "sports", "defi", "ocean", "nature", "social",
];

const STRIP_H = 140;
const STRIP_GAP = 8;
const STRIP_W = 160;

const BRollStrips: React.FC<{ speed?: number }> = ({ speed = 0.8 }) => {
  const frame = useCurrentFrame();
  const scrollY = frame * speed;
  const setHeight = BRAND_COLORS.length * (STRIP_H + STRIP_GAP);
  const colors = [...BRAND_COLORS, ...BRAND_COLORS];
  const labels = [...BRAND_LABELS, ...BRAND_LABELS];

  const renderStrip = (side: "left" | "right", offset: number) => {
    const dir = side === "left" ? 1 : -1;
    const y = (scrollY * dir + offset + setHeight * 2) % setHeight;

    return (
      <div
        style={{
          position: "absolute",
          [side]: 0,
          top: 0,
          width: STRIP_W,
          height: "100%",
          overflow: "hidden",
          opacity: 0.35,
        }}
      >
        <div
          style={{
            transform: `translateY(${-y}px)`,
            display: "flex",
            flexDirection: "column",
            gap: STRIP_GAP,
          }}
        >
          {colors.map((color, i) => (
            <div
              key={`${side}-${i}`}
              style={{
                width: STRIP_W,
                height: STRIP_H,
                background: color,
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontFamily: TYPE.subHeadingDark.fontFamily,
                  fontSize: 22,
                  fontWeight: 800,
                  color: "#fff",
                  opacity: 0.85,
                }}
              >
                {labels[i]}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      {renderStrip("left", 0)}
      {renderStrip("right", setHeight * 0.4)}
    </>
  );
};

// ── White Card ──────────────────────────────────────────────────────────────

export const DiagramCard: React.FC<DiagramCardProps> = ({
  children,
  width = 1400,
  minHeight,
  maxHeight,
  padding = "40px 48px",
  backdrop = true,
  position = "center",
  stagger = 0,
  broll = "mountains",
}) => {
  const { opacity, translateY, scale, blur, backdropOpacity } =
    useCardEntrance(stagger);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {backdrop && <BRollBackdrop opacity={backdropOpacity} broll={broll} />}
      {backdrop && <BRollStrips />}

      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: position === "center" ? "center" : "flex-end",
          justifyContent: "center",
          padding: position === "bottom" ? "0 0 40px 0" : 0,
        }}
      >
        <div
          style={{
            width,
            minHeight,
            maxHeight,
            background: PANEL.white.background,
            borderRadius: PANEL.white.borderRadius,
            border: PANEL.white.border,
            boxShadow: PANEL.white.boxShadow,
            padding,
            opacity,
            transform: `translateY(${translateY}px) scale(${scale})`,
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

// ── Dark Card ───────────────────────────────────────────────────────────────

export const DiagramCardDark: React.FC<DiagramCardProps> = ({
  children,
  width = 1400,
  minHeight,
  maxHeight,
  padding = "40px 48px",
  backdrop = true,
  position = "center",
  stagger = 0,
  broll = "mountains",
}) => {
  const { opacity, translateY, scale, blur, backdropOpacity } =
    useCardEntrance(stagger);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {backdrop && <BRollBackdrop opacity={backdropOpacity} broll={broll} />}
      {backdrop && <BRollStrips />}

      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: position === "center" ? "center" : "flex-end",
          justifyContent: "center",
          padding: position === "bottom" ? "0 0 40px 0" : 0,
        }}
      >
        <div
          style={{
            width,
            minHeight,
            maxHeight,
            background: PANEL.dark.background,
            borderRadius: PANEL.dark.borderRadius,
            border: PANEL.dark.border,
            boxShadow: "rgba(14,15,12,0.12) 0px 0px 0px 1px",
            padding,
            opacity,
            transform: `translateY(${translateY}px) scale(${scale})`,
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
