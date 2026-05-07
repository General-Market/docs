import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { font, monoFont } from "../../common/fonts";
import { FPS, colors, toFrames } from "./theme";
import { DotGrid, DotGridVignette } from "./DotGrid";
import { IdleZoom, RevealChars } from "./vibe";

// The juxtaposition. Spot, perps, options drag every predator with them.
// Block trading drags only the one bet that always existed — direction.
// The narrative comes from BlockTradingExile: each market thins the
// predators; blocks refuse all of them.
const SCENE_SECONDS = 6;
const SCENE_FRAMES = toFrames(SCENE_SECONDS);

const HEADLINE_AT = 0;
const LEFT_HEAD_AT = toFrames(0.45);
const LEFT_LIST_AT = toFrames(0.85);
const LEFT_STAGGER = toFrames(0.16);
const OR_AT = toFrames(2.7);
const RIGHT_HEAD_AT = toFrames(3.05);
const RIGHT_ANSWER_AT = toFrames(3.45);
const SUBTITLE_AT = toFrames(4.4);

const PREDATORS = [
  "Liquidation hunting",
  "Orderflow purchase",
  "Frontrunning",
  "Insider trading",
  "Toxic-flow market making",
  "Spoofing & layering",
  "Directional bets",
];

export const AntiCheatBridge: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.bg,
        fontFamily: font,
        overflow: "hidden",
      }}
    >
      <IdleZoom durationInFrames={SCENE_FRAMES} from={1} to={1.025}>
        <DotGrid />
        <Headline />
        <Comparison />
        <Subtitle />
        <DotGridVignette intensity={0.18} />
      </IdleZoom>
    </AbsoluteFill>
  );
};

const Headline: React.FC = () => {
  return (
    <div
      style={{
        position: "absolute",
        top: 88,
        left: 0,
        right: 0,
        textAlign: "center",
        fontFamily: font,
        fontSize: 84,
        fontWeight: 800,
        letterSpacing: "-0.035em",
        color: colors.fg,
        lineHeight: 1.0,
      }}
    >
      <RevealChars
        text="Do you prefer to trade against"
        startFrame={HEADLINE_AT}
        stagger={0.7}
        duration={10}
        y={16}
        blur={4}
      />
    </div>
  );
};

const Comparison: React.FC = () => {
  return (
    <div
      style={{
        position: "absolute",
        top: 280,
        left: 0,
        right: 0,
        bottom: 140,
        display: "grid",
        gridTemplateColumns: "1fr 120px 1fr",
        alignItems: "start",
        padding: "0 140px",
      }}
    >
      <LeftSide />
      <Or />
      <RightSide />
    </div>
  );
};

const LeftSide: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        textAlign: "right",
        paddingRight: 24,
      }}
    >
      <div
        style={{
          fontFamily: monoFont,
          fontSize: 22,
          fontWeight: 500,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: colors.dim,
          marginBottom: 28,
        }}
      >
        <RevealChars
          text="Spot · Perps · Options"
          startFrame={LEFT_HEAD_AT}
          stagger={0.8}
          duration={9}
          y={10}
          blur={3}
        />
      </div>

      {PREDATORS.map((label, i) => (
        <PredatorRow
          key={label}
          label={label}
          index={i}
          frame={frame}
          fps={fps}
        />
      ))}
    </div>
  );
};

const PredatorRow: React.FC<{
  label: string;
  index: number;
  frame: number;
  fps: number;
}> = ({ label, index, frame, fps }) => {
  const start = LEFT_LIST_AT + index * LEFT_STAGGER;
  const local = frame - start;

  const enter = spring({
    frame: local,
    fps,
    config: { damping: 22, stiffness: 130, mass: 0.7 },
  });
  const opacity = interpolate(local, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const x = interpolate(enter, [0, 1], [22, 0]);

  // Strike-through draws after the row settles. Last row (Directional bets)
  // does not strike — it survives into the right side.
  const isSurvivor = index === PREDATORS.length - 1;
  const strikeStart = start + 8;
  const strikeT = isSurvivor
    ? 0
    : interpolate(frame, [strikeStart, strikeStart + 9], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });

  return (
    <div
      style={{
        position: "relative",
        fontFamily: font,
        fontSize: 36,
        fontWeight: 600,
        letterSpacing: "-0.02em",
        color: isSurvivor ? colors.fg : colors.fgSoft,
        opacity,
        transform: `translateX(${x}px)`,
        marginTop: index === 0 ? 0 : 8,
        whiteSpace: "nowrap",
      }}
    >
      <span>{label}</span>
      <span
        style={{
          position: "absolute",
          right: 0,
          top: "52%",
          height: 3,
          width: `${strikeT * 100}%`,
          background: "#E11D29",
          transformOrigin: "right center",
          borderRadius: 2,
          opacity: 0.92,
        }}
      />
    </div>
  );
};

