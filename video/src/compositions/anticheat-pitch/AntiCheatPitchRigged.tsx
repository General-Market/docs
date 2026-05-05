import React from "react";
import { FPS, H, W, toFrames } from "./theme";
import { PitchFrame } from "./PitchFrame";
import {
  SlideBg,
  SlideTitle,
  HeroGlow,
  StackedBars,
  type StackedBarItem,
} from "./SlideKit";

const SCENE_SECONDS = 6.0;
const TITLE_AT = toFrames(0.2);
const BARS_AT = toFrames(1.0);

// Bar widths intentionally varied — like the deck, where each bar trails off
// at a different point so the whole stack reads as a list, not a grid.
const ITEMS: StackedBarItem[] = [
  { width: "94%", text: "A tip from a politician — material non-public information" },
  { width: "78%", text: "$100M of latency infra — co-located, sub-microsecond" },
  { width: "84%", text: "$30M for exchange data — direct feeds, unfair by design" },
];

export const AntiCheatPitchRigged: React.FC = () => {
  return (
    <SlideBg>
      <HeroGlow />

      <SlideTitle showFrom={TITLE_AT} size={84}>
        How the rig is funded.
      </SlideTitle>

      <StackedBars items={ITEMS} startFrame={BARS_AT} step={toFrames(0.55)} top="34%" />

      <PitchFrame chapter={3} total={6} eyebrow="THE RIG" />
    </SlideBg>
  );
};

export const antiCheatPitchRiggedMeta = {
  id: "AntiCheatPitchRigged",
  component: AntiCheatPitchRigged,
  durationInFrames: toFrames(SCENE_SECONDS),
  fps: FPS,
  width: W,
  height: H,
};
