import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, DURATION, FPS, H, W } from "./data";
import { TitleCard, TitleOutro, RowsBuild, HexRowFlows, GlobeScene, MapScene, NetworkScene } from "./scenesA";
import { CitiesScene, HexifyScene, MatchingScene, LocksScene, StripScene } from "./scenesB";
import {
  GanttScene,
  ReportOutScene,
  HandshakeScene,
  PaymentScene,
  Strip2Scene,
  ReportCardScene,
  BuildPopScene,
  MapBadgesScene,
  CircleScene,
  MosaicScene,
  ShieldScene,
  LedgeScene,
  OutroScene,
  EndCardScene,
} from "./scenesC";

// 1:1 rebuild of "CLSNet / How it works" — one continuous choreography,
// scenes gated by frame ranges from data.ts SEG.
export const ClsNetComposition: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: C.white }}>
      {frame < 152 && (
        <TitleOutro frame={frame}>
          <TitleCard frame={frame} />
        </TitleOutro>
      )}
      <RowsBuild frame={frame} />
      <HexRowFlows frame={frame} />
      <GlobeScene frame={frame} />
      <MapScene frame={frame} />
      <NetworkScene frame={frame} />
      <CitiesScene frame={frame} />
      <HexifyScene frame={frame} />
      <MatchingScene frame={frame} />
      <LocksScene frame={frame} />
      <StripScene frame={frame} />
      <GanttScene frame={frame} />
      <ReportOutScene frame={frame} />
      <HandshakeScene frame={frame} />
      <PaymentScene frame={frame} />
      <Strip2Scene frame={frame} />
      <ReportCardScene frame={frame} />
      <BuildPopScene frame={frame} />
      <MapBadgesScene frame={frame} />
      <CircleScene frame={frame} />
      <MosaicScene frame={frame} />
      <ShieldScene frame={frame} />
      <LedgeScene frame={frame} />
      <OutroScene frame={frame} />
      <EndCardScene frame={frame} />
    </AbsoluteFill>
  );
};

export const clsNetMeta = {
  id: "ClsNet-Replicate",
  component: ClsNetComposition,
  durationInFrames: DURATION,
  fps: FPS,
  width: W,
  height: H,
};
