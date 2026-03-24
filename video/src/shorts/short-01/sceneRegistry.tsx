import React from "react";
import type { ShotDef } from "./types";
import { CrunchyrollReveal } from "./components/CrunchyrollReveal";
import { TradingFloor3D } from "./components/TradingFloor3D";
import { MoneyExplosion3D } from "./components/MoneyExplosion3D";
import { SneakyCEO } from "./components/SneakyCEO";
import { FandomScroll } from "./components/FandomScroll";
import { CrowdVisualization3D } from "./components/CrowdVisualization3D";
import { shots as allShots } from "./shots";
import { secondsToFrame } from "../../lib/utils/frameConvert";

// Pre-compute frame offset where fandom scroll starts (first shot with fandomScroll)
const FANDOM_START_FRAME = (() => {
  let offset = 0;
  for (const s of allShots) {
    if (s.fandomScroll) return offset;
    offset += secondsToFrame(s.durationSeconds);
  }
  return offset;
})();

interface SceneProps {
  shot: ShotDef;
  globalFrameOffset: number;
}

export const SCENE_REGISTRY: Record<string, (props: SceneProps) => React.ReactNode> = {
  crunchyrollReveal: () => <CrunchyrollReveal />,
  tradingFloor: () => <TradingFloor3D />,
  moneyExplosion: () => <MoneyExplosion3D />,
  sneakyCEO: ({ shot }) => <SneakyCEO delay={shot.chibiDelay || 10} />,
  fandomScroll: ({ globalFrameOffset }) => (
    <FandomScroll globalFrameOffset={globalFrameOffset - FANDOM_START_FRAME} />
  ),
  crowdVisualization: ({ shot }) => (
    <CrowdVisualization3D variant="growing" hideCounter={!!shot.dataCallout} />
  ),
};
