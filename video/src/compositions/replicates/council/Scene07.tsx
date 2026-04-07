import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/SpaceMono";

const { fontFamily } = loadFont();
const TEAL = "#4ECDC4";
const TEAL_DEEP = "#2A9D96";
const DARK = "#1A1A2E";

// Timeline (159 frames @ 30fps ≈ 5.30s)
//   0-15   Season 1 typing in
//  15-30   "Season 1 judged." hold
//  30-40   Season 1 fade out
//  40-45   Blank
//  45-60   Season 2 typing in
//  60-90   "Season 2 loading." hold + period blink
//  90-100  Season 2 fade out
// 100-110  Blank
// 110-130  Logo in
// 130-159  Logo hold
const SEASON1_IN = 0;
const SEASON1_HOLD = 15;
const SEASON1_FADE = 30;
const SEASON1_OUT = 40;
const SEASON2_IN = 45;
const SEASON2_HOLD = 60;
const SEASON2_FADE = 90;
const SEASON2_OUT = 100;
const LOGO_IN = 110;
const END = 159;

export const Scene07: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // === Phase 1 (0-40): "Season 1 judged." ===
  const s1Text = "Season 1";
  const s1CharsVisible = Math.floor(
    interpolate(frame, [SEASON1_IN, SEASON1_IN + 12], [0, s1Text.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );
  const s1Typed = s1Text.slice(0, s1CharsVisible);

  const judgedOpacity = interpolate(
    frame,
    [SEASON1_IN + 12, SEASON1_HOLD],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  const phase1Opacity = interpolate(
    frame,
    [SEASON1_IN, SEASON1_IN + 3, SEASON1_FADE, SEASON1_OUT],
    [0, 1, 1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  // === Phase 2 (45-100): "Season 2 loading." ===
  const s2Text = "Season 2";
  const s2CharsVisible = Math.floor(
    interpolate(frame, [SEASON2_IN, SEASON2_IN + 12], [0, s2Text.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );
  const s2Typed = s2Text.slice(0, s2CharsVisible);

  const loadingOpacity = interpolate(
    frame,
    [SEASON2_IN + 12, SEASON2_HOLD],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  // Period blinks once "loading" is on screen — toggle every 8 frames.
  const blinkStart = SEASON2_HOLD;
  const periodVisible =
    frame >= blinkStart && Math.floor((frame - blinkStart) / 8) % 2 === 0;

  const phase2Opacity = interpolate(
    frame,
    [SEASON2_IN, SEASON2_IN + 3, SEASON2_FADE, SEASON2_OUT],
    [0, 1, 1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  // === Phase 3 (110-159): Virtuals Protocol logo ===
  const logoOpacity = interpolate(frame, [LOGO_IN, LOGO_IN + 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const logoScale = spring({
    frame: Math.max(0, frame - LOGO_IN),
    fps,
    config: { damping: 14, stiffness: 110, mass: 0.85 },
    from: 0.92,
    to: 1,
  });

  const protocolOpacity = interpolate(
    frame,
    [LOGO_IN + 6, LOGO_IN + 18],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#FFFFFF",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Phase 1: "Season 1 judged." — single line */}
      {frame >= SEASON1_IN && frame < SEASON1_OUT && (
        <div
          style={{
            opacity: phase1Opacity,
            display: "flex",
            flexDirection: "row",
            alignItems: "baseline",
            gap: 16,
            position: "absolute",
            whiteSpace: "nowrap",
          }}
        >
          <div
            style={{
              fontFamily,
              fontSize: 36,
              fontWeight: 700,
              color: DARK,
              letterSpacing: 0.5,
              whiteSpace: "nowrap",
            }}
          >
            {s1Typed}
          </div>
          <div
            style={{
              fontFamily,
              fontSize: 36,
              fontWeight: 700,
              color: TEAL,
              opacity: judgedOpacity,
              whiteSpace: "nowrap",
            }}
          >
            judged.
          </div>
        </div>
      )}

      {/* Phase 2: "Season 2 loading." — single line, period blinks */}
      {frame >= SEASON2_IN && frame < SEASON2_OUT && (
        <div
          style={{
            opacity: phase2Opacity,
            display: "flex",
            flexDirection: "row",
            alignItems: "baseline",
            gap: 16,
            position: "absolute",
            whiteSpace: "nowrap",
          }}
        >
          <div
            style={{
              fontFamily,
              fontSize: 36,
              fontWeight: 700,
              color: DARK,
              letterSpacing: 0.5,
              whiteSpace: "nowrap",
            }}
          >
            {s2Typed}
          </div>
          <div
            style={{
              fontFamily,
              fontSize: 36,
              fontWeight: 700,
              color: TEAL,
              opacity: loadingOpacity,
              whiteSpace: "nowrap",
            }}
          >
            loading
            <span style={{ opacity: periodVisible ? 1 : 0 }}>.</span>
          </div>
        </div>
      )}

      {/* Phase 3: Virtuals Protocol end logo */}
      {frame >= LOGO_IN && (
        <div
          style={{
            opacity: logoOpacity,
            transform: `scale(${logoScale})`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
            position: "absolute",
          }}
        >
          {/* "Virtuals" — script/cursive wordmark */}
          <div
            style={{
              fontFamily:
                "'Brush Script MT', 'Lucida Handwriting', 'Segoe Script', cursive",
              fontSize: 56,
              fontWeight: 400,
              color: TEAL_DEEP,
              letterSpacing: -1,
              lineHeight: 1,
              fontStyle: "italic",
            }}
          >
            Virtuals
          </div>
          <div
            style={{
              opacity: protocolOpacity,
              fontFamily,
              fontSize: 14,
              fontWeight: 700,
              color: TEAL_DEEP,
              letterSpacing: "0.3em",
              textAlign: "center",
              paddingLeft: "0.3em",
            }}
          >
            PROTOCOL
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

export const scene07Meta = {
  id: "Council-Scene07",
  component: Scene07,
  width: 1280,
  height: 720,
  fps: 30,
  durationInFrames: END,
};
