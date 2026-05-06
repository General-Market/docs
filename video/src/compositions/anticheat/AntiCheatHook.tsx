import React from "react";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { font, monoFont } from "../../common/fonts";
import { FPS, H, W, colors, toFrames } from "./theme";
import { DotGrid, DotGridVignette } from "./DotGrid";

const PAIRS = [
  { game: "Spin-bots", trade: "Insider traders" },
  { game: "Wall-hackers", trade: "Front-runners" },
  { game: "Kill aura", trade: "Order-flow buyers" },
] as const;

const HEADER_IN = toFrames(0.3);
const SPLIT_AT = toFrames(2.0);
const PAIRS_AT = toFrames(3.6);
const PAIR_STEP = toFrames(1.4);
const REVEAL_AT = toFrames(7.5);

export const AntiCheatHook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const splitProgress = spring({
    frame: frame - SPLIT_AT,
    fps,
    config: { damping: 18, stiffness: 90, mass: 0.9 },
  });
  const splitOffset = interpolate(splitProgress, [0, 1], [0, W / 2], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg, fontFamily: font }}>
      <DotGrid />

      {/* Left panel */}
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          right: `${splitOffset}px`,
          overflow: "hidden",
          borderRight: `1px solid ${colors.rule}`,
        }}
      >
        <PanelLabel
          eyebrow="When you play"
          slot="01 / Game"
          showFrom={HEADER_IN}
          align="left"
          frame={frame}
          fps={fps}
        />
        <PairList
          pairs={PAIRS}
          field="game"
          align="left"
          startFrame={PAIRS_AT}
          stepFrame={PAIR_STEP}
          frame={frame}
          fps={fps}
        />
      </div>

      {/* Right panel — slides in from the right edge at SPLIT_AT */}
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: `${W - splitOffset}px`,
          right: 0,
          overflow: "hidden",
          borderLeft: `1px solid ${colors.ruleStrong}`,
          backgroundColor: colors.bg,
        }}
      >
        {/* The right panel gets a slightly stronger dot density so the eye
            registers the split before reading the labels. */}
        <DotGrid intensity={1.3} />
        <PanelLabel
          eyebrow="When you trade"
          slot="02 / Market"
          showFrom={SPLIT_AT}
          align="right"
          frame={frame}
          fps={fps}
          tint={colors.accent}
        />
        <PairList
          pairs={PAIRS}
          field="trade"
          align="right"
          startFrame={PAIRS_AT}
          stepFrame={PAIR_STEP}
          frame={frame}
          fps={fps}
          tint={colors.accent}
        />
      </div>

      <Sequence from={REVEAL_AT} layout="none">
        <RevealLines />
      </Sequence>

      <DotGridVignette intensity={0.22} />
    </AbsoluteFill>
  );
};

// ─── Text components ──────────────────────────────────────────────────────────

const PanelLabel: React.FC<{
  eyebrow: string;
  slot: string;
  showFrom: number;
  align: "left" | "right";
  frame: number;
  fps: number;
  tint?: string;
}> = ({ eyebrow, slot, showFrom, align, frame, fps, tint }) => {
  const t = spring({
    frame: frame - showFrom,
    fps,
    config: { damping: 22, stiffness: 110, mass: 0.7 },
  });
  const y = interpolate(t, [0, 1], [24, 0]);
  const opacity = interpolate(t, [0, 1], [0, 1]);

  return (
    <div
      style={{
        position: "absolute",
        top: "12%",
        left: 0,
        right: 0,
        textAlign: align === "left" ? "left" : "right",
        padding: "0 96px",
        opacity,
        transform: `translateY(${y}px)`,
      }}
    >
      <div
        style={{
          fontFamily: monoFont,
          fontSize: 38,
          fontWeight: 500,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: colors.dim,
          marginBottom: 22,
          display: "flex",
          alignItems: "center",
          gap: 18,
          flexDirection: align === "left" ? "row" : "row-reverse",
          justifyContent: align === "left" ? "flex-start" : "flex-end",
        }}
      >
        <span
          style={{
            display: "inline-block",
            width: 22,
            height: 22,
            background: tint ?? colors.fg,
          }}
        />
        <span>{slot}</span>
      </div>
      <div
        style={{
          fontFamily: font,
          fontSize: 124,
          fontWeight: 800,
          letterSpacing: "-0.04em",
          color: tint ?? colors.fg,
          lineHeight: 0.95,
        }}
      >
        {eyebrow}
      </div>
    </div>
  );
};

const PairList: React.FC<{
  pairs: typeof PAIRS;
  field: "game" | "trade";
  align: "left" | "right";
  startFrame: number;
  stepFrame: number;
  frame: number;
  fps: number;
  tint?: string;
}> = ({ pairs, field, align, startFrame, stepFrame, frame, fps, tint }) => {
  return (
    <div
      style={{
        position: "absolute",
        bottom: "10%",
        left: 0,
        right: 0,
        textAlign: align === "left" ? "left" : "right",
        padding: "0 96px",
        display: "flex",
        flexDirection: "column",
        gap: 22,
        alignItems: align === "left" ? "flex-start" : "flex-end",
      }}
    >
      {pairs.map((pair, i) => {
        const at = startFrame + i * stepFrame;
        const t = spring({
          frame: frame - at,
          fps,
          config: { damping: 24, stiffness: 130, mass: 0.6 },
        });
        const x = interpolate(t, [0, 1], [align === "left" ? -40 : 40, 0]);
        const opacity = interpolate(t, [0, 1], [0, 1]);

        return (
          <div
            key={i}
            style={{
              transform: `translateX(${x}px)`,
              opacity,
              fontFamily: font,
              fontSize: 76,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              color: tint ?? colors.fg,
              display: "flex",
              alignItems: "baseline",
              gap: 24,
              flexDirection: align === "left" ? "row" : "row-reverse",
            }}
          >
            <span
              style={{
                fontFamily: monoFont,
                fontSize: 32,
                fontWeight: 500,
                color: colors.dim,
                opacity: 0.8,
                minWidth: 48,
                letterSpacing: "0.06em",
              }}
            >
              0{i + 1}
            </span>
            <span>{pair[field]}</span>
          </div>
        );
      })}
    </div>
  );
};

const RevealLines: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const t1 = spring({
    frame,
    fps,
    config: { damping: 22, stiffness: 100, mass: 0.8 },
  });
  const t2 = spring({
    frame: frame - toFrames(0.7),
    fps,
    config: { damping: 22, stiffness: 100, mass: 0.8 },
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        background: "rgba(240, 242, 244, 0.86)",
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        style={{
          fontFamily: font,
          fontWeight: 800,
          fontSize: 96,
          letterSpacing: "-0.035em",
          textAlign: "center",
          color: colors.fg,
          lineHeight: 1.05,
        }}
      >
        <div
          style={{
            opacity: interpolate(t1, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(t1, [0, 1], [16, 0])}px)`,
          }}
        >
          The same cheaters ruining your games
        </div>
        <div
          style={{
            opacity: interpolate(t2, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(t2, [0, 1], [16, 0])}px)`,
            color: colors.accent,
            marginTop: 18,
          }}
        >
          are trading against you
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const antiCheatHookMeta = {
  id: "AntiCheatHook",
  component: AntiCheatHook,
  durationInFrames: toFrames(9.5),
  fps: FPS,
  width: W,
  height: H,
};
