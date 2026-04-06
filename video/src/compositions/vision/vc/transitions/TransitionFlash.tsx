/**
 * TransitionFlash — white impact overlay for scene cuts.
 *
 * Drop at frame 0 of any Sequence. It blinds, then retreats.
 * The dramatic variant holds longer — for cards that deserve
 * the extra half-second of violence.
 *
 * When wrapping children, content scales from 1.03 to 1.0 with
 * a spring — the spatial equivalent of a punch zoom settling.
 */
import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";

interface TransitionFlashProps {
  /** Flash intensity 0-1, default 0.8 */
  intensity?: number;
  /** Enable micro screen-shake, default false */
  shake?: boolean;
  /** Dramatic mode — longer flash, default false */
  dramatic?: boolean;
  children?: React.ReactNode;
}

export const TransitionFlash: React.FC<TransitionFlashProps> = ({
  intensity = 0.8,
  shake = false,
  dramatic = false,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // --- Flash opacity curve ---
  // Standard: 80% for 2 frames, drop to 40% by frame 3, gone by frame 8
  // Dramatic: 100% held for 3 frames, then slower fade to 0 by frame 12
  const flashOpacity = dramatic
    ? interpolate(
        frame,
        [0, 2, 3, 12],
        [1 * intensity, 1 * intensity, 0.5 * intensity, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      )
    : interpolate(
        frame,
        [0, 1, 3, 8],
        [intensity, intensity, 0.4 * intensity, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      );

  // --- Screen shake ---
  const shakeDuration = dramatic ? 12 : 8;
  let shakeX = 0;
  let shakeY = 0;

  if (shake && frame < shakeDuration) {
    const decay = 1 - frame / shakeDuration;
    shakeX = Math.sin(frame * 7.3) * 2 * decay;
    shakeY = Math.cos(frame * 5.1) * 2 * decay;
  }

  // --- Scale-in spring (for children) ---
  const scaleSpring = spring({
    frame,
    fps,
    config: { damping: 15 },
    durationInFrames: 10,
  });
  const scale = interpolate(scaleSpring, [0, 1], [1.03, 1]);

  // Flash-only mode — no children, original behavior
  if (!children) {
    if (flashOpacity <= 0) return null;

    return (
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          zIndex: 100,
          transform:
            shake && (shakeX !== 0 || shakeY !== 0)
              ? `translate(${shakeX}px, ${shakeY}px)`
              : undefined,
        }}
      >
        <AbsoluteFill
          style={{
            backgroundColor: "#ffffff",
            opacity: flashOpacity,
          }}
        />
      </AbsoluteFill>
    );
  }

  // Wrapper mode — scale entrance + flash overlay
  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          transform: `scale(${scale})`,
        }}
      >
        {children}
      </AbsoluteFill>

      {flashOpacity > 0 && (
        <AbsoluteFill
          style={{
            pointerEvents: "none",
            zIndex: 100,
            backgroundColor: "#ffffff",
            opacity: flashOpacity,
            transform:
              shake && (shakeX !== 0 || shakeY !== 0)
                ? `translate(${shakeX}px, ${shakeY}px)`
                : undefined,
          }}
        />
      )}
    </AbsoluteFill>
  );
};
