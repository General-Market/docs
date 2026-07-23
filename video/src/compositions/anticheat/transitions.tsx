import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
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

// Directional travel layered on top of the zoom. Offsets are in viewport
// units (vw / vh) so the slide reads the same regardless of canvas size.
// Like the scale path, the slide is NON-REVERSING: the exiting scene
// travels out from rest toward (outX, outY); the entering scene arrives
// from (inX, inY) back to rest. The geometric jump between the two halves
// is hidden inside the blur peak at the centre of the cut, so the eye
// reads one continuous push instead of two stacked moves.
type LayerSlide = {
  outX: number;
  outY: number;
  inX: number;
  inY: number;
};

type ZoomBlurProps = {
  fg: LayerMotion;
  bg: LayerMotion;
  slide: LayerSlide;
  bgSlide: LayerSlide;
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

// Slide offset (in vw / vh) at eased progress e. Exit: rest → out.
// Enter: in → rest.
const slideAt = (
  s: LayerSlide,
  isExit: boolean,
  e: number,
): { x: number; y: number } =>
  isExit
    ? { x: s.outX * e, y: s.outY * e }
    : { x: s.inX * (1 - e), y: s.inY * (1 - e) };

const ZoomThroughBlurInner: React.FC<
  TransitionPresentationComponentProps<ZoomBlurProps>
> = ({ children, presentationProgress, presentationDirection, passedProps }) => {
  const t = presentationProgress;
  const {
    fg,
    bg,
    slide,
    bgSlide,
    maxBlur,
    exitEase,
    enterEase,
    flash,
    veil,
    veilColor,
    lightLeak,
  } = passedProps;
  const isExit = presentationDirection === "exiting";
  const e = isExit ? exitEase(t) : enterEase(t);

  const fgScale = motionAt(fg, isExit, e);
  const bgScale = motionAt(bg, isExit, e);

  const fgSlide = slideAt(slide, isExit, e);
  const bgSlideOffset = slideAt(bgSlide, isExit, e);

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
        transform: `translate(${fgSlide.x.toFixed(3)}vw, ${fgSlide.y.toFixed(3)}vh) scale(${fgScale.toFixed(4)})`,
        transformOrigin: "50% 50%",
        opacity,
        filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined,
        willChange: "transform, filter, opacity",
        ["--acx-fg-scale" as string]: fgScale.toFixed(4),
        ["--acx-bg-scale" as string]: bgScale.toFixed(4),
        // Net bg travel relative to the fg, in vw/vh. BgLayer subtracts
        // the parent fg slide and re-applies the bg slide so an
        // atmospheric layer can drift on its own vector.
        ["--acx-bg-dx" as string]: `${(bgSlideOffset.x - fgSlide.x).toFixed(3)}vw`,
        ["--acx-bg-dy" as string]: `${(bgSlideOffset.y - fgSlide.y).toFixed(3)}vh`,
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

// ─── Red light sweep ─────────────────────────────────────────────────────────
//
// Post-cut punctuation. The cut fires clean; this overlay rides on the
// ENTERING scene and travels left → right starting 0.5s after arrival.
// Renders nothing outside its window. Drop into any scene root:
//
//   <RedLightSweep onsetFrames={15} durationFrames={25} />
//
// At 30fps: onset 15 = 0.5s; duration 25 ≈ 0.83s.
export const RedLightSweep: React.FC<{
  onsetFrames?: number;
  durationFrames?: number;
  intensity?: number;
}> = ({ onsetFrames = 15, durationFrames = 25, intensity = 0.55 }) => {
  // useCurrentFrame is imported below at the call site; transitions.tsx
  // already has remotion in scope via the imports up top.
  const frame = useCurrentFrame();
  const local = frame - onsetFrames;
  if (local < 0 || local > durationFrames) return null;
  const t = local / durationFrames;
  const cx = -0.15 + t * 1.3;
  const dist = Math.abs(t - 0.5) * 2;
  const op = intensity * Math.max(0, 1 - Math.pow(dist, 1.4));
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        background: `radial-gradient(ellipse 48% 88% at ${(cx * 100).toFixed(2)}% 50%, rgba(255,38,38,${(0.78 * op).toFixed(3)}) 0%, rgba(232,30,30,${(0.42 * op).toFixed(3)}) 32%, rgba(180,20,20,${(0.18 * op).toFixed(3)}) 56%, rgba(200,20,20,0) 75%)`,
        mixBlendMode: "screen",
        filter: "blur(2px)",
        zIndex: 60,
      }}
    />
  );
};

// ─── BgLayer ──────────────────────────────────────────────────────────────────
//
// Wraps a background layer (e.g. DotGrid) so it rides the bg motion path
// instead of the fg path. Inverse-compensates the parent scale via CSS
// calc, then applies the bg scale on top. Outside a transition, both
// vars default to 1 and the wrapper resolves to identity.

export const bgLayerTransform =
  "translate(var(--acx-bg-dx, 0vw), var(--acx-bg-dy, 0vh)) scale(calc(var(--acx-bg-scale, 1) / var(--acx-fg-scale, 1)))";

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
// Each preset routes through the same primitive. The choice between them
// is now four-dimensional: zoom direction, slide vector, magnitude, ease,
// and how the bg behaves relative to the fg. The slide is the upgrade —
// every cut now carries the scene out on a vector and brings the next one
// in from the opposite side, so the eye reads a camera push, not a
// crossfade. The bg slides a fraction of the fg distance for parallax.
//
// All slide directions point along the same horizontal axis the film
// already travels (the carousel explodes rightward, the article wall
// flashes on the right, the wordmark sits centre). Keeping the axis
// consistent — left-to-right, right-to-left, alternating — is what makes
// six different cuts feel like one cohesive grammar instead of a circus.

