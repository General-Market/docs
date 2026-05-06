import React from "react";
import { AbsoluteFill } from "remotion";
import type {
  TransitionPresentation,
  TransitionPresentationComponentProps,
} from "@remotion/transitions";

// ─────────────────────────────────────────────────────────────────────────────
// Zoom-through-blur transitions for the AntiCheat film.
//
// Mental model: the exiting scene zooms (in or out) toward a peak scale,
// gaining gaussian blur as it accelerates. The cut happens at the blur
// peak — the swap is invisible inside the blur. The entering scene starts
// at the same peak scale, blurred, and dezooms back to rest as the blur
// clears.
//
// Acceleration is non-linear on both halves. The exit uses an ease-in
// curve (slow then fast) so the motion accelerates into the cut. The
// enter uses an ease-out curve (fast then slow) so the motion decelerates
// out of the cut. Asymmetric speed = momentum.
//
// All variations route through one primitive (`zoomThroughBlur`) and the
// presets below just configure it.
// ─────────────────────────────────────────────────────────────────────────────

type EaseFn = (t: number) => number;

const cubicIn: EaseFn = (t) => t * t * t;
const cubicOut: EaseFn = (t) => 1 - Math.pow(1 - t, 3);
const quartIn: EaseFn = (t) => t * t * t * t;
const quartOut: EaseFn = (t) => 1 - Math.pow(1 - t, 4);
const quintIn: EaseFn = (t) => t * t * t * t * t;
const quintOut: EaseFn = (t) => 1 - Math.pow(1 - t, 5);
const inOutQuad: EaseFn = (t) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

export const ease = {
  cubicIn,
  cubicOut,
  quartIn,
  quartOut,
  quintIn,
  quintOut,
  inOutQuad,
};

type ZoomBlurProps = {
  exitFrom: number;
  exitTo: number;
  enterFrom: number;
  enterTo: number;
  maxBlur: number;
  exitEase: EaseFn;
  enterEase: EaseFn;
  flash: number;
  veil: number;
  veilColor: string;
};

const ZoomThroughBlurInner: React.FC<
  TransitionPresentationComponentProps<ZoomBlurProps>
> = ({ children, presentationProgress, presentationDirection, passedProps }) => {
  const t = presentationProgress;
  const {
    exitFrom,
    exitTo,
    enterFrom,
    enterTo,
    maxBlur,
    exitEase,
    enterEase,
    flash,
    veil,
    veilColor,
  } = passedProps;

  const isExit = presentationDirection === "exiting";
  const e = isExit ? exitEase(t) : enterEase(t);

  const scale = isExit
    ? exitFrom + (exitTo - exitFrom) * e
    : enterFrom + (enterTo - enterFrom) * e;

  // Blur peaks at the cut moment (t=1 for exit, t=0 for enter) and falls
  // off toward the edges of the transition window. Quadratic in the
  // distance from the peak so the blur ramp matches the motion ramp.
  const peakDistance = isExit ? 1 - t : t;
  const blurT = 1 - peakDistance * peakDistance;
  const blur = maxBlur * blurT;

  // Opacity: hold full, then fade fast in the last/first 22% so the swap
  // happens inside the blur peak, not as a long crossfade.
  const opacity = isExit
    ? t > 0.78
      ? 1 - (t - 0.78) / 0.22
      : 1
    : t < 0.22
      ? t / 0.22
      : 1;

  const flashAmount =
    flash > 0
      ? isExit
        ? t > 0.7
          ? ((t - 0.7) / 0.3) * flash
          : 0
        : t < 0.3
          ? (1 - t / 0.3) * flash
          : 0
      : 0;

  const veilAmount =
    veil > 0
      ? isExit
        ? t > 0.5
          ? ((t - 0.5) / 0.5) * veil
          : 0
        : t < 0.5
          ? (1 - t / 0.5) * veil
          : 0
      : 0;

  return (
    <AbsoluteFill
      style={{
        transform: `scale(${scale})`,
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
    </AbsoluteFill>
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
// Each preset is a different shape of the same idea: zoom into the cut,
// blur peaks at the swap, dezoom out the other side. The choice between
// them is rhythm and weight, not mechanism.

// Heavy push — accelerating zoom-in, blurs hard. The default for high-
// energy cuts. Exit and enter geometry meet at 1.55x so the swap reads as
// continuous motion through a blur tunnel.
export const zoomPushHeavy = () =>
  zoomThroughBlur({
    exitFrom: 1,
    exitTo: 1.55,
    enterFrom: 1.55,
    enterTo: 1,
    maxBlur: 22,
    exitEase: quartIn,
    enterEase: quartOut,
    flash: 0.4,
    veil: 0,
    veilColor: "#FFFFFF",
  });

// Whip zoom — extreme acceleration into a 1.85x peak. Quint-in on the
// exit so the last few frames blur to nothing. Reserved for verdicts.
export const zoomWhip = () =>
  zoomThroughBlur({
    exitFrom: 1,
    exitTo: 1.85,
    enterFrom: 1.85,
    enterTo: 1,
    maxBlur: 30,
    exitEase: quintIn,
    enterEase: quartOut,
    flash: 0.6,
    veil: 0,
    veilColor: "#FFFFFF",
  });

// Pull through blur — exit dezooms slowly, blur rises, enter wakes up
// from 0.72x. The motion-equivalent of an exhale. Good for moments where
// the music dies or the tone resets.
export const zoomPullSlow = (veilColor = "#F0F2F4") =>
  zoomThroughBlur({
    exitFrom: 1,
    exitTo: 0.72,
    enterFrom: 0.72,
    enterTo: 1,
    maxBlur: 16,
    exitEase: inOutQuad,
    enterEase: inOutQuad,
    flash: 0,
    veil: 1,
    veilColor,
  });

// Soft push — gentle 1.25x peak, less blur, more breath. For cuts where
// continuity matters more than impact.
export const zoomPushSoft = () =>
  zoomThroughBlur({
    exitFrom: 1,
    exitTo: 1.28,
    enterFrom: 1.32,
    enterTo: 1,
    maxBlur: 12,
    exitEase: cubicIn,
    enterEase: cubicOut,
    flash: 0.2,
    veil: 0,
    veilColor: "#FFFFFF",
  });

// Long pull — slow retreat from the scene, soft blur, the entering scene
// rises out of the dezoom. The close. No flash, no punch.
export const zoomPullLong = () =>
  zoomThroughBlur({
    exitFrom: 1,
    exitTo: 0.82,
    enterFrom: 0.82,
    enterTo: 1,
    maxBlur: 10,
    exitEase: inOutQuad,
    enterEase: cubicOut,
    flash: 0,
    veil: 0,
    veilColor: "#FFFFFF",
  });

// ─── ParallaxText (kept as a no-op shim) ──────────────────────────────────────
//
// Earlier versions published a separate text-plane scale. The current
// presentations scale the whole scene as one block, so this wrapper
// resolves to identity. Kept exported so the scenes that imported it
// don't break — and so we have a hook ready if we want differential
// scaling back later.

export const ParallaxText: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
  origin?: string;
}> = ({ children, style }) => (
  <div style={{ display: "inline-block", ...style }}>{children}</div>
);
