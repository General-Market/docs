import React from "react";
import { MixamoCharacter } from "./MixamoCharacter";
import { GenericCharacter } from "./GenericCharacter";
import { ANIM_TO_FBX, CHAR_AVAILABLE_FBX, FBX_FALLBACKS } from "./CharacterRegistry";

// ---------------------------------------------------------------------------
// SmartCharacter — auto-routes to MixamoCharacter (FBX) or GenericCharacter (Soldier retarget)
// Only uses MixamoCharacter when the specific FBX file is available for the character
// ---------------------------------------------------------------------------

export const SmartCharacter: React.FC<{
  modelUrl: string;
  frame: number;
  fps?: number;
  position: [number, number, number];
  rotationY?: number;
  scale?: number;
  color?: string;
  animationName?: string;
  baseScaleFactor?: number;
}> = (props) => {
  const { modelUrl, animationName = "Idle", ...rest } = props;
  const fbxName = ANIM_TO_FBX[animationName] ?? animationName.toLowerCase();
  const available = CHAR_AVAILABLE_FBX[modelUrl];

  // Check if primary FBX is available
  const hasFBX = (name: string) => available === "all" || (available instanceof Set && available.has(name));

  let resolvedFBX = fbxName;
  if (!hasFBX(fbxName)) {
    // Try fallback chain before resorting to Soldier retarget
    const fallbacks = FBX_FALLBACKS[fbxName];
    const found = fallbacks?.find((f) => hasFBX(f));
    if (found) {
      resolvedFBX = found;
    } else if (!available) {
      // No FBX support at all → Soldier fallback
      return (
        <GenericCharacter
          modelUrl={modelUrl}
          animationName={animationName}
          {...rest}
        />
      );
    } else {
      // Has FBX support but none matched → use idle as last resort
      resolvedFBX = hasFBX("idle") ? "idle" : fbxName;
    }
  }

  if (hasFBX(resolvedFBX)) {
    return (
      <MixamoCharacter
        modelUrl={modelUrl}
        animName={resolvedFBX}
        stripRootMotion
        {...rest}
      />
    );
  }
  return (
    <GenericCharacter
      modelUrl={modelUrl}
      animationName={animationName}
      {...rest}
    />
  );
};
