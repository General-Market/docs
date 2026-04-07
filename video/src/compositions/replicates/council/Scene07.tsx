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
import {
  AnimatedText,
  COUNCIL_TEAL,
  COUNCIL_DARK,
  COUNCIL_TITLE_FONT_SIZE,
} from "./AnimatedText";

const { fontFamily } = loadFont();
const { fontFamily: pacificoFamily } = loadPacifico();
const TEAL_DEEP = "#3FA8A0";

// Timeline (130 frames @ 30fps ≈ 4.33s)
//   0-35   "Season 1 judged." rises, holds, fades
//  30-85   "Season 2 loading." rises with 5-frame overlap, holds, fades
//  95-130  Virtuals Protocol end logo
const LOGO_IN = 95;
const LOGO_HOLD = 110;
const END = 130;

export const Scene07: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

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
      {/* Phase 1: "Season 1 judged." — words rise one at a time, last word lingers. */}
      <AnimatedText
        text="Season 1 judged."
        highlightLastN={1}
        startFrame={0}
        framesPerWord={6}
        lastWordSpringFrames={26}
        fadeOutAt={25}
        fadeOutFrames={10}
        fontSize={COUNCIL_TITLE_FONT_SIZE}
        color={COUNCIL_DARK}
        highlightColor={COUNCIL_TEAL}
      />

      {/* Phase 2: "Season 2 loading." — 5-frame overlap with Season 1 fade.
          Note: the period no longer blinks. AnimatedText has no per-character
          animation hook, and the user prioritized one-wrapper consistency over
          the blink special case. The knife lands straight, without a wink. */}
      <AnimatedText
        text="Season 2 loading."
        highlightLastN={1}
        startFrame={30}
        framesPerWord={6}
        lastWordSpringFrames={26}
        fadeOutAt={75}
        fadeOutFrames={10}
        fontSize={COUNCIL_TITLE_FONT_SIZE}
        color={COUNCIL_DARK}
        highlightColor={COUNCIL_TEAL}
      />

      {/* Phase 3: Virtuals Protocol end logo — kept custom. A wordmark is
          not a text reveal and should not pretend to be one. */}
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
