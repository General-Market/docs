import React from "react";
import { AbsoluteFill } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { Scene01, scene01Meta } from "./Scene01";
import { Scene02, scene02Meta } from "./Scene02";
import { Scene03, scene03Meta } from "./Scene03";
import { Scene04, scene04Meta } from "./Scene04";
import { Scene05, scene05Meta } from "./Scene05";

/**
 * Crossfade duration at each scene boundary (in frames).
 * 12 frames @ 30fps = 0.4s — enough to erase the hard cut,
 * short enough to preserve the rhythm.
 */
const XFADE = 12;

const scenes = [
  { key: "scene-1", name: "Scene 01", duration: 259, Component: Scene01 },
  { key: "scene-2", name: "Scene 02", duration: 175, Component: Scene02 },
  { key: "scene-3", name: "Scene 03", duration: 745, Component: Scene03 },
  { key: "scene-4", name: "Scene 04", duration: 339, Component: Scene04 },
  { key: "scene-5", name: "Scene 05", duration: 695, Component: Scene05 },
] as const;

/** Total frames: sum of scene durations minus overlap at each of the 4 boundaries */
const TOTAL_FRAMES =
  scenes.reduce((sum, s) => sum + s.duration, 0) -
  XFADE * (scenes.length - 1);

export const OFReplicateComposition: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      <TransitionSeries>
        {scenes.map((scene, i) => (
          <React.Fragment key={scene.key}>
            <TransitionSeries.Sequence
              durationInFrames={scene.duration}
              name={scene.name}
            >
              <scene.Component />
            </TransitionSeries.Sequence>
            {i < scenes.length - 1 && (
              <TransitionSeries.Transition
                presentation={fade()}
                timing={linearTiming({ durationInFrames: XFADE })}
              />
            )}
          </React.Fragment>
        ))}
      </TransitionSeries>
    </AbsoluteFill>
  );
};

export const ofReplicateMeta = {
  id: "OFReplicate",
  component: OFReplicateComposition,
  width: 1280, height: 720, fps: 30,
  durationInFrames: TOTAL_FRAMES,
};

export const ofSceneMetas = [scene01Meta, scene02Meta, scene03Meta, scene04Meta, scene05Meta];
