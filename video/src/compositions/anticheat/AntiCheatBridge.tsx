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
// Narrative: BlockTradingExile. Visual register: Reassure (84px hero,
// accent emphasis, dot grid, mono eyebrows). The asymmetry between a
// dense ledger of seven and a single hero word does the work — no
// strikethroughs, no slide-deck affordances.
const SCENE_SECONDS = 6.0;
const SCENE_FRAMES = toFrames(SCENE_SECONDS);

// Bridge starts on beat 32. Scene-local beats: 0, 25, 51, 77.
// The OR pivot lands on beat 3 (frame 77) — last beat in the scene
// before the music tails out.
const HEADLINE_AT = 0;
const LEFT_EYEBROW_AT = 25;
const LEFT_LIST_AT = 30;
const LEFT_STAGGER = toFrames(0.13);
const OR_AT = 77;
const RIGHT_EYEBROW_AT = 90;
const RIGHT_ANSWER_AT = 102;
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
      <IdleZoom durationInFrames={SCENE_FRAMES} from={1} to={1.022}>
        <DotGrid />
        <Headline />
        <Stage />
        <DotGridVignette intensity={0.20} />
      </IdleZoom>
    </AbsoluteFill>
  );
};

// ─── Headline ─────────────────────────────────────────────────────────────────

const Headline: React.FC = () => (
  <div
    style={{
      position: "absolute",
      top: 96,
      left: 0,
      right: 0,
      textAlign: "center",
      fontFamily: font,
      fontSize: 76,
      fontWeight: 700,
      letterSpacing: "-0.032em",
      color: colors.fg,
      lineHeight: 1.0,
    }}
  >
    <RevealChars
      text="Do you prefer to trade against"
      startFrame={HEADLINE_AT}
      stagger={0.65}
      duration={10}
      y={14}
      blur={4}
    />
  </div>
);

// ─── Stage: left ledger · or · right answer ───────────────────────────────────

const Stage: React.FC = () => (
  <div
    style={{
      position: "absolute",
      top: 296,
      left: 0,
      right: 0,
      bottom: 168,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      paddingLeft: 120,
      paddingRight: 120,
    }}
  >
    <LeftLedger />
    <OrPivot />
    <RightAnswer />
  </div>
);

// ─── Left: dim ledger of seven ────────────────────────────────────────────────

const LeftLedger: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const eyebrowT = spring({
    frame: frame - LEFT_EYEBROW_AT,
    fps,
    config: { damping: 22, stiffness: 130, mass: 0.6 },
  });

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        textAlign: "right",
      }}
    >
      <div
        style={{
          fontFamily: monoFont,
          fontSize: 22,
          fontWeight: 500,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: colors.dim,
          marginBottom: 36,
          opacity: interpolate(eyebrowT, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(eyebrowT, [0, 1], [10, 0])}px)`,
        }}
      >
        Spot · Perps · Options
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 6,
        }}
      >
        {PREDATORS.map((label, i) => (
          <PredatorLine
            key={label}
            label={label}
            index={i}
            frame={frame}
            fps={fps}
          />
        ))}
      </div>
    </div>
  );
};

const PredatorLine: React.FC<{
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
    config: { damping: 24, stiffness: 140, mass: 0.65 },
  });
  const opacity = interpolate(local, [0, 9], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const x = interpolate(enter, [0, 1], [18, 0]);
  const blur = interpolate(local, [0, 10], [4, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        fontFamily: font,
        fontSize: 38,
        fontWeight: 500,
        letterSpacing: "-0.022em",
        color: colors.dim,
        opacity,
        transform: `translateX(${x}px)`,
        filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </div>
  );
};

// ─── Or: vertical pivot, mono caps with hairlines above/below ────────────────

const OrPivot: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const t = spring({
    frame: frame - OR_AT,
    fps,
    config: { damping: 18, stiffness: 130, mass: 0.6 },
  });
  const opacity = interpolate(t, [0, 1], [0, 1]);
  const lineGrow = interpolate(t, [0, 1], [0, 1]);

  return (
    <div
      style={{
        width: 180,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
        opacity,
      }}
    >
      <div
        style={{
          width: 1,
          height: 110 * lineGrow,
          background: colors.ruleStrong,
        }}
      />
      <div
        style={{
          fontFamily: monoFont,
          fontSize: 28,
          fontWeight: 500,
          letterSpacing: "0.32em",
          textTransform: "uppercase",
          color: colors.fgSoft,
        }}
      >
        or
      </div>
      <div
        style={{
          width: 1,
          height: 110 * lineGrow,
          background: colors.ruleStrong,
        }}
      />
    </div>
  );
};

// ─── Right: hero answer in accent blue with bloom ─────────────────────────────

const RightAnswer: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const eyebrowT = spring({
    frame: frame - RIGHT_EYEBROW_AT,
    fps,
    config: { damping: 22, stiffness: 130, mass: 0.6 },
  });
  const answerT = spring({
    frame: frame - RIGHT_ANSWER_AT,
    fps,
    config: { damping: 16, stiffness: 120, mass: 0.7 },
  });

  // Land + breathe — slight scale punch on arrival, then a quiet
  // sine breath so the hero word doesn't sit dead for the rest of the
  // scene.
  const sinceLand = Math.max(0, frame - RIGHT_ANSWER_AT - 14);
  const breath = 1 + Math.sin(sinceLand / 28) * 0.008;

  const eyebrowOpacity = interpolate(eyebrowT, [0, 1], [0, 1]);
  const eyebrowY = interpolate(eyebrowT, [0, 1], [12, 0]);

  const answerOpacity = interpolate(answerT, [0, 1], [0, 1]);
  const answerY = interpolate(answerT, [0, 1], [28, 0]);
  const answerBlur = interpolate(answerT, [0, 1], [12, 0]);
  const punch = interpolate(answerT, [0, 0.6, 1], [0.92, 1.04, 1]);
  const answerScale = punch * breath;

  const bloom = interpolate(answerT, [0, 1], [0, 1]);

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "center",
        textAlign: "left",
      }}
    >
      <div
        style={{
          fontFamily: monoFont,
          fontSize: 22,
          fontWeight: 500,
          letterSpacing: "0.32em",
          textTransform: "uppercase",
          color: colors.accent,
          marginBottom: 32,
          opacity: eyebrowOpacity,
          transform: `translateY(${eyebrowY}px)`,
        }}
      >
        Blocks
      </div>

      <div
        style={{
          position: "relative",
          fontFamily: font,
          fontSize: 104,
          fontWeight: 800,
          letterSpacing: "-0.04em",
          lineHeight: 0.96,
          color: colors.accent,
          opacity: answerOpacity,
          transform: `translateY(${answerY}px) scale(${answerScale})`,
          transformOrigin: "left center",
          filter: answerBlur > 0.05 ? `blur(${answerBlur.toFixed(2)}px)` : undefined,
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: -90,
            background: `radial-gradient(ellipse at 30% 50%, rgba(0,82,255,${
              0.22 * bloom
            }), transparent 65%)`,
            filter: "blur(60px)",
            zIndex: -1,
            pointerEvents: "none",
          }}
        />
        Directional
        <br />
        bets.
      </div>
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
