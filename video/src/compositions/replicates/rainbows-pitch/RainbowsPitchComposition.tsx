import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { Scene01_Intro, Scene02_Numbers, Scene03_DarkGrid, Scene04_CubeExplode } from "./ScenesA";
import { Scene05_Waiting, Scene06_Starburst, Scene07_TransactionQueue, Scene08_GridText } from "./ScenesB";
import { Scene09_Experience, Scene10_LiveTestnet, Scene11_NewSpeed, Scene12_Finale } from "./ScenesC";

/*
 * Rainbows pitch — 37.2s explainer (1920x1080, 24fps, 893 frames)
 *
 * Rhetorical order: hook → question → answer (metaphor) → setup →
 * evidence (literal) → quantify → mechanic → result → universe setup
 * → universe reveal → differentiator → brand. Closing four scenes
 * accelerate into the finale: 48 → 60 → 72 → 173 frames.
 *
 *   01  "Trade market like this." → "Is simpler than..."     0–48
 *   02  "But what are rainbows?" → title card               48–132
 *   03  "Rainbows filters out illegal activities" + cube  132–204
 *   04  "Removing" → "what shouldn't be here."            204–252
 *   05  Villains struck through                            252–360
 *   06  Counter 0→70%, "of your profits"                  360–408
 *   07  "Leaving the same profits" → "to fewer            408–492
 *       honest traders"
 *   08  Concentric circles + "gain more"                  492–540
 *   09  "while trading the same assets."                  540–588
 *   10  Asset grid: Stocks / Crypto / Predictions /       588–648
 *       Memecoins
 *   11  Counter 0→500,000, "exclusive markets",           648–720
 *       sub-caption "only tradable with rainbows"
 *   12  "General." + "Markets for everything." + fade    720–893
 */

export const RainbowsPitchComposition: React.FC = () => {
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
      <Sequence from={204} durationInFrames={48} name="04 Removing">
        <Scene05_Waiting />
      </Sequence>
      <Sequence from={252} durationInFrames={108} name="05 Villains Struck">
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
        <Scene08_GridText />
      </Sequence>
      <Sequence from={648} durationInFrames={72} name="11 500k Markets">
        <Scene06_Starburst />
      </Sequence>
      <Sequence from={720} durationInFrames={173} name="12 General Finale">
        <Scene12_Finale />
      </Sequence>
    </AbsoluteFill>
  );
};

export const rainbowsPitchMeta = {
  id: "Rainbows-Pitch",
  component: RainbowsPitchComposition,
  width: 1920,
  height: 1080,
  fps: 24,
  durationInFrames: 893,
};
