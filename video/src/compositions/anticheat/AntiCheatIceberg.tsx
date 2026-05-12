import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { font, monoFont } from "../../common/fonts";
import { FPS, H, W } from "./theme";
import { Specular } from "./fx/Specular";
import { VIDEO_BEATS } from "./beats";

// The "I lost because of …" iceberg.
//
// Iceberg fills the frame width edge to edge. Opens with a zoom-out from a
// close-up on the tip (scale 2.6 → 1.518) then scrolls down through six
// bands. The scroll clamps when the iceberg's bottom hits the frame's
// bottom — past that, the last two tiers descend toward the floor instead
// of pulling into a void.
//
// Tier 0 (strategy) sits in the sky band above the upper pink line; every
// other tier shifts up one slot.
//
// The descent has weather. Above tier 1 the air is warm and lit. At T1
// the camera crosses the waterline (a single sweep). From there a deep
// blue gradient and rising bubble particulate take over; the iceberg
// image cools per tier; the climax at "insider traders" lands with a
// specular flash, a chromatic split, and a solarised NYSE. The tier
// reveals are pinned to the music's beat grid — every stamp lands on a
// drum.

const IMG_NATIVE_W = 1265;
const IMG_NATIVE_H = 1670;

const FILL_SCALE = W / IMG_NATIVE_W;        // ~1.518
const FILL_H = IMG_NATIVE_H * FILL_SCALE;   // ~2535
const MAX_SCROLL = -(FILL_H - H);           // ~-1455 — image bottom on frame bottom

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

const rawScrollAtTier = (i: number) => PRIMARY_ACTIVE_Y - TIER_Y_FILL[i];
const scrollAtTier = (i: number) => Math.max(rawScrollAtTier(i), MAX_SCROLL);

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
  { imageSrc: "anticheat-imgs/trader-0.jpg", glyph: "📱", label: "you, on your phone" },
  { imageSrc: "anticheat-imgs/trader-1.jpg", glyph: "💻", label: "prosumer at the desk" },
  { imageSrc: "anticheat-imgs/trader-2.png", glyph: "🖥️", label: "prop firm" },
  { imageSrc: "anticheat-imgs/trader-3.jpg", glyph: "🏛️", label: "trading floor" },
  { imageSrc: "anticheat-imgs/trader-4.jpg", glyph: "🏦", label: "hedge fund" },
  { imageSrc: "anticheat-imgs/trader-5.jpg", glyph: "🏢", label: "investment bank" },
];

const EASE_OUT = Easing.bezier(0.25, 0.1, 0.3, 1);
const EASE_DEFAULT = Easing.bezier(0.4, 0, 0.6, 1);

// Beat-locked tier stamps. Iceberg's master-frame window is [111, 331].
// Local beats inside the window: 10, 36, 61, 87, 113, 139, 164, 190, 216.
// The first beat falls during the opening zoom-out — drop it. The next
// six become the six tier stamps. Stamp peaks at animStart + 9 (suffix
// scale apex), so each animStart = beat - 9.
const TIER_STAMP_LOCAL = [36, 61, 87, 113, 139, 164] as const;
const STAMP_OFFSET_FROM_ANIM = 9;
const TIER_ANIM = 11;
const ZOOM_OUT = TIER_STAMP_LOCAL[0] - STAMP_OFFSET_FROM_ANIM; // 27
const FINAL_HOLD = 40;
const OUTRO = 14;

const tierAnimStart = (i: number) =>
  TIER_STAMP_LOCAL[i] - STAMP_OFFSET_FROM_ANIM;

const tierHoldEnd = (i: number) =>
  i === LAST
    ? tierAnimStart(i) + TIER_ANIM + FINAL_HOLD
    : tierAnimStart(i + 1);

const SCENE_FRAMES =
  tierAnimStart(LAST) + TIER_ANIM + FINAL_HOLD + OUTRO; // 220

