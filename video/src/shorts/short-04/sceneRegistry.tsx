import React from "react";
import type { ShotDef } from "./types";

interface SceneProps {
  shot: ShotDef;
  globalFrameOffset: number;
}

// terrainWalker is rendered at composition level (single persistent ThreeCanvas)
export const SCENE_REGISTRY: Record<string, (props: SceneProps) => React.ReactNode> = {};
