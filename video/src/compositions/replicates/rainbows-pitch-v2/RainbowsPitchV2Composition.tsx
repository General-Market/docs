import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { Scene01_Intro, Scene02_Numbers, Scene03_DarkGrid, Scene04_CubeExplode } from "./ScenesA";
import { Scene06_Starburst, Scene07_TransactionQueue } from "./ScenesB";
import { FeaturedSourceCardsScene, FeaturedVarietyCardsScene } from "./FeaturedSourceCards";
import { Scene09_Experience, Scene10_LiveTestnet, Scene11_NewSpeed, Scene12_Finale } from "./ScenesC";

/*
 * Rainbows pitch — V2 — same beat sheet, every scene now carries a prop.
 * Same 1596-frame skeleton. The bare text scenes get screenshots, icon
 * sets, or schematic diagrams in the Postman/Algolia register.
 */

export const RainbowsPitchV2Composition: React.FC = () => {
  return (
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
        <Scene07_TransactionQueue />
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
};

export const rainbowsPitchV2Meta = {
  id: "Rainbows-Pitch-V2",
  component: RainbowsPitchV2Composition,
  width: 1920,
  height: 1080,
  fps: 24,
  durationInFrames: 1596,
};
