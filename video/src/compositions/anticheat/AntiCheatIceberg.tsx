import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { CameraMotionBlur } from "@remotion/motion-blur";
import { font, monoFont } from "../../common/fonts";
import { FPS, H, W } from "./theme";
import { Specular } from "./fx/Specular";
import { Volumetrics } from "./fx/Volumetrics";
import { Wash } from "./fx/Wash";
import { VIDEO_BEATS } from "./beats";

// The "I lost because of …" iceberg.
//
// Camera descends through six tiers. The clamp on scroll has been
// removed — at T4 and T5 the iceberg's bottom rises into the frame,
// revealing abyss below. Surface god rays at T0–T2. Waterline sweep
// at T1. Underwater takes hold afterward: caustic shimmer, three
// bubble depth layers, motion-blur on the scroll. The climax at
// "insider traders" gets specular sweep, chromatic split, NYSE
// solarise, red bloom, and a Wash vignette. Tier stamps are pinned
// to VIDEO_BEATS.

const IMG_NATIVE_W = 1265;
const IMG_NATIVE_H = 1670;

const FILL_SCALE = W / IMG_NATIVE_W;        // ~1.518

const ZOOM_START_SCALE = 2.6;

const TIER_Y_NATIVE = [
  Math.round((0 + 269) / 2),       // 134  — sky / above line 1
  Math.round((269 + 539) / 2),     // 404  — tip
  Math.round((539 + 857) / 2),     // 698  — upper underwater
  Math.round((857 + 1141) / 2),    // 999  — mid underwater
  Math.round((1141 + 1430) / 2),   // 1285 — lower iceberg
  Math.round((1430 + 1670) / 2),   // 1550 — depths
];
const TIER_Y_FILL = TIER_Y_NATIVE.map((y) => y * FILL_SCALE);

const PRIMARY_ACTIVE_Y = TIER_Y_FILL[0];
const FRAME_CENTRE_Y = H / 2;

// Camera target screen-y per tier. T0 (sky / strategy) can't centre —
// nothing exists above the asset's top edge to fill the empty space.
// Every later tier lands dead-centre so the eye doesn't hunt.
const SCREEN_TARGET_Y = (i: number) => (i === 0 ? PRIMARY_ACTIVE_Y : FRAME_CENTRE_Y);

const scrollAtTier = (i: number) => SCREEN_TARGET_Y(i) - TIER_Y_FILL[i];

type Tier = {
  word: string[];
  icon?: string;
  stat?: string;
  statUnit?: string;
  accent?: string;
  pullQuote?: string;
  caption?: string;
  source?: string;
};

export const TIERS: Tier[] = [
  { word: ["strategy"] },
  { word: ["fees"] },
  { word: ["liquidation", "hunters"] },
  { word: ["front", "runners"] },
  { word: ["orderbook", "spoofers"] },
  { word: ["insider", "traders"], accent: "#FF3344" },
];
const N = TIERS.length;
const LAST = N - 1;

type TradingTier = { imageSrc: string; glyph: string; label: string };

const TRADING_TIERS: TradingTier[] = [
  { imageSrc: "anticheat-imgs/trader-0.png", glyph: "📱", label: "you, on your phone" },
  { imageSrc: "anticheat-imgs/trader-1.png", glyph: "💻", label: "the digital nomad" },
  { imageSrc: "anticheat-imgs/trader-2.png", glyph: "🖥️", label: "prop firm" },
  { imageSrc: "anticheat-imgs/trader-3.png", glyph: "🏛️", label: "trading floor" },
  { imageSrc: "anticheat-imgs/trader-4.png", glyph: "🏦", label: "wall street" },
  { imageSrc: "anticheat-imgs/trader-5.png", glyph: "🏛️", label: "u.s. congress" },
];

const EASE_OUT = Easing.bezier(0.25, 0.1, 0.3, 1);
const EASE_DEFAULT = Easing.bezier(0.4, 0, 0.6, 1);

// Beat-locked tier stamps. Iceberg master window [111, 331].
// Local beats: 10, 36, 61, 87, 113, 139, 164, 190, 216.
// Anim window is six frames — launch video, no time to dawdle. The
// motion blur on the iceberg layer carries the eye across the gap.
const TIER_STAMP_LOCAL = [36, 61, 87, 113, 139, 164] as const;
const STAMP_OFFSET_FROM_ANIM = 5;
const TIER_ANIM = 6;
const ZOOM_OUT = TIER_STAMP_LOCAL[0] - STAMP_OFFSET_FROM_ANIM; // 31
const FINAL_HOLD = 41;
const OUTRO = 14;

const tierAnimStart = (i: number) =>
  TIER_STAMP_LOCAL[i] - STAMP_OFFSET_FROM_ANIM;

const tierHoldEnd = (i: number) =>
  i === LAST
    ? tierAnimStart(i) + TIER_ANIM + FINAL_HOLD
    : tierAnimStart(i + 1);

const SCENE_FRAMES =
  tierAnimStart(LAST) + TIER_ANIM + FINAL_HOLD + OUTRO; // 220

const WATERLINE_START = tierAnimStart(1);
const WATERLINE_DUR = 6;
const WATERLINE_FADE = 18;

type State =
  | { phase: "zoom"; t: number }
  | { phase: "tier"; tier: number; sub: "anim" | "hold"; t: number };

