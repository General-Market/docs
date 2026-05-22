// TreemapScene — 3D treemap city of Morpho risk curators. Each cell is
// an ExtrudeGeometry block: footprint = TVL, color = 7d %change along a
// diverging green↔red ramp, height = magnitude of the change.
//
// Camera is snap-and-hold (ExplorerProof pattern): wide top-down, oblique
// pan, push-in on the biggest mover, pull back wide. Two micro-motion
// sine waves ride on top so the held poses don't read as stills.

import React, { useMemo } from "react";
import { useCurrentFrame, Easing, interpolate, staticFile } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Html } from "@react-three/drei";
import * as THREE from "three";
import { CURATORS } from "./data";
import { layoutTreemap, type LaidCell } from "./layout";
import { PALETTE, pctToColor } from "./Backdrop";

const HDRI_URL = staticFile("textures/hdri/studio_small_03_1k.hdr");

const FPS = 60;
const PLANE = 14;
const LAYOUT_CANVAS = { x: 0, y: 0, w: 100, h: 100 };

// Snap-and-hold camera path. Eight beats across 30 seconds.
const BREAKPOINTS = [0, 120, 360, 720, 1020, 1320, 1620, 1800];
const SNAP_FRAMES = 36;
const EASE = Easing.bezier(0.72, 0.02, 0.18, 1.0);

function buildSnap(values: number[]): { bps: number[]; vs: number[] } {
  const bps: number[] = [];
  const vs: number[] = [];
  for (let i = 0; i < BREAKPOINTS.length; i += 1) {
    if (i === 0) {
      bps.push(BREAKPOINTS[i]);
      vs.push(values[i]);
    } else {
      bps.push(BREAKPOINTS[i] - SNAP_FRAMES, BREAKPOINTS[i]);
      vs.push(values[i - 1], values[i]);
    }
  }
  return { bps, vs };
}

function driveProp(frame: number, values: number[]): number {
  const { bps, vs } = buildSnap(values);
  return interpolate(frame, bps, vs, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
}

function roundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const cr = Math.min(r, Math.min(w, h) * 0.35);
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2 + cr, -h / 2);
  shape.lineTo(w / 2 - cr, -h / 2);
  shape.absarc(w / 2 - cr, -h / 2 + cr, cr, -Math.PI / 2, 0, false);
  shape.lineTo(w / 2, h / 2 - cr);
  shape.absarc(w / 2 - cr, h / 2 - cr, cr, 0, Math.PI / 2, false);
  shape.lineTo(-w / 2 + cr, h / 2);
  shape.absarc(-w / 2 + cr, h / 2 - cr, cr, Math.PI / 2, Math.PI, false);
  shape.lineTo(-w / 2, -h / 2 + cr);
  shape.absarc(-w / 2 + cr, -h / 2 + cr, cr, Math.PI, Math.PI * 1.5, false);
  shape.closePath();
  return shape;
}

const CELL_GAP = 0.06;
const BASE_HEIGHT = 0.18;
const PER_PCT_HEIGHT = 0.32;

function cellTransform(cell: LaidCell): {
  cx: number;
  cz: number;
  w: number;
  d: number;
  h: number;
} {
  const r = cell.rect;
  const sx = PLANE / LAYOUT_CANVAS.w;
  const sz = PLANE / LAYOUT_CANVAS.h;
  const w = Math.max(0.05, r.w * sx - CELL_GAP);
  const d = Math.max(0.05, r.h * sz - CELL_GAP);
  const cx = (r.x + r.w / 2) * sx - PLANE / 2;
  const cz = (r.y + r.h / 2) * sz - PLANE / 2;
  const pct = cell.curator.change_7d ?? 0;
  const h = BASE_HEIGHT + Math.min(15, Math.abs(pct)) * PER_PCT_HEIGHT;
  return { cx, cz, w, d, h };
}

