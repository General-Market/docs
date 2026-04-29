import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { Scene01_Hook, Scene02_TryRainbows, Scene03_CubeExplode } from "./ScenesA";
import { Scene04_FilterAndPercent, Scene05_Manipulators } from "./ScenesB";
import {
  Scene06_HonestTraders,
  Scene07_Protected,
  Scene08_FiveHundredK,
  Scene09_BrollCycle,
  Scene10_Finale,
} from "./ScenesC";

/*
 * Rainbows — script v3 (post-cut: 0:27–0:33 excised, 144 frames removed)
 * 1920x1080, 24fps, 816 frames (34s)
 *
 * Scene timeline (frame ranges):
 *   01  Hook              "You spent 10,000 hours / perfecting your trading strategies"   0–84
 *   02  TryRainbows       "Then you should try / trading rainbows"                        84–156
 *   03  CubeExplode       silent visual beat                                             156–228
 *   04  FilterAndPercent  "Rainbows filters out illegal activities" + "70% of profits"   228–336
 *   05  Manipulators      conveyor: frontrunners / spoofers / insiders / manipulators    336–444
 *   06  HonestTraders     "Leaving the same amount of profits / to fewer honest traders" 444–528
 *   07  Protected         "Trade the assets you've always traded" → "Protected"          528–624
 *   08  FiveHundredK      first 24f only (head of the line, then cut at 0:27)            624–648
 *   09  BrollCycle        last 24f only (resumes at 0:33, scene's frames 72–95)          648–672
 *   10  Finale            "rainbows" + dark fade                                         672–816
 */

export const RainbowsFlashblocksComposition: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Sequence from={0} durationInFrames={84} name="01 Hook">
        <Scene01_Hook />
      </Sequence>
      <Sequence from={84} durationInFrames={72} name="02 Try Rainbows">
        <Scene02_TryRainbows />
      </Sequence>
      <Sequence from={156} durationInFrames={72} name="03 Cube Explode">
        <Scene03_CubeExplode />
      </Sequence>
      <Sequence from={228} durationInFrames={108} name="04 Filter And Percent">
        <Scene04_FilterAndPercent />
      </Sequence>
      <Sequence from={336} durationInFrames={108} name="05 Manipulators">
        <Scene05_Manipulators />
      </Sequence>
      <Sequence from={444} durationInFrames={84} name="06 Honest Traders">
        <Scene06_HonestTraders />
      </Sequence>
      <Sequence from={528} durationInFrames={96} name="07 Protected">
        <Scene07_Protected />
      </Sequence>
      <Sequence from={624} durationInFrames={24} name="08 Five Hundred K (head)">
        <Scene08_FiveHundredK />
      </Sequence>
      <Sequence from={648} durationInFrames={24} name="09 Broll Cycle (tail)" layout="none">
        <Sequence from={-72} durationInFrames={96} layout="none">
          <Scene09_BrollCycle />
        </Sequence>
      </Sequence>
      <Sequence from={672} durationInFrames={144} name="10 Finale">
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
  durationInFrames: 816,
};

export { sceneMetasA } from "./ScenesA";
export { sceneMetasB } from "./ScenesB";
export { sceneMetasC } from "./ScenesC";
