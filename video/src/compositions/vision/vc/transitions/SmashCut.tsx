/**
 * SmashCut — clean transition for light mode.
 *
 * A brief white-to-transparent fade plus a directional slide-in.
 * When used without children, it remains a flash-only overlay.
 * When wrapping content, the children slide from +60px to 0
 * over the first 8 frames — the spatial cousin of the flat cut.
 */
import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";

interface SmashCutProps {
  color?: string;
  intensity?: number;
  children?: React.ReactNode;
}

export const SmashCut: React.FC<SmashCutProps> = ({
  color = "#ffffff",
  intensity = 0.15,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // --- Flash opacity curve ---
  const flashOpacity =
    frame > 6
      ? 0
      : interpolate(
          frame,
          [0, 1, 6],
          [intensity, intensity * 0.5, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );

  // --- Slide-in spring (for children) ---
  const slideIn = spring({
    frame,
    fps,
    config: { damping: 15 },
    durationInFrames: 8,
  });
  const translateX = interpolate(slideIn, [0, 1], [60, 0]);

  // Flash-only mode — no children, original behavior
  if (!children) {
    if (frame > 6) return null;

    return (
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          zIndex: 200,
        }}
      >
        {flashOpacity > 0 && (
          <AbsoluteFill
            style={{
              backgroundColor: color,
              opacity: flashOpacity,
            }}
          />
        )}
      </AbsoluteFill>
    );
  }

  // Wrapper mode — flash overlay + directional slide
  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          transform: `translateX(${translateX}px)`,
        }}
      >
        {children}
      </AbsoluteFill>

      {flashOpacity > 0 && (
        <AbsoluteFill
          style={{
            pointerEvents: "none",
            zIndex: 200,
            backgroundColor: color,
            opacity: flashOpacity,
          }}
        />
      )}
    </AbsoluteFill>
  );
};
