// PhaseLabel — Logo mask-reveal overlay in top-left corner
// Shows white company logos (Goldman Sachs, Citadel, Jump Trading) with a
// left-to-right clip-path reveal, inspired by LogoMaskReveal.

import React from "react";
import { Img, interpolate, staticFile } from "remotion";

const NEON_RED = "#FF2233";

// Phase → label config (only phases that should show a label)
interface LabelConfig {
  logos: string[]; // paths relative to staticFile
  color: string;
  logoHeight?: number; // override default 120px
}

const PHASE_LABEL: Record<string, LabelConfig> = {
  goldman: {
    logos: ["shorts/short-02/logos/goldman-sachs-white.png"],
    color: NEON_RED,
  },
  ambush: {
    logos: ["shorts/short-02/logos/goldman-sachs-white.png"],
    color: NEON_RED,
  },
  memecoins: {
    logos: ["shorts/short-02/logos/goldman-sachs-white.png"],
    color: NEON_RED,
  },
  defeat: {
    logos: ["shorts/short-02/logos/jump-trading-white.png"],
    color: NEON_RED,
    logoHeight: 180,
  },
};

interface Props {
  phase: string;
  /** Frame number within this shot (0-based) */
  localFrame: number;
  shotDurationFrames: number;
}

export const PhaseLabel: React.FC<Props> = ({
  phase,
  localFrame,
  shotDurationFrames,
}) => {
  const cfg = PHASE_LABEL[phase];
  if (!cfg) return null;

  const { logos, color: accentColor, logoHeight: h = 120 } = cfg;

  // Mask reveal: clip-path sweeps left → right over 40 frames
  const maskProgress = interpolate(localFrame, [0, 40], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Fade out near end of shot
  const fadeOut = interpolate(
    localFrame,
    [shotDurationFrames - 15, shotDurationFrames - 5],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Neon glow pulse
  const glowPulse = 1 + 0.2 * Math.sin(localFrame * 0.15);

  // Reveal line position (tracks the right edge of the mask)
  const revealLineX = maskProgress * 5.5; // px per percent, tuned for logo width

  return (
    <div
      style={{
        position: "absolute",
        top: 70,
        left: 48,
        zIndex: 30,
        opacity: fadeOut,
        pointerEvents: "none",
      }}
    >
      {/* Logos with mask reveal */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 24,
          clipPath: `inset(0 ${100 - maskProgress}% 0 0)`,
        }}
      >
        {logos.map((logo, i) => (
          <React.Fragment key={logo}>
            {i > 0 && (
              <span
                style={{
                  fontSize: 48,
                  fontWeight: 300,
                  color: "#FFFFFF",
                  opacity: 0.6,
                  lineHeight: 1,
                  userSelect: "none",
                }}
              >
                ×
              </span>
            )}
            <Img
              src={staticFile(logo)}
              style={{
                height: h,
                width: "auto",
                objectFit: "contain",
                filter: [
                  `drop-shadow(0 0 ${18 * glowPulse}px ${accentColor}90)`,
                  `drop-shadow(0 0 ${40 * glowPulse}px ${accentColor}50)`,
                  "drop-shadow(0 4px 12px rgba(0,0,0,0.9))",
                ].join(" "),
              }}
            />
          </React.Fragment>
        ))}
      </div>

      {/* Reveal line — sweeps across during mask animation */}
      {maskProgress < 100 && (
        <div
          style={{
            position: "absolute",
            left: revealLineX,
            top: 0,
            width: 3,
            height: h,
            background: "#FFFFFF",
            opacity: interpolate(maskProgress, [0, 10, 90, 100], [0, 1, 1, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            boxShadow: [
              `0 0 12px ${accentColor}`,
              `0 0 30px ${accentColor}80`,
              "0 0 8px #FFFFFF80",
            ].join(", "),
          }}
        />
      )}

      {/* Thin accent underline — grows with mask */}
      <div
        style={{
          width: interpolate(localFrame, [5, 30], [0, 480], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          height: 2,
          marginTop: 12,
          background: `linear-gradient(90deg, ${accentColor}, ${accentColor}80, transparent)`,
          opacity: fadeOut * 0.8,
          boxShadow: `0 0 10px ${accentColor}60`,
        }}
      />
    </div>
  );
};
