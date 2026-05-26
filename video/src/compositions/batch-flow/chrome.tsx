import React from "react";
import {
  AbsoluteFill,
  interpolate,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
} from "remotion";
import {
  BG_GRADIENT,
  C,
  EASE,
  EDGE,
  font,
  PILL_GRADIENT,
  TOTAL_FRAMES,
  W,
  H,
  WINDOW_SCALE,
} from "./theme";

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
// The shared ground for every beat: the blurred pastel video, a soft scrim,
// and one frosted glass window the beats live inside — the way the onboarding
// tour frames its scene. Each beat is authored in full 1920×1080 space and
// scaled into the window here.

export const Stage: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const vidScale = interpolate(frame, [0, TOTAL_FRAMES], [1.06, 1.14], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const winW = W * WINDOW_SCALE;
  const winH = H * WINDOW_SCALE;

  return (
    <AbsoluteFill style={{ background: BG_GRADIENT, fontFamily: font }}>
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
            transform: `scale(${vidScale.toFixed(4)})`,
          }}
        />
      </AbsoluteFill>

      {/* soft scrim — lift the edges, faint cool tint so the window pops */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(125% 120% at 50% 24%, rgba(255,255,255,0.12) 0%, rgba(40,44,96,0) 44%, rgba(30,34,80,0.22) 100%)",
          pointerEvents: "none",
        }}
      />

      <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            position: "relative",
            width: winW,
            height: winH,
            borderRadius: 34,
            overflow: "hidden",
            background:
              "linear-gradient(150deg, rgba(255,255,255,0.60) 0%, rgba(236,240,255,0.46) 55%, rgba(244,236,250,0.52) 100%)",
            backdropFilter: "saturate(168%) blur(16px)",
            WebkitBackdropFilter: "saturate(168%) blur(16px)",
            border: "1px solid rgba(255,255,255,0.64)",
            boxShadow:
              "0 48px 130px rgba(46,50,108,0.32), 0 14px 40px rgba(46,50,108,0.18), inset 0 1px 0 rgba(255,255,255,0.92)",
          }}
        >
          {/* top specular sheen — sits under the content */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0) 16%)",
              pointerEvents: "none",
            }}
          />
          {/* the beat space, scaled to fill the window */}
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
            {children}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── useFade ────────────────────────────────────────────────────────────────
//
// Beat envelope — fade in over the head, hold, fade out over the tail, so
// beats cross-dissolve over the persistent window.

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
