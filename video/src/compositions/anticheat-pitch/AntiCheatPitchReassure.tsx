import React from "react";
import { FPS, H, W, colors, toFrames, pitchSans, pitchSansLight } from "./theme";
import { PitchFrame } from "./PitchFrame";
import { SlideBg, EllipseBleed, useReveal } from "./SlideKit";

const SCENE_SECONDS = 6.0;
const FIRST_AT = toFrames(0.4);
const SECOND_AT = toFrames(2.0);
const THIRD_AT = toFrames(3.6);

export const AntiCheatPitchReassure: React.FC = () => {
  const r1 = useReveal(FIRST_AT);
  const r2 = useReveal(SECOND_AT);
  const r3 = useReveal(THIRD_AT);

  return (
    <SlideBg>
      {/* The deck's signature: a giant orange ellipse bleeding from the
          bottom-right, anchored off-canvas so only its upper-left arc shows. */}
      <EllipseBleed
        cx="78%"
        cy="120%"
        rx="58%"
        ry="80%"
        showFrom={toFrames(0.1)}
      />

      <div
        style={{
          position: "absolute",
          top: "22%",
          left: 96,
          right: "44%",
        }}
      >
        <div
          style={{
            opacity: r1.opacity,
            transform: `translateY(${r1.y}px)`,
            fontFamily: pitchSans,
            fontWeight: 700,
            fontSize: 28,
            letterSpacing: "0.32em",
            textTransform: "uppercase",
            color: colors.accent,
            marginBottom: 28,
          }}
        >
          Same markets · Same speed
        </div>

        <div
          style={{
            opacity: r2.opacity,
            transform: `translateY(${r2.y}px)`,
            fontFamily: pitchSans,
            fontWeight: 800,
            fontSize: 128,
            letterSpacing: "-0.035em",
            lineHeight: 0.96,
            color: colors.fg,
            marginBottom: 36,
          }}
        >
          Trade all the
          <br />
          same assets.
        </div>

        <div
          style={{
            opacity: r3.opacity,
            transform: `translateY(${r3.y}px)`,
            fontFamily: pitchSansLight,
            fontWeight: 400,
            fontSize: 44,
            letterSpacing: "-0.005em",
            color: colors.fgDim,
            lineHeight: 1.3,
            maxWidth: 760,
          }}
        >
          Cheaters removed.
        </div>
      </div>

      <PitchFrame chapter={5} total={6} eyebrow="WHY IT HOLDS" />
    </SlideBg>
  );
};

export const antiCheatPitchReassureMeta = {
  id: "AntiCheatPitchReassure",
  component: AntiCheatPitchReassure,
  durationInFrames: toFrames(SCENE_SECONDS),
  fps: FPS,
  width: W,
  height: H,
};
