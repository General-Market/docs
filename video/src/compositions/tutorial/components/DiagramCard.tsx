/**
 * DiagramCard — shared wrapper for all tutorial diagrams.
 *
 * Entrance matches the frontend /source/ page cascade:
 *   translateY(18px) + scale(0.95) + blur(2px) → resolved
 *   with ease-out-expo timing (cubic-bezier(0.16, 1, 0.3, 1))
 *
 * Backdrop: video becomes blurred atmosphere. Card floats on top.
 */

import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { COLOR, TYPE } from "../designTokens";

// Frontend ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1)
const EASE_OUT_EXPO = Easing.bezier(0.16, 1, 0.3, 1);

// Entrance duration: 16 frames (~0.55s at 30fps, matches --dur-entrance: 700ms scaled)
const ENTER_FRAMES = 16;

interface DiagramCardProps {
  children: React.ReactNode;
  width?: number;
  minHeight?: number;
  maxHeight?: number;
  padding?: string;
  backdrop?: boolean;
  position?: "center" | "bottom";
  /** Stagger delay in frames (for multi-card layouts) */
  stagger?: number;
}

function useCardEntrance(stagger = 0) {
  const frame = useCurrentFrame();
  const local = Math.max(frame - stagger, 0);

  // Matches .source-card-cascade → .cascade-revealed transition
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

// ── Vertical B-Roll Strips — parallax scrolling source brand columns ────────
// Mimics the /source/ page grid: colored brand blocks scrolling vertically
// on left and right sides, framing the centered diagram.

const BRAND_COLORS = [
  "#EC0016", // DB red
  "#9146FF", // Twitch purple
  "#1B2838", // Steam dark
  "#FF6B35", // Pump.fun orange
  "#00A36C", // Brand green
  "#2563EB", // Airlines blue
  "#F59E0B", // Weather gold
  "#DC2626", // Sports red
  "#6366F1", // DeFi purple
  "#0EA5E9", // Ocean data cyan
  "#84CC16", // Nature green
  "#EC4899", // Social pink
];

const BRAND_LABELS = [
  "DB", "twitch", "STEAM", "pump.fun", "GM", "flights",
  "weather", "sports", "defi", "ocean", "nature", "social",
];

const STRIP_BLOCK_H = 140; // height of each brand block
const STRIP_GAP = 8;
const STRIP_W = 200; // width of each side strip

const BRollStrips: React.FC<{ speed?: number }> = ({ speed = 0.8 }) => {
  const frame = useCurrentFrame();

  // Vertical scroll offset — slow parallax
  const scrollY = frame * speed;

  // Total height needed for one full set of blocks
  const blockTotal = BRAND_COLORS.length;
  const setHeight = blockTotal * (STRIP_BLOCK_H + STRIP_GAP);

  const renderStrip = (side: "left" | "right", offset: number) => {
    // Right strip scrolls opposite direction for parallax feel
    const direction = side === "left" ? 1 : -1;
    const y = (scrollY * direction + offset) % setHeight;
    // Render 2 sets for seamless loop
    const colors = [...BRAND_COLORS, ...BRAND_COLORS];
    const labels = [...BRAND_LABELS, ...BRAND_LABELS];

    return (
      <div
        style={{
          position: "absolute",
          [side]: 0,
          top: 0,
          width: STRIP_W,
          height: "100%",
          overflow: "hidden",
          opacity: 0.45,
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
                height: STRIP_BLOCK_H,
                background: color,
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontFamily: TYPE.heading.fontFamily,
                  fontSize: 28,
                  fontWeight: 800,
                  color: "#fff",
                  opacity: 0.9,
                  textShadow: "0 1px 4px rgba(0,0,0,0.3)",
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

export const DiagramCard: React.FC<DiagramCardProps> = ({
  children,
  width = 1400,
  minHeight,
  maxHeight,
  padding = "40px 48px",
  backdrop = true,
  position = "center",
  stagger = 0,
}) => {
  const { opacity, translateY, scale, blur, backdropOpacity } =
    useCardEntrance(stagger);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* Blurred darkened backdrop — video becomes atmosphere */}
      {backdrop && (
        <AbsoluteFill
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.45)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            opacity: backdropOpacity,
          }}
        />
      )}

      {/* Vertical b-roll strips — source brand columns scrolling on sides */}
      {backdrop && <BRollStrips />}

      {/* Card — cascade entrance matching /source/ page */}
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
            background: COLOR.bg,
            borderRadius: 20,
            border: `1px solid ${COLOR.border}`,
            boxShadow:
              "0 8px 40px rgba(0, 0, 0, 0.15), 0 2px 12px rgba(0, 0, 0, 0.08)",
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

/**
 * DiagramCardDark — same cascade entrance, dark theme.
 */
export const DiagramCardDark: React.FC<DiagramCardProps> = ({
  children,
  width = 1400,
  minHeight,
  maxHeight,
  padding = "40px 48px",
  backdrop = true,
  position = "center",
  stagger = 0,
}) => {
  const { opacity, translateY, scale, blur, backdropOpacity } =
    useCardEntrance(stagger);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {backdrop && (
        <AbsoluteFill
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.45)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            opacity: backdropOpacity,
          }}
        />
      )}

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
            background: COLOR.panelDark,
            borderRadius: 20,
            border: "1px solid rgba(255, 255, 255, 0.08)",
            boxShadow:
              "0 8px 40px rgba(0, 0, 0, 0.3), 0 2px 12px rgba(0, 0, 0, 0.15)",
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
