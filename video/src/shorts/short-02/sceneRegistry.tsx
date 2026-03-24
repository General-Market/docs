import React from "react";
import type { ShotDef } from "./types";
import { AgiArenaEndScreen } from "./components/AgiArenaEndScreen";

interface SceneProps {
  shot: ShotDef;
  globalFrameOffset: number;
}

// tradingJourney is now rendered at composition level (single persistent ThreeCanvas)
// to avoid 22 WebGL context create/destroy cycles causing black-frame micro-crashes.
export const SCENE_REGISTRY: Record<string, (props: SceneProps) => React.ReactNode> = {
  agiArenaEndScreen: () => <AgiArenaEndScreen />,
};
