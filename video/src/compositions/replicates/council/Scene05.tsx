import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/SpaceMono";

const { fontFamily } = loadFont();
const TEAL = "#4ECDC4";
const DARK = "#1A1A2E";

export const Scene05: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phase 0 (0-8): White bg fades in
  const bgOpacity = interpolate(frame, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Phase 1 (8-26): "Rationales feed into" — words appear sequentially
  const words = ["Rationales", "feed", "into"];
  const tealWord = "consensus";
  const wordStartFrame = 8;
  const wordGap = 6;
  const tealWordStart = wordStartFrame + words.length * wordGap; // frame 26

  // "consensus" teal word animation
  const tealWordY = spring({
    frame: Math.max(0, frame - tealWordStart),
    fps,
    from: 12,
    to: 0,
    durationInFrames: 12,
  });
  const tealWordOpacity = interpolate(frame, [tealWordStart, tealWordStart + 3], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Phase 1 fade out (36-45)
  const phase1Opacity = interpolate(frame, [36, 45], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Phase 2 (45-90): "Scores" then "converge"
  const scoresY = spring({
    frame: Math.max(0, frame - 45),
    fps,
    from: 12,
    to: 0,
    durationInFrames: 16,
  });
  const scoresOpacity = interpolate(frame, [45, 48], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const convergeY = spring({
    frame: Math.max(0, frame - 53),
    fps,
    from: 12,
    to: 0,
    durationInFrames: 16,
  });
  const convergeOpacity = interpolate(frame, [53, 56], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Hold "Scores converge" visible, then fade out at the end
  const phase2Opacity = interpolate(frame, [45, 48, 78, 90], [0, 1, 1, 0], {
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
        opacity: bgOpacity,
      }}
    >
      {/* Phase 1: "Rationales feed into consensus" — single line */}
      <div
        style={{
          display: "flex",
          gap: 14,
          opacity: phase1Opacity,
          position: "absolute",
          whiteSpace: "nowrap",
          flexWrap: "nowrap",
        }}
      >
        {words.map((word, i) => {
          const start = wordStartFrame + i * wordGap;
          const y = spring({
            frame: Math.max(0, frame - start),
            fps,
            from: 12,
            to: 0,
            durationInFrames: 12,
          });
          const opacity = interpolate(frame, [start, start + 3], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <span
              key={word}
              style={{
                fontSize: 36,
                color: DARK,
                fontWeight: 700,
                transform: `translateY(${y}px)`,
                opacity,
                display: "inline-block",
                whiteSpace: "nowrap",
              }}
            >
              {word}
            </span>
          );
        })}
        <span
          style={{
            fontSize: 36,
            color: TEAL,
            fontWeight: 700,
            transform: `translateY(${tealWordY}px)`,
            opacity: tealWordOpacity,
            display: "inline-block",
            whiteSpace: "nowrap",
          }}
        >
          {tealWord}
        </span>
      </div>

      {/* Phase 2: "Scores converge" — single line */}
      <div
        style={{
          display: "flex",
          gap: 14,
          opacity: phase2Opacity,
          position: "absolute",
          whiteSpace: "nowrap",
          flexWrap: "nowrap",
        }}
      >
        <span
          style={{
            fontSize: 36,
            color: DARK,
            fontWeight: 700,
            transform: `translateY(${scoresY}px)`,
            opacity: scoresOpacity,
            display: "inline-block",
            whiteSpace: "nowrap",
          }}
        >
          Scores
        </span>
        <span
          style={{
            fontSize: 36,
            color: TEAL,
            fontWeight: 700,
            transform: `translateY(${convergeY}px)`,
            opacity: convergeOpacity,
            display: "inline-block",
            whiteSpace: "nowrap",
          }}
        >
          converge
        </span>
      </div>
    </AbsoluteFill>
  );
};

export const scene05Meta = {
  id: "Council-Scene05",
  component: Scene05,
  width: 1280,
  height: 720,
  fps: 30,
  durationInFrames: 90,
};
