import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { DeviceBroll } from "../../lib/DeviceBroll";
import { CoinsBackground } from "./CoinsBackground";
import { SideTexts } from "./SideTexts";
import { EndCard } from "./EndCard";

export type ExplorerProofProps = {
  brollPath: string;
};

// Drop the screen recording of /explorer at:
//   video/public/broll/explorer-broll.mp4
// Until then the studio falls back to an existing broll so the camera
// moves and 3D coins remain previewable.
const DEFAULT_BROLL_PATH = "broll/explorer-broll.mp4";
const FALLBACK_BROLL_PATH = "broll/glacier-drone.mp4";

const BREAKPOINTS = [0, 300, 540, 780, 1020, 1260, 1500, 1740, 1980, 2100];

const EASE = Easing.bezier(0.4, 0, 0.6, 1);

const driveProp = (frame: number, values: number[]) =>
  interpolate(frame, BREAKPOINTS, values, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });

export const ExplorerProof: React.FC<ExplorerProofProps> = ({ brollPath }) => {
  const frame = useCurrentFrame();
  const resolvedBroll = staticFile(brollPath);

  // Camera zoom across the 9 beats.
  const zoom = driveProp(frame, [
    0.85, 1.15, 1.25, 1.25, 0.9, 0.9, 1.35, 0.85, 1.1, 1.1,
  ]);

  // Phone vertical position — up on beat 3, down on beat 4.
  const phoneY = driveProp(frame, [
    2.5, 2.5, 2.8, 2.2, 2.5, 2.5, 2.5, 2.5, 2.5, 2.5,
  ]);

  // Phone tilt on X (forward/back).
  const phoneRotX = driveProp(frame, [
    0, 0, -0.12, 0.12, 0, 0, 0, 0, 0, 0,
  ]);

  // Phone yaw on Y — slight right turn on beat 6.
  const phoneRotY = driveProp(frame, [
    0, 0, 0, 0, 0, 0.18, 0, 0, 0, 0,
  ]);

  // Phone scale — pushes slightly during close-ups.
  const phoneScale = driveProp(frame, [
    1.0, 1.05, 1.05, 1.05, 1.0, 1.0, 1.05, 1.0, 1.0, 1.0,
  ]);

  // Coin field — recedes when we zoom in, blooms when we pull back.
  const coinsForward = driveProp(frame, [
    0.9, 0.3, 0.2, 0.2, 0.8, 0.85, 0.15, 0.95, 0.3, 0.3,
  ]);

  const coinsOpacity = driveProp(frame, [
    1.0, 0.7, 0.6, 0.6, 1.0, 1.0, 0.5, 1.0, 1.0, 1.0,
  ]);

  // Side texts dim during close-ups.
  const sideTextsVis = driveProp(frame, [
    1.0, 0.8, 0.7, 0.7, 1.0, 1.0, 0.6, 1.0, 0.5, 0.5,
  ]);

  // End card crossfade over the last two seconds.
  const endCardProg = interpolate(frame, [2040, 2100], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });

  return (
    <AbsoluteFill style={{ background: "#E0D8EC" }}>
      <DeviceBroll
        device="phone"
        broll={resolvedBroll}
        brollAspect={9 / 19.5}
        position={[-3, phoneY, 0]}
        rotation={[phoneRotX, phoneRotY, 0]}
        scale={phoneScale}
        camera={{ zoom }}
        width={1920}
        height={1080}
        background={
          <CoinsBackground
            forwardProgress={coinsForward}
            opacity={coinsOpacity}
            width={1920}
            height={1080}
          />
        }
      />
      <SideTexts visibility={sideTextsVis} />
      <EndCard progress={endCardProg} />
    </AbsoluteFill>
  );
};

export const explorerProofMeta = {
  id: "ExplorerProof",
  component: ExplorerProof,
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 2100,
  defaultProps: { brollPath: FALLBACK_BROLL_PATH } as ExplorerProofProps,
};
