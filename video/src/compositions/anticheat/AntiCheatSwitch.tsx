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
// Setup → pivot → knife. Three rows with proportional bars; the Blocks
// row's "40%" doesn't crossfade out — it physically inflates from its
// row slot into the centre of the frame, becoming the hero.
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

// ─── Spec-ledger geometry ─────────────────────────────────────────────────────
//
// Three columns: label · proportional bar · percentage. The bar's max
// length is fixed; each row's fill is `BAR_MAX * pct/100` so the Blocks
// bar is exactly twice the Perps bar. The visual is the proof.

const LABEL_WIDTH = 240;
const BAR_MAX = 820;
const PCT_WIDTH = 160;
const COL_GAP = 28;
const ROW_TOTAL_WIDTH =
  LABEL_WIDTH + COL_GAP + BAR_MAX + COL_GAP + PCT_WIDTH;
const ROW_CONTAINER_LEFT = (W - ROW_TOTAL_WIDTH) / 2;

const LEDGER_TOP = 392;
const ROW_PAD_Y = 36;
const ROW_FONT_LABEL = 56;
const ROW_FONT_PCT = 68;
const ROW_LINE_HEIGHT = 1.05;
const ROW_BLOCK_HEIGHT = ROW_PAD_Y * 2 + ROW_FONT_PCT * ROW_LINE_HEIGHT;
const HAIRLINE_HEIGHT = 1;
const BAR_HEIGHT = 6;

const rowCenterY = (i: number) =>
  LEDGER_TOP +
  HAIRLINE_HEIGHT * (i + 1) +
  ROW_BLOCK_HEIGHT * i +
  ROW_BLOCK_HEIGHT / 2;

// Right-anchor for the percentage in column 3 — the morphing 40% starts
// here. The pct text is right-aligned in its 160px slot.
const PCT_COL_LEFT = ROW_CONTAINER_LEFT + LABEL_WIDTH + COL_GAP + BAR_MAX + COL_GAP;
const PCT_COL_RIGHT = PCT_COL_LEFT + PCT_WIDTH;
const PCT_TEXT_WIDTH_AT_ROW = 134; // approx advance of "40%" at fontSize 68
const SRC_PCT_CX = PCT_COL_RIGHT - PCT_TEXT_WIDTH_AT_ROW / 2;

// Hero sizing.
const HERO_FONT = 320;
const HERO_CENTER_X = W / 2;
const HERO_CENTER_Y = H / 2 - 24;

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
        top: 156,
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

const SpecLedger: React.FC<{
  frame: number;
  fps: number;
  morphT: number;
}> = ({ frame, fps, morphT }) => (
  <div
    style={{
      position: "absolute",
      top: LEDGER_TOP,
      left: ROW_CONTAINER_LEFT,
      width: ROW_TOTAL_WIDTH,
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

  // Counting %: 0 → row.pct over 14 frames, eased.
  const countT = Math.max(0, Math.min(1, local / 14));
  const countEased = 1 - Math.pow(1 - countT, 3);
  const value = Math.round(row.pct * countEased);

  // Bar growth: same easing window as the count, target = BAR_MAX × pct/100.
  const barFill = (BAR_MAX * row.pct) / 100;
  const barWidth = barFill * countEased;

  const isHero = index === HERO_INDEX;
  const exitOp = 1 - morphT;
  const exitY = isHero ? morphT * 4 : morphT * 56;
  const exitBlur = isHero ? morphT * 2 : morphT * 10;

  // Bars retract on pivot for non-hero rows; the Blocks bar dims with its row.
  const barRetract = 1 - morphT;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `${LABEL_WIDTH}px ${BAR_MAX}px ${PCT_WIDTH}px`,
        columnGap: COL_GAP,
        alignItems: "center",
        padding: `${ROW_PAD_Y}px 0`,
        opacity: enterOp * exitOp,
        transform: `translateY(${(enterY + exitY).toFixed(2)}px)`,
        filter:
          enterBlur + exitBlur > 0.05
            ? `blur(${(enterBlur + exitBlur).toFixed(2)}px)`
            : undefined,
        willChange: "transform, opacity, filter",
      }}
    >
      {/* Col 1 — label */}
      <div
        style={{
          fontFamily: font,
          fontSize: ROW_FONT_LABEL,
          fontWeight: 600,
          letterSpacing: "-0.022em",
          color: row.accent ? colors.fg : colors.fgSoft,
          lineHeight: ROW_LINE_HEIGHT,
        }}
      >
        {row.label}
      </div>

      {/* Col 2 — proportional bar */}
      <div
        style={{
          position: "relative",
          width: BAR_MAX,
          height: BAR_HEIGHT,
        }}
      >
        <div
          style={{
            width: barWidth * barRetract,
            height: BAR_HEIGHT,
            background: row.accent ? colors.accent : colors.dim,
            borderRadius: BAR_HEIGHT / 2,
            willChange: "width",
          }}
        />
      </div>

      {/* Col 3 — percentage. The hero row's % is rendered by MorphingForty;
       * we leave a transparent placeholder here so the grid keeps its
       * baseline. */}
      {isHero ? (
        <div
          aria-hidden
          style={{
            fontFamily: font,
            fontSize: ROW_FONT_PCT,
            fontWeight: 700,
            letterSpacing: "-0.028em",
            color: "transparent",
            fontVariantNumeric: "tabular-nums",
            lineHeight: ROW_LINE_HEIGHT,
            textAlign: "right",
          }}
        >
          {row.pct}%
        </div>
      ) : (
        <div
          style={{
            fontFamily: font,
            fontSize: ROW_FONT_PCT,
            fontWeight: 700,
            letterSpacing: "-0.028em",
            color: colors.dim,
            fontVariantNumeric: "tabular-nums",
            lineHeight: ROW_LINE_HEIGHT,
            textAlign: "right",
          }}
        >
          {value}%
        </div>
      )}
    </div>
  );
};

