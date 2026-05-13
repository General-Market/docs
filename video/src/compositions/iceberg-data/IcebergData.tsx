import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { font } from "../../common/fonts";

// IcebergData — a stripped fork of AntiCheatIceberg. Same iceberg, same
// rhythm. Image bands replaced with text rectangles that ride the iceberg
// as it scrolls. Headlines, no images inside the boxes.

const W = 1920;
const H = 1080;
const FPS = 30;

// ── Iceberg image (AntiCheatFull asset) ────────────────────────────────────
const IMG_NATIVE_W = 1265;
const IMG_NATIVE_H = 1670;
const FILL_SCALE = W / IMG_NATIVE_W; // 1.518

// Tier zones (image-space native). Same boundaries as AntiCheatIceberg.
const BAND_BOUNDS_NATIVE: ReadonlyArray<{ top: number; bottom: number }> = [
  { top: 0, bottom: 269 },
  { top: 269, bottom: 539 },
  { top: 539, bottom: 857 },
  { top: 857, bottom: 1141 },
  { top: 1141, bottom: 1430 },
  { top: 1430, bottom: 1670 },
];
const BAND_BOUNDS = BAND_BOUNDS_NATIVE.map((b) => ({
  top: b.top * FILL_SCALE,
  bottom: b.bottom * FILL_SCALE,
  height: (b.bottom - b.top) * FILL_SCALE,
  centre: ((b.top + b.bottom) / 2) * FILL_SCALE,
}));

const TIER_Y_FILL = BAND_BOUNDS.map((b) => b.centre);
const PRIMARY_ACTIVE_Y = TIER_Y_FILL[0];
const FRAME_CENTRE_Y = H / 2;

// Tier 0 sits up-high — there's nothing above the asset's top edge to fill
// the space, so the first tier camera target is the band, not screen-centre.
const screenTargetY = (i: number) =>
  i === 0 ? PRIMARY_ACTIVE_Y : FRAME_CENTRE_Y;
const scrollAtTier = (i: number) => screenTargetY(i) - TIER_Y_FILL[i];

// ── Beat rhythm (same as AntiCheatIceberg) ─────────────────────────────────
const TIERS_COUNT = 6;
const LAST = TIERS_COUNT - 1;
const TIER_STAMP_LOCAL = [36, 61, 87, 113, 139, 164] as const;
const STAMP_OFFSET = 5;
const TIER_ANIM = 6;
const FINAL_HOLD = 41;
const OUTRO = 14;
const ZOOM_START_SCALE = 2.6;
const ZOOM_OUT = TIER_STAMP_LOCAL[0] - STAMP_OFFSET; // 31

const tierAnimStart = (i: number) => TIER_STAMP_LOCAL[i] - STAMP_OFFSET;
const tierHoldEnd = (i: number) =>
  i === LAST
    ? tierAnimStart(i) + TIER_ANIM + FINAL_HOLD
    : tierAnimStart(i + 1);

const SCENE_FRAMES = tierAnimStart(LAST) + TIER_ANIM + FINAL_HOLD + OUTRO; // 220

const EASE_OUT = Easing.bezier(0.25, 0.1, 0.3, 1);
const EASE = (t: number) => EASE_OUT(t);

type State =
  | { phase: "zoom"; t: number }
  | { phase: "tier"; tier: number; sub: "anim" | "hold"; t: number };

const stateAt = (frame: number): State => {
  if (frame < ZOOM_OUT) return { phase: "zoom", t: frame / ZOOM_OUT };
  for (let i = 0; i < TIERS_COUNT; i++) {
    const animStart = tierAnimStart(i);
    const holdStart = animStart + TIER_ANIM;
    const holdEnd = tierHoldEnd(i);
    if (frame < holdStart) {
      return {
        phase: "tier",
        tier: i,
        sub: "anim",
        t: (frame - animStart) / TIER_ANIM,
      };
    }
    if (frame < holdEnd) {
      const len = Math.max(1, holdEnd - holdStart);
      return {
        phase: "tier",
        tier: i,
        sub: "hold",
        t: (frame - holdStart) / len,
      };
    }
  }
  return { phase: "tier", tier: LAST, sub: "hold", t: 1 };
};

const computeScale = (state: State): number => {
  if (state.phase === "zoom") {
    return interpolate(state.t, [0, 1], [ZOOM_START_SCALE, FILL_SCALE], {
      easing: EASE,
    });
  }
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
  return a + (b - a) * EASE(state.t);
};

