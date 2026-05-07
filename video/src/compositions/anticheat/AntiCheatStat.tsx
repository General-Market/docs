import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { font, monoFont } from "../../common/fonts";
import { FPS, H, W, colors, toFrames } from "./theme";
import { DotGrid, DotGridVignette } from "./DotGrid";
import { ParallaxText } from "./transitions";
import { IdleZoom, RevealChars } from "./vibe";

// Two compositions live in this file:
//   AntiCheatStat — the 0.01% / 70% concentration numbers (4s)
//   AntiCheatBars — the % extracted by unfair trading bar chart (3.5s)
const STAT_SECONDS = 4;
const BARS_SECONDS = 4;
const STAT_FRAMES = toFrames(STAT_SECONDS);
const BARS_FRAMES = toFrames(BARS_SECONDS);

export const AntiCheatStat: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg, fontFamily: font }}>
      <IdleZoom durationInFrames={STAT_FRAMES} from={1} to={1.04}>
        <DotGrid />
        <StatPanel />
        <DotGridVignette intensity={0.22} />
      </IdleZoom>
    </AbsoluteFill>
  );
};

export const AntiCheatBars: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg, fontFamily: font }}>
      <IdleZoom durationInFrames={BARS_FRAMES} from={1} to={1.025}>
        <DotGrid />
        <ExtractionBars />
        <DotGridVignette intensity={0.22} />
      </IdleZoom>
    </AbsoluteFill>
  );
};

// ─── Stat panel: 0.01% take 70% / 99.9% get 30% ──────────────────────────────

