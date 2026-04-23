/**
 * General Market 3D Logo — 5 FinTech scene showcase.
 * Each scene explores a different material/lighting approach.
 */
import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import {
  ScenePolishedChrome,
  scenePolishedChromeMeta,
} from "./ScenePolishedChrome";
import {
  SceneMatcapSilver,
  sceneMatcapSilverMeta,
} from "./SceneMatcapSilver";
import {
  SceneDarkChrome,
  sceneDarkChromeMeta,
} from "./SceneDarkChrome";
import {
  SceneBrushedAluminum,
  sceneBrushedAluminumMeta,
} from "./SceneBrushedAluminum";
import {
  SceneFrostedGlass,
  sceneFrostedGlassMeta,
} from "./SceneFrostedGlass";

const D = 300; // 10 seconds each

export const GMLogo3D: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#000000" }}>
    <Sequence from={0} durationInFrames={D} name="1 — Polished Chrome">
      <ScenePolishedChrome />
    </Sequence>
    <Sequence from={D} durationInFrames={D} name="2 — Matcap Silver">
      <SceneMatcapSilver />
    </Sequence>
    <Sequence from={D * 2} durationInFrames={D} name="3 — Dark Chrome">
      <SceneDarkChrome />
    </Sequence>
    <Sequence from={D * 3} durationInFrames={D} name="4 — Brushed Aluminum">
      <SceneBrushedAluminum />
    </Sequence>
    <Sequence from={D * 4} durationInFrames={D} name="5 — Frosted Glass">
      <SceneFrostedGlass />
    </Sequence>
  </AbsoluteFill>
);

export const gmLogo3dMeta = {
  id: "GMLogo3D",
  component: GMLogo3D,
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: D * 5,
};

// Individual scene metas for per-scene rendering
export const gmLogoSceneMetas = [
  scenePolishedChromeMeta,
  sceneMatcapSilverMeta,
  sceneDarkChromeMeta,
  sceneBrushedAluminumMeta,
  sceneFrostedGlassMeta,
];
