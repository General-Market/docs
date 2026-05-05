import React from "react";
import { AbsoluteFill, Series } from "remotion";
import { FPS, H, W, colors } from "./theme";
import { antiCheatPitchHookMeta } from "./AntiCheatPitchHook";
import { antiCheatPitchStatMeta } from "./AntiCheatPitchStat";
import { antiCheatPitchRiggedMeta } from "./AntiCheatPitchRigged";
import { antiCheatPitchSolutionMeta } from "./AntiCheatPitchSolution";
import { antiCheatPitchReassureMeta } from "./AntiCheatPitchReassure";
import { antiCheatPitchEndCardMeta } from "./AntiCheatPitchEndCard";

// Hook 10s + Stat 7.5s + Rigged 6s + Solution 6.5s + Reassure 6s + EndCard 5s = 41s.
// Hard cuts. No transitions. Each scene starts at the prior scene's last frame + 1.
const TOTAL_FRAMES = 1230;

const SCENES = [
  antiCheatPitchHookMeta,
  antiCheatPitchStatMeta,
  antiCheatPitchRiggedMeta,
  antiCheatPitchSolutionMeta,
  antiCheatPitchReassureMeta,
  antiCheatPitchEndCardMeta,
] as const;

export const AntiCheatPitchFull: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg }}>
      <Series>
        {SCENES.map((scene) => {
          const Comp = scene.component;
          return (
            <Series.Sequence
              key={scene.id}
              durationInFrames={scene.durationInFrames}
            >
              <Comp />
            </Series.Sequence>
          );
        })}
      </Series>
    </AbsoluteFill>
  );
};

export const antiCheatPitchFullMeta = {
  id: "AntiCheatPitchFull",
  component: AntiCheatPitchFull,
  durationInFrames: TOTAL_FRAMES,
  fps: FPS,
  width: W,
  height: H,
};
