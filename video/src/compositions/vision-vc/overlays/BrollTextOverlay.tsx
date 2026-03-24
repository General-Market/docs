/**
 * BrollTextOverlay — large text directly over b-roll footage.
 *
 * Used instead of cutting to a white card. Breaks the montage rhythm.
 * White text with a subtle backdrop blur pill, positioned bottom-third.
 */
import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from "remotion";
import { FONT } from "../tokens";

interface BrollTextOverlayProps {
  text: string;
  subtitle?: string;
}

export const BrollTextOverlay: React.FC<BrollTextOverlayProps> = ({
  text,
  subtitle,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const springConfig = { damping: 12, mass: 0.8 };

  const enterSpring = spring({
    frame,
    fps,
    config: springConfig,
  });

  const translateY = interpolate(enterSpring, [0, 1], [30, 0]);
  const opacity = interpolate(enterSpring, [0, 0.5], [0, 1], { extrapolateRight: "clamp" });

  const subtitleSpring = spring({
    frame: Math.max(0, frame - 8),
    fps,
    config: springConfig,
  });
  const subtitleY = interpolate(subtitleSpring, [0, 1], [30, 0]);
  const subtitleOpacity = interpolate(subtitleSpring, [0, 0.5], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* Dark gradient at bottom for readability */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.3) 30%, transparent 55%)",
        }}
      />

      <div
        style={{
          position: "absolute",
          bottom: 100,
          left: 80,
          right: 80,
          opacity,
          transform: `translateY(${translateY}px)`,
        }}
      >
        <div
          style={{
            fontFamily: FONT.sans,
            fontSize: 52,
            fontWeight: 800,
            color: "#ffffff",
            letterSpacing: "-0.02em",
            lineHeight: 1.2,
            textShadow: "0 2px 12px rgba(0,0,0,0.4)",
          }}
        >
          {text}
        </div>
        {subtitle && (
          <div
            style={{
              fontFamily: FONT.sans,
              fontSize: 20,
              fontWeight: 500,
              color: "rgba(255,255,255,0.7)",
              letterSpacing: "0.02em",
              marginTop: 10,
              opacity: subtitleOpacity,
              transform: `translateY(${subtitleY}px)`,
              textShadow: "0 1px 8px rgba(0,0,0,0.5)",
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
