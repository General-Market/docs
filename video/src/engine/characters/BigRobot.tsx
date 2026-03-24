import React from "react";
import { BeachCharacter } from "./BeachCharacter";
import { BIG_ROBOT_COLOR } from "./CharacterRegistry";
// ---------------------------------------------------------------------------
// Creepy RobotExpressive (for Goldman/Citadel/hedge fund phases)
// Looming behind the desk monitors
// ---------------------------------------------------------------------------

export const BigRobot: React.FC<{
  frame: number;
  fps: number;
  phase: string;
  durationFrames: number;
}> = ({ frame, fps, phase, durationFrames }) => {
  // 1.5x smaller: defeat 2.25→1.5, others 1.25→0.83
  const isDefeat = phase === "defeat";
  const isWalkIn = phase === "ambush" || phase === "memecoins";
  const scale = isDefeat ? 1.5 : 0.83;

  // Walk-in: robot starts offscreen right and walks to final position
  const finalPos: [number, number, number] = isDefeat
    ? [0, 0, -2.8]
    : [-0.5, 0, -2.5];

  const t = durationFrames > 0 ? Math.min(1, frame / durationFrames) : 1;
  const walkEase = t * t * (3 - 2 * t); // smoothstep

  let pos: [number, number, number];
  let animName = "Idle";
  if (isWalkIn) {
    // Start from far right offscreen, walk to final position
    const startX = 6;
    const startZ = -1;
    const curX = startX + (finalPos[0] - startX) * walkEase;
    const curZ = startZ + (finalPos[2] - startZ) * walkEase;
    pos = [curX, 0, curZ];
    // Switch from Walking to Idle once arrived (~80% through)
    animName = walkEase < 0.8 ? "Walking" : "Idle";
  } else {
    pos = finalPos;
  }

  // Souls boss has pulsing red eye glow; walk-in phases get red glow too
  const pulseIntensity = isDefeat
    ? 3 + Math.sin(frame * 0.08) * 2
    : isWalkIn
      ? 2 + Math.sin(frame * 0.1) * 1.5
      : 0;

  return (
    <group>
      <BeachCharacter
        frame={frame}
        fps={fps}
        position={pos}
        rotationY={isDefeat ? 0 : isWalkIn ? (Math.PI / 2) * (1 - walkEase) + 0.2 * walkEase : 0.2}
        scale={scale}
        color={isDefeat ? "#220000" : isWalkIn ? "#1a0a0a" : BIG_ROBOT_COLOR}
        animationName={animName}
      />
      {/* Red eye glow for defeat + walk-in phases */}
      {(isDefeat || isWalkIn) && (
        <>
          <pointLight
            position={[pos[0], 2.0, pos[2] + 0.8]}
            intensity={pulseIntensity}
            color="#ff0000"
            distance={6}
            decay={2}
          />
          {/* Boss health-bar style red line on ground */}
          {isDefeat && (
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -1.5]}>
              <planeGeometry args={[2.5, 0.03]} />
              <meshBasicMaterial color="#ff0033" transparent opacity={0.6 + Math.sin(frame * 0.1) * 0.3} />
            </mesh>
          )}
        </>
      )}
    </group>
  );
};
