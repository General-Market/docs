import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { Scene01_Intro, Scene02_Numbers, Scene03_DarkGrid, Scene04_CubeExplode } from "./ScenesA";
import { Scene05_Waiting, Scene06_Starburst, Scene07_TransactionQueue, Scene08_GridText } from "./ScenesB";
import { Scene09_Experience, Scene10_LiveTestnet, Scene11_NewSpeed, Scene12_Finale } from "./ScenesC";

/*
 * Flashblocks explainer — full 37s recreation
 * Original: 3840x2160, 24fps, 37.2s
 * Replica:  1920x1080, 24fps, 893 frames
 *
 * Scene timeline (frame numbers):
 *   01  Intro "What if using Base felt"    0–48
 *   02  Numbers "2→10 times faster"        48–96
 *   03  Dark grid "What are Flashblocks?"  96–180
 *   04  Cube explode                       180–252
 *   05  "Instead of waiting..."            252–300
 *   06  Starburst "200 milliseconds"       300–372
 *   07  Transaction queue                  372–480
 *   08  Grid text "faster/smoother/better" 480–540
 *   09  Experience (concentric circles)    540–588
 *   10  "Live on Testnet"                  588–672
 *   11  "New speed"                        672–720
 *   12  Finale + dark fade                 720–893
 */

export const FlashblocksComposition: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Sequence from={0} durationInFrames={48} name="01 Intro">
        <Scene01_Intro />
      </Sequence>
      <Sequence from={48} durationInFrames={48} name="02 Numbers">
        <Scene02_Numbers />
      </Sequence>
      <Sequence from={96} durationInFrames={84} name="03 Dark Grid">
        <Scene03_DarkGrid />
      </Sequence>
      <Sequence from={180} durationInFrames={72} name="04 Cube Explode">
        <Scene04_CubeExplode />
      </Sequence>
      <Sequence from={252} durationInFrames={48} name="05 Waiting">
        <Scene05_Waiting />
      </Sequence>
      <Sequence from={300} durationInFrames={72} name="06 Starburst">
        <Scene06_Starburst />
      </Sequence>
      <Sequence from={372} durationInFrames={108} name="07 Transaction Queue">
        <Scene07_TransactionQueue />
      </Sequence>
      <Sequence from={480} durationInFrames={60} name="08 Grid Text">
        <Scene08_GridText />
      </Sequence>
      <Sequence from={540} durationInFrames={48} name="09 Experience">
        <Scene09_Experience />
      </Sequence>
      <Sequence from={588} durationInFrames={84} name="10 Live Testnet">
        <Scene10_LiveTestnet />
      </Sequence>
      <Sequence from={672} durationInFrames={48} name="11 New Speed">
        <Scene11_NewSpeed />
      </Sequence>
      <Sequence from={720} durationInFrames={173} name="12 Finale">
        <Scene12_Finale />
      </Sequence>
    </AbsoluteFill>
  );
};

export const flashblocksMeta = {
  id: "Flashblocks-Replicate",
  component: FlashblocksComposition,
  width: 1920,
  height: 1080,
  fps: 24,
  durationInFrames: 893,
};
