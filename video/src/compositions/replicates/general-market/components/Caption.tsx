import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { THEME } from "../theme";

const { fontFamily: inter } = loadInter();

type Props = {
  headline: string;
  subtitle: string;
  startFrame: number;
  headlineCharsPerFrame?: number;
  subtitleCharsPerFrame?: number;
  subtitleDelay?: number;
  position?: "top" | "bottom";
  exitFrame?: number;
};

export const Caption: React.FC<Props> = ({
  headline,
  subtitle,
  startFrame,
  headlineCharsPerFrame = 1.2,
  subtitleCharsPerFrame = 1.4,
  subtitleDelay = 0,
  position = "top",
  exitFrame,
}) => {
  const frame = useCurrentFrame();

  const headlineElapsed = Math.max(0, frame - startFrame);
  const headlineChars = Math.min(
    headline.length,
    Math.floor(headlineElapsed * headlineCharsPerFrame),
  );
  const headlineText = headline.slice(0, headlineChars);

  const subtitleStart =
    startFrame +
    Math.ceil(headline.length / headlineCharsPerFrame) +
    subtitleDelay;
  const subtitleElapsed = Math.max(0, frame - subtitleStart);
  const subtitleChars = Math.min(
    subtitle.length,
    Math.floor(subtitleElapsed * subtitleCharsPerFrame),
  );
  const subtitleText = subtitle.slice(0, subtitleChars);

  const fadeIn = interpolate(
    frame,
    [startFrame, startFrame + 8],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const fadeOut = exitFrame
    ? interpolate(frame, [exitFrame - 12, exitFrame], [1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1;
  const opacity = Math.min(fadeIn, fadeOut);

  return (
    <div
      style={{
        position: "absolute",
        top: position === "top" ? 80 : undefined,
        bottom: position === "bottom" ? 80 : undefined,
        left: 0,
        right: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
        fontFamily: inter,
        opacity,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 18,
          fontSize: 52,
          fontWeight: 600,
          color: THEME.text,
          letterSpacing: -0.5,
          minHeight: 62,
        }}
      >
        <div
          style={{
            width: 5,
            height: 48,
            background: THEME.green,
            flexShrink: 0,
          }}
        />
        <div>{headlineText}</div>
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 400,
          color: THEME.textMuted,
          minHeight: 36,
          paddingLeft: 23,
        }}
      >
        {subtitleText}
      </div>
    </div>
  );
};
