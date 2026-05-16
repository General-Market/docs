import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { noise2D } from "@remotion/noise";
import { font, monoFont } from "../../common/fonts";
import { FPS, H, W, colors, toFrames } from "./theme";
import { DotGrid, DotGridVignette } from "./DotGrid";
import { IdleZoom, RevealChars } from "./vibe";
import { beatPulseScene } from "./beats";

// 228 frames, opens at absolute frame 826 (just after the Reassure→Switch
// snap). Interior music beats inside Switch land at scene-local frames
// 41, 67, 92, 118, 144 (absolute beats 33–37 at frames 867/893/918/944/970).
// Beat 32 (abs 841, local 15) lands inside the entrance transition.
//
// Setup → pivot → knife. Three rows with proportional bars; the Blocks
// row's "40%" doesn't crossfade out — it physically inflates from its
// row slot into the centre of the frame, becoming the hero. Pivot lands
// on beat 35; hero copy slams on beat 36; kicker types in on beat 37.
const SCENE_FRAMES = toFrames(7.6);

const HEADLINE_AT = 0;
const ROWS_AT = 18;
const ROW_STAGGER = 3;
// Anchored to the audio. Pivot/morph slams on beat 35 (local 92); hero
// copy lands on beat 36 (local 118); kicker types in on beat 37 (local
// 144) — the final kick before the music yields to the EndCard spike.
const PIVOT_AT = 92;
const COPY_AT = 118;
const KICKER_AT = 144;

// Interior music beats expressed in scene-local frames. Beats 33 and 34
// (local 41, 67) and beat 36 (local 118 — covered by COPY_AT) are
// handled implicitly: the brand-mark and vignette ride beatPulseScene,
// which sweeps every interior beat. The named constants below are only
// the ones that structural anchors / micro-pulses key off directly.
const BEAT_35_LOCAL = 92;  // pivot / morph / impact flash
const BEAT_37_LOCAL = 144; // final 2× punch on the last kick

type Row = { label: string; pct: number; accent: boolean };
// Order: Blocks first as the dominant bar — descending stair, matching
// the reference's IVV-leads composition.
const ROWS: Row[] = [
  { label: "Blocks", pct: 40, accent: true },
  { label: "Perps", pct: 25, accent: false },
  { label: "Predictions", pct: 25, accent: false },
  { label: "Options", pct: 20, accent: false },
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

const BAR_WIDTH = 240;
// Gap widened from 150 to 200 to accommodate the longer "Predictions"
// label without colliding with "Options".
const BAR_GAP = 200;
const BAR_BASELINE_Y = 1020;
const BAR_MAX_HEIGHT = 520; // Blocks (40%) sets the cap
const BAR_DEPTH = 30;
const BAR_STROKE = 4;

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

const CHART_TOTAL_WIDTH =
  ROWS.length * BAR_WIDTH + (ROWS.length - 1) * BAR_GAP;
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

// Hero sizing. The "2×" in the copy borrows the old 40%'s 320px scale.
// HERO_CENTER_Y is the impact point for the burst AND the vertical
// centre of the hero line — the orb glow halos the copy instead of
// floating above it like two unrelated panels.
const HERO_FONT = 320;
const HERO_CENTER_X = W / 2;
const HERO_CENTER_Y = 480;

const HERO_LINE_CENTER_Y = HERO_CENTER_Y;
const KICKER_TOP_Y = 720;

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
      <BeatVignette />
    </IdleZoom>
  </AbsoluteFill>
);

// Vignette breathes on every interior kick — base 0.20, peaks at 0.30
// when a beat lands, then settles back. Reads as the room dimming for
// a heartbeat. Linear envelope; the eye sees only the contraction.
const BeatVignette: React.FC = () => {
  const frame = useCurrentFrame();
  const env = beatPulseScene(frame, "Switch", 4, 14);
  const intensity = 0.20 + env * 0.10;
  return <DotGridVignette intensity={intensity} />;
};

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

  // Fade in around the impact (beat 35), hold through the hero state,
  // retreat at the very tail so the EndCard transition starts clean.
  const fieldOp = interpolate(
    frame,
    [85, 118, SCENE_FRAMES - 18, SCENE_FRAMES],
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
        fontWeight: 800,
        letterSpacing: "-0.04em",
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
    <BlocksLogo frame={frame} morphT={morphT} />
  </>
);

