import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { RevealChars } from "../anticheat/vibe";
import { font, monoFont, scene } from "../anticheat-edit/props/tokens";
import { EDGE } from "./theme";

// Shared atoms for the explainer. The blue field, the title slot, and the
// fade envelope are constant; each beat fills the stage below the title.

// ─── useEnter ───────────────────────────────────────────────────────────────
//
// One spring entrance: an opacity that clamps in and a rise that overshoots.
// `delay` is in frames. Read `rise` for transforms, `op` for opacity.

export const useEnter = (
  delay = 0,
  config: { mass?: number; damping?: number; stiffness?: number } = {},
): { rise: number; op: number } => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rise = spring({
    fps,
    frame: Math.max(0, frame - delay),
    config: { mass: 0.7, damping: 16, stiffness: 110, ...config },
    durationInFrames: 26,
  });
  const op = interpolate(frame - delay, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return { rise, op };
};

// ─── Beat ─────────────────────────────────────────────────────────────────
//
// The stage every beat mounts inside: a glyph-revealed title near the top,
// then the content. The whole thing rides a fade envelope so beats cross-
// dissolve over the persistent blue field.

export const Beat: React.FC<{
  durationInFrames: number;
  title?: string;
  children?: React.ReactNode;
}> = ({ durationInFrames, title, children }) => {
  const frame = useCurrentFrame();
  const fade = interpolate(
    frame,
    [0, EDGE, durationInFrames - EDGE, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill style={{ opacity: fade, fontFamily: font }}>
      {title ? (
        <div
          style={{
            position: "absolute",
            top: 96,
            left: 0,
            right: 0,
            textAlign: "center",
            padding: "0 140px",
          }}
        >
          <div
            style={{
              fontFamily: font,
              fontSize: 76,
              fontWeight: 800,
              letterSpacing: "-0.022em",
              lineHeight: 1.02,
              color: scene.ink,
              whiteSpace: "nowrap",
            }}
          >
            <RevealChars text={title} startFrame={3} stagger={1.0} duration={12} />
          </div>
        </div>
      ) : null}
      {children}
    </AbsoluteFill>
  );
};

// ─── MonoLabel ──────────────────────────────────────────────────────────────
//
// The small uppercase caption voice — JetBrains Mono, wide tracking.

export const MonoLabel: React.FC<{
  children: React.ReactNode;
  size?: number;
  color?: string;
  style?: React.CSSProperties;
}> = ({ children, size = 30, color = scene.inkSoft, style }) => (
  <div
    style={{
      fontFamily: monoFont,
      fontSize: size,
      fontWeight: 600,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color,
      ...style,
    }}
  >
    {children}
  </div>
);

// ─── Pill ─────────────────────────────────────────────────────────────────
//
// A choice chip — YES / NO, up / down. `tone` flips the accent.

export const Pill: React.FC<{
  label: string;
  glyph?: string;
  tone?: "yes" | "no" | "neutral";
  dim?: number;
}> = ({ label, glyph, tone = "neutral", dim = 1 }) => {
  const fill =
    tone === "yes"
      ? "rgba(58, 214, 138, 0.16)"
      : tone === "no"
        ? "rgba(255, 107, 107, 0.16)"
        : "rgba(255,255,255,0.08)";
  const ink =
    tone === "yes" ? "#3AD68A" : tone === "no" ? "#FF6B6B" : scene.ink;
  const edge =
    tone === "yes"
      ? "rgba(58, 214, 138, 0.5)"
      : tone === "no"
        ? "rgba(255, 107, 107, 0.5)"
        : "rgba(255,255,255,0.22)";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "22px 42px",
        borderRadius: 999,
        background: fill,
        border: `2px solid ${edge}`,
        opacity: dim,
      }}
    >
      {glyph ? (
        <span style={{ fontSize: 40, color: ink, lineHeight: 1 }}>{glyph}</span>
      ) : null}
      <span
        style={{
          fontFamily: font,
          fontSize: 46,
          fontWeight: 700,
          letterSpacing: "0.01em",
          color: ink,
        }}
      >
        {label}
      </span>
    </div>
  );
};

export const TONE = {
  yes: "#3AD68A",
  no: "#FF6B6B",
  ink: scene.ink,
  soft: scene.inkSoft,
  dim: scene.inkDim,
} as const;
