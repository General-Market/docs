import React from "react";
import { AbsoluteFill } from "remotion";
import type {
  TransitionPresentation,
  TransitionPresentationComponentProps,
} from "@remotion/transitions";

// ─────────────────────────────────────────────────────────────────────────────
// Launch-video transitions for the AntiCheat film. Wrapper drives:
//   • bg-plane scale     — applied to the wrapper itself
//   • text-plane scale   — published as `--acx-text-scale` for descendants
//   • motion blur        — CSS filter on the wrapper
//   • white flash        — overlaid plate at the cut moment
//   • veil               — used by silentDezoom only
//
// Magnitudes are loud on purpose. A subtle 12% scale reads as a render bug,
// not as a transition. Launch videos punch.
// ─────────────────────────────────────────────────────────────────────────────

type EmptyProps = Record<string, never>;

const cubicIn = (t: number) => t * t * t;
const cubicOut = (t: number) => 1 - Math.pow(1 - t, 3);
const quartOut = (t: number) => 1 - Math.pow(1 - t, 4);
const quintOut = (t: number) => 1 - Math.pow(1 - t, 5);
const inOutQuad = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const backOut = (t: number, s = 1.7) => {
  const c1 = s;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

type WrapperOpts = {
  bgScale: number;
  textScale: number;
  opacity: number;
  blur?: number;
  flash?: number;
  veil?: number;
  veilColor?: string;
  chroma?: number;
  children: React.ReactNode;
};

const TransitionWrapper: React.FC<WrapperOpts> = ({
  bgScale,
  textScale,
  opacity,
  blur = 0,
  flash = 0,
  veil = 0,
  veilColor = "#FFFFFF",
  chroma = 0,
  children,
}) => {
  const filterParts: string[] = [];
  if (blur > 0.05) filterParts.push(`blur(${blur.toFixed(2)}px)`);
  if (chroma > 0.05) {
    filterParts.push(
      `drop-shadow(${chroma.toFixed(1)}px 0 rgba(255,40,80,0.55))`,
    );
    filterParts.push(
      `drop-shadow(-${chroma.toFixed(1)}px 0 rgba(40,140,255,0.55))`,
    );
  }
  const filter = filterParts.length ? filterParts.join(" ") : undefined;

  return (
    <AbsoluteFill
      style={{
        transform: `scale(${bgScale})`,
        transformOrigin: "50% 50%",
        opacity,
        filter,
        willChange: "transform, filter, opacity",
        ["--acx-text-scale" as string]: String(textScale / bgScale),
      } as React.CSSProperties}
    >
      {children}
      {flash > 0.005 ? (
        <AbsoluteFill
          style={{
            backgroundColor: "#FFFFFF",
            opacity: flash,
            mixBlendMode: "screen",
            pointerEvents: "none",
          }}
        />
      ) : null}
      {veil > 0.005 ? (
        <AbsoluteFill
          style={{
            backgroundColor: veilColor,
            opacity: veil,
            pointerEvents: "none",
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};

// ─── Push-through ──────────────────────────────────────────────────────────────
//
// Outgoing scene rushes into the camera. Background scales 1 → 1.5 with a
// hard cubic-in curve. Text scales 1 → 4.0 — eight times the bg rate. Blur
// rises through the last third. Flash hits at the cut. Incoming scene
// arrives at bg=1.3, text=0.3 and resolves with a back-out overshoot on
// background and a spring on text. The asymmetry is the parallax.

const PushThroughInner: React.FC<
  TransitionPresentationComponentProps<EmptyProps>
> = ({ children, presentationProgress, presentationDirection }) => {
  const t = presentationProgress;

  if (presentationDirection === "exiting") {
    const e = cubicIn(t);
    const bgScale = 1 + 0.5 * e;
    const textScale = 1 + 3.0 * e;
    const blur = t > 0.55 ? ((t - 0.55) / 0.45) * 14 : 0;
    const opacity = t > 0.78 ? 1 - (t - 0.78) / 0.22 : 1;
    const flash = t > 0.85 ? ((t - 0.85) / 0.15) * 0.55 : 0;
    return (
      <TransitionWrapper
        bgScale={bgScale}
        textScale={textScale}
        opacity={opacity}
        blur={blur}
        flash={flash}
      >
        {children}
      </TransitionWrapper>
    );
  }

  const eBg = backOut(t, 1.4);
  const eText = quartOut(Math.min(1, t / 0.7));
  const bgScale = 1.3 - 0.3 * eBg;
  const textScale = 0.3 + 0.7 * eText;
  const blur = t < 0.32 ? (1 - t / 0.32) * 12 : 0;
  const opacity = t < 0.16 ? t / 0.16 : 1;
  const flash = t < 0.18 ? (1 - t / 0.18) * 0.45 : 0;

  return (
    <TransitionWrapper
      bgScale={bgScale}
      textScale={textScale}
      opacity={opacity}
      blur={blur}
      flash={flash}
    >
      {children}
    </TransitionWrapper>
  );
};

export const pushThrough = (): TransitionPresentation<EmptyProps> => ({
  component: PushThroughInner,
  props: {},
});

// ─── Pull-and-punch (dolly-zoom + slam) ────────────────────────────────────────
//
// The headline move. Outgoing scene dolly-zooms: background pulls back to
// 0.78, text pushes forward to 1.5 — the simultaneous opposite motion is
// the Hitchcock vertigo. Incoming scene slams in from bg=1.55 with a back-
// out overshoot and text from 0.4 with a heavy spring bounce. Chromatic
// aberration on the punch frame, white flash 0 → 0.7 → 0.

const PullPunchInner: React.FC<
  TransitionPresentationComponentProps<EmptyProps>
> = ({ children, presentationProgress, presentationDirection }) => {
  const t = presentationProgress;

  if (presentationDirection === "exiting") {
    const eBg = cubicOut(t);
    const eText = cubicOut(Math.min(1, t / 0.65));
    const bgScale = 1 - 0.22 * eBg;
    const textScale = 1 + 0.55 * eText;
    const blur = t > 0.5 ? ((t - 0.5) / 0.5) * 4 : 0;
    const opacity = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
    const flash = t > 0.88 ? ((t - 0.88) / 0.12) * 0.7 : 0;
    return (
      <TransitionWrapper
        bgScale={bgScale}
        textScale={textScale}
        opacity={opacity}
        blur={blur}
        flash={flash}
      >
        {children}
      </TransitionWrapper>
    );
  }

  const eBg = backOut(t, 1.8);
  const eText = backOut(Math.min(1, t / 0.75), 2.4);
  const bgScale = 1.55 - 0.55 * eBg;
  const textScale = 0.4 + 0.6 * eText;
  const blur = t < 0.28 ? (1 - t / 0.28) * 10 : 0;
  const chroma = t < 0.22 ? (1 - t / 0.22) * 5 : 0;
  const opacity = t < 0.1 ? t / 0.1 : 1;
  const flash = t < 0.18 ? (1 - t / 0.18) * 0.6 : 0;

  return (
    <TransitionWrapper
      bgScale={bgScale}
      textScale={textScale}
      opacity={opacity}
      blur={blur}
      chroma={chroma}
      flash={flash}
    >
      {children}
    </TransitionWrapper>
  );
};

export const pullPunch = (): TransitionPresentation<EmptyProps> => ({
  component: PullPunchInner,
  props: {},
});

// ─── Pull-only ─────────────────────────────────────────────────────────────────
//
// The close. Outgoing scene retreats and dims. Incoming scene fades in at
// rest. No punch — the EndCard doesn't earn one.

const PullOnlyInner: React.FC<
  TransitionPresentationComponentProps<EmptyProps>
> = ({ children, presentationProgress, presentationDirection }) => {
  const t = presentationProgress;

  if (presentationDirection === "exiting") {
    const e = inOutQuad(t);
    const bgScale = 1 - 0.2 * e;
    const textScale = 1 - 0.32 * e;
    const opacity = 1 - 0.85 * e;
    const blur = e * 5;
    return (
      <TransitionWrapper
        bgScale={bgScale}
        textScale={textScale}
        opacity={opacity}
        blur={blur}
      >
        {children}
      </TransitionWrapper>
    );
  }

  const e = quintOut(t);
  return (
    <TransitionWrapper bgScale={1} textScale={1} opacity={e}>
      {children}
    </TransitionWrapper>
  );
};

export const pullOnly = (): TransitionPresentation<EmptyProps> => ({
  component: PullOnlyInner,
  props: {},
});

// ─── Silent dezoom ─────────────────────────────────────────────────────────────
//
// The music-death cut. Outgoing scene dezooms 1 → 0.72 on a long ease-in-
// out while a veil rises. Incoming scene emerges from bg=1.12 through the
// same veil. Heavy blur during the swallow makes the silence audible.

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

  if (presentationDirection === "exiting") {
    const e = inOutQuad(t);
    const bgScale = 1 - 0.28 * e;
    const blur = e * 9;
    const veil = e;
    return (
      <TransitionWrapper
        bgScale={bgScale}
        textScale={bgScale}
        opacity={1}
        blur={blur}
        veil={veil}
        veilColor={passedProps.veilColor}
      >
        {children}
      </TransitionWrapper>
    );
  }

  const e = inOutQuad(t);
  const bgScale = 1.12 - 0.12 * e;
  const blur = (1 - e) * 7;
  const veil = 1 - e;
  return (
    <TransitionWrapper
      bgScale={bgScale}
      textScale={bgScale}
      opacity={1}
      blur={blur}
      veil={veil}
      veilColor={passedProps.veilColor}
    >
      {children}
    </TransitionWrapper>
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
// 1 and nothing changes.

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
