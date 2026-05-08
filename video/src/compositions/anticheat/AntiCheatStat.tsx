import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { font, monoFont } from "../../common/fonts";
import { FPS, H, W, colors, toFrames } from "./theme";
import { DotGrid, DotGridVignette } from "./DotGrid";
import { IdleZoom, RevealChars } from "./vibe";

// Two compositions live in this file:
//   AntiCheatStat — primary number 0.01%/70% then hard-cut to 99.9%/30%
//   AntiCheatBars — the % extracted by unfair trading bar chart
// Both durations locked to beats. Stat = 145f (4.83s) — the primary
// number cuts to its inverse on a beat partway through.
// Bars = 78f (2.6s) — its hard cut to Rigged lands on beat 11.
const STAT_FRAMES = 145;
const BARS_FRAMES = 78;
// Hard-cut flip from 0.01%/take/70% to 99.9%/get/30% on scene-local
// beat 2 (frame 51 inside Stat = absolute beat 19).
const STAT_FLIP_AT = 51;

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

// ─── Stat panel: Ember-style typewriter, two phases ──────────────────────────
// Phase 1 (0–50)  types "0.01% take 70%", wipes out before the flip.
// Phase 2 (51+)   types "99.9% get 30%" on beat 2 and holds to the
//                 snap-zoom-out at the scene tail.

const ROSE = [254, 186, 189] as const;

const easeIn = (t: number, power: number): number =>
  Math.pow(Math.max(0, Math.min(1, t)), power);

const EmberTypewriter: React.FC<{
  text: string;
  typeStart: number;
  typeEnd: number;
  wipeStart?: number;
  wipeEnd?: number;
  fontSize?: number;
  endColor?: string;
  typePower?: number;
}> = ({
  text,
  typeStart,
  typeEnd,
  wipeStart,
  wipeEnd,
  fontSize = 168,
  endColor = colors.fg,
  typePower = 2.8,
}) => {
  const frame = useCurrentFrame();
  const len = text.length;
  const hasWipe = wipeStart !== undefined && wipeEnd !== undefined;
  const wipeS = wipeStart ?? typeEnd + 1;
  const wipeE = wipeEnd ?? wipeS + 1;

  if (frame < typeStart || (hasWipe && frame > wipeE)) return null;

  let visibleStart = 0;
  let visibleEnd = 0;
  let phase: "typing" | "hold" | "wiping" = "hold";

  if (frame < typeEnd) {
    phase = "typing";
    const t = (frame - typeStart) / Math.max(1, typeEnd - typeStart);
    visibleEnd = Math.min(len, Math.max(1, Math.round(len * easeIn(t, typePower))));
  } else if (!hasWipe || frame < wipeS) {
    phase = "hold";
    visibleEnd = len;
  } else {
    phase = "wiping";
    const t = (frame - wipeS) / Math.max(1, wipeE - wipeS);
    const removed = Math.min(len, Math.round(len * easeIn(t, 2)));
    visibleStart = removed;
    visibleEnd = len;
  }

  if (visibleEnd <= visibleStart) return null;

  return (
    <AbsoluteFill
      style={{ display: "flex", justifyContent: "center", alignItems: "center" }}
    >
      <div
        style={{
          fontFamily: font,
          fontSize,
          fontWeight: 800,
          letterSpacing: "-0.04em",
          whiteSpace: "nowrap",
          color: endColor,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {text.split("").map((ch, i) => {
          if (i < visibleStart || i >= visibleEnd) return null;

          if (phase === "typing") {
            const currentT = (frame - typeStart) / Math.max(1, typeEnd - typeStart);
            const charThreshold = i / len;
            const age =
              (easeIn(currentT, typePower) - charThreshold) *
              Math.max(1, typeEnd - typeStart);
            const colorT = interpolate(age, [0, 5], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const r = Math.round(interpolate(colorT, [0, 1], [ROSE[0], 10]));
            const g = Math.round(interpolate(colorT, [0, 1], [ROSE[1], 10]));
            const b = Math.round(interpolate(colorT, [0, 1], [ROSE[2], 12]));
            const display = ch === " " ? " " : ch;
            return (
              <span key={i} style={{ color: `rgb(${r},${g},${b})` }}>
                {display}
              </span>
            );
          }

          if (phase === "wiping") {
            const dist = i - visibleStart;
            const op = interpolate(dist, [0, 2], [0.18, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const display = ch === " " ? " " : ch;
            return (
              <span key={i} style={{ color: endColor, opacity: op }}>
                {display}
              </span>
            );
          }

          const display = ch === " " ? " " : ch;
          return (
            <span key={i} style={{ color: endColor }}>
              {display}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const StatPanel: React.FC = () => {
  return (
    <AbsoluteFill>
      <Caption />

      {/* Phase 1 — types in by beat 1, wipes out into the flip */}
      <EmberTypewriter
        text="0.01% take 70%"
        typeStart={0}
        typeEnd={26}
        wipeStart={STAT_FLIP_AT - 6}
        wipeEnd={STAT_FLIP_AT}
        fontSize={168}
        endColor={colors.fg}
      />

      {/* Phase 2 — flips on beat 2, types in by beat 3, holds to snap-zoom */}
      <EmberTypewriter
        text="99.9% get 30%"
        typeStart={STAT_FLIP_AT}
        typeEnd={STAT_FLIP_AT + 26}
        fontSize={168}
        endColor={colors.fg}
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
  durationInFrames: STAT_FRAMES,
  fps: FPS,
  width: W,
  height: H,
};

export const antiCheatBarsMeta = {
  id: "AntiCheatBars",
  component: AntiCheatBars,
  durationInFrames: BARS_FRAMES,
  fps: FPS,
  width: W,
  height: H,
};
