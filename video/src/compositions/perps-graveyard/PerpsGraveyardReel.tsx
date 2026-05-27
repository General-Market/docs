import React from "react";
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";
import {
  BG_GRADIENT,
  C,
  EASE,
  font,
  FPS,
  H,
  monoFont,
  PANEL_L,
  SCHEDULE,
  TOTAL_FRAMES,
  W,
} from "./theme";
import { PROTOCOLS, TOTAL_RAISED_LABEL } from "./data";
import { Rail } from "./Rail";
import { Slide } from "./Slide";
import { BrandMark } from "../../components/BrandMark";

const Stage: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill style={{ background: BG_GRADIENT, fontFamily: font }}>
    {children}
    <AbsoluteFill
      style={{
        background:
          "repeating-linear-gradient(0deg, rgba(10,12,20,0.028) 0px, rgba(10,12,20,0.028) 1px, transparent 1px, transparent 3px)",
        mixBlendMode: "multiply",
        opacity: 0.5,
        pointerEvents: "none",
      }}
    />
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(120% 120% at 42% 42%, rgba(10,12,20,0) 58%, rgba(10,12,20,0.10) 100%)",
        pointerEvents: "none",
      }}
    />
  </AbsoluteFill>
);

// Focus-pull: blur(px → 0) over `dur` frames, no opacity, no Y. (style-table §11)
const focusPull = (frame: number, delay: number, fromBlur = 10, dur = 14) => {
  const b = interpolate(frame - delay, [0, dur], [fromBlur, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });
  return `blur(${b.toFixed(2)}px)`;
};

// Wipe-on: scaleX(0 → 1) from the left, no opacity. (style-table §11)
const wipeOn = (frame: number, delay: number, dur = 14) =>
  interpolate(frame - delay, [0, dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });

const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "absolute", left: PANEL_L, top: 380, maxWidth: 1180 }}>
      <div
        style={{
          fontFamily: monoFont,
          fontSize: 24,
          fontWeight: 700,
          letterSpacing: "0.2em",
          color: C.faint,
          transform: `scaleX(${wipeOn(frame, 0).toFixed(3)})`,
          transformOrigin: "left center",
        }}
      >
        THE&nbsp;PERPS&nbsp;GRAVEYARD
      </div>
      <div style={{ fontFamily: font, fontSize: 116, fontWeight: 800, letterSpacing: "-0.04em", color: C.text, lineHeight: 0.98, marginTop: 18, filter: focusPull(frame, 6) }}>
        They raised the money.
      </div>
      <div style={{ fontFamily: font, fontSize: 116, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 0.98, marginTop: 4, background: "linear-gradient(95deg, #0071E3 0%, #5E78FF 52%, #9E7BFF 100%)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", filter: focusPull(frame, 12) }}>
        They couldn&rsquo;t keep the liquidity.
      </div>
    </div>
  );
};

const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "absolute", left: PANEL_L, top: 360, maxWidth: 1180 }}>
      <div style={{ fontFamily: font, fontSize: 132, fontWeight: 800, letterSpacing: "-0.04em", color: C.text, lineHeight: 0.96, filter: focusPull(frame, 0) }}>
        {TOTAL_RAISED_LABEL}+ raised.
      </div>
      <div style={{ fontFamily: font, fontSize: 64, fontWeight: 700, letterSpacing: "-0.02em", color: C.dim, lineHeight: 1.05, marginTop: 22, filter: focusPull(frame, 8) }}>
Across {PROTOCOLS.length} perps protocols. The liquidity left anyway.
      </div>
      <div style={{ fontFamily: font, fontSize: 54, fontWeight: 600, letterSpacing: "-0.015em", lineHeight: 1.18, marginTop: 30, color: C.downDeep, filter: focusPull(frame, 16) }}>
        Rented liquidity leaves. Owned liquidity compounds.
      </div>
      <div style={{ fontFamily: monoFont, fontSize: 18, fontWeight: 500, color: C.faint, marginTop: 36 }}>
        * TVL: DefiLlama. Disclosed funding rounds; undisclosed/fair-launch shown by note.
      </div>
    </div>
  );
};

export const PerpsGraveyardReel: React.FC = () => (
  <Stage>
    <BrandMark surface="light" />
    {SCHEDULE.map((slot, i) => {
      if (slot.kind === "intro")
        return (
          <Sequence key={i} from={slot.from} durationInFrames={slot.dur} name="intro">
            <Intro />
          </Sequence>
        );
      if (slot.kind === "outro")
        return (
          <Sequence key={i} from={slot.from} durationInFrames={slot.dur} name="outro">
            <Outro />
          </Sequence>
        );
      const p = PROTOCOLS[slot.protoIdx];
      return (
        <Sequence key={i} from={slot.from} durationInFrames={slot.dur} name={p.id}>
          <Slide p={p} />
        </Sequence>
      );
    })}
    <Rail />
  </Stage>
);

export const perpsGraveyardReelMeta = {
  id: "PerpsGraveyardReel",
  component: PerpsGraveyardReel,
  durationInFrames: TOTAL_FRAMES,
  fps: FPS,
  width: W,
  height: H,
};
