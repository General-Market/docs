import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { Scene01_Intro, Scene02_Numbers, Scene03_DarkGrid, Scene04_CubeExplode } from "./ScenesA";
import { Scene05_Waiting, Scene06_Starburst, Scene07_TransactionQueue, Scene08_GridText } from "./ScenesB";
import { Scene09_Experience, Scene10_LiveTestnet, Scene11_NewSpeed, Scene12_Finale } from "./ScenesC";

/*
 * Rainbows pitch — 37.2s explainer (1920x1080, 24fps, 893 frames)
 *
 *   01  "Trade market like this." → "Is simpler than..."   0–48
 *   02  Counter 0→70%, "of your profits"                   48–96
 *   03  "But what are rainbows?" → title card              96–180
 *   04  "Rainbows filters out illegal activities" + cube   180–252
 *   05  "Removing" → "what shouldn't be here."             252–300
 *   06  Counter 0→500,000, "exclusive markets",            300–372
 *       sub-caption "only tradable with rainbows"
 *   07  Villains struck through (frontrunners,             372–480
 *       orderbook spoofers, illegal insiders, manipulators)
 *   08  Asset grid: Stocks / Crypto / Predictions /        480–540
 *       Memecoins
 *   09  Concentric circles + "gain more"                   540–588
 *   10  "Leaving the same profits" → "to fewer            588–672
 *       honest traders"
 *   11  "while trading the same assets."                   672–720
 *   12  "General." + "Markets for everything." + fade     720–893
 */

export const RainbowsPitchComposition: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Sequence from={0} durationInFrames={48} name="01 Compare">
        <Scene01_Intro />
      </Sequence>
      <Sequence from={48} durationInFrames={48} name="02 70% Counter">
        <Scene02_Numbers />
      </Sequence>
      <Sequence from={96} durationInFrames={84} name="03 What Are Rainbows">
        <Scene03_DarkGrid />
      </Sequence>
      <Sequence from={180} durationInFrames={72} name="04 Filters Illegal">
        <Scene04_CubeExplode />
      </Sequence>
      <Sequence from={252} durationInFrames={48} name="05 Removing">
        <Scene05_Waiting />
      </Sequence>
      <Sequence from={300} durationInFrames={72} name="06 500k Markets">
        <Scene06_Starburst />
      </Sequence>
      <Sequence from={372} durationInFrames={108} name="07 Villains Struck">
        <Scene07_TransactionQueue />
      </Sequence>
      <Sequence from={480} durationInFrames={60} name="08 Asset Grid">
        <Scene08_GridText />
      </Sequence>
      <Sequence from={540} durationInFrames={48} name="09 Gain More">
        <Scene09_Experience />
      </Sequence>
      <Sequence from={588} durationInFrames={84} name="10 Same Profits">
        <Scene10_LiveTestnet />
      </Sequence>
      <Sequence from={672} durationInFrames={48} name="11 Same Assets">
        <Scene11_NewSpeed />
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
