import React from "react";
import { AbsoluteFill } from "remotion";
import type {
  TransitionPresentation,
  TransitionPresentationComponentProps,
} from "@remotion/transitions";

// ─────────────────────────────────────────────────────────────────────────────
// Three custom presentations for the AntiCheat film. Each one drives a
// background-plane scale, a text-plane scale, and an opacity envelope. The
// background and text never share a curve and never share a rate — that
// asymmetry is what makes the cuts read as parallax instead of as a swap.
//
// CSS variables published on the wrapper:
//   --acx-bg-scale     — applied to the wrapper itself
//   --acx-text-scale   — published for descendants to consume:
//                        transform: scale(var(--acx-text-scale, 1))
//   --acx-veil-opacity — published for the silentDezoom presentation
//
// Scenes that want true text/bg parallax during the transition wrap their
// hero text in `<ParallaxText>` (defined below). Scenes that don't bother
// still inherit the wrapper's bg-scale and read fine.
// ─────────────────────────────────────────────────────────────────────────────

type EmptyProps = Record<string, never>;

const cubicIn = (t: number) => t * t * t;
const cubicOut = (t: number) => 1 - Math.pow(1 - t, 3);
const quartOut = (t: number) => 1 - Math.pow(1 - t, 4);
const inOutQuad = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

const wrapperStyle = (
  bgScale: number,
  textScale: number,
  opacity: number,
  veil = 0,
): React.CSSProperties => ({
  transform: `scale(${bgScale})`,
  transformOrigin: "50% 50%",
  opacity,
  // CSS custom props — descendants opt in by reading these.
  ["--acx-bg-scale" as string]: String(bgScale),
  ["--acx-text-scale" as string]: String(textScale / bgScale),
  ["--acx-veil-opacity" as string]: String(veil),
} as React.CSSProperties);

// ─── Push-through ──────────────────────────────────────────────────────────────
//
// Outgoing scene accelerates into the camera (cubic-in). Background nudges
// 1 → 1.12, text rushes 1 → 2.4 — the gap is the parallax. The exiting scene
// fades only in the final 18% of its window so the motion doesn't drown in
// alpha. Incoming scene meets the cut at bg=1.05, text=0.7, then both relax
// to 1.0 on cubic-out — but text recovers in the first 60% of its window
// while background takes the full 100%. The mismatch is the trick.

const PushThroughInner: React.FC<
  TransitionPresentationComponentProps<EmptyProps>
> = ({ children, presentationProgress, presentationDirection }) => {
  const t = presentationProgress;
  let bgScale: number;
  let textScale: number;
  let opacity: number;

  if (presentationDirection === "exiting") {
    const e = cubicIn(t);
    bgScale = 1 + 0.12 * e;
    textScale = 1 + 1.4 * e;
    opacity = t > 0.82 ? 1 - (t - 0.82) / 0.18 : 1;
  } else {
    const eFast = cubicOut(Math.min(1, t / 0.6));
    const eSlow = cubicOut(t);
    bgScale = 1.05 - 0.05 * eSlow;
    textScale = 0.7 + 0.3 * eFast;
    opacity = t < 0.18 ? t / 0.18 : 1;
  }

  return (
    <AbsoluteFill style={wrapperStyle(bgScale, textScale, opacity)}>
      {children}
    </AbsoluteFill>
  );
};

export const pushThrough = (): TransitionPresentation<EmptyProps> => ({
  component: PushThroughInner,
  props: {},
});

// ─── Pull-and-punch ────────────────────────────────────────────────────────────
//
// Outgoing scene retreats — bg 1 → 0.94 on ease-out, text 1 → 0.82 on a
// faster ease-out. The mismatch reads as the camera dolly-zooming out. One
// frame of rest at the cut. Incoming scene snaps: bg 1.06 → 1.0 on ease-out,
// text 1.35 → 1.0 on quart-out. Anticipation, then strike.

const PullPunchInner: React.FC<
  TransitionPresentationComponentProps<EmptyProps>
