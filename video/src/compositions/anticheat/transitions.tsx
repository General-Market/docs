import React from "react";
import { AbsoluteFill } from "remotion";
import type {
  TransitionPresentation,
  TransitionPresentationComponentProps,
} from "@remotion/transitions";

// ─────────────────────────────────────────────────────────────────────────────
// Snap-zoom-through-blur transitions for the AntiCheat film.
//
// Earlier passes had a "stuck lag" at the centre because both halves of
// the camera path met at zero velocity (sin curve peaks). The eye reads
// that as "the motion paused for a beat" — exactly what we don't want.
//
// New model: NON-REVERSING motion. Both halves move in the same direction
// across the cut. The exit half zooms 1 → exitTo, the enter half zooms
// enterFrom → 1. The geometric jump from exitTo to enterFrom is hidden
// inside the blur peak. Velocity stays high through the swap — the cut
// feels continuous, not paused.
//
// Two layers move independently:
//   • fg (foreground) — the dominant motion, big magnitude
//   • bg (background) — its own motion, usually subtler, sometimes opposed
//
// The wrapper applies the fg transform to itself (so the whole scene
// scales). It publishes both fg and bg scales as CSS variables. Layers
// that want to ride the bg path (DotGrid, vignettes) consume the vars
// via CSS `calc()` to inverse-compensate the parent's fg scale.
// ─────────────────────────────────────────────────────────────────────────────

type EaseFn = (t: number) => number;

const linear: EaseFn = (t) => t;
const cubicIn: EaseFn = (t) => t * t * t;
const cubicOut: EaseFn = (t) => 1 - Math.pow(1 - t, 3);
const quartIn: EaseFn = (t) => t * t * t * t;
const quartOut: EaseFn = (t) => 1 - Math.pow(1 - t, 4);
const inOutCubic: EaseFn = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const inOutQuad: EaseFn = (t) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

export const ease = {
  linear,
  cubicIn,
  cubicOut,
  quartIn,
  quartOut,
  inOutCubic,
  inOutQuad,
};

type LayerMotion = {
  exitFrom: number;
  exitTo: number;
  enterFrom: number;
  enterTo: number;
};

type ZoomBlurProps = {
  fg: LayerMotion;
  bg: LayerMotion;
  maxBlur: number;
  exitEase: EaseFn;
  enterEase: EaseFn;
  flash: number;
  veil: number;
  veilColor: string;
  lightLeak: number;
};

const motionAt = (m: LayerMotion, isExit: boolean, e: number): number =>
  isExit
    ? m.exitFrom + (m.exitTo - m.exitFrom) * e
    : m.enterFrom + (m.enterTo - m.enterFrom) * e;

const ZoomThroughBlurInner: React.FC<
  TransitionPresentationComponentProps<ZoomBlurProps>
> = ({ children, presentationProgress, presentationDirection, passedProps }) => {
  const t = presentationProgress;
  const { fg, bg, maxBlur, exitEase, enterEase, flash, veil, veilColor, lightLeak } =
    passedProps;
  const isExit = presentationDirection === "exiting";
  const e = isExit ? exitEase(t) : enterEase(t);

  const fgScale = motionAt(fg, isExit, e);
  const bgScale = motionAt(bg, isExit, e);

  // ── Crossfade opacity ──────────────────────────────────────────────────
  // Tight band around the centre. Outside it, exactly one scene is shown.
  const fadeStart = 0.45;
  const fadeEnd = 0.55;
  let opacity: number;
  if (t < fadeStart) opacity = isExit ? 1 : 0;
  else if (t > fadeEnd) opacity = isExit ? 0 : 1;
  else {
    const k = (t - fadeStart) / (fadeEnd - fadeStart);
    opacity = isExit ? 1 - k : k;
  }

  // ── Blur ───────────────────────────────────────────────────────────────
  // Quadratic bell at the centre — peaks where the geometric jump happens.
  const dist = Math.abs(t - 0.5) * 2;
  const blur = maxBlur * Math.max(0, 1 - dist * dist);

  const flashAmount =
    flash > 0 ? flash * Math.max(0, 1 - Math.pow(dist, 1.4)) : 0;

  const veilAmount =
    veil > 0 ? veil * Math.max(0, 1 - Math.pow(dist, 1.2)) : 0;

  return (
    <AbsoluteFill
      style={{
        transform: `scale(${fgScale.toFixed(4)})`,
        transformOrigin: "50% 50%",
        opacity,
        filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined,
        willChange: "transform, filter, opacity",
        ["--acx-fg-scale" as string]: fgScale.toFixed(4),
        ["--acx-bg-scale" as string]: bgScale.toFixed(4),
      } as React.CSSProperties}
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

// ─── BgLayer ──────────────────────────────────────────────────────────────────
//
// Wraps a background layer (e.g. DotGrid) so it rides the bg motion path
// instead of the fg path. Inverse-compensates the parent scale via CSS
// calc, then applies the bg scale on top. Outside a transition, both
// vars default to 1 and the wrapper resolves to identity.

export const bgLayerTransform =
  "scale(calc(var(--acx-bg-scale, 1) / var(--acx-fg-scale, 1)))";

export const BgLayer: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ children, style }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      transform: bgLayerTransform,
      transformOrigin: "50% 50%",
      willChange: "transform",
      ...style,
    }}
  >
    {children}
  </div>
);

