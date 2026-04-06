import React from "react";
import { useCurrentFrame, interpolate, Easing } from "remotion";
import { loadFont } from "@remotion/google-fonts/SpaceMono";

const { fontFamily } = loadFont();

export interface StrikethroughProps {
  text: string;
  startFrame: number;
  strikeFrame: number;
  strikeDurationFrames: number;
  fontSize?: number;
  textColor?: string;
  strikeColor?: string;
}

export const Strikethrough: React.FC<StrikethroughProps> = ({
  text,
  startFrame,
  strikeFrame,
  strikeDurationFrames,
  fontSize = 48,
  textColor = "#ffffff",
  strikeColor = "#ff3b30",
}) => {
  const frame = useCurrentFrame();
  const localFrame = frame - startFrame;

  // Text fade in
  const textOpacity = interpolate(localFrame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Strike progress 0 -> 1
  const strikeProgress = interpolate(
    localFrame,
    [strikeFrame, strikeFrame + strikeDurationFrames],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    },
  );

  // Approximate text width: monospace ~0.6em per char, with extra padding
  const charWidth = fontSize * 0.62;
  const approxWidth = text.length * charWidth;
  const horizontalPad = fontSize * 0.18;
  const svgWidth = approxWidth + horizontalPad * 2;
  const svgHeight = fontSize * 1.2;
  const lineY = svgHeight * 0.55;

  // Stroke-dash drawing animation
  const lineLength = svgWidth;
  const dashOffset = lineLength * (1 - strikeProgress);
  const strikeOpacity = strikeProgress > 0 ? 1 : 0;

  return (
    <div
      style={{
        position: "relative",
        display: "inline-block",
        fontFamily,
        opacity: textOpacity,
      }}
    >
      <div
        style={{
          fontSize,
          color: textColor,
          fontWeight: 600,
          letterSpacing: 1,
          padding: `0 ${horizontalPad}px`,
          lineHeight: 1.2,
          whiteSpace: "nowrap",
        }}
      >
        {text}
      </div>
      <svg
        width={svgWidth}
        height={svgHeight}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          pointerEvents: "none",
        }}
      >
        <line
          x1={horizontalPad * 0.4}
          y1={lineY}
          x2={svgWidth - horizontalPad * 0.4}
          y2={lineY}
          stroke={strikeColor}
          strokeWidth={Math.max(3, fontSize * 0.07)}
          strokeLinecap="round"
          strokeDasharray={lineLength}
          strokeDashoffset={dashOffset}
          opacity={strikeOpacity}
        />
      </svg>
    </div>
  );
};
