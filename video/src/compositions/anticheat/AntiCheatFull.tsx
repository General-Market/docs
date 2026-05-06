import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { FPS, H, W, colors } from "./theme";
import { antiCheatHookMeta } from "./AntiCheatHook";
import { antiCheatStatMeta, antiCheatBarsMeta } from "./AntiCheatStat";
import { antiCheatRiggedMeta } from "./AntiCheatRigged";
import { antiCheatSolutionMeta } from "./AntiCheatSolution";
import { antiCheatReassureMeta } from "./AntiCheatReassure";
import { antiCheatEndCardMeta } from "./AntiCheatEndCard";
import { RGBShift } from "./effects/RGBShift";
import { LensPunch } from "./effects/LensPunch";

// Hook 9.5s + Bars 3.5s + Rigged 5.5s + Stat 4s + Solution 5.5s + Reassure 4.5s + EndCard 3.5s = 36s.
// Hard cuts. No transitions. Each scene starts at the prior scene's last frame + 1.
// Effects layer: a 6-frame chromatic flash on every cut except the first;
// a single lens punch on the "is rigged." reveal at the start of Rigged.
const SCENES = [
  antiCheatHookMeta,
  antiCheatBarsMeta,
  antiCheatRiggedMeta,
  antiCheatStatMeta,
  antiCheatSolutionMeta,
  antiCheatReassureMeta,
  antiCheatEndCardMeta,
] as const;

const SCENE_STARTS = SCENES.reduce<number[]>((acc, s, i) => {
  acc.push(i === 0 ? 0 : acc[i - 1] + SCENES[i - 1].durationInFrames);
  return acc;
}, []);

const TOTAL_FRAMES = SCENES.reduce(
  (sum, s) => sum + s.durationInFrames,
  0,
);

const RIGGED_INDEX = SCENES.findIndex((s) => s.id === antiCheatRiggedMeta.id);
const LENS_PUNCH_FRAME = SCENE_STARTS[RIGGED_INDEX] + Math.round(FPS * 0.25);

export const AntiCheatFull: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg }}>
      {SCENES.map((scene, i) => {
        const Comp = scene.component;
        const startFrame = SCENE_STARTS[i];
        const isRigged = scene.id === antiCheatRiggedMeta.id;

        const sceneNode = isRigged ? (
          <LensPunch peakFrame={LENS_PUNCH_FRAME}>
            <Comp />
          </LensPunch>
        ) : (
          <Comp />
        );

        return (
          <Sequence
            key={scene.id}
            from={startFrame}
            durationInFrames={scene.durationInFrames}
            layout="none"
          >
            {sceneNode}
          </Sequence>
        );
      })}

      {SCENES.slice(1).map((scene, i) => {
        const cutFrame = SCENE_STARTS[i + 1];
        return (
          <Sequence
            key={`flash-${scene.id}`}
            from={cutFrame}
            durationInFrames={10}
            layout="none"
          >
            <RGBShift startFrame={cutFrame} durationFrames={8}>
              <ChromaticGhost />
            </RGBShift>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

// A neutral overlay tinted plate the RGB filter shears through — produces a
// 3-frame chromatic flash on top of whatever scene starts at the cut.
const ChromaticGhost: React.FC = () => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      background:
        "linear-gradient(0deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.32) 50%, rgba(255,255,255,0.18) 100%)",
      mixBlendMode: "screen",
    }}
  />
);

export const antiCheatFullMeta = {
  id: "AntiCheatFull",
  component: AntiCheatFull,
  durationInFrames: TOTAL_FRAMES,
  fps: FPS,
  width: W,
  height: H,
};
