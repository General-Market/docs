// MiamiIntro — Scramble text reveal à la TextScramble
// Shows "MIAMI" scrambling from random characters with neon glow, then fades out.

import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, random } from "remotion";
import { loadFont as loadBebas } from "@remotion/google-fonts/BebasNeue";

const { fontFamily: bebasFont } = loadBebas("normal", { subsets: ["latin"], weights: ["400"] });

const SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&";
const NEON_PINK = "#FF2D7B";
const NEON_TEAL = "#00E5CC";

interface Props {
  text?: string;
  subtitle?: string;
}

export const MiamiIntro: React.FC<Props> = ({
  text = "MIAMI",
  subtitle = "FLIPPING CARS",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const targetChars = text.split("");

  // Each char starts scrambling at index * 3 frames, resolves over 15 frames
  const getDisplayChar = (index: number, targetChar: string) => {
    const charStart = index * 3;
    const resolveEnd = charStart + 15;

    if (frame < charStart) return "\u00A0"; // not yet started
    if (frame >= resolveEnd) return targetChar; // resolved

    // Show random scramble character
    const randIdx = Math.floor(
      random(`miami-${frame}-${index}`) * SCRAMBLE_CHARS.length,
    );
    return SCRAMBLE_CHARS[randIdx];
  };

  // Fade out: start at frame 60 (~2s), fully gone by frame 75 (~2.5s)
  const fadeOut = interpolate(frame, [60, 75], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Subtle scale-up entrance
  const scaleIn = interpolate(frame, [0, 12], [0.85, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Subtitle fade-in after scramble resolves
  const subtitleOpacity = interpolate(frame, [25, 38], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  }) * fadeOut;

  // Neon glow pulse (subtle)
  const glowPulse = 1 + 0.15 * Math.sin((frame / fps) * Math.PI * 4);

  return (
    <div
      style={{
        position: "absolute",
        top: 80,
        left: 48,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        zIndex: 25,
        opacity: fadeOut,
        transform: `scale(${scaleIn})`,
        transformOrigin: "top left",
        pointerEvents: "none",
      }}
    >
      {/* Main MIAMI text */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-start",
          gap: 6,
        }}
      >
        {targetChars.map((char, i) => {
          const displayChar = getDisplayChar(i, char);
          const isResolved = displayChar === char && frame >= (i * 3 + 15);

          return (
            <span
              key={`miami-char-${i}`}
              style={{
                display: "inline-block",
                fontFamily: bebasFont,
                fontSize: 160,
                fontWeight: 400,
                letterSpacing: 16,
                lineHeight: 1,
                color: isResolved ? "#FFFFFF" : NEON_PINK,
                textShadow: isResolved
                  ? [
                      `0 0 ${20 * glowPulse}px ${NEON_PINK}80`,
                      `0 0 ${50 * glowPulse}px ${NEON_PINK}40`,
                      `0 0 ${80 * glowPulse}px ${NEON_PINK}20`,
                      "0 4px 12px rgba(0,0,0,0.9)",
                    ].join(", ")
                  : [
                      `0 0 30px ${NEON_PINK}`,
                      `0 0 60px ${NEON_PINK}80`,
                      "0 4px 12px rgba(0,0,0,0.9)",
                    ].join(", "),
              }}
            >
              {displayChar}
            </span>
          );
        })}
      </div>

      {/* Subtitle */}
      <div
        style={{
          fontFamily: bebasFont,
          fontSize: 36,
          fontWeight: 400,
          letterSpacing: 12,
          color: NEON_TEAL,
          marginTop: 16,
          opacity: subtitleOpacity,
          textShadow: [
            `0 0 15px ${NEON_TEAL}80`,
            `0 0 40px ${NEON_TEAL}40`,
            "0 2px 8px rgba(0,0,0,0.8)",
          ].join(", "),
        }}
      >
        {subtitle}
      </div>

      {/* Thin neon underline */}
      <div
        style={{
          width: interpolate(frame, [5, 20], [0, 420], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          height: 2,
          marginTop: 12,
          background: `linear-gradient(90deg, transparent, ${NEON_PINK}, ${NEON_TEAL}, transparent)`,
          opacity: fadeOut * 0.8,
          boxShadow: `0 0 12px ${NEON_PINK}60`,
        }}
      />
    </div>
  );
};