// ─── Morphing 40% ─────────────────────────────────────────────────────────────

const MorphingForty: React.FC<{
  frame: number;
  fps: number;
  morphT: number;
}> = ({ frame, fps, morphT }) => {
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
  const value = morphT > 0.05 ? 40 : Math.round(40 * countEased);

  const SRC_CY = rowCenterY(HERO_INDEX);
  const cx = SRC_PCT_CX + (HERO_CENTER_X - SRC_PCT_CX) * morphT;
  const cy = SRC_CY + (HERO_CENTER_Y - SRC_CY) * morphT;
  const scale = 1 + (HERO_FONT / ROW_FONT_PCT - 1) * morphT;

  const sinceLand = Math.max(0, frame - PIVOT_AT - 22);
  const breath = 1 + Math.sin(sinceLand / 32) * 0.006;
  const finalScale = scale * breath;

  const bloom = morphT;
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
        fontSize: ROW_FONT_PCT,
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
          fontSize: ROW_FONT_PCT * 0.62,
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

const HeroCopy: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const claimT = spring({
    frame: frame - COPY_AT,
    fps,
    config: { damping: 22, stiffness: 130, mass: 0.7 },
  });
  const claimOp = interpolate(claimT, [0, 1], [0, 1]);
  const claimY = interpolate(claimT, [0, 1], [16, 0]);

  const kickT = spring({
    frame: frame - KICKER_AT,
    fps,
    config: { damping: 22, stiffness: 130, mass: 0.7 },
  });
  const kickOp = interpolate(kickT, [0, 1], [0, 1]);
  const kickY = interpolate(kickT, [0, 1], [12, 0]);

  return (
    <>
      {/* Below the hero number — the implication. Bigger, no period. */}
      <div
        style={{
          position: "absolute",
          top: HERO_CENTER_Y + HERO_FONT * 0.55,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: font,
          fontSize: 84,
          fontWeight: 700,
          letterSpacing: "-0.030em",
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
            fontSize: 32,
            color: colors.dim,
            marginLeft: 4,
            verticalAlign: "super",
            fontWeight: 500,
            letterSpacing: 0,
          }}
        >
          *
        </span>
      </div>

      {/* Bottom kicker — the action. Larger size and stronger color so
       * it actually reads at full-frame distance. */}
      <div
        style={{
          position: "absolute",
          bottom: 88,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: font,
          fontSize: 38,
          fontWeight: 500,
          letterSpacing: "-0.020em",
          color: colors.fgSoft,
          opacity: kickOp,
          transform: `translateY(${kickY.toFixed(2)}px)`,
        }}
      >
        just by switching financial product
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
