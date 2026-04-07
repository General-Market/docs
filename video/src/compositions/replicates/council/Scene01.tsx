import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/SpaceMono";

const { fontFamily } = loadFont();

// Canonical palette sampled from the original frames.
// Green-leaning mint, not cyan. DARK is exported for sibling scenes
// that paint over a white background — Scene01 itself stays in TEAL.
export const TEAL = "#0FE8AE";
export const TEAL_LIGHT = "#B4F0D7";
export const DARK = "#000000";

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

  // Icon slides from center toward left edge of pill while it expands.
  // It stays visible the entire pill phase (frames 12-68) — the original
  // never lets the V mark dissolve while "Virtuals Protocol" is on screen.
  const iconX = interpolate(frame, [12, 28], [0, -210], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const iconOpacity = 1;

  // "Virtuals Protocol" — types 18-40, holds 40-58, fades 58-68
  const protocolText = useTypewriter("Virtuals Protocol", 18, 40);
  const protocolOpacity = interpolate(
    frame,
    [18, 22, 58, 68],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // ── Stage 3: pill empties, "Introducing" + "Virtuals AI Council" ────
  // Both elements hold solid until 175, then fade 175-190.
  const introducingOpacity = interpolate(
    frame,
    [75, 82, 175, 190],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // "Virtuals AI Council" — 19 chars, ~12 frames of typing.
  const councilText = useTypewriter("Virtuals AI Council", 78, 90);
  const councilOpacity = interpolate(
    frame,
    [78, 82, 175, 190],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  // No drift to the lighter shade — the council text holds solid teal.
  const councilColor = TEAL;

  // No pill→card morph. Scene02 starts fresh from f020.
  const finalPillWidth = pillWidth;
  const finalPillHeight = pillHeight;
  const pillRadius = 999;

  // Whole-scene fade out at the very end so Scene02 picks up cleanly.
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
      {/* "Introducing" label, ~30px above pill top edge.
          Pill is 125px tall, centered on 50%, so its top edge sits at -62.5.
          Place the label baseline ~30px above that → translateY ~ -95px. */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -95px)",
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
            fontSize: 38,
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
  durationInFrames: 190,
};
