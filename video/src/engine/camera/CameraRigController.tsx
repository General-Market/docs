import React from "react";
import { useThree, useFrame } from "@react-three/fiber";
import type { CameraRig } from "../types/camera";
import { applyOrbit } from "./behaviors/orbit";
import { applyDolly } from "./behaviors/dolly";
import { applyShake } from "./behaviors/shake";
import { applyDutchTilt } from "./behaviors/dutchTilt";
import { applyCrane } from "./behaviors/crane";
import { applyBreathe } from "./behaviors/breathe";
import { applySway } from "./behaviors/sway";
import { applyPulseRadius } from "./behaviors/pulseRadius";

export const CameraRigController: React.FC<{
  rig: CameraRig;
  frame: number;
  durationFrames: number;
  phaseFrame?: number;
  phaseDurationFrames?: number;
}> = ({ rig, frame, durationFrames, phaseFrame, phaseDurationFrames }) => {
  const { camera } = useThree();

  useFrame(() => {
    const f = phaseFrame ?? frame;
    const dur = phaseDurationFrames ?? durationFrames;
    const t = Math.min(1, f / Math.max(1, dur));
    const ease = t * t * (3 - 2 * t); // smoothstep

    // Start with zero position — behaviors add to this
    let posX = 0;
    let posY = 0;
    let posZ = 0;
    let dutchTilt = 0;

    // Track if we got a base position from orbit/dolly/static
    let hasBase = false;

    for (const b of rig.behaviors) {
      switch (b.type) {
        case "orbit": {
          const p = applyOrbit(b, ease, f);
          posX += p.x;
          posY += p.y;
          posZ += p.z;
          hasBase = true;
          break;
        }
        case "dolly": {
          const p = applyDolly(b, ease, f);
          posX += p.x;
          posY += p.y;
          posZ += p.z;
          hasBase = true;
          break;
        }
        case "static": {
          posX += b.position[0];
          posY += b.position[1];
          posZ += b.position[2];
          hasBase = true;
          break;
        }
        case "shake": {
          const s = applyShake(b, ease, f);
          posX += s.dx;
          posY += s.dy;
          posZ += s.dz;
          break;
        }
        case "dutchTilt": {
          dutchTilt += applyDutchTilt(b, ease, f);
          break;
        }
        case "crane": {
          posY += applyCrane(b, ease, f);
          break;
        }
        case "breathe": {
          posY += applyBreathe(b, ease, f);
          break;
        }
        case "sway": {
          posX += applySway(b, ease, f);
          break;
        }
        case "pulseRadius": {
          // Modifies the orbit radius — applied additively to Z
          const r = applyPulseRadius(b, ease, f);
          // This needs to work with orbit — for now add to radius via Z
          posZ += r;
          break;
        }
        case "follow": {
          // Follow is resolved by SceneRenderer which provides entity positions
          // For now, offset only
          if (b.offset) {
            posX += b.offset[0];
            posY += b.offset[1];
            posZ += b.offset[2];
          }
          break;
        }
      }
    }

    // Fallback if no base position behavior was provided
    if (!hasBase) {
      posX += 1.3;
      posY += 1.5;
      posZ += 3.0;
    }

    camera.position.set(posX, posY, posZ);

    // Compute lookAt
    let lookX = 0;
    let lookY = 1.2;
    let lookZ = 0;

    if (Array.isArray(rig.lookAt)) {
      [lookX, lookY, lookZ] = rig.lookAt;
    }

    // Apply lookAt drift if specified
    if (rig.lookAtDrift) {
      if (rig.lookAtDrift.x) {
        lookX = rig.lookAtDrift.x[0] + ease * (rig.lookAtDrift.x[1] - rig.lookAtDrift.x[0]);
      }
      if (rig.lookAtDrift.y) {
        lookY = rig.lookAtDrift.y[0] + ease * (rig.lookAtDrift.y[1] - rig.lookAtDrift.y[0]);
      }
      if (rig.lookAtDrift.z) {
        lookZ = rig.lookAtDrift.z[0] + ease * (rig.lookAtDrift.z[1] - rig.lookAtDrift.z[0]);
      }
    }

    camera.lookAt(lookX, lookY, lookZ);

    // Dutch tilt — applied AFTER lookAt
    camera.rotation.z = dutchTilt;
  });

  return null;
};