const StatPanel: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({
    frame,
    fps,
    config: { damping: 22, stiffness: 110, mass: 0.7 },
  });
  const exit = spring({
    frame: frame - (toFrames(STAT_SECONDS) - toFrames(0.4)),
    fps,
    config: { damping: 28, stiffness: 140, mass: 0.6 },
  });
  const opacity = interpolate(enter, [0, 1], [0, 1]) * (1 - exit);

  const countT = Math.min(1, Math.max(0, frame / toFrames(1.2)));
  const eased = 1 - Math.pow(1 - countT, 3);
  const left = (0.01 * eased).toFixed(2);
  const right = Math.round(70 * eased);

  const takeT = interpolate(
    frame,
    [toFrames(0.4), toFrames(1.0)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Inverse row enters after the main stat lands — first the divider,
  // then the row, all driven from the same spring family.
  const dividerT = interpolate(
    frame,
    [toFrames(1.4), toFrames(2.0)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const inverseEnter = spring({
    frame: frame - toFrames(1.7),
    fps,
    config: { damping: 24, stiffness: 120, mass: 0.7 },
  });
  const inverseGetT = interpolate(
    frame,
    [toFrames(2.0), toFrames(2.45)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill style={{ opacity }}>
      <Caption />

      <StatRow
        leftValue={`${left}%`}
        leftSubtitle="of traders"
        leftTint={colors.fg}
        rightValue={`${right}%`}
        rightSubtitle="of all profits"
        rightTint={colors.accent}
        verb="take"
        verbT={takeT}
        sizes={SIZES_PRIMARY}
        topPercent={26}
        rowOpacity={1}
      />

      <Divider t={dividerT} />

      <StatRow
        leftValue="99.9%"
        leftSubtitle="of traders"
        leftTint={colors.fgSoft}
        rightValue="30%"
        rightSubtitle="of profits"
        rightTint={colors.accentSoft}
        verb="get"
        verbT={inverseGetT}
        sizes={SIZES_SECONDARY}
        topPercent={66}
        rowOpacity={interpolate(inverseEnter, [0, 1], [0, 1])}
      />
    </AbsoluteFill>
  );
};

// ─── Caption — sets the frame, monospace, dim, anchors the slide. ────────

const Caption: React.FC = () => (
  <div
    style={{
      position: "absolute",
      top: "9%",
      left: 0,
      right: 0,
      textAlign: "center",
      fontFamily: monoFont,
      fontSize: 32,
      fontWeight: 500,
      letterSpacing: "0.22em",
      textTransform: "uppercase",
      color: colors.dim,
    }}
  >
    <RevealChars
      text="who captures the profits"
      startFrame={0}
      stagger={0.5}
      duration={8}
      y={8}
      blur={1.5}
      scale={0.97}
    />
  </div>
);

// ─── StatRow — one balanced row: number / verb / number with subtitles. ──

type StatSizes = {
  number: number;
  subtitle: number;
  verb: number;
  marginTop: number;
  verbLift: number;
};

const SIZES_PRIMARY: StatSizes = {
  number: 200,
  subtitle: 64,
  verb: 84,
  marginTop: 18,
  verbLift: 28,
};

const SIZES_SECONDARY: StatSizes = {
  number: 96,
  subtitle: 36,
  verb: 44,
  marginTop: 10,
  verbLift: 14,
};

const StatRow: React.FC<{
  leftValue: string;
  leftSubtitle: string;
  leftTint: string;
  rightValue: string;
  rightSubtitle: string;
  rightTint: string;
  verb: string;
  verbT: number;
  sizes: StatSizes;
  topPercent: number;
  rowOpacity: number;
}> = ({
  leftValue,
  leftSubtitle,
  leftTint,
  rightValue,
  rightSubtitle,
  rightTint,
  verb,
  verbT,
  sizes,
  topPercent,
  rowOpacity,
}) => {
  return (
    <div
      style={{
        position: "absolute",
        top: `${topPercent}%`,
        left: 0,
        right: 0,
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "baseline",
        columnGap: 48,
        padding: "0 220px",
        opacity: rowOpacity,
      }}
    >
      <BigNumber
        value={leftValue}
        subtitle={leftSubtitle}
        tint={leftTint}
        sizes={sizes}
        align="end"
      />
      <Verb word={verb} t={verbT} sizes={sizes} />
      <BigNumber
        value={rightValue}
        subtitle={rightSubtitle}
        tint={rightTint}
        sizes={sizes}
        align="start"
      />
    </div>
  );
};

const Verb: React.FC<{ word: string; t: number; sizes: StatSizes }> = ({
  word,
  t,
  sizes,
}) => (
  <div
    style={{
      fontFamily: font,
      fontSize: sizes.verb,
      fontWeight: 500,
      letterSpacing: "-0.01em",
      color: colors.dim,
      opacity: t,
      transform: `translateY(${(1 - t) * 12}px)`,
      // Pull up so the verb sits visually between digit centers,
      // not on the subtitle's baseline.
      paddingBottom: sizes.verbLift,
    }}
  >
    {word}
  </div>
);

const BigNumber: React.FC<{
  value: string;
  subtitle: string;
  tint: string;
  sizes: StatSizes;
  align: "start" | "end";
}> = ({ value, subtitle, tint, sizes, align }) => {
  return (
    <div
      style={{
        textAlign: align === "end" ? "right" : "left",
        justifySelf: align,
      }}
    >
      <ParallaxText>
        <div
          style={{
            fontFamily: font,
            fontSize: sizes.number,
            fontWeight: 800,
            letterSpacing: "-0.045em",
            color: tint,
            lineHeight: 0.95,
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
          }}
        >
          {value}
        </div>
      </ParallaxText>
      <div
        style={{
          marginTop: sizes.marginTop,
          fontFamily: font,
          fontSize: sizes.subtitle,
          fontWeight: 600,
          letterSpacing: "-0.01em",
          color: colors.dim,
          whiteSpace: "nowrap",
        }}
      >
        {subtitle}
      </div>
    </div>
  );
};

// ─── Divider — thin rule with a single accent bead in the middle. ────────

const Divider: React.FC<{ t: number }> = ({ t }) => {
  const reach = t;
  return (
    <div
      style={{
        position: "absolute",
        top: "60%",
        left: 0,
        right: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 22,
        padding: "0 320px",
        opacity: t,
      }}
    >
      <div
        style={{
          flex: 1,
          height: 1,
          background: colors.ruleStrong,
          transformOrigin: "right center",
          transform: `scaleX(${reach})`,
        }}
      />
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          background: colors.accent,
          opacity: 0.6,
          transform: `scale(${t})`,
        }}
      />
      <div
        style={{
          flex: 1,
          height: 1,
          background: colors.ruleStrong,
          transformOrigin: "left center",
          transform: `scaleX(${reach})`,
        }}
      />
    </div>
  );
};

// ─── Extraction bars ──────────────────────────────────────────────────────────

type Bar = {
  label: string;
  value: number;
  displayValue: string;
};

const BARS: Bar[] = [
  { label: "perps", value: 80, displayValue: "80%" },
  { label: "options", value: 90, displayValue: "90%" },
  { label: "predictions", value: 71, displayValue: "71%" },
  { label: "launchpads", value: 87, displayValue: "87%" },
];

const MAX_VALUE = Math.max(...BARS.map((b) => b.value));
const BAR_STAGGER = toFrames(0.26);
const BAR_GROW = toFrames(0.5);
const REVEAL_AT =
  BAR_STAGGER * (BARS.length - 1) + BAR_GROW + toFrames(0.3);

const TOUCHED_WORDS = ["every", "market", "you", "touched", "..."];
const TOUCHED_WORD_STAGGER = toFrames(0.085);
const TOUCHED_WORD_FADE = toFrames(0.32);
const TOUCHED_HOLD = toFrames(0.55);
const TOUCHED_EXIT = toFrames(0.6);
const TOUCHED_ENTRY_FULL =
  TOUCHED_WORD_STAGGER * (TOUCHED_WORDS.length - 1) + TOUCHED_WORD_FADE;
const TOUCHED_EXIT_AT = TOUCHED_ENTRY_FULL + TOUCHED_HOLD;
const touchedExitEase = Easing.bezier(0.55, 0.0, 0.85, 0.12);

const ExtractionBars: React.FC = () => {
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          top: "8%",
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: monoFont,
          fontSize: 36,
          fontWeight: 500,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: colors.dim,
        }}
      >
        <RevealChars
          text="% extracted by unfair trading"
          startFrame={0}
          stagger={0.5}
          duration={8}
          y={10}
          blur={2}
          scale={0.97}
        />
      </div>

      <div
        style={{
          position: "absolute",
          top: "20%",
          bottom: "22%",
          left: 0,
          right: 0,
          padding: "0 200px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 36,
        }}
      >
        {BARS.map((bar, i) => (
          <BarRow
            key={bar.label}
            bar={bar}
            maxValue={MAX_VALUE}
            delayFrames={i * BAR_STAGGER}
          />
        ))}
      </div>

      <TouchedLine />
    </AbsoluteFill>
  );
};