// The waterline crossing — single sweep at the moment the camera enters
// tier 1 (the tip). Six frames. After that the world is underwater.
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
    // Climax frame: extra linear push during T5 hold.
    const climaxPush = state.tier === LAST ? state.t * 0.06 : 0;
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

// Per-tier colour grade for the iceberg image. Cameron's Titanic move —
// warm at the surface, cold in the deep.
const computeIcebergFilter = (state: State): string => {
  const d =
    state.phase === "tier"
      ? (state.tier + (state.sub === "anim" ? state.t : 1)) / N
      : 0;
  const hue = interpolate(d, [0, 0.45, 1], [-10, 0, 15]);
  const sat = interpolate(d, [0, 0.5, 1], [1.1, 1.0, 1.18]);
  const bright = interpolate(d, [0, 0.5, 1], [1.1, 1.0, 0.72]);
  return `hue-rotate(${hue.toFixed(2)}deg) saturate(${sat.toFixed(3)}) brightness(${bright.toFixed(3)})`;
};

// Depth gauge readings per tier. The iceberg metaphor needs a yardstick.
const DEPTH_METERS = [-5, -15, -65, -160, -260, -340] as const;

const interpDepth = (state: State): number => {
  if (state.phase === "zoom") return DEPTH_METERS[0];
  if (state.sub === "hold") return DEPTH_METERS[state.tier];
  if (state.tier === 0) return DEPTH_METERS[0];
  const a = DEPTH_METERS[state.tier - 1];
  const b = DEPTH_METERS[state.tier];
  return a + (b - a) * EASE_OUT(state.t);
};

// Deterministic bubble field — rises at speed 0.6-1.6 px/frame, wraps
// around the bottom. Wobble adds slight horizontal sway. Only visible
// after the waterline crossing.
type Bubble = { x: number; baseY: number; size: number; speed: number; phase: number };

const seeded = (i: number, m = 233280) => {
  const s = (i * 9301 + 49297) % m;
  return s / m;
};

const BUBBLES: Bubble[] = Array.from({ length: 36 }, (_, i) => ({
  x: seeded(i) * W,
  baseY: seeded(i + 100) * H * 1.5,
  size: 4 + Math.round(seeded(i + 200) * 14),
  speed: 0.55 + seeded(i + 300) * 1.1,
  phase: seeded(i + 400) * Math.PI * 2,
}));

