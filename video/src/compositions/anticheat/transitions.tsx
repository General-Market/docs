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

// Snap-zoom in. fg whips through the cut: 1 → 1.28 then 0.78 → 1. Lighter
// magnitudes and less blur than before so the cut feels quick instead of
// laden. Bg breathes at a tenth of the magnitude — atmospheric, not
// coupled.
export const snapZoomIn = () =>
  zoomThroughBlur({
    fg: { exitFrom: 1.0, exitTo: 1.28, enterFrom: 0.78, enterTo: 1.0 },
    bg: { exitFrom: 1.0, exitTo: 1.04, enterFrom: 0.97, enterTo: 1.0 },
    maxBlur: 8,
    exitEase: cubicOut,
    enterEase: cubicOut,
    flash: 0.12,
    veil: 0,
    veilColor: "#FFFFFF",
    lightLeak: 0,
  });

// Snap-zoom intense. The verdict cut. Bigger fg jump than the standard,
// bg moves opposite — pulls back while fg lunges forward. The contrast
// reads as the camera and the room moving against each other. Lightened
// blur so the cut snaps instead of drags.
export const snapZoomIntense = () =>
  zoomThroughBlur({
    fg: { exitFrom: 1.0, exitTo: 1.42, enterFrom: 0.7, enterTo: 1.0 },
    bg: { exitFrom: 1.0, exitTo: 0.95, enterFrom: 1.05, enterTo: 1.0 },
    maxBlur: 11,
    exitEase: cubicOut,
    enterEase: cubicOut,
    flash: 0.18,
    veil: 0,
    veilColor: "#FFFFFF",
    lightLeak: 0,
  });

// Snap-zoom out. fg pulls away through the cut. Less veil and lighter
// leak than before — the cut still acts as the music-death pivot, but
// stops feeling like a curtain drop.
export const snapZoomOut = (veilColor = "#F0F2F4") =>
  zoomThroughBlur({
    fg: { exitFrom: 1.0, exitTo: 0.78, enterFrom: 1.3, enterTo: 1.0 },
    bg: { exitFrom: 1.0, exitTo: 0.96, enterFrom: 1.04, enterTo: 1.0 },
    maxBlur: 7,
    exitEase: inOutQuad,
    enterEase: inOutQuad,
    flash: 0,
    veil: 0.42,
    veilColor,
    lightLeak: 0.32,
  });

// Soft snap. Low-magnitude push, smooth, almost no flash. For cuts
// where continuity matters more than impact.
export const snapZoomSoft = () =>
  zoomThroughBlur({
    fg: { exitFrom: 1.0, exitTo: 1.14, enterFrom: 0.9, enterTo: 1.0 },
    bg: { exitFrom: 1.0, exitTo: 1.02, enterFrom: 0.99, enterTo: 1.0 },
    maxBlur: 4,
    exitEase: cubicOut,
    enterEase: cubicOut,
    flash: 0,
    veil: 0,
    veilColor: "#FFFFFF",
    lightLeak: 0,
  });

// Long pull. The close. fg retreats slightly, the new scene rises from
// just above rest. Bg barely moves — almost stationary. No flash,
// no leak, the lowest blur in the set.
export const pullLong = () =>
  zoomThroughBlur({
    fg: { exitFrom: 1.0, exitTo: 0.88, enterFrom: 1.12, enterTo: 1.0 },
    bg: { exitFrom: 1.0, exitTo: 0.98, enterFrom: 1.01, enterTo: 1.0 },
    maxBlur: 3,
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
