import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { noise2D } from "@remotion/noise";
import { font, monoFont } from "../../common/fonts";
import { FPS, H, W, colors, toFrames } from "./theme";
import { DotGrid, DotGridVignette } from "./DotGrid";
import { IdleZoom, RevealChars } from "./vibe";

// 180 frames, opens at absolute frame 947 (just after the Reassure→Switch
// snap). Scene-local beats inside Switch land at frames 22, 47, 73, 99
// (absolute beats 37–40, frames 969 / 994 / 1020 / 1046).
//
// Setup → pivot → knife. Three rows with proportional bars; the Blocks
// row's "40%" doesn't crossfade out — it physically inflates from its
// row slot into the centre of the frame, becoming the hero.
const SCENE_FRAMES = toFrames(6.6);

const HEADLINE_AT = 0;
const ROWS_AT = 22;
const ROW_STAGGER = 5;
// Hold the bar chart long enough that the viewer can actually read three
// percentages before the morph fires. Streak + morph + settle all share
// the same anchor so the impact still lands on the pivot. The post-morph
// hero+kicker phase compresses to absorb the extra reading time.
// SCENE_FRAMES stays at 198 — EndCard lands on schedule.
const PIVOT_AT = 107;
const COPY_AT = 130;
const KICKER_AT = 156;

type Row = { label: string; pct: number; accent: boolean };
// Order: Blocks first as the dominant bar — descending stair, matching
// the reference's IVV-leads composition.
const ROWS: Row[] = [
  { label: "Blocks", pct: 40, accent: true },
  { label: "Options", pct: 25, accent: false },
  { label: "Perps", pct: 20, accent: false },
];
const HERO_INDEX = 0;

// ─── Bar-chart geometry — outlined 3D boxes, cavalier oblique projection ────
//
// Three vertical wireframe bars over the bg. Heights scale linearly with
// pct so Blocks reads exactly twice Perps — the visual is the proof of
// "Up to 2× more". Each bar is one silhouette polygon (6 outer edges,
// filled with bg) plus three internal strokes (front-top, front-right,
// top-right fold); drawing it that way avoids double strokes at shared
// joins.

const BAR_WIDTH = 170;
const BAR_GAP = 200;
const BAR_BASELINE_Y = 870;
const BAR_MAX_HEIGHT = 400; // Blocks (40%) sets the cap
const BAR_DEPTH = 24;
const BAR_STROKE = 3;

// Visual amplification: heights map through (pct/40)^HEIGHT_POWER instead
// of linearly. With power 1.6 the displayed percentages stay legit
// (20 / 25 / 40) but Blocks reads ~3× Perps visually against the real 2×
// ratio. The chart should make you feel Blocks isn't just bigger — it's
// the answer.
const HEIGHT_POWER = 1.6;

// Pseudo-perspective. Each bar's depth direction points toward a single
// vanishing point off-frame to the upper-right. The leftmost bar (Blocks)
// shows a flatter, more horizontal right face; the rightmost bar (Perps)
// tilts more toward the VP — its top face opens up while its right face
// narrows. Camera isn't head-on; the chart isn't a flat parallel-
// projection cliché.
const VP_X = W * 1.4; // 2688 — well off the right edge
const VP_Y = -500;    // above the frame

const CHART_TOTAL_WIDTH = 3 * BAR_WIDTH + 2 * BAR_GAP;
const CHART_LEFT = (W - CHART_TOTAL_WIDTH) / 2;

const barX = (i: number) => CHART_LEFT + i * (BAR_WIDTH + BAR_GAP);
const barTargetH = (pct: number) =>
  BAR_MAX_HEIGHT * Math.pow(pct / 40, HEIGHT_POWER);
const barCenterX = (i: number) => barX(i) + BAR_WIDTH / 2;