const TouchedLine: React.FC = () => {
  const frame = useCurrentFrame();
  const local = frame - REVEAL_AT;

  if (local < 0) return null;

  const exitRaw = Math.max(
    0,
    Math.min(1, (local - TOUCHED_EXIT_AT) / TOUCHED_EXIT),
  );
  const exitEased = touchedExitEase(exitRaw);
  const exitX = -exitEased * (W * 1.15);
  const groupOpacity = interpolate(
    exitRaw,
    [0.78, 1],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <div
      style={{
        position: "absolute",
        bottom: "5%",
        left: 0,
        right: 0,
        textAlign: "center",
        fontFamily: font,
        fontSize: 96,
        fontWeight: 800,
        letterSpacing: "-0.035em",
        color: colors.fg,
        lineHeight: 0.95,
        whiteSpace: "nowrap",
        transform: `translate3d(${exitX}px, 0, 0)`,
        opacity: groupOpacity,
        willChange: "transform, opacity",
      }}
    >
      {TOUCHED_WORDS.map((word, i) => {
        const wLocal = local - i * TOUCHED_WORD_STAGGER;
        const wOpacity = interpolate(
          wLocal,
          [0, TOUCHED_WORD_FADE],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );
        const wY = interpolate(
          wLocal,
          [0, TOUCHED_WORD_FADE],
          [26, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );
        const isLast = i === TOUCHED_WORDS.length - 1;
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              marginRight: isLast ? 0 : "0.32em",
              opacity: wOpacity,
              transform: `translate3d(0, ${wY}px, 0)`,
              willChange: "transform, opacity",
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};

const LABEL_COL = 360;
const VALUE_COL = 240;

const BarRow: React.FC<{
  bar: Bar;
  maxValue: number;
  delayFrames: number;
}> = ({ bar, maxValue, delayFrames }) => {
  const frame = useCurrentFrame();
  const local = frame - delayFrames;

  const labelOpacity = interpolate(
    local,
    [0, toFrames(0.25)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const labelX = interpolate(
    local,
    [0, toFrames(0.3)],
    [-24, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const growT = Math.max(0, Math.min(1, (local - toFrames(0.15)) / BAR_GROW));
  const easedGrow = 1 - Math.pow(1 - growT, 3);
  const widthPct = (bar.value / maxValue) * 100 * easedGrow;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 32,
        height: 84,
      }}
    >
      <div
        style={{
          width: LABEL_COL,
          flexShrink: 0,
          fontFamily: monoFont,
          fontSize: 56,
          fontWeight: 500,
          letterSpacing: "0.02em",
          color: colors.fgSoft,
          textAlign: "right",
          opacity: labelOpacity,
          transform: `translateX(${labelX}px)`,
        }}
      >
        {bar.label}
      </div>

      <div
        style={{
          flex: 1,
          height: 36,
          position: "relative",
          background: colors.accentTint,
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            width: `${widthPct}%`,
            background: colors.accent,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: -6,
            bottom: -6,
            left: `calc(${widthPct}% - 1px)`,
            width: 2,
            background: colors.fg,
            opacity: easedGrow * 0.85,
          }}
        />
      </div>

      <div
        style={{
          width: VALUE_COL,
          flexShrink: 0,
          textAlign: "left",
          fontFamily: font,
          fontSize: 80,
          fontWeight: 800,
          letterSpacing: "-0.03em",
          color: colors.fg,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <ZoomEchoText
          text={bar.displayValue}
          delayFrames={Math.round(BAR_GROW * 0.55)}
          containerLocalFrame={local}
        />
      </div>
    </div>
  );
};

// ─── Zoom-echo text: number emerges with trailing depth-clones ────────────────

const ECHO_COUNT = 5;
const ECHO_GAP_FRAMES = 1.6;
const ZOOM_DURATION = toFrames(0.55);

const ZoomEchoText: React.FC<{
  text: string;
  delayFrames: number;
  containerLocalFrame: number;
}> = ({ text, delayFrames, containerLocalFrame }) => {
  const local = containerLocalFrame - delayFrames;

  if (local < 0) {
    return (
      <span style={{ display: "inline-block", visibility: "hidden" }}>
        {text}
      </span>
    );
  }

  const echoFade = interpolate(
    local,
    [
      ZOOM_DURATION + ECHO_COUNT * ECHO_GAP_FRAMES + toFrames(0.05),
      ZOOM_DURATION + ECHO_COUNT * ECHO_GAP_FRAMES + toFrames(0.35),
    ],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <span style={{ visibility: "hidden" }}>{text}</span>

      {Array.from({ length: ECHO_COUNT + 1 }).map((_, i) => {
        const f = local - i * ECHO_GAP_FRAMES;
        if (f < 0) return null;

        const t = Math.max(0, Math.min(1, f / ZOOM_DURATION));
        const eased = 1 - Math.pow(1 - t, 4);

        const scale = interpolate(eased, [0, 1], [3.6, 1]);
        const dim = i === 0 ? 1 : Math.pow(0.5, i) * echoFade;
        const op = eased * dim;

        const tint = i === 0 ? colors.fg : i % 2 === 0 ? colors.fg : colors.accent;

        return (
          <span
            key={i}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              textAlign: "left",
              transform: `scale(${scale})`,
              transformOrigin: "left center",
              opacity: op,
              color: tint,
              pointerEvents: "none",
              whiteSpace: "nowrap",
            }}
          >
            {text}
          </span>
        );
      })}
    </span>
  );
};

export const antiCheatStatMeta = {
  id: "AntiCheatStat",
  component: AntiCheatStat,
  durationInFrames: toFrames(STAT_SECONDS),
  fps: FPS,
  width: W,
  height: H,
};

export const antiCheatBarsMeta = {
  id: "AntiCheatBars",
  component: AntiCheatBars,
  durationInFrames: toFrames(BARS_SECONDS),
  fps: FPS,
  width: W,
  height: H,
};
