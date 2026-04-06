import React from "react";
import { useCurrentFrame, useVideoConfig, spring } from "remotion";

interface WordRevealProps {
  text: string;
  startFrame?: number;
  framesPerWord?: number;
  fontSize?: number;
  color?: string;
  highlightWords?: Record<string, string>;
  centerY?: number;
  maxWidth?: number;
}

export const WordReveal: React.FC<WordRevealProps> = ({
  text,
  startFrame = 0,
  framesPerWord = 8,
  fontSize = 42,
  color = "#1a1a1a",
  highlightWords = {},
  centerY = 55,
  maxWidth = 1200,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(/\s+/);

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: `${centerY}%`,
        transform: "translate(-50%, -50%)",
        maxWidth,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: `0 ${fontSize * 0.3}px`,
        fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
        fontSize,
        lineHeight: 1.4,
      }}
    >
      {words.map((word, i) => {
        const wordStart = startFrame + i * framesPerWord;
        const elapsed = frame - wordStart;
        const progress = spring({
          frame: Math.max(0, elapsed),
          fps,
          config: { damping: 18, stiffness: 120, mass: 0.6 },
          durationInFrames: 6,
        });
        const opacity = elapsed < 0 ? 0 : progress;
        const translateY = elapsed < 0 ? 15 : 15 * (1 - progress);
        const wordColor = highlightWords[word] || color;
        return (
          <span
            key={i}
            style={{
              opacity,
              transform: `translateY(${translateY}px)`,
              color: wordColor,
              fontWeight: highlightWords[word] ? 700 : 400,
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};
