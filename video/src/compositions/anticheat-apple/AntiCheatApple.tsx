import React from "react";
import { AbsoluteFill, Series } from "remotion";
import { FPS, H, W, colors } from "./theme";
import { antiCheatAppleHookMeta } from "./AntiCheatHook";
import { antiCheatAppleStatMeta } from "./AntiCheatStat";
import { antiCheatAppleRiggedMeta } from "./AntiCheatRigged";
import { antiCheatAppleSolutionMeta } from "./AntiCheatSolution";
import { antiCheatAppleReassureMeta } from "./AntiCheatReassure";
import { antiCheatAppleEndCardMeta } from "./AntiCheatEndCard";

// Hook 10s + Stat 7.5s + Rigged 6s + Solution 6.5s + Reassure 6s + EndCard 5s = 41s.
// Hard cuts. No transitions. Each scene starts at the prior scene's last frame + 1.
const TOTAL_FRAMES = 1230;

const SCENES = [
  antiCheatAppleHookMeta,
  antiCheatAppleStatMeta,
  antiCheatAppleRiggedMeta,
  antiCheatAppleSolutionMeta,
  antiCheatAppleReassureMeta,
  antiCheatAppleEndCardMeta,
] as const;

export const AntiCheatApple: React.FC = () => {
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

export const antiCheatAppleMeta = {
  id: "AntiCheatApple",
  component: AntiCheatApple,
  durationInFrames: TOTAL_FRAMES,
  fps: FPS,
  width: W,
  height: H,
};