> = ({ children, presentationProgress, presentationDirection }) => {
  const t = presentationProgress;
  let bgScale: number;
  let textScale: number;
  let opacity: number;

  if (presentationDirection === "exiting") {
    const e = cubicOut(t);
    bgScale = 1 - 0.06 * e;
    textScale = 1 - 0.18 * cubicOut(Math.min(1, t / 0.7));
    opacity = t > 0.78 ? 1 - (t - 0.78) / 0.22 : 1;
  } else {
    const eBg = cubicOut(t);
    const eText = quartOut(t);
    bgScale = 1.06 - 0.06 * eBg;
    textScale = 1.35 - 0.35 * eText;
    opacity = t < 0.12 ? t / 0.12 : 1;
  }

  return (
    <AbsoluteFill style={wrapperStyle(bgScale, textScale, opacity)}>
      {children}
    </AbsoluteFill>
  );
};

export const pullPunch = (): TransitionPresentation<EmptyProps> => ({
  component: PullPunchInner,
  props: {},
});

// ─── Pull-only ─────────────────────────────────────────────────────────────────
//
// Reserved for the close. The outgoing scene retreats slowly, the incoming
// scene appears at rest. No punch — the EndCard doesn't earn one.

const PullOnlyInner: React.FC<
  TransitionPresentationComponentProps<EmptyProps>
> = ({ children, presentationProgress, presentationDirection }) => {
  const t = presentationProgress;
  let bgScale: number;
  let textScale: number;
  let opacity: number;

  if (presentationDirection === "exiting") {
    const e = inOutQuad(t);
    bgScale = 1 - 0.09 * e;
    textScale = 1 - 0.14 * e;
    opacity = 1 - 0.7 * e;
  } else {
    bgScale = 1;
    textScale = 1;
    opacity = inOutQuad(t);
  }

  return (
    <AbsoluteFill style={wrapperStyle(bgScale, textScale, opacity)}>
      {children}
    </AbsoluteFill>
  );
};

export const pullOnly = (): TransitionPresentation<EmptyProps> => ({
  component: PullOnlyInner,
  props: {},
});

// ─── Silent dezoom ─────────────────────────────────────────────────────────────
//
// The transition for the music-death cut. Background dezooms 1 → 0.88 on a
// long ease-in-out while a white veil rises 0 → 1. The incoming scene
// emerges through the same veil from bg=1.04, with no text-bg parallax —
// equality is the point. The silence and the symmetry are the transition.
//
// Veil color is parameterizable so the close can use the off-white field
// color (#F0F2F4) of the back half of the film instead of pure white.

type SilentDezoomProps = {
  veilColor: string;
};

const SilentDezoomInner: React.FC<
  TransitionPresentationComponentProps<SilentDezoomProps>
> = ({
  children,
  presentationProgress,
  presentationDirection,
  passedProps,
}) => {
  const t = presentationProgress;
  let bgScale: number;
  let veil: number;
  let opacity: number;

  if (presentationDirection === "exiting") {
    const e = inOutQuad(t);
    bgScale = 1 - 0.12 * e;
    veil = e;
    opacity = 1;
  } else {
    const e = inOutQuad(t);
    bgScale = 1.04 - 0.04 * e;
    veil = 1 - e;
    opacity = 1;
  }

  return (
    <AbsoluteFill style={wrapperStyle(bgScale, bgScale, opacity, veil)}>
      {children}
      <AbsoluteFill
        style={{
          backgroundColor: passedProps.veilColor,
          opacity: veil,
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};

export const silentDezoom = (
  props: SilentDezoomProps = { veilColor: "#F0F2F4" },
): TransitionPresentation<SilentDezoomProps> => ({
  component: SilentDezoomInner,
  props,
});

// ─── ParallaxText ──────────────────────────────────────────────────────────────
//
// Scenes wrap their hero text in this to inherit the text-plane scale from
// the active transition. Outside a transition the CSS variable defaults to
// 1 and nothing changes. `display: inline-block` is required so the
// transform has a box to apply to.

export const ParallaxText: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
  origin?: string;
}> = ({ children, style, origin = "50% 50%" }) => (
  <div
    style={{
      transform: "scale(var(--acx-text-scale, 1))",
      transformOrigin: origin,
      display: "inline-block",
      willChange: "transform",
      ...style,
    }}
  >
    {children}
  </div>
);
