// Source: https://codepen.io/soju22/full/MYgbRwg
import React, { useMemo } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

const loadMontserrat = () => {
  const link = document.createElement("link");
  link.href =
    "https://fonts.googleapis.com/css2?family=Montserrat:wght@700;900&display=swap";
  link.rel = "stylesheet";
  if (!document.head.querySelector('link[href*="Montserrat"]')) {
    document.head.appendChild(link);
  }
};

// ── Config ──

const HEX_N = 20;
const LIGHT1_COLOR = 0xffffff;
const LIGHT1_Z = 5;
const LIGHT2_COLOR = 0xff0000;
const LIGHT2_Z = -20;
const COLORS = [0x0000ff, 0x202020, 0xffffff];
const METALNESS = 0.8;
const ROUGHNESS = 0.5;
const CLEARCOAT = 1;
const CLEARCOAT_ROUGHNESS = 0.1;
const TIME_COEF = 1;
const DEPTH_SCALE = 1;
const TILT_ROTATION_X = 0.15;
const TILT_ROTATION_Y = 0.15;

const RADIUS = 50 / HEX_N;
const NX = HEX_N;
const NY = HEX_N;

// ── Hex lathe geometry (6-segment = hexagonal prism) ──

function createHexGeometry(): THREE.LatheGeometry {
  const segments = 6;
  const height = 5 * RADIUS;
  const cornerR = 0.125 * RADIUS;
  const cornerRZ = 0.125 * RADIUS;
  const cornerSteps = 6;

  const points: THREE.Vector2[] = [];
  points.push(new THREE.Vector2(RADIUS, -height / 2));
  for (let i = 0; i < cornerSteps; i++) {
    const t = i / (cornerSteps - 1);
    const x = RADIUS - cornerR + Math.cos((t * Math.PI) / 2) * cornerR;
    const z = height / 2 - cornerRZ + Math.sin((t * Math.PI) / 2) * cornerRZ;
    points.push(new THREE.Vector2(x, z));
  }
  points.push(new THREE.Vector2(0, height / 2));

  const geo = new THREE.LatheGeometry(points, segments);
  geo.translate(0, -height / 2, 0);
  geo.rotateX(Math.PI / 2);
  return geo;
}

// ── Precomputed tile data ──

