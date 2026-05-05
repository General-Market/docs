import React from "react";
import { AbsoluteFill, Series } from "remotion";
import { FPS, H, W, colors } from "./theme";
import { antiCheatHookMeta } from "./AntiCheatHook";
import { antiCheatStatMeta } from "./AntiCheatStat";
import { antiCheatRiggedMeta } from "./AntiCheatRigged";
import { antiCheatSolutionMeta } from "./AntiCheatSolution";
import { antiCheatReassureMeta } from "./AntiCheatReassure";
import { antiCheatEndCardMeta } from "./AntiCheatEndCard";

// Hook 9.5s + Stat 10.5s + Rigged 5.5s + Solution 5.5s + Reassure 4.5s + EndCard 3.5s = 39s.
// Stat now contains the crowd dezoom that used to be a separate scene.
// Hard cuts. No transitions. Each scene starts at the prior scene's last frame + 1.
const TOTAL_FRAMES = 1170;

const SCENES = [
  antiCheatHookMeta,
  antiCheatStatMeta,
  antiCheatRiggedMeta,
  antiCheatSolutionMeta,
  antiCheatReassureMeta,
  antiCheatEndCardMeta,
] as const;

export const AntiCheatFull: React.FC = () => {
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

export const antiCheatFullMeta = {
  id: "AntiCheatFull",
  component: AntiCheatFull,
  durationInFrames: TOTAL_FRAMES,
  fps: FPS,
  width: W,
  height: H,
};
