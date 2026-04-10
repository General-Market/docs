/**
 * GlowMarqueeOverlay — two-line counter-scrolling text with floating green orbs.
 *
 * "BEGINNER" scrolls left, "HEDGE FUND" scrolls right.
 * Green gradient orbs float underneath on sine waves.
 * Active only during the 36.4–42.8s scene (right-small layout).
 */

import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT } from "../designTokens";
import { FPS } from "../theme";
import { useDesignTokens } from "../TutorialTheme";
import { useTalkingHead } from "../TalkingHeadLayout";
import { Sfx } from "../components/Sfx";
import { WHOOSH } from "../sfxMap";

const sec = (s: number) => Math.round(s * FPS);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Full scroll cycle in seconds (halved from 12 → 6 for 2x speed) */
const CYCLE_S = 6;

/** Sine-wave oscillation */
function floatWave(t: number, period: number): number {
  const p = (t / period) % 2;
  const lin = p <= 1 ? p : 2 - p;
  return 0.5 - 0.5 * Math.cos(lin * Math.PI);
}

const ORB_GREEN =
  "radial-gradient(circle, rgba(159,232,112,0.85) 0%, rgba(159,232,112,0.4) 35%, rgba(159,232,112,0.08) 65%, transparent 100%)";
const ORB_MINT =
  "radial-gradient(circle, rgba(205,255,173,0.75) 0%, rgba(205,255,173,0.35) 35%, rgba(205,255,173,0.06) 65%, transparent 100%)";

/** A single scrolling line — renders 3 copies for seamless tiling */
const MarqueeLine: React.FC<{
  text: string;
  fontSize: number;
  scrollPct: number;
  textColor: string;
}> = ({ text, fontSize, scrollPct, textColor }) => {
  const style: React.CSSProperties = {
    fontFamily: FONT.display,
    fontWeight: 900,
    color: textColor,
    whiteSpace: "nowrap",
    letterSpacing: "-0.03em",
    lineHeight: 0.85,
    opacity: 1,
    fontFeatureSettings: '"calt" 1',
    padding: "0 80px",
    fontSize,
  };
  return (
    <div style={{ display: "inline-flex", transform: `translateX(${scrollPct}%)` }}>
      <span style={style}>{text}</span>
      <span style={style}>{text}</span>
      <span style={style}>{text}</span>
    </div>
  );
};

export const GlowMarqueeOverlay: React.FC = () => {
  const { COLOR } = useDesignTokens();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { contentArea } = useTalkingHead();
  const t = frame / fps;

  if (!contentArea) return null;

  // Only active during the "Beginner to Hedge Fund" scene (36.4–42.8s)
  if (t < 36.0 || t > 43.0) return null;

  const fadeIn = interpolate(frame, [sec(36.4), sec(37.2)], [0, 1], clamp);
  const fadeOut = interpolate(frame, [sec(41.8), sec(42.8)], [1, 0], clamp);
  const opacity = Math.min(fadeIn, fadeOut);
  if (opacity <= 0) return null;

  // Scroll progress — continuous, starts from scene entry
  const scroll = ((t - 36.4) / CYCLE_S) % 1;
  // Line 1 scrolls left, Line 2 scrolls right
  const line1X = -scroll * 33.33;
  const line2X = -(1 - scroll) * 33.33;

  // Orb floating
  const orbAY = floatWave(t, 4.5) * 10;
  const orbBY = 6 - floatWave(t, 3.2) * 6;
  const orbDrift = floatWave(t, 8) * 12;
  const orbDim = Math.min(contentArea.w, contentArea.h) * 0.65;

  return (
    <Sfx sound={WHOOSH}>
    <div
      style={{
        position: "absolute",
        left: contentArea.x,
        top: contentArea.y,
        width: contentArea.w,
        height: contentArea.h,
        overflow: "hidden",
        borderRadius: 30,
        opacity,
        pointerEvents: "none",
      }}
    >
      {/* Orb A */}
      <div
        style={{
          position: "absolute",
          width: orbDim,
          height: orbDim,
          borderRadius: "50%",
          background: ORB_GREEN,
          left: `${25 + orbDrift * 0.4}%`,
          top: `${20 + orbAY}%`,
          transform: "translate(-50%, -50%)",
        }}
      />
      {/* Orb B */}
      <div
        style={{
          position: "absolute",
          width: orbDim * 0.8,
          height: orbDim * 0.8,
          borderRadius: "50%",
          background: ORB_MINT,
          left: `${70 + orbDrift * 0.25}%`,
          top: `${70 + orbBY}%`,
          transform: "translate(-50%, -50%)",
        }}
      />

      {/* Two lines scrolling in opposite directions */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 24,
          overflow: "hidden",
        }}
      >
        <MarqueeLine text="BEGINNER" fontSize={216} scrollPct={line1X} textColor={COLOR.nearBlack} />
        <MarqueeLine text="HEDGE  FUND" fontSize={216} scrollPct={line2X} textColor={COLOR.nearBlack} />
      </div>
    </div>
    </Sfx>
  );
};
