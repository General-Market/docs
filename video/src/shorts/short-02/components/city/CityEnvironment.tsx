// ---------------------------------------------------------------------------
// CityEnvironment — buildings, road, neon, palms, sky plane, road car
// Canvas-textured facades (~4 meshes/face vs ~94 individual window planes)
// ---------------------------------------------------------------------------

import React, { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { staticFile } from "remotion";
import * as THREE from "three";

import { createBuildingFacade } from "./createBuildingFacade";
import {
  mulberry32,
  BUILDINGS,
  PALM_POSITIONS,
  ROAD_CONFIG,
  type BuildingDef,
} from "./cityConfig";

// ---------------------------------------------------------------------------
// Asset URLs
// ---------------------------------------------------------------------------

const PALM_URL = staticFile("models/palm-tree.glb");
useGLTF.preload(PALM_URL);

const CAR_URL = staticFile("models/car-sedan.glb");
useGLTF.preload(CAR_URL);

// ---------------------------------------------------------------------------
// CityTower — single building with canvas-textured facades
// ---------------------------------------------------------------------------

const CityTower: React.FC<{ b: BuildingDef; idx: number }> = ({ b, idx }) => {
  const setback = b.setback ?? 0;
  const mainH = b.height * (1 - setback);
  const topH = b.height * setback;
  const halfH = b.height / 2;

  // Generate 4 face textures (one per cardinal direction, different seed offset)
  const textures = useMemo(() => {
    return [0, 1, 2, 3].map((faceId) => {
      const canvas = createBuildingFacade(
        b.seed + faceId * 100,
        b.litPct,
        b.glassColor,
        b.litColor,
        b.bodyColor,
        b.mullionColor,
      );
      const tex = new THREE.CanvasTexture(canvas);
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      return tex;
    });
  }, [b.seed, b.litPct, b.glassColor, b.litColor, b.bodyColor, b.mullionColor]);

  // Face definitions: [width, height, position offset, rotationY, textureIndex]
  const faces: [number, number, [number, number, number], number, number][] = [
    // Front face (-z)
    [b.width, mainH, [0, (b.podiumH ?? 0) + mainH / 2, -b.depth / 2 - 0.005], 0, 0],
    // Back face (+z)
    [b.width, mainH, [0, (b.podiumH ?? 0) + mainH / 2, b.depth / 2 + 0.005], Math.PI, 1],
    // Left face (-x)
    [b.depth, mainH, [-(b.width / 2) - 0.005, (b.podiumH ?? 0) + mainH / 2, 0], Math.PI / 2, 2],
    // Right face (+x)
    [b.depth, mainH, [b.width / 2 + 0.005, (b.podiumH ?? 0) + mainH / 2, 0], -Math.PI / 2, 3],
  ];

  return (
    <group position={[b.pos[0], b.pos[1], b.pos[2]]}>
      {/* Podium base */}
      {b.podiumH != null && b.podiumScale != null && (
        <mesh position={[0, b.podiumH / 2, 0]}>
          <boxGeometry args={[b.width * b.podiumScale, b.podiumH, b.depth * b.podiumScale]} />
          <meshStandardMaterial color="#a0b8c8" metalness={0.4} roughness={0.2} />
        </mesh>
      )}

      {/* Main body */}
      <mesh position={[0, (b.podiumH ?? 0) + mainH / 2, 0]}>
        <boxGeometry args={[b.width, mainH, b.depth]} />
        <meshStandardMaterial color={b.bodyColor} metalness={0.4} roughness={0.15} />
      </mesh>

      {/* Top setback section */}
      {topH > 0 && (
        <mesh position={[0, (b.podiumH ?? 0) + mainH + topH / 2, 0]}>
          <boxGeometry args={[b.width * 0.6, topH, b.depth * 0.6]} />
          <meshStandardMaterial color={b.bodyColor} metalness={0.4} roughness={0.15} />
        </mesh>
      )}

      {/* Canvas-textured facade planes (4 faces) */}
      {faces.map(([w, h, pos, rotY, texIdx]) => (
        <mesh key={texIdx} position={pos} rotation={[0, rotY, 0]}>
          <planeGeometry args={[w, h]} />
          <meshStandardMaterial
            map={textures[texIdx]}
            emissiveMap={textures[texIdx]}
            emissive={new THREE.Color("#ffffff")}
            emissiveIntensity={1.1}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* Crown: spire */}
      {b.crowned && b.crownType === "spire" && (
        <>
          <mesh position={[0, b.height + (b.podiumH ?? 0) + 1.5, 0]}>
            <cylinderGeometry args={[0.01, 0.06, 3.0, 6]} />
            <meshStandardMaterial color="#c0c8d0" roughness={0.2} metalness={0.6} />
          </mesh>
          <mesh position={[0, b.height + (b.podiumH ?? 0) + 3.0, 0]}>
            <sphereGeometry args={[0.03, 8, 6]} />
            <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={3} toneMapped={false} />
          </mesh>
        </>
      )}

      {/* Crown: antenna */}
      {b.crowned && b.crownType === "antenna" && (
        <>
          <mesh position={[0, b.height + (b.podiumH ?? 0) + 0.02, 0]}>
            <boxGeometry args={[b.width * 0.4, 0.04, b.depth * 0.4]} />
            <meshStandardMaterial color="#7a8890" roughness={0.3} metalness={0.5} />
          </mesh>
          <mesh position={[0, b.height + (b.podiumH ?? 0) + 0.6, 0]}>
            <cylinderGeometry args={[0.012, 0.025, 1.2, 6]} />
            <meshStandardMaterial color="#b0b8c0" roughness={0.2} metalness={0.6} />
          </mesh>
          <mesh position={[0, b.height + (b.podiumH ?? 0) + 1.2, 0]}>
            <sphereGeometry args={[0.035, 8, 6]} />
            <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={3} toneMapped={false} />
          </mesh>
        </>
      )}

      {/* Neon LED strip — vertical accent */}
      {b.neonAccent && (
        <mesh position={[0, halfH + (b.podiumH ?? 0), -b.depth / 2 - 0.015]}>
          <planeGeometry args={[0.03, b.height * 0.85]} />
          <meshStandardMaterial
            color={b.neonAccent}
            emissive={b.neonAccent}
            emissiveIntensity={2}
            toneMapped={false}
          />
        </mesh>
      )}
    </group>
  );
};

// ---------------------------------------------------------------------------
// RoadAndSidewalks
// ---------------------------------------------------------------------------

const RoadAndSidewalks: React.FC = () => {
  const { roadZ, roadWidth, roadLength, sidewalkOffset, sidewalkWidth } = ROAD_CONFIG;
  return (
    <group>
      {/* Road surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, roadZ]} receiveShadow>
        <planeGeometry args={[roadLength, roadWidth]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.9} metalness={0.05} />
      </mesh>
      {/* Sidewalk — beach side */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.003, roadZ - sidewalkOffset]}>
        <planeGeometry args={[roadLength, sidewalkWidth]} />
        <meshStandardMaterial color="#c0b8a8" roughness={0.85} />
      </mesh>
      {/* Sidewalk — building side */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.003, roadZ + sidewalkOffset]}>
        <planeGeometry args={[roadLength, sidewalkWidth]} />
        <meshStandardMaterial color="#c0b8a8" roughness={0.85} />
      </mesh>
    </group>
  );
};

// ---------------------------------------------------------------------------
// PalmTree
// ---------------------------------------------------------------------------

export const PalmTree: React.FC<{
  position: [number, number, number];
  seed: number;
}> = ({ position, seed }) => {
  const gltf = useGLTF(PALM_URL);

  const { cloned, yaw, s } = useMemo(() => {
    const rng = mulberry32(seed);
    const c = gltf.scene.clone(true);
    return { cloned: c, yaw: rng() * Math.PI * 2, s: 1.2 + rng() * 0.6 };
  }, [gltf.scene, seed]);

  return (
    <group position={position} rotation={[0, yaw, 0]} scale={[s, s, s]}>
      <primitive object={cloned} />
    </group>
  );
};

// ---------------------------------------------------------------------------
// SkyPlane — small airplane crossing the sky
// ---------------------------------------------------------------------------

const SkyPlane: React.FC<{ frame: number; totalFrames: number }> = ({ frame, totalFrames }) => {
  const t = frame / Math.max(1, totalFrames);
  const x = 15 - t * 30;
  const z = -8 - t * 4;
  const y = 8 + Math.sin(t * Math.PI * 2) * 0.3;

  return (
    <group position={[x, y, z]} rotation={[0, -Math.PI * 0.85, 0]}>
      <mesh>
        <cylinderGeometry args={[0.03, 0.015, 0.5, 6]} />
        <meshStandardMaterial color="#e8e8e8" roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <boxGeometry args={[0.02, 0.6, 0.12]} />
        <meshStandardMaterial color="#d8d8d8" roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0.06, -0.22]}>
        <boxGeometry args={[0.01, 0.1, 0.06]} />
        <meshStandardMaterial color="#d8d8d8" roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0, -0.22]} rotation={[0, 0, Math.PI / 2]}>
        <boxGeometry args={[0.01, 0.18, 0.05]} />
        <meshStandardMaterial color="#d8d8d8" roughness={0.4} metalness={0.3} />
      </mesh>
    </group>
  );
};

