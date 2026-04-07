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
const TEAL = "#0FE8AE";
const DARK = "#000000";

export const Scene05: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phase 1 (0-55): "Rationales feed into consensus metric"
  // 0-15:  "Rationales feed into" types in (3 words across 15 frames)
  // 15-30: "consensus metric" types in (2 teal words across 15 frames)
  // 30-50: hold
  // 50-55: fade
  const darkWords = ["Rationales", "feed", "into"];
  const tealWords = ["consensus", "metric"];

  const darkWordStart = 0;
  const darkWordSpan = 15;
  const darkWordGap = darkWordSpan / darkWords.length; // 5 frames per word

  const tealWordStart = 15;
  const tealWordSpan = 15;
  const tealWordGap = tealWordSpan / tealWords.length; // 7.5 frames per word

  const phase1Opacity = interpolate(frame, [0, 1, 50, 55], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Blank: 55-60 — both phases hidden

  // Phase 2 (60-110): "Scores converge"
  // 60-70:  "Scores" types in
  // 70-78:  "converge" types in
  // 78-100: hold
  // 100-110: fade
  const scoresStart = 60;
  const convergeStart = 70;

  const scoresY = spring({
    frame: Math.max(0, frame - scoresStart),
    fps,
    from: 12,
    to: 0,
    durationInFrames: 16,
  });
  const scoresOpacity = interpolate(
    frame,
    [scoresStart, scoresStart + 4],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  const convergeY = spring({
    frame: Math.max(0, frame - convergeStart),
    fps,
    from: 12,
    to: 0,
    durationInFrames: 16,
  });
  const convergeOpacity = interpolate(
    frame,
    [convergeStart, convergeStart + 4],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  const phase2Opacity = interpolate(
    frame,
    [60, 61, 100, 110],
    [0, 1, 1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#fff",
        justifyContent: "center",
        alignItems: "center",
        fontFamily,
      }}
    >
      {/* Phase 1: "Rationales feed into consensus metric" — single line */}
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
        {darkWords.map((word, i) => {
          const start = darkWordStart + i * darkWordGap;
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
        {tealWords.map((word, i) => {
          const start = tealWordStart + i * tealWordGap;
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
                color: TEAL,
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
  durationInFrames: 110,
};