const stateAt = (frame: number): State => {
  if (frame < ZOOM_OUT) return { phase: "zoom", t: frame / ZOOM_OUT };
  for (let i = 0; i < N; i++) {
    const animStart = tierAnimStart(i);
    const holdStart = animStart + TIER_ANIM;
    const holdEnd = tierHoldEnd(i);
    if (frame < holdStart)
      return { phase: "tier", tier: i, sub: "anim", t: (frame - animStart) / TIER_ANIM };
    if (frame < holdEnd) {
      const holdLen = Math.max(1, holdEnd - holdStart);
      return { phase: "tier", tier: i, sub: "hold", t: (frame - holdStart) / holdLen };
    }
  }
  return { phase: "tier", tier: LAST, sub: "hold", t: 1 };
};

const computeScale = (state: State): number => {
  if (state.phase === "zoom")
    return interpolate(state.t, [0, 1], [ZOOM_START_SCALE, FILL_SCALE], {
      easing: EASE_OUT,
    });
  if (state.sub === "hold") {
    const pulse = Math.sin(state.t * Math.PI) * 0.008;
    const climaxPush = state.tier === LAST ? state.t * 0.05 : 0;
    return FILL_SCALE * (1 + pulse + climaxPush);
  }
  return FILL_SCALE;
};

const computeScrollY = (state: State): number => {
  if (state.phase === "zoom") return 0;
  if (state.sub === "hold") return scrollAtTier(state.tier);
  if (state.tier === 0) return 0;
  const a = scrollAtTier(state.tier - 1);
  const b = scrollAtTier(state.tier);
  return a + (b - a) * EASE_OUT(state.t);
};

// Per-tier colour grade. Hue-rotate kept narrow so the iceberg's
// blue stays believable. Brightness drops with depth.
const computeIcebergFilter = (state: State): string => {
  const d =
    state.phase === "tier"
      ? (state.tier + (state.sub === "anim" ? state.t : 1)) / N
      : 0;
  const sat = interpolate(d, [0, 0.5, 1], [1.05, 0.95, 1.15]);
  const bright = interpolate(d, [0, 0.5, 1], [1.08, 0.92, 0.62]);
  const contrast = interpolate(d, [0, 1], [1.0, 1.18]);
  return `saturate(${sat.toFixed(3)}) brightness(${bright.toFixed(3)}) contrast(${contrast.toFixed(3)})`;
};

// Per-tier PnL stamp. Escalates roughly with the dollars-extracted scale
// established in the original LossCounter — strategy is a paper-cut,
// insider traders is a fatal wound.
const TIER_PNL = ["−1.0%", "−2.8%", "−6.4%", "−14.7%", "−32.5%", "−74.2%"] as const;

// ─── Pointcloud iceberg ───────────────────────────────────────────────────────
//
// The photo is retired. The iceberg is rendered as a halftone-style point
// cloud — a jittered grid of dots whose radii track a procedural density
// function. Two peaks above the waterline, the bulk underwater, sky and
// abyss reduced to sparse particulate. Computed once at module load and
// memoised inside React.

type IcebergDot = { x: number; y: number; r: number; fill: string };

const pseudo = (i: number): number => {
  let h = (i * 2654435761) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 0xffffffff;
};

const ICEBERG_WATERLINE_NORM = 539 / IMG_NATIVE_H;   // 0.323
const ICEBERG_TOP_NORM = 0.085;
const ICEBERG_BOTTOM_NORM = 0.945;

const icebergDensity = (x: number, y: number): number => {
  let d = 0;

  // Above-water tip — two peaks rising out of the waterline.
  if (y >= ICEBERG_TOP_NORM && y < ICEBERG_WATERLINE_NORM) {
    const tipT =
      (y - ICEBERG_TOP_NORM) / (ICEBERG_WATERLINE_NORM - ICEBERG_TOP_NORM);

    // Tall left peak.
    const lpCx = 0.435 - tipT * 0.055;
    const lpHw = 0.022 + tipT * 0.140;
    const lDist = Math.abs(x - lpCx) / lpHw;
    if (lDist < 1) d = Math.max(d, 1 - lDist * lDist * 0.55);

    // Shorter right peak, starts a bit lower.
    if (y >= 0.155) {
      const rpT = (y - 0.155) / (ICEBERG_WATERLINE_NORM - 0.155);
      const rpCx = 0.560 + rpT * 0.045;
      const rpHw = 0.026 + rpT * 0.108;
      const rDist = Math.abs(x - rpCx) / rpHw;
      if (rDist < 1) d = Math.max(d, 1 - rDist * rDist * 0.55);
    }
  }

  // Below-water bulk — wide at the waterline, narrows to a rounded foot.
  if (y >= ICEBERG_WATERLINE_NORM && y <= ICEBERG_BOTTOM_NORM) {
    const bulkT =
      (y - ICEBERG_WATERLINE_NORM) /
      (ICEBERG_BOTTOM_NORM - ICEBERG_WATERLINE_NORM);

    const widthCurve = 1 - Math.pow(bulkT, 1.45) * 0.88;
    const halfW = 0.295 * widthCurve;
    const wobble =
      Math.sin(bulkT * 11) * 0.010 + Math.sin(bulkT * 23 + 1.4) * 0.006;
    const cx = 0.505 + wobble;
    const dist = Math.abs(x - cx) / halfW;

    if (dist < 1) d = Math.max(d, 1 - dist * dist * 0.50);
  }

  return Math.min(1, d);
};

