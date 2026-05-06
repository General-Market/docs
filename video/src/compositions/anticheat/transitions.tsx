import React from "react";
import { AbsoluteFill } from "remotion";
import type {
  TransitionPresentation,
  TransitionPresentationComponentProps,
} from "@remotion/transitions";

// ─────────────────────────────────────────────────────────────────────────────
// Calm zoom-through-blur transitions for the AntiCheat film.
//
// Earlier passes had two structural problems: both scenes rendered at full
// opacity for most of the window (visibly stacked), and the asymmetric
// ease curves meant the visible zoom motion happened in only ~20% of the
// window — the rest was just blur. This pass fixes both.
//
// New model:
//   • A single shared scale curve `scale(t) = 1 + (peak-1) * sin(t*π)`
//     drives both exit and enter scenes. They ride the same camera path,
//     so the geometry is continuous through the swap — no scale jump.
//   • Opacity is a narrow crossfade centred at t = 0.5, only ~12% wide.
//     Outside that band, exactly one scene is visible. No stacked layers.
//   • Blur peaks at t = 0.5 where the swap happens, falls off symmetrically.
//
// Calm magnitudes by default. Peaks live at 1.10 – 1.25 for pushes and
// 0.86 – 0.94 for pulls. The motion should feel like a breath, not a
// punch.
// ─────────────────────────────────────────────────────────────────────────────

type EaseFn = (t: number) => number;

const cubicIn: EaseFn = (t) => t * t * t;
const cubicOut: EaseFn = (t) => 1 - Math.pow(1 - t, 3);
const quartIn: EaseFn = (t) => t * t * t * t;
const quartOut: EaseFn = (t) => 1 - Math.pow(1 - t, 4);
const inOutCubic: EaseFn = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const inOutQuad: EaseFn = (t) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

export const ease = {
  cubicIn,
  cubicOut,
  quartIn,
  quartOut,
  inOutCubic,
  inOutQuad,
};

type ZoomBlurProps = {
  peak: number;
  maxBlur: number;
  shape: EaseFn;
  flash: number;
  veil: number;
  veilColor: string;
  lightLeak: number;
};

const ZoomThroughBlurInner: React.FC<
  TransitionPresentationComponentProps<ZoomBlurProps>
> = ({ children, presentationProgress, presentationDirection, passedProps }) => {
  const t = presentationProgress;
  const { peak, maxBlur, shape, flash, veil, veilColor, lightLeak } =
    passedProps;
  const isExit = presentationDirection === "exiting";

  // ── Shared camera scale ────────────────────────────────────────────────
  // Smooth bump from 1 → peak → 1 across the window. Both exit and enter
  // compute the same scale at the same t, so the geometry is continuous.
  // `bump` is a 0→1→0 envelope, `shape` smooths the curve.
  const bump = Math.sin(t * Math.PI);
  const shaped = shape(bump);
  const scale = 1 + (peak - 1) * shaped;

  // ── Crossfade opacity ──────────────────────────────────────────────────
  // Tight band around the centre. Outside it, exactly one scene is shown.
  const fadeStart = 0.44;
  const fadeEnd = 0.56;
  let opacity: number;
  if (t < fadeStart) opacity = isExit ? 1 : 0;
  else if (t > fadeEnd) opacity = isExit ? 0 : 1;
  else {
    const k = (t - fadeStart) / (fadeEnd - fadeStart);
    opacity = isExit ? 1 - k : k;
  }

  // ── Blur ───────────────────────────────────────────────────────────────
  // Quadratic bell centred at the swap. Distance from centre, normalised.
  const dist = Math.abs(t - 0.5) * 2;
  const blur = maxBlur * Math.max(0, 1 - dist * dist);

  // ── Flash ──────────────────────────────────────────────────────────────
  // Small symmetric envelope around the centre. Default 0 for calm cuts.
  const flashAmount =
    flash > 0 ? flash * Math.max(0, 1 - Math.pow(dist, 1.4)) : 0;

  // ── Veil ───────────────────────────────────────────────────────────────
  // Symmetric rise-and-fall around the centre. Used only by the slow pull.
  const veilAmount =
    veil > 0 ? veil * Math.max(0, 1 - Math.pow(dist, 1.2)) : 0;

  return (
    <AbsoluteFill
      style={{
        transform: `scale(${scale.toFixed(4)})`,
        transformOrigin: "50% 50%",
        opacity,
        filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined,
        willChange: "transform, filter, opacity",
      }}
    >
      {children}
      {flashAmount > 0.005 ? (
        <AbsoluteFill
          style={{
            backgroundColor: "#FFFFFF",
            opacity: flashAmount,
            mixBlendMode: "screen",
            pointerEvents: "none",
          }}
        />
      ) : null}
      {veilAmount > 0.005 ? (
        <AbsoluteFill
          style={{
            backgroundColor: veilColor,
            opacity: veilAmount,
            pointerEvents: "none",
          }}
        />
      ) : null}
      {lightLeak > 0 ? (
        <LightLeakBand t={t} intensity={lightLeak} />
      ) : null}
    </AbsoluteFill>
  );
};

