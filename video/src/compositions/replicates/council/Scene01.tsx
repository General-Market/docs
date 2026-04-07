import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { loadFont } from "@remotion/google-fonts/SpaceMono";
import {
  AnimatedText,
  COUNCIL_TEAL,
  COUNCIL_DARK,
  COUNCIL_TITLE_FONT_SIZE,
} from "./AnimatedText";

const { fontFamily } = loadFont();

// Re-exported for sibling scenes that still reach for the old names.
export const TEAL = COUNCIL_TEAL;
export const DARK = COUNCIL_DARK;
export const TEAL_LIGHT = "#B4F0D7";

const VirtualsIcon: React.FC<{ size?: number }> = ({ size = 44 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32">
    <path
      d="M5 9 C 8 9, 11 11, 14 18 L 16 24 L 18 18 C 20 13, 23 10, 26 10"
      stroke={COUNCIL_TEAL}
      strokeWidth="3"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="27" cy="11" r="1.4" fill={COUNCIL_TEAL} />
  </svg>
);

export const Scene01: React.FC = () => {
  const frame = useCurrentFrame();

  // Stage 1: circle reveal (frames 0-12)
  const circleScale = interpolate(frame, [0, 6, 12], [0.0, 1.05, 1.0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Stage 2: circle morphs to pill (12-30)
  const PILL_WIDTH_FULL = 580;
  const PILL_HEIGHT = 125;
  const CIRCLE_SIZE = 130;

  const pillWidth = interpolate(
    frame,
    [12, 30],
    [CIRCLE_SIZE, PILL_WIDTH_FULL],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const pillHeight = interpolate(
    frame,
    [12, 30],
    [CIRCLE_SIZE, PILL_HEIGHT],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Icon slides from center toward the left edge of the pill while it expands.
  // Stays visible the entire "Virtuals Protocol" window, fades when that block fades.
  const iconX = interpolate(frame, [12, 28], [0, -210], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const iconOpacity = interpolate(frame, [58, 68], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const pillRadius = 999;

  // Whole-scene fade out at the tail so Scene02 picks up cleanly.
  const sceneOpacity = interpolate(frame, [180, 190], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#fff",
        justifyContent: "center",
        alignItems: "center",
        fontFamily,
        opacity: sceneOpacity,
      }}
    >
      {/* Pill / Circle container */}
      <div
        style={{
          width: pillWidth,
          height: pillHeight,
          borderRadius: pillRadius,
          backgroundColor: "#fff",
          boxShadow: "0 12px 48px rgba(0,0,0,0.10)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          transform: `scale(${circleScale})`,
        }}
      >
        {/* V mark — visible during circle + pill morph, fades before Stage 3 */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: `translate(calc(-50% + ${iconX}px), -50%)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: iconOpacity,
          }}
        >
          <VirtualsIcon size={48} />
        </div>

        {/* Stage 2 — "Virtuals Protocol" reveals word by word inside the pill */}
        <AnimatedText
          text="Virtuals Protocol"
          highlightLastN={2}
          startFrame={30}
          framesPerWord={7}
          wordSpringFrames={12}
          lastWordSpringFrames={22}
          fadeOutAt={58}
          fadeOutFrames={10}
          fontSize={COUNCIL_TITLE_FONT_SIZE}
          fontWeight={500}
          color={COUNCIL_TEAL}
          highlightColor={COUNCIL_TEAL}
          style={{ transform: "translateX(30px)" }}
        />

        {/* Stage 3 — "Virtuals AI Council" reveals inside the now-empty pill */}
        <AnimatedText
          text="Virtuals AI Council"
          highlightLastN={3}
          startFrame={82}
          framesPerWord={7}
          wordSpringFrames={12}
          lastWordSpringFrames={26}
          fadeOutAt={175}
          fadeOutFrames={15}
          fontSize={COUNCIL_TITLE_FONT_SIZE}
          fontWeight={500}
          color={COUNCIL_TEAL}
          highlightColor={COUNCIL_TEAL}
        />
      </div>

      {/* Stage 3 — "Introducing" label floats above the pill */}
      <AnimatedText
        text="Introducing"
        startFrame={76}
        framesPerWord={6}
        wordSpringFrames={14}
        lastWordSpringFrames={14}
        riseFromPx={20}
        fadeOutAt={175}
        fadeOutFrames={15}
        fontSize={COUNCIL_TITLE_FONT_SIZE}
        fontWeight={500}
        color={COUNCIL_TEAL}
        letterSpacing={0.5}
        style={{ transform: "translateY(-95px)" }}
      />
    </AbsoluteFill>
  );
};

export const scene01Meta = {
  id: "Council-Scene01",
  component: Scene01,
  width: 1280,
  height: 720,
  fps: 30,
  durationInFrames: 190,
};
