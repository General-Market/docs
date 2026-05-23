import React from "react";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { ILLUSTRATIONS } from "./registry";

// Two studio outputs:
//
//   AntiCheatEditIllustrations — all twenty-four schematics on one timeline,
//     each held 5.5s with a short cross-fade. Scrub the whole set in order.
//   Ill_<Name> (a Folder of stills) — each schematic alone, so a single one
//     can be inspected without scrubbing past the others.
//
// Each scene owns a fresh frame-0, so its entrance re-fires.

const FPS = 30;
const W = 1920;
const H = 1080;

const HOLD = Math.round(5.5 * FPS); // 165
const FADE = 12;

export const IllustrationsReel: React.FC = () => {
  return (
    <TransitionSeries>
      {ILLUSTRATIONS.flatMap((ill, i) => {
        const Comp = ill.component;
        const seq = (
          <TransitionSeries.Sequence key={`s-${ill.slug}`} durationInFrames={HOLD}>
            <Comp />
          </TransitionSeries.Sequence>
        );
        if (i === 0) return [seq];
        return [
          <TransitionSeries.Transition
            key={`t-${ill.slug}`}
            presentation={fade()}
            timing={linearTiming({ durationInFrames: FADE })}
          />,
          seq,
        ];
      })}
    </TransitionSeries>
  );
};

const REEL_TOTAL = HOLD * ILLUSTRATIONS.length - FADE * (ILLUSTRATIONS.length - 1);

export const illustrationsReelMeta = {
  id: "AntiCheatEditIllustrations",
  component: IllustrationsReel,
  durationInFrames: REEL_TOTAL,
  fps: FPS,
  width: W,
  height: H,
};

// One meta per schematic, for the studio Folder. Composition ids allow
// only [a-zA-Z0-9-] (no underscore), so the prefix is hyphenated.
export const illustrationMetas = ILLUSTRATIONS.map((ill) => ({
  id: `Ill-${ill.name}`,
  component: ill.component,
  durationInFrames: HOLD,
  fps: FPS,
  width: W,
  height: H,
}));
