import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { THEME, DUR } from "./theme";
import { GridLabel } from "./components/GridLabel";

const { fontFamily: inter } = loadInter();

// Scene structure:
// 0-20   : hold (grids imagined still behind — faded out)
// 20-45  : grids dissolve into bars
// 45-60  : "edge" labels fade in
// 60-75  : formula fades in above
// 75-105 : fee flashes red, OTHERS chunk falls, fee crosses out under GM
// 105-135: spread flash
// 135-165: variance flash
// 165-195: knowledge flash
// 195-220: "pure edge" slides in
// 220-300: hold

const BAR_Y_TOP = 500;
const BAR_Y_BOT = 680;
const BAR_HEIGHT = 60;
const BAR_MAX_WIDTH = 1400;
const BAR_X = (1920 - BAR_MAX_WIDTH) / 2;

const TERM_FLASH_FRAMES = [75, 105, 135, 165];
const OTHERS_WIDTHS = [1.0, 0.72, 0.48, 0.24, 0.06];

export const Scene06Formula: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Bar appear (dissolve from grids to bars)
  const barAppear = interpolate(frame, [20, 45], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  // OTHERS bar width — determined by most recent flash applied
  const appliedCount = TERM_FLASH_FRAMES.filter(
    (f) => frame >= f + 6,
  ).length;
  const prevW = OTHERS_WIDTHS[appliedCount];
  const nextW = OTHERS_WIDTHS[Math.min(appliedCount + 1, OTHERS_WIDTHS.length - 1)];
  const currentFlash = TERM_FLASH_FRAMES[appliedCount];
  const widthTransition =
    currentFlash !== undefined
      ? interpolate(frame, [currentFlash, currentFlash + 12], [prevW, nextW], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        })
      : prevW;
  const othersWidth = BAR_MAX_WIDTH * widthTransition * barAppear;

  const gmWidth = BAR_MAX_WIDTH * barAppear;

  // Formula text appears above
  const formulaOpacity = interpolate(frame, [50, 65], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // "pure edge" slides in
  const pureEdgeProgress = spring({
    frame: frame - 200,
    fps,
    from: 0,
    to: 1,
    config: { damping: 14, mass: 0.8, stiffness: 100 },
  });

  const edgeLabelOpacity = interpolate(frame, [45, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Fade out the initial "edge" labels once "pure edge" comes in
  const edgeLabelFadeOut = interpolate(frame, [195, 210], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: THEME.bg,
        fontFamily: inter,
      }}
    >
      {/* Formula above bars */}
      <Formula frame={frame} opacity={formulaOpacity} />

      {/* OTHERS bar */}
      <div
        style={{
          position: "absolute",
          left: BAR_X,
          top: BAR_Y_TOP - 36,
        }}
      >
        <GridLabel text="OTHERS" accent={false} size={18} />
      </div>
      <div
        style={{
          position: "absolute",
          left: BAR_X,
          top: BAR_Y_TOP,
          width: othersWidth,
          height: BAR_HEIGHT,
          background: `linear-gradient(90deg, ${THEME.grey} 0%, ${THEME.greyLine} 100%)`,
          borderRadius: 4,
          border: `1px solid ${THEME.greyLine}`,
          boxShadow: "inset 0 -2px 8px rgba(0,0,0,0.3)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: BAR_X,
          top: BAR_Y_TOP + BAR_HEIGHT + 12,
          color: THEME.textMuted,
          fontSize: 22,
          fontWeight: 500,
          letterSpacing: 2,
          textTransform: "uppercase",
          opacity: edgeLabelOpacity * edgeLabelFadeOut,
        }}
      >
        edge
      </div>

      {/* GM bar */}
      <div
        style={{
          position: "absolute",
          left: BAR_X,
          top: BAR_Y_BOT - 36,
        }}
      >
        <GridLabel text="GENERAL MARKET" accent size={18} />
      </div>
      <div
        style={{
          position: "absolute",
          left: BAR_X,
          top: BAR_Y_BOT,
          width: gmWidth,
          height: BAR_HEIGHT,
          background: `linear-gradient(90deg, ${THEME.greenDim} 0%, ${THEME.green} 100%)`,
          borderRadius: 4,
          border: `1px solid ${THEME.green}`,
          boxShadow: `0 0 24px ${THEME.greenGlow}`,
        }}
      />

      {/* Crossed-out terms under GM bar */}
      <div
        style={{
          position: "absolute",
          left: BAR_X,
          top: BAR_Y_BOT + BAR_HEIGHT + 12,
          display: "flex",
          gap: 22,
          opacity: edgeLabelFadeOut,
        }}
      >
        <TermStrike text="fee" flashFrame={75} frame={frame} />
        <TermStrike text="spread" flashFrame={105} frame={frame} />
        <TermStrike text="variance" flashFrame={135} frame={frame} />
        <TermStrike text="knowledge" flashFrame={165} frame={frame} />
      </div>

      {/* "pure edge" slides in under GM */}
      <div
        style={{
          position: "absolute",
          left: BAR_X,
          top: BAR_Y_BOT + BAR_HEIGHT + 12,
          opacity: pureEdgeProgress,
          transform: `translateY(${(1 - pureEdgeProgress) * 24}px)`,
        }}
      >
        <div
          style={{
            fontSize: 34,
            fontWeight: 700,
            color: THEME.green,
            letterSpacing: 1,
            textTransform: "uppercase",
            textShadow: `0 0 20px ${THEME.greenGlow}`,
          }}
        >
          pure edge
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Formula display at top of frame.
const Formula: React.FC<{ frame: number; opacity: number }> = ({
  frame,
  opacity,
}) => {
  return (
    <div
      style={{
        position: "absolute",
        top: 200,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 32,
        fontSize: 68,
        fontWeight: 500,
        color: THEME.text,
        letterSpacing: -1,
        opacity,
      }}
    >
      <FormulaTerm text="edge" flashFrame={null} frame={frame} />
      <Minus />
      <FormulaTerm text="fee" flashFrame={75} frame={frame} />
      <Minus />
      <FormulaTerm text="spread" flashFrame={105} frame={frame} />
      <Minus />
      <FormulaTerm text="variance" flashFrame={135} frame={frame} />
      <Minus />
      <FormulaTerm text="knowledge" flashFrame={165} frame={frame} />
    </div>
  );
};

const Minus: React.FC = () => (
  <span style={{ color: THEME.textMuted, fontWeight: 300 }}>−</span>
);

const FormulaTerm: React.FC<{
  text: string;
  flashFrame: number | null;
  frame: number;
}> = ({ text, flashFrame, frame }) => {
  if (flashFrame == null) {
    return <span style={{ color: THEME.green }}>{text}</span>;
  }

  const flashProgress = interpolate(
    frame,
    [flashFrame, flashFrame + 6, flashFrame + 18],
    [0, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const color = flashProgress > 0
    ? `rgb(${255}, ${Math.round(75 * (1 - flashProgress))}, ${Math.round(75 * (1 - flashProgress))})`
    : THEME.text;
  const scale = 1 + flashProgress * 0.12;
  const isStruck = frame >= flashFrame + 18;

  return (
    <span
      style={{
        color,
        display: "inline-block",
        transform: `scale(${scale})`,
        textDecoration: isStruck ? "line-through" : "none",
        textDecorationColor: THEME.textMuted,
        textDecorationThickness: 3,
        opacity: isStruck ? 0.55 : 1,
      }}
    >
      {text}
    </span>
  );
};

// Under-GM: each term crosses out as its flash hits.
const TermStrike: React.FC<{
  text: string;
  flashFrame: number;
  frame: number;
}> = ({ text, flashFrame, frame }) => {
  const appear = interpolate(frame, [flashFrame - 2, flashFrame + 6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const strikeProgress = interpolate(
    frame,
    [flashFrame + 2, flashFrame + 14],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <div
      style={{
        position: "relative",
        display: "inline-block",
        fontSize: 22,
        fontWeight: 500,
        color: THEME.textMuted,
        opacity: appear,
      }}
    >
      {text}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: 0,
          width: `${strikeProgress * 100}%`,
          height: 2,
          background: THEME.red,
          transform: "translateY(-1px)",
        }}
      />
    </div>
  );
};

export const scene06FormulaMeta = {
  id: "GM-Scene06Formula",
  component: Scene06Formula,
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: DUR.beat6,
};