const generateIcebergDots = (): IcebergDot[] => {
  const dots: IcebergDot[] = [];
  const COLS = 88;
  const ROWS = 116;

  for (let row = 0; row < ROWS; row++) {
    const stagger = row % 2 === 0 ? 0 : 0.5;
    for (let col = 0; col < COLS; col++) {
      const seed = row * 1003 + col * 7 + 17;
      const n1 = pseudo(seed);
      const n2 = pseudo(seed + 1009);
      const n3 = pseudo(seed + 2017);

      const jx = (n1 - 0.5) * 0.42;
      const jy = (n2 - 0.5) * 0.42;
      const xNorm = (col + stagger + jx) / COLS;
      const yNorm = (row + jy) / ROWS;
      if (xNorm < 0 || xNorm > 1 || yNorm < 0 || yNorm > 1) continue;

      const density = icebergDensity(xNorm, yNorm);
      let r: number;
      let fill: string;

      if (density > 0.04) {
        const isAbove = yNorm < ICEBERG_WATERLINE_NORM;
        const radiusJitter = (n3 - 0.5) * 2.4;
        r = Math.max(0.7, 2.6 + density * 9.0 + radiusJitter);

        if (isAbove) {
          const bright = 210 + density * 45;
          const rC = Math.min(255, Math.round(bright));
          const gC = Math.min(255, Math.round(bright + 10));
          fill = `rgba(${rC}, ${gC}, 255, ${(0.86 + density * 0.14).toFixed(3)})`;
        } else {
          const depth = (yNorm - ICEBERG_WATERLINE_NORM) / (1 - ICEBERG_WATERLINE_NORM);
          const coolFade = 1 - depth * 0.55;
          const rC = Math.round(120 * coolFade + density * 110 * coolFade);
          const gC = Math.round(180 * coolFade + density * 60 * coolFade);
          const bC = Math.round(240 - depth * 30);
          fill = `rgba(${rC}, ${gC}, ${bC}, ${(0.78 + density * 0.18).toFixed(3)})`;
        }
      } else {
        if (n1 < 0.58) continue; // sparser background
        const isSky = yNorm < ICEBERG_WATERLINE_NORM;
        if (isSky) {
          r = 0.55 + n3 * 1.05;
          fill = `rgba(205, 222, 245, ${(0.18 + n3 * 0.22).toFixed(3)})`;
        } else {
          const depthT =
            (yNorm - ICEBERG_WATERLINE_NORM) / (1 - ICEBERG_WATERLINE_NORM);
          r = 0.85 + n3 * 1.35;
          const rC = Math.max(0, Math.round(30 - depthT * 24));
          const gC = Math.max(0, Math.round(76 - depthT * 52));
          const bC = Math.max(0, Math.round(140 - depthT * 86));
          fill = `rgba(${rC}, ${gC}, ${bC}, ${(0.40 - depthT * 0.22).toFixed(3)})`;
        }
      }

      dots.push({
        x: xNorm * IMG_NATIVE_W,
        y: yNorm * IMG_NATIVE_H,
        r,
        fill,
      });
    }
  }

  return dots;
};

const ICEBERG_DOTS = generateIcebergDots();

const IcebergPoints: React.FC = React.memo(() => (
  <svg
    width={IMG_NATIVE_W}
    height={IMG_NATIVE_H}
    viewBox={`0 0 ${IMG_NATIVE_W} ${IMG_NATIVE_H}`}
    style={{
      position: "absolute",
      left: 0,
      top: 0,
      display: "block",
      shapeRendering: "geometricPrecision",
    }}
  >
    <defs>
      <linearGradient
        id="iceberg-bg"
        x1={0}
        y1={0}
        x2={0}
        y2={IMG_NATIVE_H}
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0%" stopColor="#1f3760" />
        <stop offset={`${(ICEBERG_WATERLINE_NORM * 100).toFixed(2)}%`} stopColor="#0a1a36" />
        <stop offset="68%" stopColor="#040a1e" />
        <stop offset="100%" stopColor="#000308" />
      </linearGradient>
    </defs>
    <rect width={IMG_NATIVE_W} height={IMG_NATIVE_H} fill="url(#iceberg-bg)" />
    {ICEBERG_DOTS.map((d, i) => (
      <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={d.fill} />
    ))}
  </svg>
));
IcebergPoints.displayName = "IcebergPoints";

type Bubble = { x: number; baseY: number; size: number; speed: number; phase: number };

const seeded = (i: number, m = 233280) => {
  const s = (i * 9301 + 49297) % m;
  return s / m;
};

const makeField = (count: number, seedBase: number, sizeBase: number, sizeRange: number, speedBase: number, speedRange: number): Bubble[] =>
  Array.from({ length: count }, (_, i) => ({
    x: seeded(i + seedBase) * W,
    baseY: seeded(i + seedBase + 100) * H * 1.6,
    size: sizeBase + Math.round(seeded(i + seedBase + 200) * sizeRange),
    speed: speedBase + seeded(i + seedBase + 300) * speedRange,
    phase: seeded(i + seedBase + 400) * Math.PI * 2,
  }));

// Three depth layers — far/blurred/slow, mid/sharp/medium, near/large/fast.
const BUBBLES_FAR = makeField(28, 500, 2, 3, 0.15, 0.25);
const BUBBLES_MID = makeField(22, 1000, 5, 6, 0.5, 0.8);
const BUBBLES_NEAR = makeField(14, 2000, 12, 18, 1.0, 1.3);

// Bioluminescent sparkle field in the abyss.
const SPARKS = makeField(24, 3000, 1, 2, 0, 0);

const HERO_SHADOW =
  "0 4px 28px rgba(0,0,0,0.95), 0 2px 10px rgba(0,0,0,0.9), 0 0 56px rgba(0,0,0,0.55)";