// ─── Light leak ──────────────────────────────────────────────────────────────
//
// Warm amber band sweeping right → left across the cut. Position is
// continuous across exit and enter halves (we use the shared t directly).
// Opacity bell-curves around the cut.

const LightLeakBand: React.FC<{
  t: number;
  intensity: number;
}> = ({ t, intensity }) => {
  const cx = 1.25 - t * 1.5;
  const dist = Math.abs(t - 0.5) * 2;
  const op = intensity * Math.max(0, 1 - Math.pow(dist, 1.6));

  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        background: `radial-gradient(ellipse 55% 90% at ${(cx * 100).toFixed(2)}% 50%, rgba(255,176,76,${(0.45 * op).toFixed(3)}) 0%, rgba(255,200,120,${(0.24 * op).toFixed(3)}) 35%, rgba(255,210,140,0) 70%)`,
        mixBlendMode: "screen",
      }}
    />
  );
};

const zoomThroughBlur = (
  props: ZoomBlurProps,
): TransitionPresentation<ZoomBlurProps> => ({
  component: ZoomThroughBlurInner,
  props,
});

// ─── Variations ────────────────────────────────────────────────────────────────
//
// All presets share the same primitive — only the peak, the curve shape,
// the blur, and the optional veil/leak/flash differ. Calm by default.

// Heavy push — moderate 1.22x peak, smooth in-out cubic.
export const zoomPushHeavy = () =>
  zoomThroughBlur({
    peak: 1.22,
    maxBlur: 12,
    shape: inOutCubic,
    flash: 0.12,
    veil: 0,
    veilColor: "#FFFFFF",
    lightLeak: 0,
  });

// Whip zoom — formerly extreme. Now a slightly sharper push at 1.30x.
// Quart-shaped envelope for a touch more weight than the heavy push, but
// nothing close to a punch.
export const zoomWhip = () =>
  zoomThroughBlur({
    peak: 1.3,
    maxBlur: 14,
    shape: quartOut,
    flash: 0.16,
    veil: 0,
    veilColor: "#FFFFFF",
    lightLeak: 0,
  });

// Pull slow — exit dezooms gently to 0.88x, the music dies inside the
// veil, the entering scene wakes from the same scale and breathes back to
// 1.0. Light-leak crosses the cut as projector breath.
export const zoomPullSlow = (veilColor = "#F0F2F4") =>
  zoomThroughBlur({
    peak: 0.88,
    maxBlur: 10,
    shape: inOutQuad,
    flash: 0,
    veil: 0.85,
    veilColor,
    lightLeak: 0.55,
  });

// Soft push — barely-there 1.10x peak, low blur, no flash.
export const zoomPushSoft = () =>
  zoomThroughBlur({
    peak: 1.1,
    maxBlur: 7,
    shape: inOutCubic,
    flash: 0,
    veil: 0,
    veilColor: "#FFFFFF",
    lightLeak: 0,
  });

// Long pull — slow retreat to 0.93x, the entering scene rises from rest.
// The close. No flash, no leak, the lowest blur in the set.
export const zoomPullLong = () =>
  zoomThroughBlur({
    peak: 0.93,
    maxBlur: 6,
    shape: inOutQuad,
    flash: 0,
    veil: 0,
    veilColor: "#FFFFFF",
    lightLeak: 0,
  });

// ─── ParallaxText (kept as a no-op shim) ──────────────────────────────────────
//
// Earlier versions published a separate text-plane scale. The current
// presentations scale the whole scene as one block, so this wrapper
// resolves to identity. Kept exported so the scenes that imported it
// don't break — and so we have a hook ready if differential scaling
// returns later.

export const ParallaxText: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
  origin?: string;
}> = ({ children, style }) => (
  <div style={{ display: "inline-block", ...style }}>{children}</div>
);
