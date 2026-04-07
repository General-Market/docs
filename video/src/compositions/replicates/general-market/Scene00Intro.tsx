import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { THEME, DUR } from "./theme";

const { fontFamily: inter } = loadInter();

const LINE_ONE = "Meet General Market.";
const LINE_TWO = "A prediction market to empower algo traders.";

const useTypewriter = (
  text: string,
  startFrame: number,
  charsPerFrame: number,
) => {
  const frame = useCurrentFrame();
  const elapsed = Math.max(0, frame - startFrame);
  return text.slice(0, Math.min(text.length, Math.floor(elapsed * charsPerFrame)));
};

export const Scene00Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const total = DUR.intro;

  const line1 = useTypewriter(LINE_ONE, 6, 1.3);
  const line2 = useTypewriter(LINE_TWO, 34, 1.5);

  const fadeIn = interpolate(frame, [0, 6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(frame, [total - 12, total], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = Math.min(fadeIn, fadeOut);

  const cursorOn = Math.floor(frame / 8) % 2 === 0;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#000",
        fontFamily: inter,
        color: THEME.text,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "flex-start",
        paddingLeft: 220,
        paddingRight: 220,
        opacity,
      }}
    >
      <Line
        text={line1}
        size={84}
        showCursor={cursorOn && line1.length < LINE_ONE.length}
      />
      <div style={{ height: 28 }} />
      <Line
        text={line2}
        size={84}
        showCursor={
          cursorOn &&
          line1.length === LINE_ONE.length &&
          line2.length < LINE_TWO.length
        }
      />
    </AbsoluteFill>
  );
};

const Line: React.FC<{
  text: string;
  size: number;
  showCursor: boolean;
}> = ({ text, size, showCursor }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 28,
      fontSize: size,
      fontWeight: 500,
      letterSpacing: -1.5,
      lineHeight: 1.05,
    }}
  >
    <div
      style={{
        width: 6,
        height: size * 0.9,
        background: THEME.green,
        flexShrink: 0,
      }}
    />
    <div style={{ whiteSpace: "nowrap" }}>
      {text}
      <span
        style={{
          display: "inline-block",
          width: size * 0.5,
          marginLeft: 4,
          color: THEME.green,
          opacity: showCursor ? 1 : 0,
        }}
      >
        _
      </span>
    </div>
  </div>
);

export const scene00IntroMeta = {
  id: "GM-Scene00Intro",
  component: Scene00Intro,
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: DUR.intro,
};
