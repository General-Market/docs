import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, EASE, font, PILL_GRADIENT, W, H, WINDOW_SCALE } from "./theme";

// ─── Glass helpers ──────────────────────────────────────────────────────────
//
// Translucent fills only — no nested backdrop-filter. The window (below) is the
// single element that blurs the video; everything inside reads as glass against
// that frosted ground.

export const glassPanel = (radius = 18): React.CSSProperties => ({
  background:
    "linear-gradient(160deg, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.48) 100%)",
  border: "1px solid rgba(255,255,255,0.72)",
  borderRadius: radius,
  boxShadow:
    "0 12px 32px rgba(70,74,140,0.16), inset 0 1px 0 rgba(255,255,255,0.9)",
});

export const glassCard = (radius = 16): React.CSSProperties => ({
  background:
    "linear-gradient(160deg, rgba(255,255,255,0.66) 0%, rgba(255,255,255,0.40) 100%)",
  border: "1px solid rgba(255,255,255,0.6)",
  borderRadius: radius,
  boxShadow:
    "0 8px 24px rgba(70,74,140,0.13), inset 0 1px 0 rgba(255,255,255,0.82)",
});

// ─── Stage ────────────────────────────────────────────────────────────────
//
// A calm, static blue backlight fills the frame; the board panel floats on it
// (the onboarding framing). The backlight does NOT move — an animated broll back
// there only pulsed for no reason and pulled the eye off the board. The panel is
// a fixed 1920×1080 viewport; the board (the children) is larger and rides a
// camera transform, so the panel shows only the slice the camera looks at. The
// board paints its own #F0F2F4 paper and Base-blue dot lattice.

export const FIELD_BG = "#F0F2F4"; // the AntiCheatEdit chart ground (colors.bg)

export const Stage: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const winW = W * WINDOW_SCALE;
  const winH = H * WINDOW_SCALE;
  return (
    <AbsoluteFill style={{ background: "#0B1E46", fontFamily: font }}>
      {/* a still blue backlight behind the panel — a soft glow, no motion */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(125% 115% at 50% 42%, #1c3f80 0%, #122e60 40%, #0a1c40 72%, #07142f 100%)",
        }}
      />

      {/* the panel — a card floating on the backlight, holding the board */}
      <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            position: "relative",
            width: winW,
            height: winH,
            borderRadius: 34,
            overflow: "hidden",
            background: FIELD_BG,
            border: "1px solid rgba(255,255,255,0.7)",
            boxShadow:
              "0 48px 130px rgba(14,30,80,0.42), 0 14px 40px rgba(14,30,80,0.26), inset 0 1px 0 rgba(255,255,255,0.9)",
          }}
        >
          {/* the viewport — a 1920×1080 window onto the board; the board rides
              the camera transform and paints its own dot field */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: W,
              height: H,
              transform: `scale(${WINDOW_SCALE})`,
              transformOrigin: "0 0",
              overflow: "hidden",
              background: FIELD_BG,
            }}
          >
            {children}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── CaptionPill ────────────────────────────────────────────────────────────
//
// A floating lower caption — a frosted glass pill, used over the full-bleed
// product shots where a top title would cover the UI.

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
        bottom: 40,
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
          ...glassPanel(999),
          padding: "15px 36px",
          boxShadow: "0 18px 44px rgba(58,62,130,0.24), inset 0 1px 0 rgba(255,255,255,0.9)",
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
// The reel's voice: a blue→violet gradient pill (the reference's label style),
// with an optional dim subtitle below it. Top-centered.

export const BeatTitle: React.FC<{
  title: string;
  sub?: string;
  delay?: number;
  size?: number;
}> = ({ title, sub, delay = 2, size = 46 }) => {
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
        top: 58,
        left: 0,
        right: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        opacity: op,
        transform: `translateY(${y.toFixed(1)}px)`,
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "16px 40px",
          borderRadius: 999,
          background: PILL_GRADIENT,
          boxShadow:
            "0 16px 40px rgba(94,120,255,0.42), 0 4px 14px rgba(0,113,227,0.30), inset 0 1px 0 rgba(255,255,255,0.5)",
          fontFamily: font,
          fontSize: size,
          fontWeight: 800,
          letterSpacing: "-0.01em",
          color: "#fff",
          lineHeight: 1.0,
          whiteSpace: "nowrap",
          textShadow: "0 1px 2px rgba(40,40,90,0.28)",
        }}
      >
        {title}
      </div>
      {sub ? (
        <div
          style={{
            marginTop: 16,
            fontFamily: font,
            fontSize: 30,
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