// Stamps the General Market mark on the dominant Blocks bar. Sync'd
// to the bar's own lifecycle so the logo reads as embedded in the
// face: it appears as the bar grows up to its target height, and
// dissolves at the same rate as the bar retracts during the morph.
// Hero bar starts at scene-local frame (ROWS_AT + 2) = 20 and reaches
// full height at frame 29 (count ease over 9f).
const LOGO_FADE_IN_AT = ROWS_AT + HERO_INDEX * ROW_STAGGER + 2;
const LOGO_FADE_IN_LEN = 9;
const LOGO_SIZE = 168;
// Sit the mark on the upper half of the Blocks front face so the
// "Blocks / 40%" label still reads above it without a clash.
const LOGO_CENTER_Y_RATIO = 0.34;

const BlocksLogo: React.FC<{ frame: number; morphT: number }> = ({
  frame,
  morphT,
}) => {
  // Track the hero bar's CURRENT height — not its target. The bar
  // grows up during enter and shrinks down during the morph. The
  // logo's position, scale and opacity all key off that height so
  // the mark genuinely lives inside the bar instead of floating
  // above it after the bar collapses.
  const blocks = ROWS[HERO_INDEX];
  const targetH = barTargetH(blocks.pct);
  const countT = Math.max(0, Math.min(1, (frame - LOGO_FADE_IN_AT) / LOGO_FADE_IN_LEN));
  const countEased = 1 - Math.pow(1 - countT, 3);
  const heightFactor = Math.max(0, Math.min(1, 1 - morphT * 1.4));
  const currentH = targetH * countEased * heightFactor;
  // Same disappearance threshold as Bar3D — match the bar's own
  // "I'm gone" rule so the mark dies on the same frame as the polygon.
  if (currentH < 0.5) return null;

  const yTop = BAR_BASELINE_Y - currentH;
  const cx = barCenterX(HERO_INDEX);
  const cy = yTop + currentH * LOGO_CENTER_Y_RATIO;

  // Opacity from the same combined alpha the bar uses (enter × exit).
  // Bar fades its polygon via exitOp = (1 - morphT); we mirror it so
  // the mark feels stitched into the same alpha channel.
  const opacity = countEased * (1 - Math.max(0, Math.min(1, morphT)));
  if (opacity < 0.005) return null;

  // Logo size scales with the bar's height so the mark feels embedded
  // rather than dropped on top. At full height it's LOGO_SIZE; as the
  // bar shrinks the mark shrinks with it. Beat envelope adds a tiny
  // breath on every interior kick — the mark inhales with the music.
  const baseScale = Math.min(1, currentH / targetH);
  const beatEnv = beatPulseScene(frame, "Switch", 4, 14);
  const scale = baseScale * (1 + beatEnv * 0.045);

  return (
    <div
      style={{
        position: "absolute",
        left: cx,
        top: cy,
        width: LOGO_SIZE,
        height: LOGO_SIZE,
        transform: `translate(-50%, -50%) scale(${scale.toFixed(3)})`,
        opacity,
        pointerEvents: "none",
        willChange: "transform, opacity",
      }}
    >
      <img
        src={staticFile("gm-mark-blue.svg")}
        alt=""
        draggable={false}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          filter: "drop-shadow(0 6px 22px rgba(0, 82, 255, 0.36))",
        }}
      />
    </div>
  );
};