export const AntiCheatIceberg: React.FC = () => {
  const frame = useCurrentFrame();
  const state = stateAt(frame);
  const scale = computeScale(state);
  const scrollY = computeScrollY(state);
  const icebergFilter = computeIcebergFilter(state);

  const activeTier = state.phase === "tier" ? state.tier : -1;
  const activeFrameY =
    activeTier >= 0 ? TIER_Y_FILL[activeTier] + scrollY * 1 : PRIMARY_ACTIVE_Y;

  const introOpacity = interpolate(frame, [0, ZOOM_OUT * 0.3], [0, 1], {
    easing: EASE_OUT,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const outroOpacity = interpolate(
    frame,
    [SCENE_FRAMES - OUTRO, SCENE_FRAMES],
    [1, 0],
    { easing: EASE_OUT, extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const sceneOpacity = Math.min(introOpacity, outroOpacity);

  const descentProgress =
    state.phase === "tier" ? state.tier / LAST : 0;
  const vignetteAlpha = 0.22 + 0.4 * descentProgress;

  const underwaterT = interpolate(
    frame,
    [WATERLINE_START, WATERLINE_START + WATERLINE_DUR + WATERLINE_FADE],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_OUT },
  );

  // Camera-in-water sway. Subtle horizontal drift on the iceberg layer
  // sells "we are submerged."
  const swayX =
    underwaterT > 0 ? Math.sin(frame / 32) * 6 * underwaterT : 0;
  const swayY = underwaterT > 0 ? Math.cos(frame / 47) * 3 * underwaterT : 0;

  // Caustic light position drift — two animated radial gradients overlap
  // and translate independently. Reads as shimmering water light on top
  // of the iceberg.
  const causticT = frame;
  const caustic1X = 30 + Math.sin(causticT / 36) * 22;
  const caustic1Y = 20 + Math.cos(causticT / 48) * 14;
  const caustic2X = 70 + Math.cos(causticT / 42) * 18;
  const caustic2Y = 15 + Math.sin(causticT / 58) * 12;

  // Background gradient — surface light fades, abyss takes over.
  const bgScroll = scrollY * 0.3;

  // Climax housekeeping.
  const isClimax = state.phase === "tier" && state.tier === LAST;

  // Past suffixes fade out during the climax — the field has earned the
  // right to be empty by the time "insider traders" lands.
  const pastFade = isClimax
    ? interpolate(state.sub === "hold" ? state.t : 0, [0, 0.4], [0.62, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1;

  // Whether the scroll between tiers is currently in motion. Motion blur
  // kicks in for those frames only.
  const scrollMoving =
    state.phase === "tier" && state.sub === "anim" && state.tier > 0;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#000000",
        fontFamily: font,
        opacity: sceneOpacity,
        overflow: "hidden",
      }}
    >
      {/* Far-back atmosphere — surface light up top, abyss below. The
          deepest descent eats the gradient entirely. */}
      <AbsoluteFill
        style={{
          background: `
            radial-gradient(140% 90% at 50% ${-15 + descentProgress * 40}%,
              rgba(140, 188, 240, ${0.32 * (1 - underwaterT * 0.5)}) 0%,
              rgba(38, 78, 128, ${0.78 * underwaterT}) 28%,
              rgba(12, 26, 52, ${0.94 * underwaterT}) 60%,
              rgba(2, 6, 14, ${0.98 * underwaterT}) 100%
            )
          `,
          transform: `translateY(${bgScroll.toFixed(2)}px)`,
          pointerEvents: "none",
        }}
      />

      {/* Far depth — slow, blurred particulate, parallaxes at 0.4×. */}
      {underwaterT > 0.03 && (
        <Particles
          field={BUBBLES_FAR}
          frame={frame}
          parallax={0.4 * scrollY}
          colour={`rgba(170, 200, 235, ${0.18 * underwaterT})`}
          blur={2}
        />
      )}

      {/* Surface god rays — peak at the waterline crossing, decay as we
          descend. Light from above-frame. */}
      <Volumetrics
        peakFrame={WATERLINE_START - 4}
        attack={14}
        decay={70}
        cx="50%"
        cy="-8%"
        color="rgba(140, 200, 255, 0.6)"
        coreColor="rgba(220, 240, 255, 0.85)"
        intensity={Math.max(0, 1 - descentProgress * 1.4)}
        rays={26}
        rayWidth={0.9}
        blur={2.4}
        reach="85%"
        streak={false}
      />

      {/* Iceberg layer — wrapped in motion blur during scroll transitions.
          Caustic shimmer + per-tier colour grade live inside this layer
          so they ride the iceberg. */}
      <ConditionalMotionBlur active={scrollMoving} shutter={140}>
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: scrollY + swayY,
            width: IMG_NATIVE_W,
            height: IMG_NATIVE_H,
            transform: `translate(${(-50).toFixed(0)}%, 0) translateX(${swayX.toFixed(2)}px) scale(${scale.toFixed(4)})`,
            transformOrigin: "top center",
            willChange: "transform, top",
            filter: icebergFilter,
          }}
        >
          <IcebergPoints />

          {/* Caustic light shimmer — two drifting radials. Only above the
              waterline (native y < 539, the upper iceberg). */}
          {underwaterT < 0.95 && (
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: IMG_NATIVE_W,
                height: 539,
                background: `
                  radial-gradient(ellipse 30% 18% at ${caustic1X}% ${caustic1Y}%, rgba(220,240,255,${0.28 * (1 - underwaterT)}) 0%, transparent 60%),
                  radial-gradient(ellipse 24% 14% at ${caustic2X}% ${caustic2Y}%, rgba(190,220,250,${0.22 * (1 - underwaterT)}) 0%, transparent 60%)
                `,
                mixBlendMode: "screen",
                pointerEvents: "none",
              }}
            />
          )}

          {/* Underwater caustic — broader, slower, on the submerged
              portion. Fades in with descent. */}
          {underwaterT > 0.1 && (
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 539,
                width: IMG_NATIVE_W,
                height: IMG_NATIVE_H - 539,
                background: `
                  radial-gradient(ellipse 40% 22% at ${100 - caustic1X}% ${20 + caustic1Y * 0.5}%, rgba(120,180,235,${0.22 * underwaterT}) 0%, transparent 65%),
                  radial-gradient(ellipse 35% 18% at ${100 - caustic2X}% ${30 + caustic2Y * 0.4}%, rgba(90,150,210,${0.18 * underwaterT}) 0%, transparent 65%)
                `,
                mixBlendMode: "screen",
                pointerEvents: "none",
              }}
            />
          )}
        </div>
      </ConditionalMotionBlur>

      {/* Mid-depth bubbles between the iceberg and the foreground. */}
      {underwaterT > 0.08 && (
        <Particles
          field={BUBBLES_MID}
          frame={frame}
          parallax={0.7 * scrollY}
          colour={`rgba(195, 220, 245, ${0.34 * underwaterT})`}
          ring
        />
      )}

      {/* Specular sweep across the iceberg surface — climax marker on
          tier 5 only. Starts 0.5s after the stamp so it carries the eye
          into the Iceberg→Rigged transition rather than landing with
          the suffix. The light passes, then we cut. */}
      {isClimax && (
        <Specular
          startFrame={tierAnimStart(LAST) + 15}
          duration={30}
          angle={108}
          intensity={1.25}
          color="rgba(255, 92, 116, 0.95)"
          bandWidth={0.26}
          blendMode="screen"
        />
      )}

      {/* Atmospheric vignette deepens as we descend. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 50% 35%, rgba(0,0,0,0) 30%, rgba(0,0,0,${vignetteAlpha.toFixed(3)}) 100%)`,
          pointerEvents: "none",
        }}
      />

      {/* Past tier suffixes — fade out during the climax. */}
      {TIERS.map((tier, i) =>
        state.phase === "tier" && i < state.tier ? (
          <PastSuffix
            key={i}
            tier={tier}
            index={i}
            scrollY={scrollY}
            opacity={pastFade}
          />
        ) : null,
      )}

      {/* Active row. */}
      {activeTier >= 0 && (
        <ActiveRow
          state={state}
          tier={activeTier}
          activeFrameY={activeFrameY}
          frame={frame}
        />
      )}

      {/* Per-tier image bands. */}
      {TRADING_TIERS.map((tt, i) => (
        <TierImage
          key={i}
          tier={tt}
          index={i}
          scrollY={scrollY}
          isActive={state.phase === "tier" && i === state.tier}
          state={state}
          frame={frame}
        />
      ))}

      {/* Bioluminescent sparkle in the abyss — only when the iceberg has
          retreated and the bottom of the frame is mostly dark. */}
      {state.phase === "tier" && state.tier >= 4 && (
        <SparkField
          field={SPARKS}
          frame={frame}
          intensity={interpolate(state.tier - 4 + (state.sub === "anim" ? state.t : 1), [0, 2], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
        />
      )}

      {/* Foreground bubble column — fastest, largest, most blurred. */}
      {underwaterT > 0.05 && (
        <Particles
          field={BUBBLES_NEAR}
          frame={frame}
          parallax={1.4 * scrollY}
          colour={`rgba(230, 240, 250, ${0.42 * underwaterT})`}
          ring
          blur={0.5}
        />
      )}

      {/* The waterline crossing — single sweep, then a thin persistent
          line that scrolls with the surface. */}
      <Waterline frame={frame} scrollY={scrollY} />

      {/* Climax wash — periphery darkens and a cool tint scrim wraps the
          frame. Holds through T5 hold + outro. */}
      {isClimax && (
        <Wash
          startFrame={tierAnimStart(LAST) - 4}
          inFrames={14}
          hold={FINAL_HOLD + 8}
          outFrames={OUTRO}
          cx="34%"
          cy="50%"
          holeSize="22%"
          holeSoftness="68%"
          vignette={0.55}
          vignetteColor="rgba(4, 8, 18, 1)"
          tint="rgba(80, 24, 48, 1)"
          tintOpacity={0.18}
          blendMode="multiply"
        />
      )}

      {/* Source citation. */}
      {activeTier >= 0 && TIERS[activeTier].source && (
        <SourceCitation url={TIERS[activeTier].source!} state={state} />
      )}
    </AbsoluteFill>
  );
};