const barDepth = (i: number, pct: number) => {
  const cx = barCenterX(i);
  const top = BAR_BASELINE_Y - barTargetH(pct);
  const vx = VP_X - cx;
  const vy = top - VP_Y;
  const len = Math.hypot(vx, vy);
  return {
    dx: (vx / len) * BAR_DEPTH,
    dy: (vy / len) * BAR_DEPTH,
  };
};

// Labels float above each bar's FINAL back-top edge, so they don't bob as
// the bar grows. Two lines: name (smaller) and pct (larger). The hero
// row's pct is rendered transparently here; MorphingForty paints over it.
const LABEL_NAME_FONT = 80;
const LABEL_NAME_LH = 1.05;
const LABEL_VALUE_FONT = 40;
const LABEL_VALUE_LH = 1.0;
const LABEL_INTERLINE_GAP = 8;
const LABEL_BAR_GAP = 14;
const LABEL_BLOCK_HEIGHT =
  LABEL_NAME_FONT * LABEL_NAME_LH +
  LABEL_INTERLINE_GAP +
  LABEL_VALUE_FONT * LABEL_VALUE_LH;

const labelTopY = (i: number, pct: number) => {
  const { dy } = barDepth(i, pct);
  return (
    BAR_BASELINE_Y - barTargetH(pct) - dy - LABEL_BAR_GAP - LABEL_BLOCK_HEIGHT
  );
};

// Hero source position for the morphing 40% — centred on the Blocks
// bar's front face, at the value-line midpoint.
const SRC_PCT_CX = barCenterX(HERO_INDEX);
const SRC_PCT_CY =
  labelTopY(HERO_INDEX, 40) +
  LABEL_NAME_FONT * LABEL_NAME_LH +
  LABEL_INTERLINE_GAP +
  (LABEL_VALUE_FONT * LABEL_VALUE_LH) / 2;

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
      <DotGrid speed={3} />
      <ParticleField />
      <Stage />
      <DotGridVignette intensity={0.20} />
    </IdleZoom>
  </AbsoluteFill>
);

// ─── Particle field — soft drifting dots, GMBrand SegSupercharge pattern ──
//
// Adapted from Scene03's "Built to maximize your edge" supercharge segment:
// noise-driven dots at varied sizes, fade in around the impact moment and
// hold through the rest of the scene. Tinted to the accent-blue family so
// they augment the hero glow without competing with the ledger.

const PARTICLE_COUNT = 32;
const PARTICLE_COLORS = [
  colors.accent,
  colors.accentSoft,
  "#8DA5FF",
  "#B8C8FF",
  "#FFFFFF",
];

const ParticleField: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Fade in around the impact, hold through the hero state, retreat at the
  // very tail so the EndCard transition starts clean.
  const fieldOp = interpolate(
    frame,
    [100, 130, SCENE_FRAMES - 18, SCENE_FRAMES],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  if (fieldOp < 0.005) return null;

  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: fieldOp }}>
      {Array.from({ length: PARTICLE_COUNT }, (_, i) => {
        const t = frame / fps;
        const px = noise2D("acpx" + i, t * 0.5, i) * 760 + 960;
        const py = noise2D("acpy" + i, i, t * 0.5) * 460 + 540;
        const sz = 3 + (i % 5) * 1.6;
        const color = PARTICLE_COLORS[i % PARTICLE_COLORS.length];
        const baseOp = 0.32 + ((i * 17) % 36) / 100;
        const blur = i % 4 === 0 ? 1.8 : 0;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: px,
              top: py,
              width: sz,
              height: sz,
              borderRadius: "50%",
              backgroundColor: color,
              opacity: baseOp,
              filter: blur > 0 ? `blur(${blur.toFixed(1)}px)` : undefined,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

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
      <SettleOrb frame={frame} fps={fps} />
      <BarChart3D frame={frame} fps={fps} morphT={morphT} />
      <Streak
        frame={frame}
        startFromX={HERO_CENTER_X + 1100}
        startFromY={HERO_CENTER_Y - 700}
      />
      <Streak
        frame={frame}
        startFromX={HERO_CENTER_X - 1100}
        startFromY={HERO_CENTER_Y + 700}
        delay={2}
      />
      <ImpactFlash frame={frame} />
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
        fontSize: 140,
        fontWeight: 700,
        letterSpacing: "-0.036em",
        color: colors.fg,
        lineHeight: 1.0,
        opacity: exitOp,
        transform: `translateY(${exitY.toFixed(2)}px)`,
        filter: exitBlur > 0.05 ? `blur(${exitBlur.toFixed(2)}px)` : undefined,
        willChange: "transform, opacity, filter",
      }}
    >
      <RevealChars
        text="Same strategy"
        startFrame={HEADLINE_AT}
        stagger={1.0}
        duration={11}
        y={14}
        blur={4}
      />
    </div>
  );
};