// ---------------------------------------------------------------------------
// RoadCar — background car that drives along the road
// ---------------------------------------------------------------------------

const RoadCar: React.FC<{ frame: number; totalFrames: number }> = ({ frame, totalFrames }) => {
  const t = frame / Math.max(1, totalFrames);
  const x = 18 - t * 30;
  const gltf = useGLTF(CAR_URL);
  const cloned = useMemo(() => {
    const c = gltf.scene.clone(true);
    c.traverse((child: THREE.Object3D) => {
      const m = child as THREE.Mesh;
      if (m.isMesh && m.material) {
        const mat = m.material as THREE.MeshStandardMaterial;
        if (mat.isMeshStandardMaterial && !mat.transparent && mat.opacity > 0.9) {
          const hsl = { h: 0, s: 0, l: 0 };
          mat.color.getHSL(hsl);
          if (hsl.l < 0.75 && hsl.s < 0.8) {
            const newMat = mat.clone();
            newMat.color.set("#cc2222");
            m.material = newMat;
          }
        }
      }
    });
    return c;
  }, [gltf.scene]);

  if (x < -12 || x > 18) return null;

  return (
    <group position={[x, 0.01, 3.8]} rotation={[0, -Math.PI / 2, 0]} scale={[0.7, 0.7, 0.7]}>
      <primitive object={cloned} />
    </group>
  );
};

// ---------------------------------------------------------------------------
// CityEnvironment — single composite export
// ---------------------------------------------------------------------------

export const CityEnvironment: React.FC<{
  isDark: boolean;
  frame: number;
  totalFrames: number;
  hasDesk: boolean;
}> = ({ isDark, frame, totalFrames, hasDesk }) => {
  return (
    <>
      {/* Buildings */}
      {BUILDINGS.map((b, i) => (
        <CityTower key={`bld-${i}`} b={b} idx={i} />
      ))}

      {/* Road + sidewalks */}
      <RoadAndSidewalks />


      {/* Palm trees */}
      {PALM_POSITIONS.map((p, i) => (
        <PalmTree key={`palm-${i}`} position={p.pos} seed={p.seed} />
      ))}

      {/* Small airplane */}
      <SkyPlane frame={frame} totalFrames={totalFrames} />

      {/* Background road car (desk phases only) */}
      {hasDesk && <RoadCar frame={frame} totalFrames={totalFrames} />}
    </>
  );
};
