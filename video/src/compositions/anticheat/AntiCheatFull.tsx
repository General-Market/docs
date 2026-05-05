import React from "react";
import { AbsoluteFill, Series } from "remotion";
import { FPS, H, W, colors } from "./theme";
import { antiCheatHookMeta } from "./AntiCheatHook";
import { antiCheatStatMeta, antiCheatBarsMeta } from "./AntiCheatStat";
import { antiCheatRiggedMeta } from "./AntiCheatRigged";
import { antiCheatSolutionMeta } from "./AntiCheatSolution";
import { antiCheatReassureMeta } from "./AntiCheatReassure";
import { antiCheatEndCardMeta } from "./AntiCheatEndCard";

// Hook 9.5s + Bars 3.5s + Rigged 5.5s + Stat 4s + Solution 5.5s + Reassure 4.5s + EndCard 3.5s = 36s.
// The bar chart sits right after the Hook so the audience meets the data
// before the proof. The 0.01% / 70% concentration numbers reinforce the
// verdict immediately after "is rigged." lands, so the closing third of
// the film is anchored in extraction-as-fact, not extraction-as-claim.
//
// Hard cuts. No transitions. Each scene starts at the prior scene's
// last frame + 1.
const SCENES = [
  antiCheatHookMeta,
  antiCheatBarsMeta,
  antiCheatRiggedMeta,
  antiCheatStatMeta,
  antiCheatSolutionMeta,
  antiCheatReassureMeta,
  antiCheatEndCardMeta,
] as const;

const TOTAL_FRAMES = SCENES.reduce(
  (sum, s) => sum + s.durationInFrames,
  0,
);

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