// ─── Bar chart — outlined 3D boxes ────────────────────────────────────────────

const BarChart3D: React.FC<{
  frame: number;
  fps: number;
  morphT: number;
}> = ({ frame, fps, morphT }) => (
  <>
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        pointerEvents: "none",
      }}
    >
      {ROWS.map((row, i) => (
        <Bar3D
          key={row.label}
          row={row}
          index={i}
          frame={frame}
          morphT={morphT}
        />
      ))}
    </svg>
    {ROWS.map((row, i) => (
      <BarLabel
        key={row.label}
        row={row}
        index={i}
        frame={frame}
        fps={fps}
        morphT={morphT}
      />
    ))}
  </>
);

const Bar3D: React.FC<{
  row: Row;
  index: number;
  frame: number;
  morphT: number;
}> = ({ row, index, frame, morphT }) => {
  const start = ROWS_AT + index * ROW_STAGGER + 2;
  const local = frame - start;

  const enterOp = interpolate(local, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Height growth: ease-cubic-out over 14 frames, same window as the count.
  const countT = Math.max(0, Math.min(1, local / 14));
  const countEased = 1 - Math.pow(1 - countT, 3);

  const isHero = index === HERO_INDEX;
  const exitOp = 1 - morphT;
  // Hero retracts a touch faster so the 40% flies free without leaving a
  // phantom bar trailing behind it.
  const heightFactor = isHero
    ? Math.max(0, 1 - morphT * 1.4)
    : 1 - morphT;
  const currentH = barTargetH(row.pct) * countEased * heightFactor;
  if (currentH < 0.5) return null;

  const x = barX(index);
  const yBottom = BAR_BASELINE_Y;
  const yTop = yBottom - currentH;
  const xR = x + BAR_WIDTH;
  const { dx, dy } = barDepth(index, row.pct);

  const bTLx = x + dx;
  const bTLy = yTop - dy;
  const bTRx = xR + dx;
  const bTRy = yTop - dy;
  const bBRx = xR + dx;
  const bBRy = yBottom - dy;

  // Outer silhouette traced counter-clockwise: front-bottom-left → front-
  // top-left → back-top-left → back-top-right → back-bottom-right →
  // front-bottom-right. Six visible edges. Filled with bg to mask the dot
  // grid behind the box.
  const silhouette = [
    `${x},${yBottom}`,
    `${x},${yTop}`,
    `${bTLx},${bTLy}`,
    `${bTRx},${bTRy}`,
    `${bBRx},${bBRy}`,
    `${xR},${yBottom}`,
  ].join(" ");

  return (
    <g opacity={enterOp * exitOp}>
      <polygon
        points={silhouette}
        fill={colors.bg}
        stroke={colors.fg}
        strokeWidth={BAR_STROKE}
        strokeLinejoin="round"
      />
      {/* Front-top edge */}
      <line
        x1={x}
        y1={yTop}
        x2={xR}
        y2={yTop}
        stroke={colors.fg}
        strokeWidth={BAR_STROKE}
        strokeLinecap="round"
      />
      {/* Front-right edge */}
      <line
        x1={xR}
        y1={yTop}
        x2={xR}
        y2={yBottom}
        stroke={colors.fg}
        strokeWidth={BAR_STROKE}
        strokeLinecap="round"
      />
      {/* Top-right fold (front-top-right → back-top-right) */}
      <line
        x1={xR}
        y1={yTop}
        x2={bTRx}
        y2={bTRy}
        stroke={colors.fg}
        strokeWidth={BAR_STROKE}
        strokeLinecap="round"
      />
    </g>
  );
};

const BarLabel: React.FC<{
  row: Row;
  index: number;
  frame: number;
  fps: number;
  morphT: number;
}> = ({ row, index, frame, fps, morphT }) => {
  const start = ROWS_AT + index * ROW_STAGGER + 2;
  const local = frame - start;

  const enterOp = interpolate(local, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const enterBlur = interpolate(local, [0, 12], [4, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const enter = spring({
    frame: local,
    fps,
    config: { damping: 24, stiffness: 130, mass: 0.7 },
  });
  const enterY = interpolate(enter, [0, 1], [12, 0]);

  const countT = Math.max(0, Math.min(1, local / 14));
  const countEased = 1 - Math.pow(1 - countT, 3);
  const value = Math.round(row.pct * countEased);

  const isHero = index === HERO_INDEX;
  const exitOp = 1 - morphT;
  const exitY = isHero ? morphT * 4 : morphT * 56;
  const exitBlur = isHero ? morphT * 2 : morphT * 10;

  return (
    <div
      style={{
        position: "absolute",
        left: barCenterX(index),
        top: labelTopY(index, row.pct),
        transform: `translate(-50%, 0) translateY(${(enterY + exitY).toFixed(2)}px)`,
        textAlign: "center",
        opacity: enterOp * exitOp,
        filter:
          enterBlur + exitBlur > 0.05
            ? `blur(${(enterBlur + exitBlur).toFixed(2)}px)`
            : undefined,
        willChange: "transform, opacity, filter",
        whiteSpace: "nowrap",
      }}
    >
      <div
        style={{
          fontFamily: font,
          fontSize: LABEL_NAME_FONT,
          lineHeight: LABEL_NAME_LH,
          fontWeight: 600,
          letterSpacing: "-0.022em",
          color: row.accent ? colors.fg : colors.fgSoft,
        }}
      >
        {row.label}
      </div>
      <div style={{ height: LABEL_INTERLINE_GAP }} />
      {/* Hero pct rendered transparently — MorphingForty paints the visible
       * "40%" over the same spot. */}
      <div
        aria-hidden={isHero}
        style={{
          fontFamily: font,
          fontSize: LABEL_VALUE_FONT,
          lineHeight: LABEL_VALUE_LH,
          fontWeight: 700,
          letterSpacing: "-0.028em",
          fontVariantNumeric: "tabular-nums",
          color: isHero ? "transparent" : colors.dim,
        }}
      >
        {isHero ? `${row.pct}%` : `${value}%`}
      </div>
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

  const cx = SRC_PCT_CX + (HERO_CENTER_X - SRC_PCT_CX) * morphT;
  const cy = SRC_PCT_CY + (HERO_CENTER_Y - SRC_PCT_CY) * morphT;
  const scale = 1 + (HERO_FONT / LABEL_VALUE_FONT - 1) * morphT;

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
        fontSize: LABEL_VALUE_FONT,
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
          fontSize: LABEL_VALUE_FONT * 0.62,
          marginLeft: 4,
          letterSpacing: "-0.02em",
        }}
      >
        %
      </span>
    </div>
  );
};

// ─── Impact burst ─────────────────────────────────────────────────────────────
//
// Two diagonal accent-blue capsules accelerate from off-screen into the
// centre of the morphing 40%. Brief radial flash on impact. A soft
// settle orb fades in behind the hero and holds. Reference: Apple's
// "watched" reveal — adapted to single-color accent.

const STREAK_START = 89;
const STREAK_IMPACT = 106;
const FLASH_END = 117;
const SETTLE_START = 109;

const Streak: React.FC<{
  frame: number;
  startFromX: number;
  startFromY: number;
  delay?: number;
}> = ({ frame, startFromX, startFromY, delay = 0 }) => {
  const startAt = STREAK_START + delay;
  const local = frame - startAt;
  const duration = STREAK_IMPACT - startAt;

  if (local < -4 || frame >= STREAK_IMPACT + 1) return null;

  const t = Math.max(0, Math.min(1, local / duration));
  // Ease-in cubic — the streak accelerates into impact.
  const eased = t * t * t;

  const x = startFromX + (HERO_CENTER_X - startFromX) * eased;
  const y = startFromY + (HERO_CENTER_Y - startFromY) * eased;

  const dx = HERO_CENTER_X - startFromX;
  const dy = HERO_CENTER_Y - startFromY;
  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

  // Longer fade-in window now that the travel is 42 frames; keeps the
  // streaks faint while the rows are still settling.
  const fadeIn = Math.max(0, Math.min(1, local / 14));
  const opacity = fadeIn;

  // Stretch the capsule as it accelerates — motion smearing.
  const baseLength = 300;
  const length = baseLength * (1 + eased * 0.7);
  const thickness = 26;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: length,
        height: thickness,
        transform: `translate(-50%, -50%) rotate(${angleDeg.toFixed(2)}deg)`,
        transformOrigin: "center center",
        borderRadius: thickness / 2,
        background:
          "linear-gradient(90deg, rgba(0,82,255,0) 0%, rgba(0,82,255,0.3) 28%, rgba(0,82,255,0.95) 72%, rgba(200,225,255,1) 92%, rgba(255,255,255,1) 100%)",
        filter: "blur(2px)",
        boxShadow:
          "0 0 28px rgba(0,82,255,0.85), 0 0 72px rgba(0,82,255,0.5), 0 0 160px rgba(0,82,255,0.22)",
        opacity,
        willChange: "transform, opacity",
        pointerEvents: "none",
      }}
    />
  );
};

