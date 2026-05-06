import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { font } from "../../common/fonts";
import { FPS, H, W, colors, toFrames } from "./theme";

const SCENE_SECONDS = 3.5;
const SUBLINE_AT = toFrames(1.0);
const TERTIARY_AT = toFrames(1.6);

// The endcard inverts. Solid Base blue field, white wordmark.
// A light dot grid laid over blue gives the same texture vocabulary as
// the rest of the film, but the relationship is flipped.

export const AntiCheatEndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const wordmarkOpacity = interpolate(
    frame,
    [0, toFrames(0.18)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const wordmarkY = interpolate(
    frame,
    [0, toFrames(0.18)],
    [14, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const punch = spring({
    frame: frame - toFrames(0.05),
    fps,
    config: { damping: 9, stiffness: 220, mass: 0.55 },
  });
  const wordmarkPunch =
    1 + Math.sin(Math.min(1, Math.max(0, punch)) * Math.PI) * 0.06;

  const underlineT = interpolate(
    frame,
    [toFrames(0.4), toFrames(1.1)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const sublineLocal = frame - SUBLINE_AT;
  const sublineOpacity = interpolate(
    sublineLocal,
    [0, toFrames(0.18)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const sublineY = interpolate(
    sublineLocal,
    [0, toFrames(0.18)],
    [14, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const tertiaryLocal = frame - TERTIARY_AT;
  const tertiaryOpacity = interpolate(
    tertiaryLocal,
    [0, toFrames(0.18)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const tertiaryY = interpolate(
    tertiaryLocal,
    [0, toFrames(0.18)],
    [14, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.accent,
        fontFamily: font,
        justifyContent: "center",
        alignItems: "center",
        padding: "0 96px",
      }}
    >
      <WhiteDotGrid />
      <div
        style={{
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          position: "relative",
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 240,
            fontWeight: 800,
            letterSpacing: "-0.05em",
            color: "#FFFFFF",
            lineHeight: 0.95,
            opacity: wordmarkOpacity,
            transform: `translateY(${wordmarkY}px) scale(${wordmarkPunch})`,
            transformOrigin: "center",
            display: "flex",
            alignItems: "center",
            gap: 36,
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: 140,
              height: 140,
              background: "#FFFFFF",
              flexShrink: 0,
            }}
          />
          <span>General</span>
        </div>

        <div
          style={{
            position: "relative",
            width: 720,
            height: 2,
            marginTop: 28,
            marginBottom: 36,
            background: "rgba(255,255,255,0.20)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              bottom: 0,
              width: `${underlineT * 100}%`,
              background:
                "linear-gradient(90deg, rgba(255,255,255,0) 0%, #FFFFFF 50%, rgba(255,255,255,0) 100%)",
            }}
          />
        </div>

        <div
          style={{
            fontFamily: font,
            fontSize: 78,
            fontWeight: 700,
            letterSpacing: "-0.025em",
            color: "#FFFFFF",
            lineHeight: 1.1,
            opacity: sublineOpacity,
            transform: `translateY(${sublineY}px)`,
          }}
        >
          Trading is easy with an Anti-Cheat
        </div>

        <div
          style={{
            marginTop: 40,
            display: "inline-flex",
            alignItems: "center",
            gap: 14,
            padding: "16px 28px",
            border: "1px solid rgba(255,255,255,0.25)",
            borderRadius: 999,
            background: "rgba(255,255,255,0.08)",
            opacity: tertiaryOpacity,
            transform: `translateY(${tertiaryY}px)`,
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              background: "#FFFFFF",
              boxShadow: "0 0 10px rgba(255,255,255,0.6)",
            }}
          />
          <span
            style={{
              fontFamily: font,
              fontSize: 40,
              fontWeight: 600,
              letterSpacing: "-0.005em",
              color: "#FFFFFF",
            }}
          >
            Available only via trading bots
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── White dot grid for the inverted endcard ─────────────────────────────────
//
// Same two-layer recipe as DotGrid, but in white over the blue field. Inlined
// here because the fill color is the only difference.

const FINE_SPACING = 14;
const FINE_RADIUS = 1.6;
const FINE_ALPHA = 0.22;

type Band = {
  y: number;
  len: number;
  anchor: number;
  spacing: number;
  radius: number;
  alpha: number;
  velocity: number;
  phase: number;
};

const BANDS: Band[] = [
  { y: 0.045, len: 0.62, anchor: 0.30, spacing: 7, radius: 2.4, alpha: 0.95, velocity: 380, phase: 0.00 },
  { y: 0.062, len: 0.58, anchor: 0.46, spacing: 6, radius: 2.4, alpha: 0.95, velocity: 540, phase: 0.30 },
  { y: 0.078, len: 0.42, anchor: 0.22, spacing: 7, radius: 2.4, alpha: 0.92, velocity: 320, phase: 0.55 },
  { y: 0.85, len: 0.58, anchor: 0.62, spacing: 7, radius: 2.4, alpha: 0.95, velocity: 360, phase: 0.05 },
  { y: 0.867, len: 0.62, anchor: 0.42, spacing: 6, radius: 2.4, alpha: 0.95, velocity: 500, phase: 0.35 },
  { y: 0.884, len: 0.46, anchor: 0.74, spacing: 7, radius: 2.4, alpha: 0.92, velocity: 280, phase: 0.60 },
];

const FADE_FRACTION = 0.18;
const WHITE = "#FFFFFF";

const WhiteDotGrid: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const cycleW = W * 1.6;

  const fineCols = Math.ceil(W / FINE_SPACING) + 2;
  const fineRows = Math.ceil(H / FINE_SPACING) + 2;

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
      }}
    >
      <g opacity={FINE_ALPHA}>
        {Array.from({ length: fineRows }).map((_, ry) => {
          const y = ry * FINE_SPACING - FINE_SPACING / 2;
          return (
            <g key={`r${ry}`}>
              {Array.from({ length: fineCols }).map((_, rx) => {
                const x = rx * FINE_SPACING - FINE_SPACING / 2;
                return (
                  <circle
                    key={`r${ry}c${rx}`}
                    cx={x}
                    cy={y}
                    r={FINE_RADIUS}
                    fill={WHITE}
                  />
                );
              })}
            </g>
          );
        })}
      </g>

      <g>
        {BANDS.map((band, bi) => {
          const yPx = band.y * H;
          const lenPx = band.len * W;
          const halfLen = lenPx / 2;
          const drift = band.velocity * t;
          const phasePx = band.phase * cycleW;
          const wrappedMid =
            ((band.anchor * W + drift + phasePx) % cycleW + cycleW) % cycleW
            - cycleW * 0.3;
          const x0Px = wrappedMid - halfLen;
          const x1Px = wrappedMid + halfLen;
          if (x1Px < -20 || x0Px > W + 20) return null;

          const fadePx = lenPx * FADE_FRACTION;
          const count = Math.max(2, Math.floor(lenPx / band.spacing));

          return (
            <g key={`b${bi}`}>
              {Array.from({ length: count }).map((_, di) => {
                const x = x0Px + di * band.spacing;
                if (x < -10 || x > W + 10) return null;

                const fromStart = x - x0Px;
                const fromEnd = x1Px - x;
                let alphaScale = 1;
                if (fromStart < fadePx) alphaScale *= fromStart / fadePx;
                if (fromEnd < fadePx) alphaScale *= fromEnd / fadePx;
                alphaScale = Math.max(0, Math.min(1, alphaScale));

                return (
                  <circle
                    key={`d${di}`}
                    cx={x}
                    cy={yPx}
                    r={band.radius}
                    fill={WHITE}
                    opacity={band.alpha * alphaScale}
                  />
                );
              })}
            </g>
          );
        })}
      </g>
    </svg>
  );
};

export const antiCheatEndCardMeta = {
  id: "AntiCheatEndCard",
  component: AntiCheatEndCard,
  durationInFrames: toFrames(SCENE_SECONDS),
  fps: FPS,
  width: W,
  height: H,
};