interface TileData {
  x: number;
  y: number;
  color: THREE.Color;
  phase: number;
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

function getColorAt(colors: number[], t: number): THREE.Color {
  const cArr = colors.map((c) => new THREE.Color(c));
  const n = Math.max(0, Math.min(1, t)) * (cArr.length - 1);
  const i = Math.floor(n);
  if (i >= cArr.length - 1) return cArr[cArr.length - 1].clone();
  const f = n - i;
  const a = cArr[i];
  const b = cArr[i + 1];
  return new THREE.Color(
    a.r + f * (b.r - a.r),
    a.g + f * (b.g - a.g),
    a.b + f * (b.b - a.b),
  );
}

function computeTiles(): TileData[] {
  const spacing = Math.cos(Math.PI / 6) * RADIUS * 2;
  const rowH = 1.5 * RADIUS;
  const ox = (-NX / 2) * spacing + spacing / 4;
  const oy = (-NY / 2) * rowH + rowH / 2;

  const colorRng = seededRandom(123);
  const phaseRng = seededRandom(42);
  const tiles: TileData[] = [];

  for (let col = 0; col < NX; col++) {
    for (let row = 0; row < NY; row++) {
      tiles.push({
        x: ox + col * spacing + ((row % 2) / 2) * spacing,
        y: oy + row * rowH,
        color: getColorAt(COLORS, colorRng()),
        phase: (phaseRng() - 0.5) * 2 * Math.PI,
      });
    }
  }
  return tiles;
}

// ── Individual hex tile ──

const HexTile: React.FC<{
  tile: TileData;
  geometry: THREE.LatheGeometry;
  material: THREE.MeshPhysicalMaterial;
  time: number;
  cursorX: number;
  cursorY: number;
  scaleFactor: number;
}> = ({ tile, geometry, material, time, cursorX, cursorY, scaleFactor }) => {
  const worldX = tile.x * scaleFactor;
  const worldY = tile.y * scaleFactor;
  const dx = worldX - cursorX;
  const dy = worldY - cursorY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  const maxDist = 20 * RADIUS * scaleFactor;
  const t = Math.max(0, Math.min(1, dist / maxDist));
  const proximity = 1 - t * t * (3 - 2 * t);

  const depth =
    0.5 *
    (Math.cos(tile.phase + time * TIME_COEF) - 1) *
    RADIUS *
    DEPTH_SCALE *
    proximity;

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

// ── Scene ──

const HexGridScene: React.FC<{
  time: number;
  pointerX: number;
  pointerY: number;
}> = ({ time, pointerX, pointerY }) => {
  const { size: threeSize } = useThree();

  const hexGeo = useMemo(() => createHexGeometry(), []);
  const tiles = useMemo(() => computeTiles(), []);

  // One material per distinct color
  const materials = useMemo(() => {
    const map = new Map<string, THREE.MeshPhysicalMaterial>();
    for (const tile of tiles) {
      const key = tile.color.getHexString();
      if (!map.has(key)) {
        map.set(
          key,
          new THREE.MeshPhysicalMaterial({
            color: tile.color,
            metalness: METALNESS,
            roughness: ROUGHNESS,
            clearcoat: CLEARCOAT,
            clearcoatRoughness: CLEARCOAT_ROUGHNESS,
            side: THREE.FrontSide,
          }),
        );
      }
    }
    return map;
  }, [tiles]);

  const aspect = threeSize.width / threeSize.height;
  const cameraZ = 100;
  const fov = 50;
  const vFov = (fov * Math.PI) / 180;
  const wHeight = 2 * Math.tan(vFov / 2) * cameraZ;
  const wWidth = wHeight * aspect;

  const scaleFactor =
    aspect > 1 ? (wWidth / 100) * 1.4 : (wHeight / 100) * 1.4;

  // Pointer to world-space
  const targetX = (pointerX * wWidth) / 2;
  const targetY = (pointerY * wHeight) / 2;

  // Tilt toward cursor
  const tiltX = -pointerY * TILT_ROTATION_X;
  const tiltY = pointerX * TILT_ROTATION_Y;

  return (
    <>
      <pointLight
        color={LIGHT1_COLOR}
        intensity={8}
        decay={0}
        position={[targetX, targetY, LIGHT1_Z]}
      />
      <pointLight
        color={LIGHT2_COLOR}
        intensity={3}
        decay={0}
        position={[targetX, targetY, LIGHT2_Z]}
      />
      <ambientLight intensity={0.3} />

      <group
        scale={[scaleFactor, scaleFactor, 1]}
        rotation={[tiltX, tiltY, 0]}
      >
        {tiles.map((tile, i) => (
          <HexTile
            key={i}
            tile={tile}
            geometry={hexGeo}
            material={materials.get(tile.color.getHexString())!}
            time={time}
            cursorX={targetX}
            cursorY={targetY}
            scaleFactor={scaleFactor}
          />
        ))}
      </group>

      {/* No environment — original uses point lights only, alpha shows CSS gradient */}
    </>
  );
};

// ── Main ──

export const ParticleWave: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  useMemo(() => {
    if (typeof document !== "undefined") loadMontserrat();
  }, []);

  const time = frame / fps;

  const pointerX = Math.sin(time * 0.4) * Math.cos(time * 0.25) * 0.6;
  const pointerY = Math.sin(time * 0.3) * 0.5;

  const introOpacity = interpolate(frame, [0, Math.floor(fps * 1.5)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const textOpacity = interpolate(frame, [30, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(0,0,0,0.5) 200%)",
      }}
    >
      <div style={{ width: "100%", height: "100%", opacity: introOpacity }}>
        <ThreeCanvas
          width={width}
          height={height}
          camera={{ position: [0, 0, 100], fov: 50 }}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: "high-performance",
            toneMapping: THREE.NoToneMapping,
          }}
          shadows
          style={{ width: "100%", height: "100%" }}
        >
          <HexGridScene
            time={time}
            pointerX={pointerX}
            pointerY={pointerY}
          />
        </ThreeCanvas>
      </div>

      {/* Text overlay */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          opacity: textOpacity,
        }}
      >
        <div
          style={{
            fontFamily: "Montserrat, sans-serif",
            fontWeight: 900,
            fontSize: 72,
            color: "#ffffff",
            textTransform: "uppercase" as const,
            letterSpacing: 8,
            textShadow: "0 2px 20px rgba(0,0,0,0.5)",
            lineHeight: 1.1,
            textAlign: "center" as const,
          }}
        >
          Hexagonal
        </div>
        <div
          style={{
            fontFamily: "Montserrat, sans-serif",
            fontWeight: 700,
            fontSize: 72,
            color: "#ffffff",
            textTransform: "uppercase" as const,
            letterSpacing: 8,
            textShadow: "0 2px 20px rgba(0,0,0,0.5)",
            lineHeight: 1.1,
            textAlign: "center" as const,
          }}
        >
          Grid
        </div>
      </div>
    </AbsoluteFill>
  );
};
