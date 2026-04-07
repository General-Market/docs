import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/SpaceMono";
import { loadFont as loadPacifico } from "@remotion/google-fonts/Pacifico";

const { fontFamily } = loadFont();
const { fontFamily: pacificoFamily } = loadPacifico();
const TEAL = "#0FE8AE";
const TEAL_DEEP = "#3FA8A0";
const DARK = "#000000";

// Timeline (130 frames @ 30fps ≈ 4.33s)
//   0-12   Season 1 typing in
//  12-25   "Season 1 judged." hold
//  25-35   Season 1 fade out (overlaps with Season 2 ghost-in at 30)
//  30-40   Season 2 ghosts in (5-frame overlap)
//  40-50   "Season 2 loading." complete
//  50-75   Hold + period blink (12-frame toggle)
//  75-85   Season 2 fade
//  85-95   Blank
//  95-110  Logo fades in
// 110-130  Logo hold
const SEASON1_IN = 0;
const SEASON1_TYPED = 12;
const SEASON1_HOLD = 25;
const SEASON1_OUT = 35;
const SEASON2_IN = 30;
const SEASON2_TYPED = 40;
const SEASON2_HOLD = 50;
const SEASON2_FADE = 75;
const SEASON2_OUT = 85;
const LOGO_IN = 95;
const LOGO_HOLD = 110;
const END = 130;

export const Scene07: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // === Phase 1 (0-35): "Season 1 judged." ===
  const s1Text = "Season 1";
  const s1CharsVisible = Math.floor(
    interpolate(frame, [SEASON1_IN, SEASON1_TYPED], [0, s1Text.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );
  const s1Typed = s1Text.slice(0, s1CharsVisible);

  const judgedOpacity = interpolate(
    frame,
    [SEASON1_TYPED, SEASON1_HOLD],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  const phase1Opacity = interpolate(
    frame,
    [SEASON1_IN, SEASON1_IN + 3, SEASON1_HOLD, SEASON1_OUT],
    [0, 1, 1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  // === Phase 2 (30-85): "Season 2 loading." with 5-frame overlap ===
  const s2Text = "Season 2";
  const s2CharsVisible = Math.floor(
    interpolate(frame, [SEASON2_IN, SEASON2_TYPED], [0, s2Text.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );
  const s2Typed = s2Text.slice(0, s2CharsVisible);

  const loadingOpacity = interpolate(
    frame,
    [SEASON2_TYPED, SEASON2_HOLD],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  // Period blinks once "loading" is on screen — toggle every 12 frames (2.5 Hz).
  const blinkStart = SEASON2_HOLD;
  const periodVisible =
    frame < blinkStart || Math.floor((frame - blinkStart) / 12) % 2 === 0;

  const phase2Opacity = interpolate(
    frame,
    [SEASON2_IN, SEASON2_IN + 5, SEASON2_FADE, SEASON2_OUT],
    [0, 1, 1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  // === Phase 3 (95-130): Virtuals Protocol logo ===
  const logoOpacity = interpolate(frame, [LOGO_IN, LOGO_HOLD], [0, 1], {
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
      {frame >= SEASON1_IN && frame <= SEASON1_OUT && (
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
      {frame >= SEASON2_IN && frame <= SEASON2_OUT && (
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
          {/* "Virtuals" — Pacifico cursive wordmark, closest readily-available
              approximation of the original hand-drawn SVG path */}
          <div
            style={{
              fontFamily: pacificoFamily,
              fontSize: 40,
              fontWeight: 400,
              color: TEAL_DEEP,
              letterSpacing: -1,
              lineHeight: 1,
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
              letterSpacing: "0.35em",
              textAlign: "center",
              paddingLeft: "0.35em",
              marginTop: 8,
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
