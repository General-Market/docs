import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { Scene01_Hook, Scene02_TryRainbows, Scene03_CubeExplode } from "./ScenesA";
import { Scene04_FilterAndPercent, Scene05_Manipulators } from "./ScenesB";
import {
  Scene06_HonestTraders,
  Scene10_Finale,
} from "./ScenesC";

/*
 * Rainbows — script v3 (post-cut: scenes 07, 08, 09 removed; scene 02 trimmed)
 * 1920x1080, 24fps, 648 frames (27s)
 *
 * Scene timeline (frame ranges):
 *   01  Hook              "You spent 10,000 hours / perfecting your trading strategies"   0–84
 *   02  TryRainbows       "How rainbows improve / your gains?"                            84–132
 *   03  CubeExplode       silent visual beat                                             132–204
 *   04  FilterAndPercent  "Rainbows filters out illegal activities" + "70% of profits"   204–312
 *   05  Manipulators      conveyor: frontrunners / spoofers / insiders / manipulators    312–420
 *   06  HonestTraders     "Leaving the same amount of profits / to fewer honest traders" 420–504
 *   10  Finale            "rainbows" + dark fade                                         504–648
 */

export const RainbowsFlashblocksComposition: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Sequence from={0} durationInFrames={84} name="01 Hook">
        <Scene01_Hook />
      </Sequence>
      <Sequence from={84} durationInFrames={48} name="02 Try Rainbows">
        <Scene02_TryRainbows />
      </Sequence>
      <Sequence from={132} durationInFrames={72} name="03 Cube Explode">
        <Scene03_CubeExplode />
      </Sequence>
      <Sequence from={204} durationInFrames={108} name="04 Filter And Percent">
        <Scene04_FilterAndPercent />
      </Sequence>
      <Sequence from={312} durationInFrames={108} name="05 Manipulators">
        <Scene05_Manipulators />
      </Sequence>
      <Sequence from={420} durationInFrames={84} name="06 Honest Traders">
        <Scene06_HonestTraders />
      </Sequence>
      <Sequence from={504} durationInFrames={144} name="10 Finale">
        <Scene10_Finale />
      </Sequence>
    </AbsoluteFill>
  );
};

export const rainbowsFlashblocksMeta = {
  id: "Rainbows-Flashblocks",
  component: RainbowsFlashblocksComposition,
  width: 1920,
  height: 1080,
  fps: 24,
  durationInFrames: 648,
};

export { sceneMetasA } from "./ScenesA";
export { sceneMetasB } from "./ScenesB";
export { sceneMetasC } from "./ScenesC";
