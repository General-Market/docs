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
const DARK = "#1A1A2E";

export const Scene07: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phase 0: White bg fade in (0-5)
  const bgOpacity = interpolate(frame, [0, 5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // === Phase 1 (3-28): "Season 1 judged." ===
  const s1Text = "Season 1";
  const s1CharsVisible = Math.floor(
    interpolate(frame, [3, 16], [0, s1Text.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );
  const s1Typed = s1Text.slice(0, s1CharsVisible);

  const judgedOpacity = interpolate(frame, [16, 19], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Phase 1 fade out (24-28)
  const phase1Opacity = interpolate(frame, [3, 5, 24, 28], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // === Phase 2 (28-55): "Season 2 loading." ===
  const s2Text = "Season 2";
  const s2CharsVisible = Math.floor(
    interpolate(frame, [28, 41], [0, s2Text.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );
  const s2Typed = s2Text.slice(0, s2CharsVisible);

  const loadingOpacity = interpolate(frame, [41, 44], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Period blinks on/off every 8 frames
  const periodVisible = frame >= 44 && Math.floor((frame - 44) / 8) % 2 === 0;

  // Phase 2 fade out (51-55)
  const phase2Opacity = interpolate(frame, [28, 30, 51, 55], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // === Phase 3 (55-90): Virtuals Protocol logo ===
  const logoOpacity = interpolate(frame, [55, 68], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const logoScale = spring({
    frame: Math.max(0, frame - 55),
    fps,
    config: { damping: 14, stiffness: 120, mass: 0.8 },
    from: 0.9,
    to: 1,
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#FFFFFF",
        opacity: bgOpacity,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Phase 1: "Season 1 judged." */}
      {frame >= 3 && frame < 28 && (
        <div
          style={{
            opacity: phase1Opacity,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            position: "absolute",
          }}
        >
          <div
            style={{
              fontFamily,
              fontSize: 36,
              fontWeight: 700,
              color: DARK,
              letterSpacing: 1,
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
            }}
          >
            judged.
          </div>
        </div>
      )}

      {/* Phase 2: "Season 2 loading." */}
      {frame >= 28 && frame < 55 && (
        <div
          style={{
            opacity: phase2Opacity,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            position: "absolute",
          }}
        >
          <div
            style={{
              fontFamily,
              fontSize: 36,
              fontWeight: 700,
              color: DARK,
              letterSpacing: 1,
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
            }}
          >
            loading{periodVisible ? "." : "\u00A0"}
          </div>
        </div>
      )}

      {/* Virtuals Protocol logo */}
      {frame >= 55 && (
        <div
          style={{
            opacity: logoOpacity,
            transform: `scale(${logoScale})`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}
        >
          <svg width="250" height="50" viewBox="0 0 250 50">
            <path
              d="M10 40 Q20 5 35 20 Q45 35 55 15 Q60 5 70 20 Q75 28 82 15 Q88 5 95 15 L100 25 Q105 35 115 20 Q120 10 130 25 Q138 38 148 15 Q155 5 165 25 Q170 35 180 20 Q188 8 200 30 Q205 38 215 20 Q220 12 230 25 Q235 32 240 20"
              stroke={TEAL}
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
          <div
            style={{
              fontFamily,
              fontSize: 18,
              fontWeight: 700,
              color: TEAL,
              letterSpacing: 6,
              textAlign: "center",
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
  durationInFrames: 90,
};
