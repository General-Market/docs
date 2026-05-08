import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { font, monoFont } from "../../common/fonts";
import { FPS, H, W, colors, toFrames } from "./theme";
import { DotGrid, DotGridVignette } from "./DotGrid";
import { IdleZoom, RevealChars } from "./vibe";

// Same slot the Bridge used to occupy: 180 frames, beat 32 absolute.
// Scene-local beats: 0 (headline), 25 (rows), 51 (pivot), 77 (hero).
//
// Setup → pivot → knife. The Blocks row's "40%" doesn't crossfade out —
// it physically inflates from its row slot into the centre of the frame,
// becoming the hero. Continuous motion, the way Apple actually does it.
const SCENE_FRAMES = toFrames(6.0);

const HEADLINE_AT = 0;
const ROWS_AT = 25;
const ROW_STAGGER = 5;
const PIVOT_AT = 51;
const COPY_AT = 78;
const KICKER_AT = toFrames(4.4);

type Row = { label: string; pct: number; accent: boolean };
const ROWS: Row[] = [
  { label: "Perps", pct: 20, accent: false },
  { label: "Options", pct: 25, accent: false },
  { label: "Blocks", pct: 40, accent: true },
];
const HERO_INDEX = 2;

// Spec-ledger geometry. The morphing percentage relies on these numbers
// to know where it starts. Pre-pivot it sits in the Blocks row's right
// slot; post-pivot it lands at canvas centre.
const LEDGER_TOP = 376;
const LEDGER_LEFT = 240;
const LEDGER_RIGHT = 240;
const ROW_PAD_Y = 32;
const ROW_FONT = 68;
const ROW_LINE_HEIGHT = 1.05;
const ROW_BLOCK_HEIGHT = ROW_PAD_Y * 2 + ROW_FONT * ROW_LINE_HEIGHT;
const HAIRLINE_HEIGHT = 1;

const rowCenterY = (i: number) =>
  LEDGER_TOP +
  HAIRLINE_HEIGHT * (i + 1) +
  ROW_BLOCK_HEIGHT * i +
  ROW_BLOCK_HEIGHT / 2;

// "40%" right-anchor inside the row. Use the row's right padding edge.
const ROW_PCT_RIGHT_X = W - LEDGER_RIGHT - 12;

// Hero sizing.
const HERO_FONT = 320;
const HERO_CENTER_X = W / 2;
const HERO_CENTER_Y = H / 2 - 12;

export const AntiCheatSwitch: React.FC = () => (
  <AbsoluteFill
    style={{
      backgroundColor: colors.bg,
      fontFamily: font,
      overflow: "hidden",
    }}
  >
    <IdleZoom durationInFrames={SCENE_FRAMES} from={1} to={1.022}>
      <DotGrid />
      <Stage />
      <DotGridVignette intensity={0.20} />
    </IdleZoom>
  </AbsoluteFill>
);

// ─── Stage ────────────────────────────────────────────────────────────────────
//
// One spring drives the whole pivot. Headline lifts, rows slide and blur,
// hairlines retract, the Blocks 40% travels and inflates, hero copy lands.
const Stage: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const morphT = spring({
    frame: frame - PIVOT_AT,
    fps,
    config: { damping: 18, stiffness: 100, mass: 0.85 },
  });

  return (
    <AbsoluteFill>
      <Headline morphT={morphT} />
      <SpecLedger frame={frame} fps={fps} morphT={morphT} />
      <MorphingForty frame={frame} fps={fps} morphT={morphT} />
      <HeroCopy frame={frame} fps={fps} />
    </AbsoluteFill>
  );
};

// ─── Headline ─────────────────────────────────────────────────────────────────

const Headline: React.FC<{ morphT: number }> = ({ morphT }) => {
  const exitY = -morphT * 38;
  const exitOp = 1 - morphT;
  const exitBlur = morphT * 8;

  return (
    <div
      style={{
        position: "absolute",
        top: 152,
        left: 0,
        right: 0,
        textAlign: "center",
        fontFamily: font,
        fontSize: 100,
        fontWeight: 700,
        letterSpacing: "-0.034em",
        color: colors.fg,
        lineHeight: 1.0,
        opacity: exitOp,
        transform: `translateY(${exitY.toFixed(2)}px)`,
        filter: exitBlur > 0.05 ? `blur(${exitBlur.toFixed(2)}px)` : undefined,
        willChange: "transform, opacity, filter",
      }}
    >
      <RevealChars
        text="Same strategy."
        startFrame={HEADLINE_AT}
        stagger={1.0}
        duration={11}
        y={14}
        blur={4}
      />
    </div>
  );
};

// ─── Spec ledger ──────────────────────────────────────────────────────────────
//
// Hairlines draw left-to-right on row reveal, then retract on pivot.
// Non-hero rows fade and slide down; the Blocks row keeps its label and
// hands the "40%" off to the morphing overlay.