const Or: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const t = spring({
    frame: frame - OR_AT,
    fps,
    config: { damping: 18, stiffness: 140, mass: 0.6 },
  });
  const opacity = interpolate(t, [0, 1], [0, 1]);
  const scale = interpolate(t, [0, 1], [0.6, 1]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        paddingTop: 120,
        gap: 14,
      }}
    >
      <div
        style={{
          width: 1,
          height: 80,
          background: colors.rule,
          opacity,
        }}
      />
      <div
        style={{
          fontFamily: monoFont,
          fontSize: 26,
          fontWeight: 500,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: colors.dim,
          opacity,
          transform: `scale(${scale})`,
        }}
      >
        or
      </div>
      <div
        style={{
          width: 1,
          height: 80,
          background: colors.rule,
          opacity,
        }}
      />
    </div>
  );
};

const RightSide: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headT = spring({
    frame: frame - RIGHT_HEAD_AT,
    fps,
    config: { damping: 22, stiffness: 110, mass: 0.7 },
  });
  const answerT = spring({
    frame: frame - RIGHT_ANSWER_AT,
    fps,
    config: { damping: 16, stiffness: 130, mass: 0.6 },
  });

  const headOpacity = interpolate(headT, [0, 1], [0, 1]);
  const answerOpacity = interpolate(answerT, [0, 1], [0, 1]);
  const answerY = interpolate(answerT, [0, 1], [22, 0]);
  const answerScale = interpolate(answerT, [0, 1], [0.94, 1]);

  // Soft accent bloom behind the survivor.
  const glow = interpolate(answerT, [0, 1], [0, 1]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        textAlign: "left",
        paddingLeft: 24,
      }}
    >
      <div
        style={{
          fontFamily: monoFont,
          fontSize: 22,
          fontWeight: 500,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: colors.accent,
          marginBottom: 28,
          opacity: headOpacity,
        }}
      >
        <RevealChars
          text="Blocks"
          startFrame={RIGHT_HEAD_AT}
          stagger={1.2}
          duration={9}
          y={10}
          blur={3}
        />
      </div>

      <div
        style={{
          position: "relative",
          fontFamily: font,
          fontSize: 56,
          fontWeight: 800,
          letterSpacing: "-0.03em",
          color: colors.accent,
          opacity: answerOpacity,
          transform: `translateY(${answerY}px) scale(${answerScale})`,
          transformOrigin: "left center",
          padding: "10px 0",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: -40,
            background: `radial-gradient(ellipse at center, rgba(0,82,255,${
              0.18 * glow
            }), transparent 70%)`,
            filter: "blur(40px)",
            zIndex: -1,
          }}
        />
        Directional bets
      </div>
    </div>
  );
};

const Subtitle: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [SUBTITLE_AT, SUBTITLE_AT + toFrames(0.4)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const exit = interpolate(
    frame,
    [SCENE_FRAMES - toFrames(0.6), SCENE_FRAMES],
    [1, 0.4],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <div
      style={{
        position: "absolute",
        bottom: 56,
        left: 0,
        right: 0,
        textAlign: "center",
        fontFamily: monoFont,
        fontSize: 26,
        fontWeight: 500,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: colors.dim,
        opacity: opacity * exit,
      }}
    >
      Same assets · seven fewer predators
    </div>
  );
};

export const antiCheatBridgeMeta = {
  id: "AntiCheatBridge",
  component: AntiCheatBridge,
  durationInFrames: SCENE_FRAMES,
  fps: FPS,
  width: 1920,
  height: 1080,
};
