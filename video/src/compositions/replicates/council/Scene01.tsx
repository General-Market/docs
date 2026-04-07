import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/SpaceMono";

const { fontFamily } = loadFont();

// Teal sampled from the original frames (avg ~#5BB3A8, core darker).
const TEAL = "#4DB3A6";
const TEAL_LIGHT = "#A8DDD5";

const VirtualsIcon: React.FC<{ size?: number }> = ({ size = 44 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32">
    <path
      d="M5 9 C 8 9, 11 11, 14 18 L 16 24 L 18 18 C 20 13, 23 10, 26 10"
      stroke={TEAL}
      strokeWidth="3"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="27" cy="11" r="1.4" fill={TEAL} />
  </svg>
);

const useTypewriter = (
  text: string,
  startFrame: number,
  endFrame: number,
) => {
  const frame = useCurrentFrame();
  if (frame <= startFrame) return "";
  if (frame >= endFrame) return text;
  const ratio = (frame - startFrame) / (endFrame - startFrame);
  const charCount = Math.floor(ratio * text.length);
  return text.slice(0, Math.min(charCount, text.length));
};

export const Scene01: React.FC = () => {
  const frame = useCurrentFrame();

  // ── Stage 1: circle reveal (frames 0-10) ────────────────────────────
  const circleScale = interpolate(frame, [0, 6, 12], [0.0, 1.05, 1.0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Stage 2: circle morphs to pill, "Virtuals" types (12-40) ────────
  const PILL_WIDTH_FULL = 530;
  const PILL_HEIGHT = 120;
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

  // Icon slides from center toward left edge of pill while it expands
  const iconX = interpolate(frame, [12, 28], [0, -190], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const iconOpacity = interpolate(frame, [60, 70], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // "Virtuals Protocol" — types 18-40, holds 40-58, fades 58-68
  const protocolText = useTypewriter("Virtuals Protocol", 18, 40);
  const protocolOpacity = interpolate(
    frame,
    [18, 22, 58, 68],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // ── Stage 3: pill empties, "Introducing" + "Virtuals AI Council" ────
  // "Introducing" appears 75-82, holds, fades at 150
  const introducingOpacity = interpolate(
    frame,
    [75, 82, 150, 158],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // "Virtuals AI Council" types 78-100, holds, fades at 150
  const councilText = useTypewriter("Virtuals AI Council", 78, 100);
  const councilOpacity = interpolate(
    frame,
    [78, 82, 145, 155],
    [0, 1, 1, 0.35],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  // After 150 the council text drifts toward the lighter shade seen in f016.
  const councilColor =
    frame < 145 ? TEAL : frame < 165 ? TEAL_LIGHT : TEAL_LIGHT;

  // ── Stage 4: hand-off — pill morphs taller toward card (155-198) ────
  const pillTransitionWidth = interpolate(
    frame,
    [155, 190],
    [PILL_WIDTH_FULL, 860],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const pillTransitionHeight = interpolate(
    frame,
    [155, 190],
    [PILL_HEIGHT, 560],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const pillRadius = interpolate(frame, [155, 190], [999, 32], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const finalPillWidth = frame < 155 ? pillWidth : pillTransitionWidth;
  const finalPillHeight = frame < 155 ? pillHeight : pillTransitionHeight;

  // Whole-scene fade out at the very end so Scene02 picks up cleanly.
  const sceneOpacity = interpolate(frame, [188, 198], [1, 0], {
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
      {/* "Introducing" label above pill */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -130px)",
          fontSize: 20,
          color: TEAL,
          opacity: introducingOpacity,
          letterSpacing: 0.5,
          whiteSpace: "nowrap",
        }}
      >
        Introducing
      </div>

      {/* Pill / Circle container */}
      <div
        style={{
          width: finalPillWidth,
          height: finalPillHeight,
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
        {/* Icon — visible during circle + pill morph, fades when pill empties */}
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

        {/* "Virtuals Protocol" — phase 2 */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-30%, -50%)",
            fontSize: 34,
            color: TEAL,
            whiteSpace: "nowrap",
            opacity: protocolOpacity,
            fontWeight: 500,
          }}
        >
          {protocolText}
        </div>

        {/* "Virtuals AI Council" — phase 3 */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            fontSize: 36,
            color: councilColor,
            whiteSpace: "nowrap",
            opacity: councilOpacity,
            fontWeight: 500,
            textAlign: "center",
          }}
        >
          {councilText}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const scene01Meta = {
  id: "Council-Scene01",
  component: Scene01,
  width: 1280,
  height: 720,
  fps: 30,
  durationInFrames: 198,
};
