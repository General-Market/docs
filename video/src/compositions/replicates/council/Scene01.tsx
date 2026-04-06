import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/SpaceMono";

const { fontFamily } = loadFont();
const TEAL = "#4ECDC4";

const VirtualsIcon: React.FC<{ size?: number }> = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32">
    <path d="M16 28 L8 12 L12 12 L16 22 L20 12 L24 12 Z" fill={TEAL} />
    <circle cx="16" cy="8" r="3" fill={TEAL} />
  </svg>
);

const useTypewriter = (text: string, startFrame: number, charsPerFrame = 0.6) => {
  const frame = useCurrentFrame();
  const elapsed = Math.max(0, frame - startFrame);
  const charCount = Math.min(Math.floor(elapsed * charsPerFrame), text.length);
  return text.slice(0, charCount);
};

export const Scene01: React.FC = () => {
  const frame = useCurrentFrame();

  // Phase 1 (0-15): Icon appears quickly (already visible at frame 0)
  const iconScale = interpolate(frame, [0, 10], [0.85, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Phase 2 (12-30): Circle morphs to pill
  const pillWidth = interpolate(frame, [12, 30], [80, 550], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const pillHeight = interpolate(frame, [12, 30], [80, 90], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Icon slides left inside pill
  const iconX = interpolate(frame, [12, 25], [0, -200], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // "Virtuals Protocol" typewriter (frames 15-45)
  const protocolText = useTypewriter("Virtuals Protocol", 15, 1.5);
  const protocolOpacity = interpolate(frame, [15, 18, 40, 50], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Phase 3 (60-90): "Introducing" label + "Virtuals AI Council" typewriter
  const introducingOpacity = interpolate(frame, [55, 60, 100, 110], [0, 0.6, 0.6, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const councilText = useTypewriter("Virtuals AI Council", 58, 1.2);
  const councilOpacity = interpolate(frame, [46, 48], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Phase 5 (130-140): Quick fade out
  const fadeOut = interpolate(frame, [130, 140], [1, 0], {
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
        opacity: fadeOut,
      }}
    >
      {/* "Introducing" label above pill */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -85px)",
          fontSize: 18,
          color: TEAL,
          opacity: introducingOpacity,
        }}
      >
        Introducing
      </div>

      {/* Pill / Circle container */}
      <div
        style={{
          width: pillWidth,
          height: pillHeight,
          borderRadius: 999,
          backgroundColor: "#fff",
          boxShadow: "0 8px 40px rgba(0,0,0,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
          transform: `scale(${iconScale})`,
        }}
      >
        {/* Icon */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: `translate(calc(-50% + ${iconX}px), -50%)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <VirtualsIcon size={36} />
        </div>

        {/* "Virtuals Protocol" text (phase 2) */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-25%, -50%)",
            fontSize: 36,
            color: TEAL,
            whiteSpace: "nowrap",
            opacity: protocolOpacity,
            fontWeight: 700,
          }}
        >
          {protocolText}
        </div>

        {/* "Virtuals AI Council" text (phase 3) */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            fontSize: 36,
            color: TEAL,
            whiteSpace: "nowrap",
            opacity: councilOpacity,
            fontWeight: 700,
            textAlign: "center",
            width: "100%",
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
  durationInFrames: 140,
};