// Suspended particulate — slower, mid-depth plane, parallaxes at 0.6×.
const PARTICULATE: Bubble[] = Array.from({ length: 22 }, (_, i) => ({
  x: seeded(i + 500) * W,
  baseY: seeded(i + 600) * H * 1.5,
  size: 2 + Math.round(seeded(i + 700) * 4),
  speed: 0.2 + seeded(i + 800) * 0.3,
  phase: seeded(i + 900) * Math.PI * 2,
}));

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
    activeTier >= 0 ? TIER_Y_FILL[activeTier] + scrollY : PRIMARY_ACTIVE_Y;

  const prefixPulse =
    state.phase === "tier" && state.sub === "anim"
      ? Math.sin(state.t * Math.PI) * 0.04
      : 0;

  let prefixOpacity = 0;
  if (state.phase === "tier") {
    if (state.tier === 0 && state.sub === "anim") {
      prefixOpacity = interpolate(state.t, [0.25, 0.85], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: EASE_OUT,
      });
    } else {
      prefixOpacity = 1;
    }
  }

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
  const vignetteAlpha = 0.18 + 0.32 * descentProgress;

  // Underwater takes hold after the sweep.
  const underwaterT = interpolate(
    frame,
    [WATERLINE_START, WATERLINE_START + WATERLINE_DUR + WATERLINE_FADE],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_OUT },
  );

  // Deep gradient bg — drifts up slowly as we descend, cools with tier.
  const bgScroll = scrollY * 0.3;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#000000",
        fontFamily: font,
        opacity: sceneOpacity,
        overflow: "hidden",
      }}
    >
      {/* Far-back parallax gradient — surface light on top, abyss below.
          Slowly migrates with the camera. */}
      <AbsoluteFill
        style={{
          background: `
            radial-gradient(120% 80% at 50% ${-10 + descentProgress * 30}%,
              rgba(120, 168, 220, ${0.28 * (1 - underwaterT * 0.4)}) 0%,
              rgba(20, 38, 70, ${0.85 * underwaterT}) 35%,
              rgba(4, 10, 22, ${0.96 * underwaterT}) 100%
            )
          `,
          transform: `translateY(${bgScroll.toFixed(2)}px)`,
          pointerEvents: "none",
        }}
      />

      {/* Mid-depth particulate — slower than camera, debris suspended in
          the column. Renders only once the water has us. */}
      {underwaterT > 0.05 && (
        <Particles
          field={PARTICULATE}
          frame={frame}
          parallax={0.6 * scrollY}
          colour={`rgba(180, 210, 240, ${0.16 * underwaterT})`}
          blur={1.5}
        />
      )}

      {/* Iceberg — full-width, scrolling, top-centre origin. Per-tier
          colour grade. */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: scrollY,
          width: IMG_NATIVE_W,
          height: IMG_NATIVE_H,
          transform: `translate(-50%, 0) scale(${scale.toFixed(4)})`,
          transformOrigin: "top center",
          willChange: "transform, top",
          filter: icebergFilter,
        }}
      >
        <Img
          src={staticFile("iceberg-tiers.webp")}
          style={{ width: IMG_NATIVE_W, height: IMG_NATIVE_H, display: "block" }}
        />
      </div>

      {/* Specular sweep across the iceberg surface — climax marker on
          tier 5 only. Sits above the iceberg, below the type. */}
      {state.phase === "tier" && state.tier === LAST && (
        <Specular
          startFrame={tierAnimStart(LAST)}
          duration={24}
          angle={108}
          intensity={1.1}
          color="rgba(255, 86, 110, 0.85)"
          bandWidth={0.22}
          blendMode="screen"
        />
      )}

      {/* Atmospheric vignette that deepens as we descend. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 35%, rgba(0,0,0,${vignetteAlpha.toFixed(3)}) 100%)`,
          pointerEvents: "none",
        }}
      />

      {/* Past tier suffixes — settled on the iceberg, scroll with it. */}
      {TIERS.map((tier, i) =>
        state.phase === "tier" && i < state.tier ? (
          <PastSuffix key={i} tier={tier} index={i} scrollY={scrollY} />
        ) : null,
      )}

      {/* Active row — prefix + suffix + optional adornments. */}
      {activeTier >= 0 && (
        <ActiveRow
          state={state}
          tier={activeTier}
          activeFrameY={activeFrameY}
          prefixOpacity={prefixOpacity}
          prefixPulse={prefixPulse}
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

      {/* Foreground bubble column — rises through the frame after the
          waterline crossing. Parallaxes faster than the camera. */}
      {underwaterT > 0.05 && (
        <Particles
          field={BUBBLES}
          frame={frame}
          parallax={1.3 * scrollY}
          colour={`rgba(220, 235, 250, ${0.32 * underwaterT})`}
          ring
        />
      )}

      {/* The waterline crossing — one sweep, then a thin persistent line
          that scrolls with the surface position. */}
      <Waterline frame={frame} scrollY={scrollY} />

      {/* Depth gauge — bottom-left, mono. Ticks as we descend. */}
      <DepthGauge state={state} frame={frame} />

      {/* Source citation — bottom-left, only when the active tier has a
          source. Shifts up to make room for the depth gauge. */}
      {activeTier >= 0 && TIERS[activeTier].source && (
        <SourceCitation url={TIERS[activeTier].source!} state={state} />
      )}
    </AbsoluteFill>
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
        const wobble = Math.sin(frame / 26 + b.phase) * 6;
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
                : "none",
              filter: blur ? `blur(${blur}px)` : undefined,
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

  // Sweep window: a wide luminous bar that expands from centre to full
  // width over WATERLINE_DUR frames. After it, a thin persistent line
  // marks the surface and scrolls with the iceberg.
  const sweepLocal = frame - WATERLINE_START;
  const sweepT = Math.min(1, sweepLocal / WATERLINE_DUR);
  const sweepWidth = EASE_OUT(sweepT) * W;
  const sweepOpacity = sweepLocal < WATERLINE_DUR
    ? 1
    : Math.max(0, 1 - (sweepLocal - WATERLINE_DUR) / WATERLINE_FADE);

  // Persistent surface line. Anchored to T1's band top in iceberg-space,
  // moves with scrollY.
  const surfaceY = 269 * FILL_SCALE + scrollY;
  const lineOpacity = Math.max(0, Math.min(1, (sweepLocal - WATERLINE_DUR) / WATERLINE_FADE)) * 0.7;

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
const BAND_VERTICAL_PADDING = 0;

const TierImage: React.FC<{
  tier: TradingTier;
  index: number;
  scrollY: number;
  isActive: boolean;
  state: State;
  frame: number;
}> = ({ tier, index, scrollY, isActive, state, frame }) => {
  const band = BAND_BOUNDS[index];
  const top = band.top + scrollY + BAND_VERTICAL_PADDING;
  const height = band.height - BAND_VERTICAL_PADDING * 2;

  if (top + height < -120 || top > H + 120) return null;

  // NYSE (tier 5) solarises for 4 frames at the climax stamp.
  const solariseStart = tierAnimStart(LAST) + 5;
  const isSolarising =
    index === LAST &&
    frame >= solariseStart &&
    frame < solariseStart + 4;

  // Ken Burns push on the active photo during hold.
  const kenBurns =
    isActive && state.phase === "tier" && state.sub === "hold"
      ? 1 + state.t * 0.04
      : 1;

  const filter = isSolarising
    ? "invert(1) saturate(0.4) hue-rotate(180deg)"
    : isActive
      ? "saturate(1.08) brightness(1)"
      : "grayscale(1) brightness(0.55) blur(1px)";

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
          ? index === LAST
            ? "inset 0 0 0 3px rgba(255,86,110,0.95), inset 0 0 60px rgba(255,86,110,0.35)"
            : "inset 0 0 0 3px rgba(255,255,255,0.92), inset 0 0 38px rgba(255,255,255,0.2)"
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
            "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.88) 100%)",
          fontFamily: font,
          fontSize: 18,
          fontWeight: 600,
          color: isActive ? "#FFFFFF" : "rgba(255,255,255,0.62)",
          letterSpacing: "-0.012em",
          textAlign: "left",
          lineHeight: 1.2,
          textShadow: "0 1px 6px rgba(0,0,0,0.95)",
        }}
      >
        {tier.label}
      </div>
    </div>
  );
};