// Per-tier colour grade — same descent feel.
const computeIcebergFilter = (state: State): string => {
  const d =
    state.phase === "tier"
      ? (state.tier + (state.sub === "anim" ? state.t : 1)) / TIERS_COUNT
      : 0;
  const sat = interpolate(d, [0, 0.5, 1], [1.05, 0.95, 1.15]);
  const bright = interpolate(d, [0, 0.5, 1], [1.08, 0.92, 0.62]);
  const contrast = interpolate(d, [0, 1], [1.0, 1.18]);
  return `saturate(${sat.toFixed(3)}) brightness(${bright.toFixed(3)}) contrast(${contrast.toFixed(3)})`;
};

// ── Tier labels — your words. ──────────────────────────────────────────────
const TIERS: ReadonlyArray<{ label: string; emphasis?: boolean }> = [
  { label: "Strategies" },
  { label: "Fees" },
  { label: "Liquidation hunters" },
  { label: "Front runners" },
  { label: "Orderbook spoofers" },
  { label: "Insider traders", emphasis: true },
];

// ── Per-tier text rectangle. Pinned to image-space top via scrollY.
// Horizontal position + size are screen-fixed.
const TIER_RECT_WIDTH = 460;
const TIER_RECT_HEIGHT = 120;
const TIER_RECT_RIGHT_INSET = 80;

const TierRect: React.FC<{
  index: number;
  state: State;
  scrollY: number;
  scale: number;
  frame: number;
  fps: number;
}> = ({ index, state, scrollY, scale, frame, fps }) => {
  const band = BAND_BOUNDS[index];
  const tier = TIERS[index];

  // Track image-space Y (band centre), translated by scrollY. Scale stretches
  // the iceberg slightly during hold pulses — apply the same scale to the
  // rectangle's vertical anchor so it stays glued.
  const bandCentreScaled =
    band.centre * (scale / FILL_SCALE);
  const centreY = bandCentreScaled + scrollY;
  const top = centreY - TIER_RECT_HEIGHT / 2;

  // Cull if off-screen — keeps render cost low when the camera is far away.
  if (top + TIER_RECT_HEIGHT < -40 || top > H + 40) return null;

  const isActiveTier =
    state.phase === "tier" &&
    (state.tier === index || (state.tier > index && state.sub === "hold"));
  const hasLanded =
    state.phase === "tier" &&
    (state.tier > index ||
      (state.tier === index && (state.sub === "hold" || state.t >= 0.4)));

  // Enter spring — driven by the tier's beat.
  const animStart = tierAnimStart(index);
  const enter = spring({
    frame: frame - animStart,
    fps,
    config: { damping: 18, stiffness: 160, mass: 0.85 },
  });

  // Active vs dim — dim everything that hasn't landed yet.
  const intensity = hasLanded ? 1 : 0.32;

  const isRed = !!tier.emphasis && hasLanded;
  const borderColor = isRed ? "rgba(255,86,110,0.95)" : "rgba(255,255,255,0.92)";
  const glowColor = isRed ? "rgba(255,86,110,0.55)" : "rgba(255,255,255,0.22)";
  const textColor = isRed ? "#FF566E" : "#FFFFFF";

  // Active tier breathes; climax tier pulses harder.
  const breath = isActiveTier ? 1 + Math.sin(frame * 0.22) * 0.012 : 1;
  const climaxBoost =
    isRed && state.phase === "tier" && state.tier === LAST && state.sub === "hold"
      ? 1 + Math.sin(frame * 0.4) * 0.018
      : 1;

  return (
    <div
      style={{
        position: "absolute",
        right: TIER_RECT_RIGHT_INSET,
        top,
        width: TIER_RECT_WIDTH,
        height: TIER_RECT_HEIGHT,
        borderRadius: 18,
        background: "rgba(4,8,14,0.88)",
        boxShadow: `inset 0 0 0 3px ${borderColor}, inset 0 0 80px ${glowColor}, 0 24px 56px rgba(0,0,0,0.55)`,
        opacity: enter * intensity,
        transform: `translateY(${(1 - enter) * 22}px) scale(${(breath * climaxBoost).toFixed(4)})`,
        fontFamily: font,
        display: "flex",
        alignItems: "center",
        padding: "0 30px",
        willChange: "transform, opacity",
      }}
    >
      <span
        style={{
          fontSize: 17,
          fontWeight: 600,
          color: isRed ? "rgba(255,86,110,0.7)" : "rgba(255,255,255,0.55)",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          marginRight: 18,
          fontFeatureSettings: '"tnum" 1',
        }}
      >
        {String(index + 1).padStart(2, "0")}
      </span>
      <span
        style={{
          fontSize: tier.label.length > 16 ? 30 : 36,
          fontWeight: 800,
          letterSpacing: "-0.018em",
          color: textColor,
          textShadow: "0 1px 8px rgba(0,0,0,0.95)",
          lineHeight: 1.05,
        }}
      >
        {tier.label}
      </span>
    </div>
  );
};