const ImpactFlash: React.FC<{ frame: number }> = ({ frame }) => {
  const local = frame - STREAK_IMPACT;
  if (local < -2 || local > FLASH_END - STREAK_IMPACT) return null;

  // Spike → decay over ~10 frames.
  const tIn = Math.max(0, Math.min(1, (local + 2) / 4));
  const tOut = Math.max(
    0,
    Math.min(1, (local - 1) / (FLASH_END - STREAK_IMPACT - 1)),
  );
  const opacity = tIn * tIn * (1 - tOut * tOut * tOut);
  const scale = 0.4 + 1.3 * Math.sqrt(Math.max(0.001, tIn * (1 - tOut * 0.6)));

  return (
    <div
      style={{
        position: "absolute",
        left: HERO_CENTER_X,
        top: HERO_CENTER_Y,
        width: 800,
        height: 800,
        transform: `translate(-50%, -50%) scale(${scale.toFixed(3)})`,
        borderRadius: "50%",
        background:
          "radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(200,225,255,0.92) 14%, rgba(0,82,255,0.72) 30%, rgba(0,82,255,0.22) 55%, rgba(0,82,255,0) 78%)",
        filter: "blur(20px)",
        opacity,
        pointerEvents: "none",
      }}
    />
  );
};

const SettleOrb: React.FC<{ frame: number; fps: number }> = ({
  frame,
  fps,
}) => {
  const t = spring({
    frame: frame - SETTLE_START,
    fps,
    config: { damping: 22, stiffness: 90, mass: 0.8 },
  });
  if (t < 0.005) return null;

  const sinceStart = Math.max(0, frame - SETTLE_START);
  const breath = 1 + Math.sin(sinceStart / 36) * 0.035;
  const scale = (0.88 + t * 0.12) * breath;
  const opacity = t * 0.9;

  return (
    <div
      style={{
        position: "absolute",
        left: HERO_CENTER_X,
        top: HERO_CENTER_Y,
        width: 1100,
        height: 1100,
        transform: `translate(-50%, -50%) scale(${scale.toFixed(3)})`,
        borderRadius: "50%",
        background:
          "radial-gradient(circle, rgba(0,82,255,0.42) 0%, rgba(0,82,255,0.22) 25%, rgba(0,82,255,0.08) 50%, rgba(0,82,255,0) 78%)",
        filter: "blur(60px)",
        opacity,
        pointerEvents: "none",
      }}
    />
  );
};

