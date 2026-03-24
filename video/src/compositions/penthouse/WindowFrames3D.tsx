import React from "react";
import * as THREE from "three";

// ══════════════════════════════════════════════════════════════════════════════
// WindowFrames3D — Panoramic corner window system (back wall + right wall)
// ══════════════════════════════════════════════════════════════════════════════

// ── Constants ────────────────────────────────────────────────────────────────

const FRAME_COLOR = "#060810";
const FRAME_ROUGHNESS = 0.2;
const FRAME_METALNESS = 0.7;

// Back wall dimensions (matching existing scene)
const BACK_Z = -2.75;
const BACK_LEFT = -3.3;
const BACK_RIGHT = 3.3;
const BACK_WIDTH = BACK_RIGHT - BACK_LEFT; // 6.6 total

// Right wall dimensions
const RIGHT_X = 3.3;
const RIGHT_FRONT_Z = 1.0; // how far forward the right wall extends
const RIGHT_BACK_Z = BACK_Z; // connects to back wall at corner
const RIGHT_DEPTH = RIGHT_FRONT_Z - RIGHT_BACK_Z; // ~3.75

// Vertical extents
const SILL_Y = 0.15;
const TOP_Y = 3.9;
const WINDOW_HEIGHT = TOP_Y - SILL_Y; // 3.75

// Mullion dimensions — thin and elegant
const MULLION_W = 0.06;
const MULLION_D = 0.07;
const EDGE_W = 0.10;
const EDGE_D = 0.08;
const RAIL_H = 0.06;
const RAIL_D = 0.08;

// Corner column
const CORNER_W = 0.12;

// Glass
const GLASS_OPACITY = 0.04;
const GLASS_COLOR = "#80a0c0";

// ── Mullion material (reusable) ─────────────────────────────────────────────
const frameMat = {
  color: FRAME_COLOR,
  roughness: FRAME_ROUGHNESS,
  metalness: FRAME_METALNESS,
};

// ── Helper: Vertical mullion ────────────────────────────────────────────────
const VMullion: React.FC<{
  x: number;
  y: number;
  z: number;
  height: number;
  width?: number;
  depth?: number;
  rotY?: number;
}> = ({ x, y, z, height, width = MULLION_W, depth = MULLION_D, rotY = 0 }) => (
  <mesh position={[x, y, z]} rotation={[0, rotY, 0]}>
    <boxGeometry args={[width, height, depth]} />
    <meshStandardMaterial {...frameMat} />
  </mesh>
);

// ── Helper: Horizontal rail ─────────────────────────────────────────────────
const HRail: React.FC<{
  x: number;
  y: number;
  z: number;
  length: number;
  height?: number;
  depth?: number;
  rotY?: number;
}> = ({ x, y, z, length, height = RAIL_H, depth = RAIL_D, rotY = 0 }) => (
  <mesh position={[x, y, z]} rotation={[0, rotY, 0]}>
    <boxGeometry args={[length, height, depth]} />
    <meshStandardMaterial {...frameMat} />
  </mesh>
);

// ── Helper: Glass pane ──────────────────────────────────────────────────────
const GlassPane: React.FC<{
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  rotY?: number;
}> = ({ x, y, z, width, height, rotY = 0 }) => (
  <mesh position={[x, y, z]} rotation={[0, rotY, 0]}>
    <planeGeometry args={[width, height]} />
    <meshStandardMaterial
      color={GLASS_COLOR}
      transparent
      opacity={GLASS_OPACITY}
      roughness={0.05}
      metalness={0.9}
      side={THREE.DoubleSide}
    />
  </mesh>
);

// ── Main component ──────────────────────────────────────────────────────────