const SpecLedger: React.FC<{
  frame: number;
  fps: number;
  morphT: number;
}> = ({ frame, fps, morphT }) => {
  return (
    <div
      style={{
        position: "absolute",
        top: LEDGER_TOP,
        left: LEDGER_LEFT,
        right: LEDGER_RIGHT,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Hairline frame={frame} fps={fps} index={0} morphT={morphT} />
      {ROWS.map((row, i) => (
        <React.Fragment key={row.label}>
          <SpecRow
            row={row}
            index={i}
            frame={frame}
            fps={fps}
            morphT={morphT}
          />
          <Hairline
            frame={frame}
            fps={fps}
            index={i + 1}
            morphT={morphT}
          />
        </React.Fragment>
      ))}
    </div>
  );
};

const Hairline: React.FC<{
  frame: number;
  fps: number;
  index: number;
  morphT: number;
}> = ({ frame, fps, index, morphT }) => {
  const start = ROWS_AT + index * ROW_STAGGER;
  const draw = spring({
    frame: frame - start,
    fps,
    config: { damping: 26, stiffness: 130, mass: 0.6 },
  });
  // Hairlines retract from the right on pivot.
  const retract = 1 - morphT;
  const scaleX = draw * retract;
  return (
    <div
      style={{
        height: HAIRLINE_HEIGHT,
        background: colors.rule,
        transform: `scaleX(${scaleX.toFixed(3)})`,
        transformOrigin: "0% 50%",
        willChange: "transform",
      }}
    />
  );
};

const SpecRow: React.FC<{
  row: Row;
  index: number;
  frame: number;
  fps: number;
  morphT: number;
}> = ({ row, index, frame, fps, morphT }) => {
  const start = ROWS_AT + index * ROW_STAGGER + 2;
  const local = frame - start;
  const enter = spring({
    frame: local,
    fps,
    config: { damping: 24, stiffness: 130, mass: 0.7 },
  });
  const enterOp = interpolate(local, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const enterY = interpolate(enter, [0, 1], [12, 0]);
  const enterBlur = interpolate(local, [0, 12], [4, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Counting %: digit ticks up from 0 to its value over ~14 frames.
  const countT = Math.max(0, Math.min(1, local / 14));
  const countEased = 1 - Math.pow(1 - countT, 3);
  const value = Math.round(row.pct * countEased);

  // Exit choreography: non-hero rows blow out on pivot — slide down,
  // blur, fade. The hero row keeps its label still (the % travels off
  // on its own as the hero), but the row itself dims and clears.
  const isHero = index === HERO_INDEX;
  const exitOp = 1 - morphT;
  const exitY = isHero ? morphT * 4 : morphT * 56;
  const exitBlur = isHero ? morphT * 2 : morphT * 10;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        padding: `${ROW_PAD_Y}px 12px`,
        opacity: enterOp * exitOp,
        transform: `translateY(${(enterY + exitY).toFixed(2)}px)`,
        filter:
          enterBlur + exitBlur > 0.05
            ? `blur(${(enterBlur + exitBlur).toFixed(2)}px)`
            : undefined,
        willChange: "transform, opacity, filter",
      }}
    >
      <div
        style={{
          fontFamily: font,
          fontSize: ROW_FONT - 8,
          fontWeight: 600,
          letterSpacing: "-0.022em",
          color: row.accent ? colors.fg : colors.fgSoft,
          lineHeight: ROW_LINE_HEIGHT,
        }}
      >
        {row.label}
      </div>
      {/* The hero row's % is rendered by MorphingForty; we leave a
       * spacer here so the row's flex layout stays balanced. The
       * spacer's text is invisible but reserves the same advance width
       * as the rendered hero-glyph, keeping the baseline honest. */}
      {isHero ? (
        <div
          aria-hidden
          style={{
            fontFamily: font,
            fontSize: ROW_FONT,
            fontWeight: 700,
            letterSpacing: "-0.028em",
            color: "transparent",
            fontVariantNumeric: "tabular-nums",
            lineHeight: ROW_LINE_HEIGHT,
          }}
        >
          {row.pct}%
        </div>
      ) : (
        <div
          style={{
            fontFamily: font,
            fontSize: ROW_FONT,
            fontWeight: 700,
            letterSpacing: "-0.028em",
            color: colors.dim,
            fontVariantNumeric: "tabular-nums",
            lineHeight: ROW_LINE_HEIGHT,
          }}
        >
          {value}%
        </div>
      )}
    </div>
  );
};

// ─── Morphing 40% ─────────────────────────────────────────────────────────────
//
// One element. Lives in the Blocks row pre-pivot, travels to centre and
// inflates 4.7× on pivot. Bloom intensifies with the morph. The pivot
// spring carries it; no crossfade.

const MorphingForty: React.FC<{
  frame: number;
  fps: number;
  morphT: number;
}> = ({ frame, fps, morphT }) => {
  // Reveal: fade-in + counting up to 40 during Act 1.
  const revealStart = ROWS_AT + HERO_INDEX * ROW_STAGGER + 2;
  const revealLocal = frame - revealStart;
  const revealOp = interpolate(revealLocal, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const revealBlur = interpolate(revealLocal, [0, 12], [4, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const enter = spring({
    frame: revealLocal,
    fps,
    config: { damping: 24, stiffness: 130, mass: 0.7 },
  });
  const enterY = interpolate(enter, [0, 1], [12, 0]);

  const countT = Math.max(0, Math.min(1, revealLocal / 14));
  const countEased = 1 - Math.pow(1 - countT, 3);
  // Past the pivot, the value is locked at 40 — the morph carries it.
  const value = morphT > 0.05 ? 40 : Math.round(40 * countEased);

  // Source: row position. The element is right-anchored visually inside
  // the row. We position by its CENTRE, which depends on the rendered
  // text width, but the morph lerps to the canvas centre by the end so
  // a small approximation in source-x is invisible.
  const ROW_PCT_TEXT_WIDTH = 138; // rough advance of "40%" at ROW_FONT=68
  const SRC_CX = ROW_PCT_RIGHT_X - ROW_PCT_TEXT_WIDTH / 2;
  const SRC_CY = rowCenterY(HERO_INDEX);

  // Lerp centre + scale on the same spring.
  const cx = SRC_CX + (HERO_CENTER_X - SRC_CX) * morphT;
  const cy = SRC_CY + (HERO_CENTER_Y - SRC_CY) * morphT;
  const scale = 1 + (HERO_FONT / ROW_FONT - 1) * morphT;

  // Quiet sine breath after morph completes — the hero never sits dead.
  const sinceLand = Math.max(0, frame - PIVOT_AT - 22);
  const breath = 1 + Math.sin(sinceLand / 32) * 0.006;
  const finalScale = scale * breath;

  // Bloom rides the morph and stays at full strength after.
  const bloom = morphT;

  // Subtle weight push as it inflates — 700 → 800.
  const weight = morphT > 0.5 ? 800 : 700;

  return (
    <div
      style={{
        position: "absolute",
        left: cx,
        top: cy,
        transform: `translate(-50%, -50%) translateY(${enterY.toFixed(2)}px) scale(${finalScale.toFixed(4)})`,
        transformOrigin: "center center",
        fontFamily: font,
        fontSize: ROW_FONT,
        fontWeight: weight,
        letterSpacing: "-0.045em",
        lineHeight: 1,
        whiteSpace: "nowrap",
        color: colors.accent,
        fontVariantNumeric: "tabular-nums",
        opacity: revealOp,
        filter: revealBlur > 0.05 ? `blur(${revealBlur.toFixed(2)}px)` : undefined,
        willChange: "transform, opacity, filter",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: -120,
          background: `radial-gradient(ellipse at center, rgba(0,82,255,${(0.34 * bloom).toFixed(3)}), transparent 65%)`,
          filter: "blur(80px)",
          zIndex: -1,
          pointerEvents: "none",
        }}
      />
      {value}
      <span
        style={{
          fontSize: ROW_FONT * 0.62,
          marginLeft: 4,
          letterSpacing: "-0.02em",
        }}
      >
        %
      </span>
    </div>
  );
};

// ─── Hero copy ────────────────────────────────────────────────────────────────
//
// Below the 40%: "Up to 2× more.*" — the implication.
// Bottom kicker: "Just by switching financial product." — the action.

const HeroCopy: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const claimT = spring({
    frame: frame - COPY_AT,
    fps,
    config: { damping: 22, stiffness: 130, mass: 0.7 },
  });
  const claimOp = interpolate(claimT, [0, 1], [0, 1]);
  const claimY = interpolate(claimT, [0, 1], [14, 0]);

  const kickT = spring({
    frame: frame - KICKER_AT,
    fps,
    config: { damping: 22, stiffness: 130, mass: 0.7 },
  });
  const kickOp = interpolate(kickT, [0, 1], [0, 1]);
  const kickY = interpolate(kickT, [0, 1], [10, 0]);

  return (
    <>
      {/* Below the hero number — the implication */}
      <div
        style={{
          position: "absolute",
          top: HERO_CENTER_Y + HERO_FONT * 0.55,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: font,
          fontSize: 56,
          fontWeight: 600,
          letterSpacing: "-0.024em",
          color: colors.fg,
          lineHeight: 1.0,
          opacity: claimOp,
          transform: `translateY(${claimY.toFixed(2)}px)`,
        }}
      >
        Up to 2× more
        <span
          style={{
            fontFamily: monoFont,
            fontSize: 24,
            color: colors.dim,
            marginLeft: 2,
            verticalAlign: "super",
            fontWeight: 500,
          }}
        >
          *
        </span>
        .
      </div>

      {/* Bottom kicker — the action */}
      <div
        style={{
          position: "absolute",
          bottom: 96,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: monoFont,
          fontSize: 22,
          fontWeight: 500,
          letterSpacing: "0.32em",
          textTransform: "uppercase",
          color: colors.dim,
          opacity: kickOp,
          transform: `translateY(${kickY.toFixed(2)}px)`,
        }}
      >
        Just by switching financial product
      </div>
    </>
  );
};

export const antiCheatSwitchMeta = {
  id: "AntiCheatSwitch",
  component: AntiCheatSwitch,
  durationInFrames: SCENE_FRAMES,
  fps: FPS,
  width: W,
  height: H,
};