// ─── Active row ───────────────────────────────────────────────────────────────

const ActiveRow: React.FC<{
  state: State;
  tier: number;
  activeFrameY: number;
  prefixOpacity: number;
  prefixPulse: number;
  frame: number;
}> = ({ state, tier, activeFrameY, prefixOpacity, prefixPulse, frame }) => {
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
    suffixScale = interpolate(at, [0.55, 0.85, 1], [0.96, 1.05, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: EASE_DEFAULT,
    });
  }

  const sizes = suffixSizing(t.word);
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

  // Climax chromatic split — only on tier 5, two-frame window at stamp.
  const stampFrame = tierAnimStart(LAST) + STAMP_OFFSET_FROM_ANIM;
  const chromaticDelta = frame - stampFrame;
  const chromaticOn = tier === LAST && chromaticDelta >= 0 && chromaticDelta < 3;
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

  const suffixBase: React.CSSProperties = {
    position: "absolute",
    left: 0,
    right: 360,
    top: activeFrameY + suffixSlide,
    transform: `translateY(-50%) scale(${suffixScale.toFixed(3)})`,
    transformOrigin: "center center",
    opacity: suffixOpacity,
    textAlign: "center",
    fontFamily: font,
    color: suffixColor,
    letterSpacing: "-0.04em",
    lineHeight: 0.94,
    textShadow: t.accent
      ? `${HERO_SHADOW}, 0 0 48px ${t.accent}55`
      : HERO_SHADOW,
    pointerEvents: "none",
    willChange: "transform, top, opacity",
  };

  return (
    <>
      {/* Prefix above the icon (if any) or directly above the suffix. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 360,
          top: activeFrameY,
          transform: `translateY(calc(-100% - ${
            sizes.totalHeight / 2 + (HAS_ICON ? 84 : 12)
          }px)) scale(${(1 + prefixPulse).toFixed(3)})`,
          transformOrigin: "center bottom",
          opacity: prefixOpacity,
          textAlign: "center",
          fontFamily: font,
          fontSize: 38,
          fontWeight: 500,
          color: "rgba(255,255,255,0.82)",
          letterSpacing: "-0.018em",
          lineHeight: 1,
          whiteSpace: "nowrap",
          textShadow: HERO_SHADOW,
          pointerEvents: "none",
          willChange: "transform, top, opacity",
        }}
      >
        I lost because of
      </div>

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

      {/* Suffix — hero type. On tier 5 the stamp moment fires a chromatic
          split: two ghosted duplicates offset in red and cyan. */}
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
}> = ({ tier, index, scrollY }) => {
  const y = TIER_Y_FILL[index] + scrollY;
  if (y < -200 || y > H + 200) return null;
  const sizes = suffixSizing(tier.word, 0.72);

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
        color: "rgba(255,255,255,0.58)",
        letterSpacing: "-0.04em",
        lineHeight: 0.94,
        textShadow: HERO_SHADOW,
        pointerEvents: "none",
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

// ─── Depth gauge ──────────────────────────────────────────────────────────────

const DepthGauge: React.FC<{ state: State; frame: number }> = ({
  state,
  frame,
}) => {
  if (state.phase !== "tier") return null;
  const depth = interpDepth(state);
  const ticking =
    state.phase === "tier" && state.sub === "anim";
  // Sonar ping window — three frames after each tier stamp.
  const lastStamp = TIER_STAMP_LOCAL[state.tier] ?? 0;
  const pingDelta = frame - lastStamp;
  const pingT = pingDelta >= 0 && pingDelta < 14 ? pingDelta / 14 : -1;

  return (
    <div
      style={{
        position: "absolute",
        right: 384,
        bottom: 56,
        fontFamily: monoFont,
        color: "rgba(220,235,250,0.92)",
        textShadow: "0 1px 6px rgba(0,0,0,0.95), 0 0 18px rgba(120,180,240,0.35)",
        pointerEvents: "none",
        zIndex: 12,
      }}
    >
      <div
        style={{
          fontSize: 14,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "rgba(180,210,240,0.7)",
          marginBottom: 6,
        }}
      >
        depth
      </div>
      <div
        style={{
          fontSize: 56,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          lineHeight: 1,
          color: ticking ? "rgba(180,220,255,1)" : "rgba(220,235,250,0.95)",
        }}
      >
        {Math.round(depth)} m
      </div>
      {pingT >= 0 && (
        <div
          style={{
            marginTop: 8,
            height: 2,
            width: 180,
            background: `linear-gradient(90deg,
              rgba(180,220,255,${0.9 * (1 - pingT)}) 0%,
              rgba(180,220,255,${0.9 * (1 - pingT)}) ${pingT * 100}%,
              rgba(180,220,255,0.06) ${pingT * 100}%,
              rgba(180,220,255,0.06) 100%)`,
            boxShadow: `0 0 ${12 * (1 - pingT)}px rgba(180,220,255,${0.6 * (1 - pingT)})`,
          }}
        />
      )}
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

// Sanity check: keep imports honest.
void VIDEO_BEATS;

export const antiCheatIcebergMeta = {
  id: "AntiCheatIceberg",
  component: AntiCheatIceberg,
  durationInFrames: SCENE_FRAMES,
  fps: FPS,
  width: W,
  height: H,
};
