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

  // Phase 0 (0-10): White bg fades in
  const bgOpacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Phase 1 (10-40): "Rationales feed into" — words appear sequentially
  const words = ["Rationales", "feed", "into"];
  const tealWord = "consensus";
  const wordStartFrame = 10;
  const wordGap = 8;
  const tealWordStart = wordStartFrame + words.length * wordGap; // frame 34

  // "consensus" teal word animation
  const tealWordY = spring({
    frame: Math.max(0, frame - tealWordStart),
    fps,
    from: 15,
    to: 0,
    durationInFrames: 15,
  });
  const tealWordOpacity = interpolate(frame, [tealWordStart, tealWordStart + 3], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Phase 2 (48-60): Fade out first phrase
  const phase1Opacity = interpolate(frame, [48, 60], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Phase 3 (60-110): "Scores" then "converge"
  const scoresY = spring({
    frame: Math.max(0, frame - 60),
    fps,
    from: 15,
    to: 0,
    durationInFrames: 20,
  });
  const scoresOpacity = interpolate(frame, [60, 63], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const convergeY = spring({
    frame: Math.max(0, frame - 70),
    fps,
    from: 15,
    to: 0,
    durationInFrames: 20,
  });
  const convergeOpacity = interpolate(frame, [70, 73], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Hold "Scores converge" visible, then fade out at the end
  const phase2Opacity = interpolate(frame, [60, 63, 100, 120], [0, 1, 1, 0], {
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
      {/* Phase 1: "Rationales feed into" */}
      <div
        style={{
          display: "flex",
          gap: 14,
          opacity: phase1Opacity,
          position: "absolute",
        }}
      >
        {words.map((word, i) => {
          const start = wordStartFrame + i * wordGap;
          const y = spring({
            frame: Math.max(0, frame - start),
            fps,
            from: 15,
            to: 0,
            durationInFrames: 15,
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
          }}
        >
          {tealWord}
        </span>
      </div>

      {/* Phase 2: "Scores converge" */}
      <div
        style={{
          display: "flex",
          gap: 14,
          opacity: phase2Opacity,
          position: "absolute",
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
  durationInFrames: 120,
};