// ── Headline strip — screen-fixed at the top. Swaps mid-scene. ─────────────
const Headline: React.FC<{
  state: State;
  frame: number;
  fps: number;
}> = ({ state, frame, fps }) => {
  const showFirst =
    state.phase === "zoom" ||
    (state.phase === "tier" && state.tier <= 1);
  const swapTier = 2; // when tier 2 lands, swap to second headline
  const swapFrame = tierAnimStart(swapTier);

  const firstOpacity = interpolate(
    frame,
    [swapFrame - 6, swapFrame],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const secondOpacity = interpolate(
    frame,
    [swapFrame, swapFrame + 12],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 64,
          textAlign: "center",
          fontFamily: font,
          opacity: firstOpacity,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            display: "inline-block",
            padding: "12px 28px",
            borderRadius: 999,
            background: "rgba(4,12,20,0.78)",
            color: "#FFFFFF",
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.18)",
          }}
        >
          Why traders think they lost
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 64,
          textAlign: "center",
          fontFamily: font,
          opacity: secondOpacity,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            display: "inline-block",
            padding: "12px 28px",
            borderRadius: 999,
            background: "rgba(4,12,20,0.78)",
            color: "#FF566E",
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            boxShadow: "inset 0 0 0 1px rgba(255,86,110,0.35)",
          }}
        >
          Why traders really lost
        </div>
      </div>
    </>
  );
};

// ── Outer composition ─────────────────────────────────────────────────────
export const IcebergData: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const state = stateAt(frame);
  const scale = computeScale(state);
  const scrollY = computeScrollY(state);
  const icebergFilter = computeIcebergFilter(state);

  const introOpacity = interpolate(frame, [0, ZOOM_OUT * 0.3], [0, 1], {
    easing: EASE,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const outroOpacity = interpolate(
    frame,
    [SCENE_FRAMES - OUTRO, SCENE_FRAMES],
    [1, 0],
    { easing: EASE, extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const sceneOpacity = Math.min(introOpacity, outroOpacity);

  const descentProgress = state.phase === "tier" ? state.tier / LAST : 0;
  const vignetteAlpha = 0.22 + 0.4 * descentProgress;

  const imgDisplayedW = IMG_NATIVE_W * scale;
  const imgDisplayedH = IMG_NATIVE_H * scale;
  const imgLeft = (W - imgDisplayedW) / 2;
  const imgTop = scrollY;

  return (
    <AbsoluteFill style={{ background: "#02070F", opacity: sceneOpacity }}>
      {/* Background gradient — surface to abyss */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, #08182C 0%, #06121F 40%, #030814 100%)",
        }}
      />

      {/* Iceberg image — scrolls vertically with scrollY */}
      <div
        style={{
          position: "absolute",
          left: imgLeft,
          top: imgTop,
          width: imgDisplayedW,
          height: imgDisplayedH,
          filter: icebergFilter,
          willChange: "top, filter",
        }}
      >
        <Img
          src={staticFile("iceberg-tiers-clean.webp")}
          style={{
            width: "100%",
            height: "100%",
            display: "block",
          }}
        />
      </div>

      {/* Vignette deepens as we descend */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 38%, rgba(0,0,0,${vignetteAlpha.toFixed(3)}) 100%)`,
          pointerEvents: "none",
        }}
      />

      {/* 6 tier rectangles — pinned to image bands, screen-fixed horizontally */}
      {TIERS.map((_, i) => (
        <TierRect
          key={i}
          index={i}
          state={state}
          scrollY={scrollY}
          scale={scale}
          frame={frame}
          fps={fps}
        />
      ))}

      {/* Headline — swaps when we cross the waterline (tier 2 lands) */}
      <Headline state={state} frame={frame} fps={fps} />
    </AbsoluteFill>
  );
};

export const icebergDataMeta = {
  id: "IcebergData",
  component: IcebergData,
  durationInFrames: SCENE_FRAMES,
  fps: FPS,
  width: W,
  height: H,
};
