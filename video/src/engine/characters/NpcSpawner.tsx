import React, { useMemo } from "react";
import { mulberry32 } from "../../shorts/short-02/components/city/cityConfig";
import { SmartCharacter } from "./SmartCharacter";
import { CHAR_URLS, MODEL_BASE_SCALE, NPC_MODEL_POOL } from "./CharacterRegistry";
import { PHASE_NPC_SEEDS, NPC_COLORS, PHASE_NPC_TEMPLATES } from "./npcTemplates";

export const BackgroundNPCs: React.FC<{
  frame: number;
  fps: number;
  phase: string;
  phaseFrame?: number; // accumulated frame across same-phase shots (prevents jump on cut)
}> = ({ frame, fps, phase, phaseFrame }) => {
  const templates = PHASE_NPC_TEMPLATES[phase] ?? PHASE_NPC_TEMPLATES["forex"];
  // Use phaseFrame for position continuity across same-phase shot cuts
  const f = phaseFrame ?? frame;

  const npcs = useMemo(() => {
    const seed = PHASE_NPC_SEEDS[phase] ?? 5555;
    const rng = mulberry32(seed);
    return templates.map((t) => ({
      ...t,
      startX: -6 + rng() * 12,
      z: t.zRange[0] + rng() * (t.zRange[1] - t.zRange[0]),
      direction: rng() > 0.5 ? 1 : -1,
      color: NPC_COLORS[Math.floor(rng() * NPC_COLORS.length)],
      circleRadius: 0.8 + rng() * 1.2,
      circlePhase: rng() * Math.PI * 2,
      zigzagAmp: 0.5 + rng() * 1.0,
      zigzagFreq: 0.02 + rng() * 0.03,
      wanderSeed: Math.floor(rng() * 10000),
      frameOffset: Math.floor(rng() * 500), // stagger start so NPCs don't all begin at origin
      modelUrl: (phase === "forex-intro" || phase === "forex")
        ? CHAR_URLS["dancingGurl"]
        : NPC_MODEL_POOL[Math.floor(rng() * NPC_MODEL_POOL.length)],
    }));
  }, [phase, templates]);

  return (
    <>
      {npcs.map((npc, i) => {
        // Calculate position based on movement pattern
        let x = npc.startX;
        let z = npc.z;
        let rotY = npc.direction > 0 ? -Math.PI / 2 : Math.PI / 2;
        const spd = npc.speed * 0.015;
        // Effective frame: phaseFrame + per-NPC stagger for variety
        const ef = f + npc.frameOffset;

        if (npc.move === "walk" || npc.move === "run") {
          // Wide wrapping range (40 units) so NPCs never visibly teleport
          const raw = npc.startX + ef * spd * npc.direction;
          x = ((raw % 40) + 40) % 40 - 20;
        } else if (npc.move === "circle") {
          const angle = npc.circlePhase + ef * spd * 0.5;
          x = npc.startX + Math.cos(angle) * npc.circleRadius;
          z = npc.z + Math.sin(angle) * npc.circleRadius;
          rotY = angle + Math.PI / 2;
        } else if (npc.move === "zigzag") {
          const raw = npc.startX + ef * spd * npc.direction;
          x = ((raw % 40) + 40) % 40 - 20;
          z = npc.z + Math.sin(ef * npc.zigzagFreq) * npc.zigzagAmp;
        } else if (npc.move === "wander") {
          // Continuous Perlin-like wander using layered sine waves (no resets)
          const s = npc.wanderSeed;
          const wx = Math.sin(ef * 0.008 + s) * 1.5 + Math.sin(ef * 0.003 + s * 2.7) * 0.8;
          const wz = Math.cos(ef * 0.006 + s * 1.3) * 1.0 + Math.cos(ef * 0.0025 + s * 3.1) * 0.6;
          x = npc.startX + wx;
          z = npc.z + wz;
          // Face movement direction
          const dx = Math.cos(ef * 0.008 + s) * 0.008 * 1.5;
          const dz = -Math.sin(ef * 0.006 + s * 1.3) * 0.006 * 1.0;
          rotY = Math.atan2(dx, dz);
        }

        return (
          <SmartCharacter
            key={i}
            modelUrl={npc.modelUrl}
            frame={frame}
            fps={fps}
            position={[x, 0, z]}
            rotationY={rotY}
            scale={npc.scale}
            color={npc.color}
            animationName={npc.anim}
            baseScaleFactor={MODEL_BASE_SCALE[npc.modelUrl] ?? 0.6}
          />
        );
      })}
    </>
  );
};
