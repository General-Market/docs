// TEMPLATE — Copy /src/shorts/_template/ to /src/shorts/your-short/
// Then: replace __TEMPLATE__ with your short ID
//
// Add your topic-specific components here.
// Each entry maps a customScenes key to a render function.

import React from "react";
import type { ShotDef } from "./types";

interface SceneProps {
  shot: ShotDef;
  globalFrameOffset: number;
}

export const SCENE_REGISTRY: Record<string, (props: SceneProps) => React.ReactNode> = {
  // Example:
  // myReveal: () => <MyRevealComponent />,
  // myScene: ({ shot }) => <My3DScene variant={shot.someField} />,
};
