import React from "react";
import {
  AbsoluteFill,
  interpolate,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { C, EASE, EDGE, font, PILL_GRADIENT, W, H, WINDOW_SCALE } from "./theme";
import { DotGrid, DotGridVignette } from "../anticheat/DotGrid";

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
// The blue broll plays full-bleed and shows around a panel floating on it (the
// onboarding framing). Inside the panel sits the AntiCheatEdit flag-chart
// ground — the light #F0F2F4 paper with its fine Base-blue dot lattice
// (DotGrid) and a soft edge vignette — the same field the venue bar charts use
// over there. Beats render in full 1920×1080 space inside the panel.

const FIELD_BG = "#F0F2F4"; // the AntiCheatEdit chart ground (colors.bg)

export const Stage: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const winW = W * WINDOW_SCALE;
  const winH = H * WINDOW_SCALE;
  return (
    <AbsoluteFill style={{ background: "#0B1E46", fontFamily: font }}>
      {/* blue broll, full-bleed — visible around the panel */}
      <AbsoluteFill style={{ overflow: "hidden" }}>
        <OffthreadVideo
          src={staticFile("batch-flow/bg-blur.mp4")}
          muted
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: "scale(1.08)",
          }}
        />
      </AbsoluteFill>

      {/* the panel — a card floating on the broll, holding the dot-grid field */}
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
          {/* beat space — the AntiCheatEdit dot-grid ground + beats */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: W,
              height: H,
              transform: `scale(${WINDOW_SCALE})`,
              transformOrigin: "0 0",
            }}
          >
            <AbsoluteFill style={{ background: FIELD_BG }} />
            <DotGrid intensity={0.7} speed={0.2} />
            <DotGridVignette intensity={0.24} />
            {children}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── SlideBeat ────────────────────────────────────────────────────────────────
//
// The whiteboard slide. A beat enters from the right while the one before it
// leaves to the left — both travelling right→left — so during the overlap you
// watch the old panel slide out and the new one slide in, the way a lecture
// hall board rolls sideways. No fade: panels are opaque on a track, and the
// frosted window clips whatever rides off either edge.

export const SlideBeat: React.FC<{
  durationInFrames: number;
  enter?: boolean;
  exit?: boolean;
  children?: React.ReactNode;
}> = ({ durationInFrames, enter = true, exit = true, children }) => {
  const frame = useCurrentFrame();
  let x = 0;
  if (enter && frame < EDGE) {
    x = interpolate(frame, [0, EDGE], [W, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: EASE.out,
    });
  } else if (exit && frame > durationInFrames - EDGE) {
    x = interpolate(frame, [durationInFrames - EDGE, durationInFrames], [0, -W], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: EASE.in,
    });
  }
  return (
    <AbsoluteFill
      style={{ transform: `translateX(${x.toFixed(1)}px)`, willChange: "transform" }}
    >
      {children}
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
