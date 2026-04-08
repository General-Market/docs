import React from "react";
import { AbsoluteFill, Sequence, OffthreadVideo, staticFile } from "remotion";
import { Scene01, scene01Meta } from "./Scene01";
import { Scene02, scene02Meta } from "./Scene02";
import { Scene03, scene03Meta } from "./Scene03";
import { Scene04, scene04Meta } from "./Scene04";
import { Scene05, scene05Meta } from "./Scene05";
import { Scene06, scene06Meta } from "./Scene06";
import { Scene07, scene07Meta } from "./Scene07";

const TOTAL =
  scene01Meta.durationInFrames +
  scene02Meta.durationInFrames +
  scene03Meta.durationInFrames +
  scene04Meta.durationInFrames +
  scene05Meta.durationInFrames +
  scene06Meta.durationInFrames +
  scene07Meta.durationInFrames;

const S1 = 0;
const S2 = S1 + scene01Meta.durationInFrames;
const S3 = S2 + scene02Meta.durationInFrames;
const S4 = S3 + scene03Meta.durationInFrames;
const S5 = S4 + scene04Meta.durationInFrames;
const S6 = S5 + scene05Meta.durationInFrames;
const S7 = S6 + scene06Meta.durationInFrames;

export const VirtualsCouncil: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#FFFFFF" }}>
    <Sequence
      from={S1}
      durationInFrames={scene01Meta.durationInFrames}
      name="Logo Intro"
    >
      <Scene01 />
    </Sequence>
    <Sequence
      from={S2}
      durationInFrames={scene02Meta.durationInFrames}
      name="Features Card"
    >
      <Scene02 />
    </Sequence>
    <Sequence
      from={S3}
      durationInFrames={scene03Meta.durationInFrames}
      name="We Built AI"
    >
      <Scene03 />
    </Sequence>
    <Sequence
      from={S4}
      durationInFrames={scene04Meta.durationInFrames}
      name="Leaderboard"
    >
      <Scene04 />
    </Sequence>
    <Sequence
      from={S5}
      durationInFrames={scene05Meta.durationInFrames}
      name="Text Transitions"
    >
      <Scene05 />
    </Sequence>
    <Sequence
      from={S6}
      durationInFrames={scene06Meta.durationInFrames}
      name="Three Panels"
    >
      <Scene06 />
    </Sequence>
    <Sequence
      from={S7}
      durationInFrames={scene07Meta.durationInFrames}
      name="Season 2 End"
    >
      <Scene07 />
    </Sequence>
  </AbsoluteFill>
);

export const councilReplicateMeta = {
  id: "VirtualsCouncil-Replicate",
  component: VirtualsCouncil,
  width: 1280,
  height: 720,
  fps: 30,
  durationInFrames: TOTAL,
};

export const CouncilSideBySide: React.FC = () => (
  <AbsoluteFill
    style={{ backgroundColor: "#000", display: "flex", flexDirection: "row" }}
  >
    <div
      style={{
        width: 1280,
        height: 720,
        position: "relative",
        flexShrink: 0,
      }}
    >
      <OffthreadVideo
        src={staticFile("virtuals-original.mp4")}
        style={{ width: "100%", height: "100%" }}
      />
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          background: "rgba(0,0,0,0.6)",
          color: "#fff",
          padding: "4px 12px",
          borderRadius: 6,
          fontFamily: "monospace",
          fontSize: 14,
        }}
      >
        ORIGINAL
      </div>
    </div>
    <div style={{ width: 2, background: "#333", flexShrink: 0 }} />
    <div
      style={{
        width: 1280,
        height: 720,
        position: "relative",
        flexShrink: 0,
      }}
    >
      <VirtualsCouncil />
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          background: "rgba(0,0,0,0.6)",
          color: "#fff",
          padding: "4px 12px",
          borderRadius: 6,
          fontFamily: "monospace",
          fontSize: 14,
        }}
      >
        REPLICA
      </div>
    </div>
  </AbsoluteFill>
);

export const councilSideBySideMeta = {
  id: "VirtualsCouncil-SideBySide",
  component: CouncilSideBySide,
  width: 2562,
  height: 720,
  fps: 30,
  durationInFrames: TOTAL,
};

export const councilSceneMetas = [
  scene01Meta,
  scene02Meta,
  scene03Meta,
  scene04Meta,
  scene05Meta,
  scene06Meta,
  scene07Meta,
];
