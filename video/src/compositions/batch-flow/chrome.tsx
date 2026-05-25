import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { BG_GRADIENT, C, EASE, EDGE, font } from "./theme";

// ─── Stage ────────────────────────────────────────────────────────────────
//
// The shared ground for every beat: the white-glow gradient, a faint
// scanline veil and a soft vignette. Light CRT — no barrel warp, so the UI
// replica and the bars stay crisp. Rendered once, behind all the beats.

export const Stage: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill style={{ background: BG_GRADIENT, fontFamily: font }}>
    {children}
    {/* scanlines */}
    <AbsoluteFill
      style={{
        background:
          "repeating-linear-gradient(0deg, rgba(10,12,20,0.028) 0px, rgba(10,12,20,0.028) 1px, transparent 1px, transparent 3px)",
        mixBlendMode: "multiply",
        opacity: 0.5,
        pointerEvents: "none",
      }}
    />
    {/* vignette */}
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(120% 120% at 50% 42%, rgba(10,12,20,0) 58%, rgba(10,12,20,0.10) 100%)",
        pointerEvents: "none",
      }}
    />
  </AbsoluteFill>
);

// ─── useFade ────────────────────────────────────────────────────────────────
//
// Beat envelope — fade in over the head, hold, fade out over the tail, so
// beats cross-dissolve over the persistent stage.

export const useFade = (durationInFrames: number): number => {
  const frame = useCurrentFrame();
  return interpolate(
    frame,
    [0, EDGE, durationInFrames - EDGE, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
};

// ─── CaptionPill ────────────────────────────────────────────────────────────
//
// A floating lower caption — used over the full-bleed product shots where a
// top title would cover the UI.

export const CaptionPill: React.FC<{ text: string; delay?: number; accent?: string }> = ({
  text,
  delay = 10,
  accent = C.text,
}) => {
  const frame = useCurrentFrame();
  const op = interpolate(frame - delay, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(frame - delay, [0, 14], [14, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });
  return (
    <div
      style={{
        position: "absolute",
        bottom: 38,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        opacity: op,
        transform: `translateY(${y.toFixed(1)}px)`,
      }}
    >
      <div
        style={{
          background: "rgba(255,255,255,0.92)",
          border: `1px solid ${C.rule}`,
          borderRadius: 999,
          padding: "14px 32px",
          boxShadow: "0 12px 34px rgba(10,12,20,0.14)",
          fontFamily: font,
          fontSize: 30,
          fontWeight: 700,
          letterSpacing: "-0.01em",
          color: accent,
        }}
      >
        {text}
      </div>
    </div>
  );
};

// ─── BeatTitle ────────────────────────────────────────────────────────────
//
// Big bold title + optional subtitle, top-centered — the reel's voice.

export const BeatTitle: React.FC<{
  title: string;
  sub?: string;
  delay?: number;
  size?: number;
}> = ({ title, sub, delay = 2, size = 84 }) => {
  const frame = useCurrentFrame();
  const op = interpolate(frame - delay, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(frame - delay, [0, 16], [16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });
  return (
    <div
      style={{
        position: "absolute",
        top: 64,
        left: 0,
        right: 0,
        textAlign: "center",
        opacity: op,
        transform: `translateY(${y.toFixed(1)}px)`,
      }}
    >
      <div
        style={{
          fontFamily: font,
          fontSize: size,
          fontWeight: 800,
          letterSpacing: "-0.03em",
          color: C.text,
          lineHeight: 1.0,
          whiteSpace: "nowrap",
        }}
      >
        {title}
      </div>
      {sub ? (
        <div
          style={{
            marginTop: 14,
            fontFamily: font,
            fontSize: 36,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            color: C.dim,
          }}
        >
          {sub}
        </div>
      ) : null}
    </div>
  );
};
