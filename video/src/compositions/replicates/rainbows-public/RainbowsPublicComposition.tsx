import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { Scene01, scene01Meta } from "./Scene01";
import { Scene02, scene02Meta } from "./Scene02";
import { Scene03, scene03Meta } from "./Scene03";
import { Scene04, scene04Meta } from "./Scene04";

export const RainbowsPublicComposition: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      <Sequence key={"scene-1"} from={0} durationInFrames={301} name="Scene 01">
        <Scene01 />
      </Sequence>
      <Sequence key={"scene-2"} from={301} durationInFrames={364} name="Scene 02">
        <Scene02 />
      </Sequence>
      <Sequence key={"scene-3"} from={666} durationInFrames={153} name="Scene 03">
        <Scene03 />
      </Sequence>
      <Sequence key={"scene-4"} from={820} durationInFrames={81} name="Scene 04">
        <Scene04 />
      </Sequence>
    </AbsoluteFill>
  );
};

export const rainbowsPublicMeta = {
  id: "Rainbows-Public",
  component: RainbowsPublicComposition,
  width: 1280,
  height: 720,
  fps: 29,
  durationInFrames: 899,
};

export const rainbowsPublicSceneMetas = [
  scene01Meta,
  scene02Meta,
  scene03Meta,
  scene04Meta,
];