function smoothstep(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

type CellMeshProps = {
  cell: LaidCell;
  startFrame: number;
  frame: number;
};

const CellMesh: React.FC<CellMeshProps> = ({ cell, startFrame, frame }) => {
  const { cx, cz, w, d, h } = cellTransform(cell);

  const riseT = smoothstep((frame - startFrame) / 30);
  const colorT = smoothstep((frame - startFrame - 24) / 40);
  const liveColor = useMemo(() => {
    const start = new THREE.Color(PALETTE.neutral);
    const target = new THREE.Color(pctToColor(cell.curator.change_7d));
    return start.lerp(target, colorT);
  }, [colorT, cell.curator.change_7d]);

  const geom = useMemo(() => {
    const shape = roundedRectShape(w, d, 0.07);
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: h,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.022,
      bevelThickness: 0.016,
      curveSegments: 4,
    });
    g.rotateX(-Math.PI / 2);
    g.computeVertexNormals();
    return g;
  }, [w, d, h]);

  const mat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: liveColor,
        metalness: 0.05,
        roughness: 0.5,
        envMapIntensity: 0.75,
        clearcoat: 0.35,
        clearcoatRoughness: 0.4,
      }),
    [liveColor],
  );

  const yScale = Math.max(0.001, riseT);

  return (
    <group position={[cx, 0, cz]} scale={[1, yScale, 1]}>
      <mesh geometry={geom} material={mat} castShadow receiveShadow />
    </group>
  );
};

const CellLabel: React.FC<{
  cell: LaidCell;
  frame: number;
  startFrame: number;
}> = ({ cell, frame, startFrame }) => {
  const { cx, cz, w, d, h } = cellTransform(cell);
  const tooSmall = Math.min(w, d) < 0.95;
  const tickT = smoothstep((frame - startFrame - 30) / 30);
  const pct = cell.curator.change_7d ?? 0;
  const shown = pct * tickT;
  const fadeT = smoothstep((frame - startFrame - 12) / 24);

  if (tooSmall) return null;

  const sign = shown >= 0 ? "+" : "";
  const labelColor = pct >= 0 ? "#C9F3D4" : "#FFE4E4";

  return (
    <Html
      position={[cx, h + 0.05, cz]}
      transform={false}
      occlude={false}
      pointerEvents="none"
      zIndexRange={[20, 0]}
      style={{ width: 0, height: 0 }}
    >
      <div
        style={{
          transform: "translate(-50%, -50%)",
          fontFamily: '"Inter Tight", -apple-system, sans-serif',
          color: "#FFFFFF",
          textAlign: "center",
          textShadow: "0 2px 18px rgba(0,0,0,0.85)",
          opacity: fadeT,
          whiteSpace: "nowrap",
        }}
      >
        <div
          style={{
            fontSize: Math.min(34, Math.max(18, Math.min(w, d) * 12)),
            fontWeight: 600,
            letterSpacing: "-0.018em",
            lineHeight: 1,
          }}
        >
          {cell.curator.name}
        </div>
        <div
          style={{
            fontSize: Math.min(30, Math.max(15, Math.min(w, d) * 10)),
            fontWeight: 500,
            color: labelColor,
            marginTop: 6,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "-0.01em",
          }}
        >
          {sign}
          {shown.toFixed(2)}%
        </div>
      </div>
    </Html>
  );
};

type SceneInnerProps = {
  cells: LaidCell[];
  frame: number;
  cameraPos: [number, number, number];
  cameraLook: [number, number, number];
};

