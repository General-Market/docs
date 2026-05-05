import React from "react";
import { FPS, H, W, colors, toFrames } from "./theme";
import { PitchFrame } from "./PitchFrame";
import {
  SlideBg,
  SlideTitle,
  HeroGlow,
  WhiteCardGrid,
  type WhiteCardItem,
} from "./SlideKit";

const SCENE_SECONDS = 6.5;
const TITLE_AT = toFrames(0.2);
const CARDS_AT = toFrames(1.0);

const FIXES: WhiteCardItem[] = [
  {
    header: "Sealed Bets",
    body: "Front-runners can't run what they can't see. Orders sealed until settlement.",
  },
  {
    header: "Parimutuel Pricing",
    body: "No order book to spoof. No liquidity for whales to drain.",
  },
  {
    header: "BLS Oracles",
    body: "Outcomes proved by signed consensus. No call to a friend at the exchange.",
  },
  {
    header: "On-Chain Audit",
    body: "Every move recorded, every fill verifiable, every cheat — visible.",
  },
];

export const AntiCheatPitchSolution: React.FC = () => {
  return (
    <SlideBg>
      <HeroGlow />

      <SlideTitle showFrom={TITLE_AT} size={84}>
        General <span style={{ color: colors.accent }}>changes</span> this.
      </SlideTitle>

      <WhiteCardGrid items={FIXES} startFrame={CARDS_AT} step={toFrames(0.4)} />

      <PitchFrame chapter={4} total={6} eyebrow="THE FIX" />
    </SlideBg>
  );
};

export const antiCheatPitchSolutionMeta = {
  id: "AntiCheatPitchSolution",
  component: AntiCheatPitchSolution,
  durationInFrames: toFrames(SCENE_SECONDS),
  fps: FPS,
  width: W,
  height: H,
};
