// Reusable hex grid forked from compositions/backgrounds/webgl-picks/ParticleWave.tsx.
// Scene-level: renders inside a parent <ThreeCanvas>. Drop two of these in one
// canvas to build side-by-side comparisons (GM vs everything else).

import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";

export interface GMGridProps {
  cols: number;
  rows: number;
  fillRatio: number;
  activeColor: string;
  inactiveColor: string;
  pulseFreq: number;
  pulseAmplitude?: number;
  categoryIndex?: number;
  scale?: number;
  position?: [number, number, number];
  seed?: number;
}

interface TileData {
  x: number;
  y: number;
  phase: number;
  active: boolean;
  noise: number;
}

// Mulberry32 — deterministic, tiny, good enough for layout seeding.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Hex prism via lathe — same recipe as ParticleWave, exposed so radius scales
// with the grid dimensions rather than a global HEX_N.
function createHexGeometry(radius: number): THREE.LatheGeometry {
  const segments = 6;
  const height = 5 * radius;
  const cornerR = 0.125 * radius;
  const cornerRZ = 0.125 * radius;
  const cornerSteps = 6;

  const points: THREE.Vector2[] = [];
  points.push(new THREE.Vector2(radius, -height / 2));
  for (let i = 0; i < cornerSteps; i++) {
    const t = i / (cornerSteps - 1);
    const x = radius - cornerR + Math.cos((t * Math.PI) / 2) * cornerR;
    const z = height / 2 - cornerRZ + Math.sin((t * Math.PI) / 2) * cornerRZ;
    points.push(new THREE.Vector2(x, z));
  }
  points.push(new THREE.Vector2(0, height / 2));

  const geo = new THREE.LatheGeometry(points, segments);
  geo.translate(0, -height / 2, 0);
  geo.rotateX(Math.PI / 2);
  return geo;
}

function computeTiles(
  cols: number,
  rows: number,
  radius: number,
  fillRatio: number,
  seed: number,
): TileData[] {
  const spacing = Math.cos(Math.PI / 6) * radius * 2;
  const rowH = 1.5 * radius;
  const ox = (-cols / 2) * spacing + spacing / 4;
  const oy = (-rows / 2) * rowH + rowH / 2;

  const activeRng = mulberry32(seed);
  const phaseRng = mulberry32(seed + 17);
  const noiseRng = mulberry32(seed + 101);

  const tiles: TileData[] = [];
  const clampedFill = Math.max(0, Math.min(1, fillRatio));

  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      tiles.push({
        x: ox + col * spacing + ((row % 2) / 2) * spacing,
        y: oy + row * rowH,
        phase: (phaseRng() - 0.5) * 2 * Math.PI,
        active: activeRng() < clampedFill,
        noise: noiseRng(),
      });
    }
  }
  return tiles;
}

interface HexTileProps {
  tile: TileData;
  geometry: THREE.LatheGeometry;
  material: THREE.MeshPhysicalMaterial;
  radius: number;
  time: number;
  pulseFreq: number;
  pulseAmplitude: number;
}

const HexTile: React.FC<HexTileProps> = ({
  tile,
  geometry,
  material,
  radius,
  time,
  pulseFreq,
  pulseAmplitude,
}) => {
  const depth = tile.active
    ? Math.cos(tile.phase + time * pulseFreq * 2 * Math.PI) *
      pulseAmplitude *
      radius *
      2
    : 0;

  return (
    <mesh
      geometry={geometry}
      material={material}
      position={[tile.x, tile.y, depth]}
      castShadow
      receiveShadow
    />
  );
};

export const GMGrid: React.FC<GMGridProps> = ({
  cols,
  rows,
  fillRatio,
  activeColor,
  inactiveColor,
  pulseFreq,
  pulseAmplitude = 0.3,
  categoryIndex,
  scale = 1,
  position = [0, 0, 0],
  seed = 1,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const time = frame / fps;

  // Radius sized so the rectangle roughly fills a 100-unit tall viewport,
  // matching ParticleWave's camera at z=100 / fov=50. Parent can rescale.
  const radius = useMemo(() => 50 / Math.max(cols, rows), [cols, rows]);

  const geometry = useMemo(() => createHexGeometry(radius), [radius]);

  const tiles = useMemo(
    () => computeTiles(cols, rows, radius, fillRatio, seed),
    [cols, rows, radius, fillRatio, seed],
  );

  // Build one material per unique color. When categoryIndex is set, each
  // column gets its own hue — the diagonal sweep emerges as the caller
  // animates categoryIndex across frames.
  const { activeMaterial, inactiveMaterial, categoryMaterials } = useMemo(() => {
    const inactive = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(inactiveColor),
      metalness: 0.8,
      roughness: 0.5,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      side: THREE.FrontSide,
    });

    const active = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(activeColor),
      metalness: 0.8,
      roughness: 0.5,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      side: THREE.FrontSide,
    });

    const perColumn: THREE.MeshPhysicalMaterial[] = [];
    if (categoryIndex !== undefined) {
      for (let col = 0; col < cols; col++) {
        const hue = (((categoryIndex * 360) / 14) + col * 5) % 360;
        perColumn.push(
          new THREE.MeshPhysicalMaterial({
            color: new THREE.Color(`hsl(${Math.round(hue)}, 70%, 55%)`),
            metalness: 0.8,
            roughness: 0.5,
            clearcoat: 1,
            clearcoatRoughness: 0.1,
            side: THREE.FrontSide,
          }),
        );
      }
    }

    return {
      activeMaterial: active,
      inactiveMaterial: inactive,
      categoryMaterials: perColumn,
    };
  }, [activeColor, inactiveColor, categoryIndex, cols]);

  // Resolve which material each tile uses. We derive col from the tile index
  // since tiles are generated col-major above.
  const tilesWithMaterial = useMemo(() => {
    return tiles.map((tile, i) => {
      const col = Math.floor(i / rows);
      let mat: THREE.MeshPhysicalMaterial;
      if (!tile.active) {
        mat = inactiveMaterial;
      } else if (categoryIndex !== undefined) {
        mat = categoryMaterials[col] ?? activeMaterial;
      } else {
        mat = activeMaterial;
      }
      return { tile, material: mat };
    });
  }, [
    tiles,
    rows,
    categoryIndex,
    categoryMaterials,
    activeMaterial,
    inactiveMaterial,
  ]);

  return (
    <group position={position} scale={[scale, scale, scale]}>
      {tilesWithMaterial.map(({ tile, material }, i) => (
        <HexTile
          key={i}
          tile={tile}
          geometry={geometry}
          material={material}
          radius={radius}
          time={time}
          pulseFreq={pulseFreq}
          pulseAmplitude={pulseAmplitude}
        />
      ))}
    </group>
  );
};
