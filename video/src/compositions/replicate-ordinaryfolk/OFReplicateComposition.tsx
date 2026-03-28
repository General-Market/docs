import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { Scene01, scene01Meta } from "./Scene01";
import { Scene02, scene02Meta } from "./Scene02";
import { Scene03, scene03Meta } from "./Scene03";
import { Scene04, scene04Meta } from "./Scene04";
import { Scene05, scene05Meta } from "./Scene05";

export const OFReplicateComposition: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
        <Sequence key={"scene-1"} from={0} durationInFrames={259} name="Scene 01"><Scene01 /></Sequence>
        <Sequence key={"scene-2"} from={259} durationInFrames={175} name="Scene 02"><Scene02 /></Sequence>
        <Sequence key={"scene-3"} from={434} durationInFrames={745} name="Scene 03"><Scene03 /></Sequence>
        <Sequence key={"scene-4"} from={1180} durationInFrames={339} name="Scene 04"><Scene04 /></Sequence>
        <Sequence key={"scene-5"} from={1520} durationInFrames={695} name="Scene 05"><Scene05 /></Sequence>
    </AbsoluteFill>
  );
};

export const ofReplicateMeta = {
  id: "OFReplicate",
  component: OFReplicateComposition,
  width: 1280, height: 720, fps: 30,
  durationInFrames: 2213,
};

export const ofSceneMetas = [scene01Meta, scene02Meta, scene03Meta, scene04Meta, scene05Meta];