export const WindowFrames3D: React.FC = () => {
  const centerY = SILL_Y + WINDOW_HEIGHT / 2;
  const backCenterX = (BACK_LEFT + BACK_RIGHT) / 2; // 0

  // Back wall: 5 panels
  // Dividing BACK_WIDTH into 5 panels means 4 internal mullions + 2 edges
  const backPanelCount = 5;
  const backInnerWidth = BACK_WIDTH - EDGE_W; // usable width between edges
  const backPanelWidth = backInnerWidth / backPanelCount;

  // Back wall mullion x-positions (4 internal dividers)
  const backMullionXs: number[] = [];
  for (let i = 1; i < backPanelCount; i++) {
    backMullionXs.push(BACK_LEFT + EDGE_W / 2 + i * backPanelWidth);
  }

  // Right wall: 4 panels
  // The right wall runs from z=RIGHT_BACK_Z to z=RIGHT_FRONT_Z at x=RIGHT_X
  const rightPanelCount = 4;
  const rightInnerDepth = RIGHT_DEPTH - EDGE_W; // usable depth
  const rightPanelDepth = rightInnerDepth / rightPanelCount;

  // Right wall mullion z-positions (3 internal dividers)
  const rightMullionZs: number[] = [];
  for (let i = 1; i < rightPanelCount; i++) {
    rightMullionZs.push(RIGHT_BACK_Z + EDGE_W / 2 + i * rightPanelDepth);
  }

  // Subtle mid-height crossbar Y position
  const crossbarY = 1.6;

  return (
    <group>
      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* BACK WALL WINDOWS                                                */}
      {/* ══════════════════════════════════════════════════════════════════ */}

      {/* Left edge */}
      <VMullion x={BACK_LEFT} y={centerY} z={BACK_Z} height={WINDOW_HEIGHT} width={EDGE_W} depth={EDGE_D} />

      {/* Right edge of back wall — replaced by corner column */}

      {/* 4 internal vertical mullions */}
      {backMullionXs.map((x, i) => (
        <VMullion key={`bvm-${i}`} x={x} y={centerY} z={BACK_Z} height={WINDOW_HEIGHT} />
      ))}

      {/* Top rail */}
      <HRail
        x={backCenterX}
        y={TOP_Y}
        z={BACK_Z}
        length={BACK_WIDTH}
        height={0.08}
      />

      {/* Bottom sill */}
      <HRail
        x={backCenterX}
        y={SILL_Y}
        z={BACK_Z}
        length={BACK_WIDTH}
      />

      {/* Mid-height crossbar (subtle) */}
      <HRail
        x={backCenterX}
        y={crossbarY}
        z={BACK_Z}
        length={BACK_WIDTH}
        height={0.03}
        depth={0.06}
      />

      {/* Glass panes for back wall — 5 panels */}
      {Array.from({ length: backPanelCount }).map((_, i) => {
        const panelLeft = BACK_LEFT + EDGE_W / 2 + i * backPanelWidth;
        const panelCenterX = panelLeft + backPanelWidth / 2;
        const glassWidth = backPanelWidth - MULLION_W;
        return (
          <GlassPane
            key={`bgp-${i}`}
            x={panelCenterX}
            y={centerY}
            z={BACK_Z + 0.005}
            width={glassWidth}
            height={WINDOW_HEIGHT - RAIL_H}
          />
        );
      })}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* CORNER COLUMN                                                    */}
      {/* ══════════════════════════════════════════════════════════════════ */}

      <mesh position={[RIGHT_X, centerY, BACK_Z]}>
        <boxGeometry args={[CORNER_W, WINDOW_HEIGHT + 0.1, CORNER_W]} />
        <meshStandardMaterial {...frameMat} />
      </mesh>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* RIGHT WALL WINDOWS                                               */}
      {/* ══════════════════════════════════════════════════════════════════ */}

      {/* Front edge of right wall (toward camera) */}
      <VMullion
        x={RIGHT_X}
        y={centerY}
        z={RIGHT_FRONT_Z}
        height={WINDOW_HEIGHT}
        width={MULLION_D}
        depth={EDGE_W}
      />

      {/* 3 internal vertical mullions on right wall */}
      {rightMullionZs.map((z, i) => (
        <VMullion
          key={`rvm-${i}`}
          x={RIGHT_X}
          y={centerY}
          z={z}
          height={WINDOW_HEIGHT}
          width={MULLION_D}
          depth={MULLION_W}
        />
      ))}

      {/* Top rail — right wall */}
      <HRail
        x={RIGHT_X}
        y={TOP_Y}
        z={(RIGHT_BACK_Z + RIGHT_FRONT_Z) / 2}
        length={RIGHT_DEPTH}
        height={0.08}
        rotY={Math.PI / 2}
      />

      {/* Bottom sill — right wall */}
      <HRail
        x={RIGHT_X}
        y={SILL_Y}
        z={(RIGHT_BACK_Z + RIGHT_FRONT_Z) / 2}
        length={RIGHT_DEPTH}
        rotY={Math.PI / 2}
      />

      {/* Mid-height crossbar — right wall */}
      <HRail
        x={RIGHT_X}
        y={crossbarY}
        z={(RIGHT_BACK_Z + RIGHT_FRONT_Z) / 2}
        length={RIGHT_DEPTH}
        height={0.03}
        depth={0.06}
        rotY={Math.PI / 2}
      />

      {/* Glass panes for right wall — 4 panels */}
      {Array.from({ length: rightPanelCount }).map((_, i) => {
        const panelBack = RIGHT_BACK_Z + EDGE_W / 2 + i * rightPanelDepth;
        const panelCenterZ = panelBack + rightPanelDepth / 2;
        const glassDepth = rightPanelDepth - MULLION_W;
        return (
          <GlassPane
            key={`rgp-${i}`}
            x={RIGHT_X + 0.005}
            y={centerY}
            z={panelCenterZ}
            width={glassDepth}
            height={WINDOW_HEIGHT - RAIL_H}
            rotY={Math.PI / 2}
          />
        );
      })}
    </group>
  );
};
