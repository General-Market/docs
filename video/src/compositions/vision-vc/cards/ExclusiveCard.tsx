/**
 * ExclusiveCard — scene-specific label card (light mode)
 *
 * White background. Dark text. Thin border. Geist Sans.
 * No bass drops, no screen shakes, no scan lines.
 * The card states what you can trade. Then it leaves.
 */
import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { COLOR, FONT } from "../tokens";

interface ExclusiveCardProps {
  label?: string;
  subtitle?: string;
  fontWeight?: number;
  montageProgress?: number;
}

export const ExclusiveCard: React.FC<ExclusiveCardProps> = ({
  label = "Trade this.",
  subtitle,
  fontWeight = 700,
  montageProgress = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Clean spring entrance — no overshoot
  const enterSpring = spring({
    frame,
    fps,
    config: { damping: 22, stiffness: 160, mass: 0.5 },
  });

  const opacity = interpolate(frame, [0, 6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Subtle upward drift on entrance
  const translateY = interpolate(enterSpring, [0, 1], [12, 0]);

  // 3D rotation on entrance — card tilts into place
  const rotateY = interpolate(enterSpring, [0, 1], [-4, 0]);

  // Delayed period
  const hasPeriod = label.endsWith(".");
  const textBody = hasPeriod ? label.slice(0, -1) : label;
  const periodOpacity = interpolate(frame, [4, 7], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Subtitle entrance
  const subtitleDelay = 10;
  const subtitleOpacity = interpolate(
    frame,
    [subtitleDelay, subtitleDelay + 8],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const subtitleY = interpolate(
    frame,
    [subtitleDelay, subtitleDelay + 8],
    [4, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // ── EXIT: translateY down 20px + fade in last 6 frames ──
  const exitProgress = interpolate(frame, [durationInFrames - 6, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const exitY = interpolate(exitProgress, [0, 1], [0, 20]);
  const exitOpacity = interpolate(exitProgress, [0, 1], [1, 0]);

  // Border accent color shifts subtly across montage (brand → slightly warmer)
  const borderAlpha = interpolate(montageProgress, [0, 1], [0.08, 0.15]);

  return (
    <AbsoluteFill style={{
      backgroundColor: COLOR.page,
      perspective: '1200px',
      transform: `translateY(${exitY}px)`,
      opacity: exitOpacity,
    }}>
      <div style={{ width: '100%', height: '100%', transform: `rotateY(${rotateY}deg)`, transformStyle: 'preserve-3d' }}>
        {/* Subtle top border accent */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "15%",
            right: "15%",
            height: 2,
            backgroundColor: COLOR.borderLight,
            opacity: borderAlpha * 3,
          }}
        />

        {/* Centered text */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: `translate(-50%, calc(-50% + ${translateY}px))`,
            opacity,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            maxWidth: 900,
            userSelect: "none",
          }}
        >
          {/* Main label */}
          <div
            style={{
              fontFamily: FONT.sans,
              fontWeight: 800,
              fontSize: 68,
              color: COLOR.textPrimary,
              letterSpacing: "-0.03em",
              whiteSpace: "nowrap",
            }}
          >
            {textBody}
            {hasPeriod && (
              <span style={{ opacity: periodOpacity, color: COLOR.textMuted }}>.</span>
            )}
          </div>

          {/* Thin rule */}
          {subtitle && (
            <div
              style={{
                width: 60,
                height: 1,
                backgroundColor: COLOR.borderLight,
                opacity: subtitleOpacity,
              }}
            />
          )}

          {/* Subtitle */}
          {subtitle && (
            <div
              style={{
                fontFamily: FONT.sans,
                fontWeight: 500,
                fontSize: 20,
                color: COLOR.textMuted,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                opacity: subtitleOpacity,
                transform: `translateY(${subtitleY}px)`,
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};