// ─── Conditional motion blur ──────────────────────────────────────────────────

const ConditionalMotionBlur: React.FC<{
  active: boolean;
  shutter: number;
  children: React.ReactNode;
}> = ({ active, shutter, children }) => {
  if (!active) return <>{children}</>;
  return (
    <CameraMotionBlur shutterAngle={Math.min(180, shutter)} samples={2}>
      {children}
    </CameraMotionBlur>
  );
};

// ─── Particles ────────────────────────────────────────────────────────────────

const Particles: React.FC<{
  field: Bubble[];
  frame: number;
  parallax: number;
  colour: string;
  blur?: number;
  ring?: boolean;
}> = ({ field, frame, parallax, colour, blur = 0, ring = false }) => {
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {field.map((b, i) => {
        const period = H + 200;
        const raw = b.baseY - frame * b.speed + parallax;
        const wrapped = ((raw % period) + period) % period - 100;
        const wobble = Math.sin(frame / 26 + b.phase) * 7;
        const x = b.x + wobble;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: wrapped,
              width: b.size,
              height: b.size,
              borderRadius: "50%",
              background: ring ? "transparent" : colour,
              border: ring ? `1px solid ${colour}` : "none",
              boxShadow: ring
                ? `inset 0 0 ${b.size}px ${colour}, 0 0 ${b.size * 1.5}px ${colour}`
                : `0 0 ${b.size}px ${colour}`,
              filter: blur ? `blur(${blur}px)` : undefined,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// ─── Sparkle field ────────────────────────────────────────────────────────────

const SparkField: React.FC<{
  field: Bubble[];
  frame: number;
  intensity: number;
}> = ({ field, frame, intensity }) => {
  if (intensity <= 0) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {field.map((s, i) => {
        const phase = (frame / 18 + s.phase) % (Math.PI * 2);
        const twinkle = Math.max(0, Math.sin(phase));
        const opacity = twinkle * intensity * 0.95;
        // Constrain to lower half of frame so sparkles read as deep-water.
        const y = (H * 0.45) + s.baseY * 0.35;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: s.x,
              top: y,
              width: 3,
              height: 3,
              borderRadius: "50%",
              background: "rgba(180, 220, 255, 1)",
              boxShadow:
                "0 0 8px rgba(180,220,255,0.95), 0 0 18px rgba(120,180,240,0.6)",
              opacity,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// ─── Waterline ────────────────────────────────────────────────────────────────

const Waterline: React.FC<{ frame: number; scrollY: number }> = ({
  frame,
  scrollY,
}) => {
  if (frame < WATERLINE_START) return null;

  const sweepLocal = frame - WATERLINE_START;
  const sweepT = Math.min(1, sweepLocal / WATERLINE_DUR);
  const sweepWidth = EASE_OUT(sweepT) * W;
  const sweepOpacity = sweepLocal < WATERLINE_DUR
    ? 1
    : Math.max(0, 1 - (sweepLocal - WATERLINE_DUR) / WATERLINE_FADE);

  const surfaceY = 269 * FILL_SCALE + scrollY;
  const lineOpacity =
    Math.max(0, Math.min(1, (sweepLocal - WATERLINE_DUR) / WATERLINE_FADE)) * 0.62;

  return (
    <>
      {sweepOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            top: PRIMARY_ACTIVE_Y - 4,
            left: W / 2 - sweepWidth / 2,
            width: sweepWidth,
            height: 8,
            background:
              "linear-gradient(90deg, rgba(140,200,240,0) 0%, rgba(220,240,255,1) 50%, rgba(140,200,240,0) 100%)",
            boxShadow:
              "0 0 38px rgba(180,220,255,0.95), 0 0 90px rgba(120,180,240,0.55)",
            opacity: sweepOpacity,
            mixBlendMode: "screen",
            pointerEvents: "none",
          }}
        />
      )}
      {lineOpacity > 0 && surfaceY > -20 && surfaceY < H + 20 && (
        <div
          style={{
            position: "absolute",
            top: surfaceY,
            left: 0,
            width: W,
            height: 2,
            background:
              "linear-gradient(90deg, rgba(140,200,240,0) 0%, rgba(180,220,255,0.85) 50%, rgba(140,200,240,0) 100%)",
            boxShadow: "0 0 16px rgba(160,210,250,0.45)",
            opacity: lineOpacity,
            mixBlendMode: "screen",
            pointerEvents: "none",
          }}
        />
      )}
    </>
  );
};

// ─── Per-tier image band ──────────────────────────────────────────────────────

const BAND_BOUNDS_NATIVE: { top: number; bottom: number }[] = [
  { top: 0,    bottom: 269 },
  { top: 269,  bottom: 539 },
  { top: 539,  bottom: 857 },
  { top: 857,  bottom: 1141 },
  { top: 1141, bottom: 1430 },
  { top: 1430, bottom: 1670 },
];

const BAND_BOUNDS = BAND_BOUNDS_NATIVE.map((b) => ({
  top: b.top * FILL_SCALE,
  bottom: b.bottom * FILL_SCALE,
  height: (b.bottom - b.top) * FILL_SCALE,
}));

const BAND_RIGHT_INSET = 0;
const BAND_WIDTH = 360;

const TierImage: React.FC<{
  tier: TradingTier;
  index: number;
  scrollY: number;
  isActive: boolean;
  state: State;
  frame: number;
}> = ({ tier, index, scrollY, isActive, state, frame }) => {
  const band = BAND_BOUNDS[index];
  const top = band.top + scrollY;
  const height = band.height;

  if (top + height < -120 || top > H + 120) return null;

  const solariseStart = tierAnimStart(LAST) + 5;
  const isSolarising =
    index === LAST &&
    frame >= solariseStart &&
    frame < solariseStart + 4;

  const kenBurns =
    isActive && state.phase === "tier" && state.sub === "hold"
      ? 1 + state.t * 0.05
      : 1;

  const filter = isSolarising
    ? "invert(1) saturate(0.4) hue-rotate(180deg)"
    : isActive
      ? "saturate(1.1) brightness(1)"
      : "grayscale(1) brightness(0.45) blur(1.5px)";

  const borderColor =
    index === LAST
      ? "rgba(255,86,110,0.95)"
      : "rgba(255,255,255,0.92)";
  const glowColor =
    index === LAST
      ? "rgba(255,86,110,0.55)"
      : "rgba(255,255,255,0.25)";

  return (
    <div
      style={{
        position: "absolute",
        right: BAND_RIGHT_INSET,
        top,
        width: BAND_WIDTH,
        height,
        overflow: "hidden",
        boxShadow: isActive
          ? `inset 0 0 0 3px ${borderColor}, inset 0 0 60px ${glowColor}`
          : "none",
        background: "#000000",
        pointerEvents: "none",
        willChange: "top",
      }}
    >
      <Img
        src={staticFile(tier.imageSrc)}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${kenBurns.toFixed(3)})`,
          transformOrigin: "center center",
          filter,
          transition: "filter 220ms ease",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: "22px 16px 12px",
          background:
            "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.92) 100%)",
          fontFamily: font,
          fontSize: 18,
          fontWeight: 600,
          color: isActive ? "#FFFFFF" : "rgba(255,255,255,0.55)",
          letterSpacing: "-0.012em",
          textAlign: "left",
          lineHeight: 1.2,
          textShadow: "0 1px 6px rgba(0,0,0,0.95)",
        }}
      >
        {tier.label}
      </div>
      <div
        style={{
          position: "absolute",
          top: 14,
          left: 14,
          right: 14,
          padding: "10px 14px 11px",
          background: "rgba(46, 6, 14, 0.86)",
          border: "1.5px solid rgba(255, 86, 110, 0.85)",
          borderRadius: 8,
          fontFamily: monoFont,
          fontSize: 32,
          fontWeight: 700,
          letterSpacing: "-0.015em",
          color: isActive ? "rgba(255, 96, 110, 1)" : "rgba(255, 96, 110, 0.55)",
          textAlign: "center",
          lineHeight: 1,
          textShadow: "0 2px 8px rgba(0,0,0,0.95)",
          boxShadow: isActive
            ? "0 6px 22px rgba(0,0,0,0.7), 0 0 26px rgba(255,56,80,0.5)"
            : "0 2px 10px rgba(0,0,0,0.55)",
          pointerEvents: "none",
        }}
      >
        {TIER_PNL[index]}
      </div>
    </div>
  );
};

// ─── Active row ───────────────────────────────────────────────────────────────

const ActiveRow: React.FC<{
  state: State;
  tier: number;
  activeFrameY: number;
  frame: number;
}> = ({ state, tier, activeFrameY, frame }) => {
  const t = TIERS[tier];
  const isAnim = state.phase === "tier" && state.sub === "anim";

  let suffixSlide = 0;
  let suffixOpacity = 1;
  let suffixScale = 1;
  if (isAnim) {
    const at = state.t;
    suffixSlide = interpolate(at, [0, 1], [70, 0], { easing: EASE_OUT });
    suffixOpacity = interpolate(at, [0.35, 0.85], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    suffixScale = interpolate(at, [0.55, 0.85, 1], [0.96, 1.08, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: EASE_DEFAULT,
    });
  }

  // Climax suffix breathes — beat-pulses on local 164, 190, 216.
  const isClimax = tier === LAST;
  let climaxBreath = 0;
  if (isClimax) {
    const beats = [164, 190, 216];
    for (const b of beats) {
      const d = frame - b;
      if (d >= -3 && d <= 18) {
        const env = d <= 0 ? (d + 3) / 3 : 1 - d / 18;
        if (env > climaxBreath) climaxBreath = env;
      }
    }
  }

  const sizes = suffixSizing(t.word, isClimax ? 1.12 : 1);
  const suffixColor = t.accent ?? "#FFFFFF";

  const HAS_ICON = !!t.icon;
  const HAS_STAT = !!t.stat;
  const HAS_QUOTE = !!t.pullQuote;
  const HAS_CAPTION = !!t.caption;

  let stackBelow = sizes.totalHeight / 2 + 14;
  const statY = stackBelow;
  if (HAS_STAT) stackBelow += 96;
  const quoteY = stackBelow;
  if (HAS_QUOTE) stackBelow += 56;
  const captionY = stackBelow;

  const stampFrame = tierAnimStart(LAST) + STAMP_OFFSET_FROM_ANIM;
  const chromaticDelta = frame - stampFrame;
  const chromaticOn = isClimax && chromaticDelta >= 0 && chromaticDelta < 3;
  const chromaticIntensity = chromaticOn ? 1 - chromaticDelta / 3 : 0;

  const suffixContent = (
    <>
      {t.word.map((line, idx) => (
        <div
          key={idx}
          style={{
            fontSize: sizes.perLine[idx],
            fontWeight: 800,
            whiteSpace: "nowrap",
          }}
        >
          {line}
        </div>
      ))}
    </>
  );

  const climaxGlow = isClimax
    ? `, 0 0 ${28 + climaxBreath * 80}px rgba(255,68,90,${0.55 + climaxBreath * 0.45}), 0 0 ${60 + climaxBreath * 120}px rgba(255,86,110,${0.35 + climaxBreath * 0.4})`
    : "";

  const suffixBase: React.CSSProperties = {
    position: "absolute",
    left: 0,
    right: 360,
    top: activeFrameY + suffixSlide,
    transform: `translateY(-50%) scale(${(suffixScale * (1 + climaxBreath * 0.02)).toFixed(3)})`,
    transformOrigin: "center center",
    opacity: suffixOpacity,
    textAlign: "center",
    fontFamily: font,
    color: suffixColor,
    letterSpacing: "-0.04em",
    lineHeight: 0.94,
    textShadow: t.accent
      ? `${HERO_SHADOW}, 0 0 48px ${t.accent}55${climaxGlow}`
      : HERO_SHADOW,
    pointerEvents: "none",
    willChange: "transform, top, opacity",
  };

  return (
    <>
      {HAS_ICON && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: activeFrameY,
            transform: `translateY(calc(-100% - ${sizes.totalHeight / 2 + 16}px))`,
            opacity: suffixOpacity,
            textAlign: "center",
            fontSize: 72,
            lineHeight: 1,
            textShadow: HERO_SHADOW,
            pointerEvents: "none",
          }}
        >
          {t.icon}
        </div>
      )}

      {chromaticIntensity > 0 && (
        <>
          <div
            style={{
              ...suffixBase,
              transform: `translate(${(3 * chromaticIntensity).toFixed(2)}px, calc(-50%)) scale(${suffixScale.toFixed(3)})`,
              color: "#FF2A2A",
              mixBlendMode: "screen",
              opacity: chromaticIntensity * 0.85,
              textShadow: "none",
            }}
          >
            {suffixContent}
          </div>
          <div
            style={{
              ...suffixBase,
              transform: `translate(${(-3 * chromaticIntensity).toFixed(2)}px, calc(-50%)) scale(${suffixScale.toFixed(3)})`,
              color: "#00E8FF",
              mixBlendMode: "screen",
              opacity: chromaticIntensity * 0.85,
              textShadow: "none",
            }}
          >
            {suffixContent}
          </div>
        </>
      )}
      <div style={suffixBase}>{suffixContent}</div>

      {HAS_STAT && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: activeFrameY,
            transform: `translateY(${statY}px)`,
            opacity: suffixOpacity,
            textAlign: "center",
            fontFamily: font,
            lineHeight: 1,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              fontSize: 68,
              fontWeight: 700,
              color: t.accent ?? "rgba(255,255,255,0.95)",
              letterSpacing: "-0.03em",
              textShadow: HERO_SHADOW,
              whiteSpace: "nowrap",
            }}
          >
            {t.stat}
          </div>
          {t.statUnit && (
            <div
              style={{
                marginTop: 6,
                fontSize: 22,
                fontWeight: 500,
                color: "rgba(255,255,255,0.6)",
                letterSpacing: "0.02em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                textShadow: HERO_SHADOW,
              }}
            >
              {t.statUnit}
            </div>
          )}
        </div>
      )}

      {HAS_QUOTE && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: activeFrameY,
            transform: `translateY(${quoteY}px)`,
            opacity: suffixOpacity,
            textAlign: "center",
            fontFamily: font,
            fontSize: 30,
            fontStyle: "italic",
            fontWeight: 400,
            color: "rgba(255,255,255,0.78)",
            letterSpacing: "-0.012em",
            lineHeight: 1.25,
            whiteSpace: "nowrap",
            textShadow: HERO_SHADOW,
            pointerEvents: "none",
          }}
        >
          &ldquo;{t.pullQuote}&rdquo;
        </div>
      )}

      {HAS_CAPTION && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: activeFrameY,
            transform: `translateY(${captionY}px)`,
            opacity: suffixOpacity,
            textAlign: "center",
            fontFamily: font,
            fontSize: 26,
            fontWeight: 500,
            color: "rgba(255,255,255,0.7)",
            letterSpacing: "-0.012em",
            lineHeight: 1.25,
            whiteSpace: "nowrap",
            textShadow: HERO_SHADOW,
            pointerEvents: "none",
          }}
        >
          {t.caption}
        </div>
      )}
    </>
  );
};

// ─── Past suffix ──────────────────────────────────────────────────────────────

const PastSuffix: React.FC<{
  tier: Tier;
  index: number;
  scrollY: number;
  opacity: number;
}> = ({ tier, index, scrollY, opacity }) => {
  const y = TIER_Y_FILL[index] + scrollY;
  if (y < -260 || y > H + 200) return null;
  if (opacity <= 0.02) return null;
  const sizes = suffixSizing(tier.word, 0.7);

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 360,
        top: y,
        transform: "translateY(-50%)",
        textAlign: "center",
        fontFamily: font,
        color: `rgba(255,255,255,${0.58 * opacity})`,
        letterSpacing: "-0.04em",
        lineHeight: 0.94,
        textShadow: HERO_SHADOW,
        pointerEvents: "none",
        opacity,
      }}
    >
      {tier.word.map((line, idx) => (
        <div
          key={idx}
          style={{
            fontSize: sizes.perLine[idx],
            fontWeight: 800,
            whiteSpace: "nowrap",
          }}
        >
          {line}
        </div>
      ))}
    </div>
  );
};

// ─── Source citation ──────────────────────────────────────────────────────────

const SourceCitation: React.FC<{ url: string; state: State }> = ({
  url,
  state,
}) => {
  const opacity =
    state.phase === "tier" && state.sub === "anim"
      ? interpolate(state.t, [0.35, 0.85], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: EASE_OUT,
        })
      : 1;
  return (
    <div
      style={{
        position: "absolute",
        left: 56,
        bottom: 48,
        maxWidth: 960,
        fontFamily: monoFont,
        fontSize: 22,
        lineHeight: 1.35,
        color: "rgba(255,255,255,0.78)",
        letterSpacing: "0.01em",
        wordBreak: "break-all",
        opacity,
        textShadow: "0 1px 2px rgba(0,0,0,0.85)",
        pointerEvents: "none",
        zIndex: 10,
      }}
    >
      <span style={{ color: "rgba(255,255,255,0.5)", marginRight: 8 }}>
        source —
      </span>
      {url}
    </div>
  );
};

// ─── Sizing helpers ───────────────────────────────────────────────────────────

const lineSize = (line: string, mult: number): number => {
  if (line.length <= 5) return Math.round(150 * mult);
  if (line.length <= 8) return Math.round(130 * mult);
  return Math.round(110 * mult);
};

const suffixSizing = (
  lines: string[],
  mult = 1,
): { perLine: number[]; totalHeight: number } => {
  const perLine = lines.map((l) => lineSize(l, mult));
  const totalHeight = perLine.reduce((sum, s) => sum + s * 0.94, 0);
  return { perLine, totalHeight };
};

void VIDEO_BEATS;

export const antiCheatIcebergMeta = {
  id: "AntiCheatIceberg",
  component: AntiCheatIceberg,
  durationInFrames: SCENE_FRAMES,
  fps: FPS,
  width: W,
  height: H,
};
