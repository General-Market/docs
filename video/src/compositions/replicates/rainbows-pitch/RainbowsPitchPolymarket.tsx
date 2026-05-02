/* RainbowsPitchPolymarket.tsx — two variant compositions of the
   Rainbows Pitch, identical to the original except the villain
   chart panels at 00:11 wear Polymarket-style chrome.

   A: ManipulationPanel becomes a smooth pump-dump line.
   B: ManipulationPanel keeps its candlesticks; only the surrounding
      frame adopts the Polymarket headline/pills/ladder/playhead. */

import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import {
  Scene01_Intro,
  Scene02_Numbers,
  Scene03_DarkGrid,
  Scene04_CubeExplode,
} from "./ScenesA";
import { Scene06_Starburst, Scene07_TransactionQueue } from "./ScenesB";
import {
  FeaturedSourceCardsScene,
  FeaturedVarietyCardsScene,
} from "./FeaturedSourceCards";
import {
  Scene09_Experience,
  Scene10_LiveTestnet,
  Scene11_NewSpeed,
  Scene12_Finale,
} from "./ScenesC";
import { VillainPanelsA, VillainPanelsB } from "./villainPanelsPolymarket";

const FPS = 24;
const TOTAL = 1596;
const W = 1920;
const H = 1080;

const Composition: React.FC<{ Panels: typeof VillainPanelsA }> = ({ Panels }) => (
  <AbsoluteFill style={{ backgroundColor: "#000" }}>
    <Audio src={staticFile("music/rainbows-pitch.mp3")} volume={0.7} />
    <Sequence from={0} durationInFrames={72} name="01 Compare">
      <Scene01_Intro />
    </Sequence>
    <Sequence from={72} durationInFrames={60} name="02 What Are Rainbows">
      <Scene03_DarkGrid />
    </Sequence>
    <Sequence from={132} durationInFrames={72} name="03 Filters Illegal">
      <Scene04_CubeExplode />
    </Sequence>
    <Sequence from={204} durationInFrames={156} name="04 Removing + Villains">
      <Scene07_TransactionQueue Panels={Panels} />
    </Sequence>
    <Sequence from={360} durationInFrames={48} name="06 70% Counter">
      <Scene02_Numbers />
    </Sequence>
    <Sequence from={408} durationInFrames={84} name="07 Same Profits">
      <Scene10_LiveTestnet />
    </Sequence>
    <Sequence from={492} durationInFrames={48} name="08 Gain More">
      <Scene09_Experience />
    </Sequence>
    <Sequence from={540} durationInFrames={48} name="09 Same Assets">
      <Scene11_NewSpeed />
    </Sequence>
    <Sequence from={588} durationInFrames={60} name="10 Asset Grid">
      <FeaturedSourceCardsScene />
    </Sequence>
    <Sequence from={648} durationInFrames={72} name="11 500k Markets">
      <Scene06_Starburst />
    </Sequence>
    <Sequence from={720} durationInFrames={84} name="12 Variety Cards">
      <FeaturedVarietyCardsScene />
    </Sequence>
    <Sequence from={804} durationInFrames={792} name="13 General Finale">
      <Scene12_Finale />
    </Sequence>
  </AbsoluteFill>
);

export const RainbowsPitchPolymarketA: React.FC = () => (
  <Composition Panels={VillainPanelsA} />
);

export const RainbowsPitchPolymarketB: React.FC = () => (
  <Composition Panels={VillainPanelsB} />
);

export const rainbowsPitchPolymarketAMeta = {
  id: "Rainbows-Pitch-PolymarketA",
  component: RainbowsPitchPolymarketA,
  width: W,
  height: H,
  fps: FPS,
  durationInFrames: TOTAL,
};

export const rainbowsPitchPolymarketBMeta = {
  id: "Rainbows-Pitch-PolymarketB",
  component: RainbowsPitchPolymarketB,
  width: W,
  height: H,
  fps: FPS,
  durationInFrames: TOTAL,
};