const SceneInner: React.FC<SceneInnerProps> = ({
  cells,
  frame,
  cameraPos,
  cameraLook,
}) => {
  const { camera } = useThree();
  const persp = camera as THREE.PerspectiveCamera;
  persp.position.set(cameraPos[0], cameraPos[1], cameraPos[2]);
  persp.lookAt(cameraLook[0], cameraLook[1], cameraLook[2]);
  persp.fov = 36;
  persp.updateProjectionMatrix();

  const ordered = useMemo(
    () =>
      cells
        .map((c, i) => ({ c, i, area: c.rect.w * c.rect.h }))
        .sort((a, b) => b.area - a.area),
    [cells],
  );

  return (
    <>
      <Environment files={HDRI_URL} resolution={256} />
      <ambientLight intensity={0.45} color="#ffffff" />
      <directionalLight position={[-8, 14, 6]} intensity={1.1} color="#ffffff" />
      <directionalLight position={[8, 8, -4]} intensity={0.55} color="#9fb4ff" />
      <ContactShadows
        position={[0, 0, 0]}
        scale={PLANE * 1.6}
        far={8}
        blur={2.2}
        opacity={0.55}
        resolution={1024}
        color="#000000"
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
        <planeGeometry args={[PLANE * 1.8, PLANE * 1.8]} />
        <meshStandardMaterial color="#0a0d12" metalness={0.0} roughness={1.0} />
      </mesh>
      {ordered.map(({ c, i }) => (
        <CellMesh
          key={`m-${c.curator.slug}`}
          cell={c}
          startFrame={60 + i * 2}
          frame={frame}
        />
      ))}
      {ordered.map(({ c, i }) => (
        <CellLabel
          key={`l-${c.curator.slug}`}
          cell={c}
          startFrame={60 + i * 2}
          frame={frame}
        />
      ))}
    </>
  );
};

export type TreemapSceneProps = {
  width: number;
  height: number;
};

export const TreemapScene: React.FC<TreemapSceneProps> = ({ width, height }) => {
  const frame = useCurrentFrame();
  const cells = useMemo(() => layoutTreemap(CURATORS, LAYOUT_CANVAS), []);

  // Find the cell with the biggest absolute 7d move (for the push-in beat).
  const hero = useMemo(() => {
    if (cells.length === 0) return null;
    return cells.reduce((best, c) => {
      const ms = Math.abs(c.curator.change_7d ?? 0);
      const mb = Math.abs(best.curator.change_7d ?? 0);
      return ms > mb ? c : best;
    }, cells[0]);
  }, [cells]);

  const heroT = useMemo(() => {
    if (!hero) return { x: 0, z: 0 };
    const tf = cellTransform(hero);
    return { x: tf.cx, z: tf.cz };
  }, [hero]);

  // ── Camera beats ─────────────────────────────────────────────────
  //   1 0..120     fly-in from high above, looking nearly straight down
  //   2 120..360   tilt to oblique 3/4 view of full board
  //   3 360..720   gentle push across the board
  //   4 720..1020  push-in close on biggest mover
  //   5 1020..1320 pull back to a low oblique
  //   6 1320..1620 wide hero shot, full board centred
  //   7 1620..1800 hold + slow drift

  const camY = driveProp(frame, [18, 14, 12, 9, 12, 16, 16, 16]);
  const camX = driveProp(frame, [0, 0.5, 4, heroT.x + 3, 5, 0, 0, 0]);
  const camZ = driveProp(frame, [22, 18, 16, 12, 18, 22, 22, 22]);
  const lookX = driveProp(frame, [0, 0, 2.5, heroT.x, 3, 0, 0, 0]);
  const lookY = driveProp(frame, [0, 0, 0.5, 1.2, 0.5, 0, 0, 0]);
  const lookZ = driveProp(frame, [0, 0, 0, heroT.z, 0, 0, 0, 0]);

  const t = frame / FPS;
  const breathX = Math.sin((t * 2 * Math.PI) / 4.5 + 1.0) * 0.12;
  const breathY = Math.sin((t * 2 * Math.PI) / 5.2 + 0.4) * 0.06;
  const breathZ = Math.sin((t * 2 * Math.PI) / 6.0 + 2.0) * 0.10;

  const cameraPos: [number, number, number] = [
    camX + breathX,
    camY + breathY,
    camZ + breathZ,
  ];
  const cameraLook: [number, number, number] = [lookX, lookY, lookZ];

  return (
    <ThreeCanvas
      width={width}
      height={height}
      camera={{ fov: 36, near: 0.5, far: 200, position: cameraPos }}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.05,
      }}
      style={{ background: "transparent" }}
    >
      <React.Suspense fallback={null}>
        <SceneInner
          cells={cells}
          frame={frame}
          cameraPos={cameraPos}
          cameraLook={cameraLook}
        />
      </React.Suspense>
    </ThreeCanvas>
  );
};