// ─── Kicker typing — GMBrand Scene02 "the next era" pattern ──────────────
// Frame-driven typewriter: chars appear one by one at CHARS_PER_FRAME speed,
// blinking cursor while typing, cursor fades after completion. The accent
// half ("financial product") types in blue once the gray prefix lands.

const KICKER_TEXT_PRE = "just by switching ";
const KICKER_TEXT_HERO = "financial product";
const KICKER_CHARS_PER_FRAME = 1.2;

const KickerTyping: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const elapsed = Math.max(0, frame - startFrame);
  const totalChars = KICKER_TEXT_PRE.length + KICKER_TEXT_HERO.length;
  const charsVisible = Math.min(
    totalChars,
    Math.floor(elapsed * KICKER_CHARS_PER_FRAME),
  );
  const preVisible = Math.min(KICKER_TEXT_PRE.length, charsVisible);
  const heroVisible = Math.max(0, charsVisible - KICKER_TEXT_PRE.length);
  const typingDone = charsVisible >= totalChars;
  const completeAt = startFrame + totalChars / KICKER_CHARS_PER_FRAME;
  const cursorOpacity = !typingDone
    ? Math.sin(frame * 0.5) > -0.3
      ? 0.85
      : 0
    : Math.max(0, 0.85 - Math.max(0, frame - completeAt) / 8);

  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <span style={{ color: colors.fg }}>
        {KICKER_TEXT_PRE.slice(0, preVisible)}
      </span>
      <span style={{ color: colors.accent }}>
        {KICKER_TEXT_HERO.slice(0, heroVisible)}
      </span>
      {charsVisible > 0 && (
        <span
          style={{
            display: "inline-block",
            width: 4,
            height: 96 * 0.7,
            backgroundColor:
              charsVisible > KICKER_TEXT_PRE.length ? colors.accent : colors.fg,
            opacity: cursorOpacity,
            marginLeft: 4,
            verticalAlign: "baseline",
            transform: "translateY(6px)",
          }}
        />
      )}
    </span>
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
          fontSize: 96,
          fontWeight: 700,
          letterSpacing: "-0.032em",
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

      {/* Top kicker — the action, matched in size + weight to "Up to 2× more"
       * so the two read as twins. Sits where the headline used to live; now
       * that "Same strategy." has exited it owns the top of the frame. */}
      <div
        style={{
          position: "absolute",
          top: 156,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: font,
          fontSize: 96,
          fontWeight: 700,
          letterSpacing: "-0.032em",
          color: colors.fg,
          lineHeight: 1.0,
          opacity: kickOp,
          transform: `translateY(${kickY.toFixed(2)}px)`,
        }}
      >
        <KickerTyping startFrame={KICKER_AT} />
      </div>

      {/* Legal footnote — tiny, dim, defensible. Apple-style fine print. */}
      <div
        style={{
          position: "absolute",
          bottom: 56,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: font,
          fontSize: 18,
          fontWeight: 400,
          letterSpacing: "-0.005em",
          color: colors.dim,
          lineHeight: 1.35,
          maxWidth: 1240,
          margin: "0 auto",
          opacity: kickOp,
        }}
      >
        *Indicative comparison under favorable market conditions. Net of fees and slippage. Past performance does not guarantee future returns.
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
