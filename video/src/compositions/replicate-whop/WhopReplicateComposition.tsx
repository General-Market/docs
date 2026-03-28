import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { Scene01, scene01Meta } from "./Scene01";
import { scene02Meta } from "./Scene02";
import { Scene03, scene03Meta } from "./Scene03";
import { Scene04, scene04Meta } from "./Scene04";

export const WhopReplicateComposition: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#fafafa" }}>
        <Sequence key={"scene-1"} from={0} durationInFrames={227} name="Scene 01"><Scene01 /></Sequence>
        <Sequence key={"scene-3"} from={227} durationInFrames={132} name="Scene 03"><Scene03 /></Sequence>
        <Sequence key={"scene-4"} from={360} durationInFrames={443} name="Scene 04"><Scene04 /></Sequence>
    </AbsoluteFill>
  );
};

export const whopReplicateMeta = {
  id: "WhopReplicate",
  component: WhopReplicateComposition,
  width: 3840, height: 2160, fps: 25,
  durationInFrames: 802,
};

export const whopSceneMetas = [scene01Meta, scene02Meta, scene03Meta, scene04Meta];