type SlideDir = "left" | "right";

// Build a horizontal slide pair: the exiting scene leaves toward the
// chosen side, the entering scene arrives from the opposite side. `mag`
// is the fg travel in vw; the bg rides `bgFrac` of that for parallax.
const hSlide = (
  dir: SlideDir,
  mag: number,
  bgFrac: number,
): { slide: LayerSlide; bgSlide: LayerSlide } => {
  // "left" = scene exits to the left, new scene enters from the right.
  const exitSign = dir === "left" ? -1 : 1;
  const enterSign = -exitSign;
  const slide: LayerSlide = {
    outX: exitSign * mag,
    outY: 0,
    inX: enterSign * mag,
    inY: 0,
  };
  const bgSlide: LayerSlide = {
    outX: exitSign * mag * bgFrac,
    outY: 0,
    inX: enterSign * mag * bgFrac,
    inY: 0,
  };
  return { slide, bgSlide };
};

// Snap-zoom in. fg whips through the cut: 1 → 1.28 then 0.78 → 1. Lighter
// magnitudes and less blur than before so the cut feels quick instead of
// laden. Bg breathes at a tenth of the magnitude — atmospheric, not
// coupled. Now also carries a small leftward push.
export const snapZoomIn = (dir: SlideDir = "left") =>
  zoomThroughBlur({
    fg: { exitFrom: 1.0, exitTo: 1.28, enterFrom: 0.78, enterTo: 1.0 },
    bg: { exitFrom: 1.0, exitTo: 1.04, enterFrom: 0.97, enterTo: 1.0 },
    ...hSlide(dir, 7, 0.45),
    maxBlur: 8,
    exitEase: cubicOut,
    enterEase: cubicOut,
    flash: 0.12,
    veil: 0,
    veilColor: "#FFFFFF",
    lightLeak: 0,
  });

// Snap-zoom intense. The verdict cut (Rigged → Stat). Bigger fg jump than
// the standard, bg moves opposite — pulls back while fg lunges forward.
// The slide is the biggest in the set and the bg crosses against the fg
// (negative bgFrac), so the camera and the room shear past each other —
// the verdict slams in from the right as the rigged wall is thrown left.
export const snapZoomIntense = (dir: SlideDir = "left") =>
  zoomThroughBlur({
    fg: { exitFrom: 1.0, exitTo: 1.42, enterFrom: 0.7, enterTo: 1.0 },
    bg: { exitFrom: 1.0, exitTo: 0.95, enterFrom: 1.05, enterTo: 1.0 },
    ...hSlide(dir, 12, -0.22),
    maxBlur: 11,
    exitEase: cubicOut,
    enterEase: cubicOut,
    flash: 0.18,
    veil: 0,
    veilColor: "#FFFFFF",
    lightLeak: 0,
  });

// Snap-zoom out. The music-death pivot (Stat → Solution). fg pulls away
// through the cut. Slide is gentle and the bg leads the fg slightly
// (bgFrac > 1 would overshoot; 0.7 keeps it a soft parallax) — the world
// recedes and drifts as the music drops out. The veil + leak survive.
export const snapZoomOut = (veilColor = "#F0F2F4", dir: SlideDir = "right") =>
  zoomThroughBlur({
    fg: { exitFrom: 1.0, exitTo: 0.78, enterFrom: 1.3, enterTo: 1.0 },
    bg: { exitFrom: 1.0, exitTo: 0.96, enterFrom: 1.04, enterTo: 1.0 },
    ...hSlide(dir, 6, 0.6),
    maxBlur: 7,
    exitEase: inOutQuad,
    enterEase: inOutQuad,
    flash: 0,
    veil: 0.42,
    veilColor,
    lightLeak: 0.32,
  });

// Soft snap. Low-magnitude push, smooth, almost no flash. For cuts where
// continuity matters more than impact (used three times — Bars → Rigged,
// Solution → Reassure, Reassure → Switch). The direction alternates per
// call so consecutive soft cuts don't all push the same way; the small
// slide gives each a clear travel vector without shouting.
export const snapZoomSoft = (dir: SlideDir = "left") =>
  zoomThroughBlur({
    fg: { exitFrom: 1.0, exitTo: 1.14, enterFrom: 0.9, enterTo: 1.0 },
    bg: { exitFrom: 1.0, exitTo: 1.02, enterFrom: 0.99, enterTo: 1.0 },
    ...hSlide(dir, 5, 0.5),
    maxBlur: 4,
    exitEase: cubicOut,
    enterEase: cubicOut,
    flash: 0,
    veil: 0,
    veilColor: "#FFFFFF",
    lightLeak: 0,
  });

// Long pull. The close (Switch → EndCard). fg retreats slightly, the new
// scene rises from just below rest — a vertical lift instead of a
// horizontal push, so the final cut feels like settling, not travelling.
// Bg barely moves. No flash, no leak, the lowest blur in the set.
export const pullLong = () =>
  zoomThroughBlur({
    fg: { exitFrom: 1.0, exitTo: 0.88, enterFrom: 1.12, enterTo: 1.0 },
    bg: { exitFrom: 1.0, exitTo: 0.98, enterFrom: 1.01, enterTo: 1.0 },
    // Vertical settle: exit drifts up a touch, the EndCard rises from
    // just below. Small magnitudes — the music is dying, the motion
    // should breathe out, not lunge.
    slide: { outX: 0, outY: -3.5, inX: 0, inY: 4.5 },
    bgSlide: { outX: 0, outY: -1.4, inX: 0, inY: 1.8 },
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