const Bar3D: React.FC<{
  row: Row;
  index: number;
  frame: number;
  morphT: number;
}> = ({ row, index, frame, morphT }) => {
  const start = ROWS_AT + index * ROW_STAGGER + 2;
  const local = frame - start;

  const enterOp = interpolate(local, [0, 6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Height growth: ease-cubic-out over 9 frames — bars snap up, no slow fade.
  const countT = Math.max(0, Math.min(1, local / 9));
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

  const enterOp = interpolate(local, [0, 6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const enterBlur = interpolate(local, [0, 6], [4, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const enter = spring({
    frame: local,
    fps,
    config: { damping: 20, stiffness: 180, mass: 0.6 },
  });
  const enterY = interpolate(enter, [0, 1], [12, 0]);

  const countT = Math.max(0, Math.min(1, local / 9));
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
      {/* Blocks lights up in accent so the dominant bar still reads as the
       * hero now that the morphing 40% is gone. */}
      <div
        style={{
          fontFamily: font,
          fontSize: LABEL_VALUE_FONT,
          lineHeight: LABEL_VALUE_LH,
          fontWeight: 700,
          letterSpacing: "-0.028em",
          fontVariantNumeric: "tabular-nums",
          color: isHero ? colors.accent : colors.dim,
        }}
      >
        {`${value}%`}
      </div>
    </div>
  );
};

// ─── Impact burst ─────────────────────────────────────────────────────────────
//
// Two diagonal accent-blue capsules accelerate from off-screen into the
// centre of the morphing 40%. Brief radial flash on impact. A soft
// settle orb fades in behind the hero and holds. Reference: Apple's
// "watched" reveal — adapted to single-color accent.

// Streak races into impact on beat 35; flash + settle ride the same kick
// so the morph, the burst and the orb all land on one frame.
const STREAK_IMPACT = BEAT_35_LOCAL;        // 92 — kick
const STREAK_TRAVEL = 17;
const STREAK_START = STREAK_IMPACT - STREAK_TRAVEL; // 75
const FLASH_END = STREAK_IMPACT + 11;       // 103
const SETTLE_START = STREAK_IMPACT + 3;     // 95

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
        filter: "blur(40px)",
        opacity,
        pointerEvents: "none",
      }}
    />
  );
};

// ─── Kicker typing — GMBrand Scene02 "the next era" pattern ──────────────
// Frame-driven typewriter: chars appear one by one at CHARS_PER_FRAME speed,
// blinking cursor while typing, cursor fades after completion. The accent
// half ("the same markets") types in blue once the gray prefix lands.

const KICKER_TEXT_PRE = "simply by ";
const KICKER_TEXT_HERO = "NOT trading against insiders";
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
            height: 76 * 0.7,
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

  // Final pre-EndCard pulse on beat 37 (local 144). Punches the "2×"
  // multiplier on the last kick before the music yields to the spike.
  const beat37Delta = frame - BEAT_37_LOCAL;
  const beat37Env =
    beat37Delta < -4 || beat37Delta > 18
      ? 0
      : beat37Delta <= 0
        ? (beat37Delta + 4) / 4
        : 1 - beat37Delta / 18;
  const heroPunch = 1 + beat37Env * 0.045;

  return (
    <>
      {/* Hero line: "Earn up to 2× more*" — one row, "2×" sized at the old
       * 40%'s 320px scale and lit in accent. The smaller words ride the
       * baseline so the multiplier looms over them. */}
      <div
        style={{
          position: "absolute",
          top: HERO_LINE_CENTER_Y,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: font,
          color: colors.fg,
          opacity: claimOp,
          transform: `translate(0, -50%) translateY(${claimY.toFixed(2)}px)`,
          whiteSpace: "nowrap",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "baseline",
            justifyContent: "center",
            gap: 24,
          }}
        >
          <span
            style={{
              fontSize: 140,
              fontWeight: 700,
              letterSpacing: "-0.032em",
              lineHeight: 1.0,
            }}
          >
            Earn up to
          </span>
          <span
            style={{
              fontSize: HERO_FONT,
              fontWeight: 800,
              letterSpacing: "-0.045em",
              lineHeight: 1.0,
              color: colors.accent,
              display: "inline-block",
              transform: `scale(${heroPunch.toFixed(3)})`,
              transformOrigin: "center center",
              willChange: "transform",
            }}
          >
            2×
          </span>
          <span
            style={{
              fontSize: 140,
              fontWeight: 700,
              letterSpacing: "-0.032em",
              lineHeight: 1.0,
            }}
          >
            more
            <span
              style={{
                fontFamily: monoFont,
                fontSize: 32,
                color: colors.dim,
                marginLeft: 6,
                verticalAlign: "super",
                fontWeight: 500,
                letterSpacing: 0,
              }}
            >
              (6)
            </span>
          </span>
        </span>
      </div>

      {/* Kicker — sits below the hero line. Types in once the hero has
       * landed so the eye reads top-down: setup, claim, cause. */}
      <div
        style={{
          position: "absolute",
          top: KICKER_TOP_Y,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: font,
          fontSize: 76,
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