// ─── Variations ────────────────────────────────────────────────────────────────
//
// Each preset routes through the same primitive; the choice between them
// is direction (zoom in/out), magnitude, ease, and how the bg behaves
// relative to the fg.

// Snap-zoom in. fg whips through the cut: 1 → 1.45 then 0.65 → 1. The
// geometric jump 1.45 → 0.65 is hidden by the blur peak. Bg breathes at
// a tenth of the magnitude — atmospheric, not coupled.
export const snapZoomIn = () =>
  zoomThroughBlur({
    fg: { exitFrom: 1.0, exitTo: 1.45, enterFrom: 0.65, enterTo: 1.0 },
    bg: { exitFrom: 1.0, exitTo: 1.06, enterFrom: 0.95, enterTo: 1.0 },
    maxBlur: 14,
    exitEase: cubicOut,
    enterEase: cubicOut,
    flash: 0.15,
    veil: 0,
    veilColor: "#FFFFFF",
    lightLeak: 0,
  });

// Snap-zoom intense. The verdict cut. Bigger fg jump (1.65 → 0.55) and
// bg moves opposite — pulls back while fg lunges forward. The contrast
// reads as the camera and the room moving against each other.
export const snapZoomIntense = () =>
  zoomThroughBlur({
    fg: { exitFrom: 1.0, exitTo: 1.65, enterFrom: 0.55, enterTo: 1.0 },
    bg: { exitFrom: 1.0, exitTo: 0.92, enterFrom: 1.08, enterTo: 1.0 },
    maxBlur: 18,
    exitEase: quartOut,
    enterEase: quartOut,
    flash: 0.22,
    veil: 0,
    veilColor: "#FFFFFF",
    lightLeak: 0,
  });

// Snap-zoom out. fg pulls away through the cut: 1 → 0.7 then 1.5 → 1.
// Bg pulls back at a much smaller magnitude. Used at the music-death
// cut, with the amber light-leak crossing the swap.
export const snapZoomOut = (veilColor = "#F0F2F4") =>
  zoomThroughBlur({
    fg: { exitFrom: 1.0, exitTo: 0.72, enterFrom: 1.42, enterTo: 1.0 },
    bg: { exitFrom: 1.0, exitTo: 0.94, enterFrom: 1.05, enterTo: 1.0 },
    maxBlur: 12,
    exitEase: inOutQuad,
    enterEase: inOutQuad,
    flash: 0,
    veil: 0.7,
    veilColor,
    lightLeak: 0.55,
  });

// Soft snap. Lower-magnitude push, smooth, almost no flash. For cuts
// where continuity matters more than impact.
export const snapZoomSoft = () =>
  zoomThroughBlur({
    fg: { exitFrom: 1.0, exitTo: 1.22, enterFrom: 0.84, enterTo: 1.0 },
    bg: { exitFrom: 1.0, exitTo: 1.03, enterFrom: 0.98, enterTo: 1.0 },
    maxBlur: 8,
    exitEase: cubicOut,
    enterEase: cubicOut,
    flash: 0,
    veil: 0,
    veilColor: "#FFFFFF",
    lightLeak: 0,
  });

// Long pull. The close. fg retreats to 0.82, the new scene rises from
// 1.18 back to rest. Bg barely moves — almost stationary. No flash,
// no leak, the lowest blur in the set.
export const pullLong = () =>
  zoomThroughBlur({
    fg: { exitFrom: 1.0, exitTo: 0.82, enterFrom: 1.18, enterTo: 1.0 },
    bg: { exitFrom: 1.0, exitTo: 0.97, enterFrom: 1.02, enterTo: 1.0 },
    maxBlur: 6,
    exitEase: inOutCubic,
    enterEase: inOutCubic,
    flash: 0,
    veil: 0,
    veilColor: "#FFFFFF",
    lightLeak: 0,
  });

// ─── Legacy aliases ──────────────────────────────────────────────────────────
//
// Older AntiCheatFull versions imported these names. Mapped to the
// nearest snap-motion equivalent so the existing scene wiring keeps
// working without changes.
export const zoomPushHeavy = snapZoomIn;
export const zoomWhip = snapZoomIntense;
export const zoomPullSlow = snapZoomOut;
export const zoomPushSoft = snapZoomSoft;
export const zoomPullLong = pullLong;

// ─── ParallaxText (no-op shim) ────────────────────────────────────────────────

export const ParallaxText: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
  origin?: string;
}> = ({ children, style }) => (
  <div style={{ display: "inline-block", ...style }}>{children}</div>
);
