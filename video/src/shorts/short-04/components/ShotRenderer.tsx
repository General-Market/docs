import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import type { ShotDef } from "../types";
import { COLORS } from "../types";
import { SCENE_REGISTRY } from "../sceneRegistry";

interface Props {
  shot: ShotDef;
  globalFrameOffset: number;
  shotDurationFrames: number;
}

export const ShotRenderer: React.FC<Props> = ({
  shot,
  globalFrameOffset,
  shotDurationFrames,
}) => {
  const frame = useCurrentFrame();
  const clamp = {
    extrapolateLeft: "clamp" as const,
    extrapolateRight: "clamp" as const,
  };

  const fsScale = shot.fullScreenZoom
    ? interpolate(
        frame,
        [0, shotDurationFrames],
        shot.fullScreenZoom === "in" ? [1, 1.05] : [1.05, 1],
        clamp,
      )
    : 1;

  // 3D scene is rendered at composition level — transparent bg
  const has3D = shot.customScenes?.includes("terrainWalker");

  return (
    <AbsoluteFill
      style={{
        backgroundColor: has3D ? "transparent" : COLORS.BG_BASE,
        transform: fsScale !== 1 ? `scale(${fsScale})` : undefined,
      }}
    >
      {/* Custom scenes via registry */}
      {shot.customScenes?.map((name) => {
        const render = SCENE_REGISTRY[name];
        return render ? (
          <React.Fragment key={name}>
            {render({ shot, globalFrameOffset })}
          </React.Fragment>
        ) : null;
      })}
    </AbsoluteFill>
  );
};
