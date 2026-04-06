import React, { useMemo } from "react";
import * as THREE from "three";
import { seededRandom } from "./chartData";

// ══════════════════════════════════════════════════════════════════════════════
// CityBuildings3D — Flat facade planes for dense NYC skyline
// Only renders the face visible from the room (no full 3D boxes).
// ══════════════════════════════════════════════════════════════════════════════

// ── Types ────────────────────────────────────────────────────────────────────

interface FacadeDef {
  x: number;
  z: number;
  width: number;
  height: number;
  facing: "back" | "right"; // back = faces +Z, right = faces -X
  seed: number;
  litPct: number;
  spireHeight?: number;
  artDeco?: boolean;
  sideDepth?: number;        // depth of the perpendicular side face
  sideHeightRatio?: number;  // 0-1, fraction of main height for the side face
}

interface CityProps {
  frame: number;
  timeOfDay?: number;
  rainIntensity?: number;
}

// ── Facade generation ───────────────────────────────────────────────────────
// Back wall windows at z=-2.75 (x from -3.3 to 3.3, 5 panels ~1.32 wide each)
// Right wall windows at x=3.3 (z from -2.75 to 1.0, 4 panels ~0.94 deep each)

function generateFacades(): FacadeDef[] {
  const f: FacadeDef[] = [];
  seededRandom(314159); // consume for deterministic seed sequence
  let seedCounter = 100;
  const s = () => seedCounter++;

  // ═══════════════════════════════════════════════════════════════════════
  // BACK WALL — NYC skyline with natural gaps showing sky between towers
  // Two rows: close hero towers + distant shorter buildings behind gaps
  // ═══════════════════════════════════════════════════════════════════════

  // ── HERO TOWERS (z=-3.0 to -3.1) — large, close, with sky gaps ─────
  // Each tower is a distinct building. Gaps between them show sky/distant row.

  // Far left — partially hidden by left wall
  f.push({ x: -4.0, z: -3.0, width: 2.0, height: 14, facing: "back", seed: s(), litPct: 0.72, sideDepth: 1.5, sideHeightRatio: 0.5 });
  // Left tower
  f.push({ x: -2.6, z: -3.0, width: 1.6, height: 10, facing: "back", seed: s(), litPct: 0.65, sideDepth: 1.0, sideHeightRatio: 0.7 });
  // Left-center tall spire
  f.push({ x: -1.3, z: -3.0, width: 1.4, height: 16, facing: "back", seed: s(), litPct: 0.72, spireHeight: 1.5, sideDepth: 1.0, sideHeightRatio: 0.65 });
  // Center — tallest tower (ONE WTC style)
  f.push({ x: 0.1, z: -3.0, width: 1.5, height: 18, facing: "back", seed: s(), litPct: 0.78, spireHeight: 2.0, sideDepth: 0.8, sideHeightRatio: 0.6 });
  // Right-center — Chrysler-style
  f.push({ x: 1.5, z: -3.0, width: 1.4, height: 13, facing: "back", seed: s(), litPct: 0.68, artDeco: true, spireHeight: 1.0, sideDepth: 1.0, sideHeightRatio: 0.65 });
  // Right tower
  f.push({ x: 2.8, z: -3.0, width: 1.5, height: 11, facing: "back", seed: s(), litPct: 0.70, sideDepth: 1.0, sideHeightRatio: 0.7 });
  // Far right — partially hidden
  f.push({ x: 4.2, z: -3.0, width: 2.0, height: 15, facing: "back", seed: s(), litPct: 0.70, sideDepth: 1.5, sideHeightRatio: 0.5 });

  // ── DISTANT ROW (z=-3.5 to -4.0) — shorter buildings visible in gaps ──
  // These peek through the sky gaps between hero towers, adding depth.
  f.push({ x: -3.3, z: -3.6, width: 1.3, height: 7, facing: "back", seed: s(), litPct: 0.50 });
  f.push({ x: -2.0, z: -3.8, width: 1.4, height: 6, facing: "back", seed: s(), litPct: 0.48 });
  f.push({ x: -0.6, z: -3.5, width: 1.2, height: 8, facing: "back", seed: s(), litPct: 0.52 });
  f.push({ x: 0.7, z: -3.7, width: 1.3, height: 5, facing: "back", seed: s(), litPct: 0.46 });
  f.push({ x: 2.0, z: -3.6, width: 1.4, height: 7, facing: "back", seed: s(), litPct: 0.50 });
  f.push({ x: 3.5, z: -3.8, width: 1.3, height: 6, facing: "back", seed: s(), litPct: 0.44 });

  // ═══════════════════════════════════════════════════════════════════════
  // RIGHT WALL — Buildings visible through right-side windows (facing -X)
  // Right wall at x=3.3, z from -2.75 to 1.0
  // Same layered strategy: backdrop + hero + fill
  // ═══════════════════════════════════════════════════════════════════════

  // ── BACKDROP (x=3.7) — full coverage ───────────────────────────────
  f.push({ x: 3.7, z: -1.5, width: 4.0, height: 12, facing: "right", seed: s(), litPct: 0.50 });
  f.push({ x: 3.7, z: 0.8, width: 3.0, height: 10, facing: "right", seed: s(), litPct: 0.46 });
  f.push({ x: 3.8, z: -0.3, width: 3.5, height: 16, facing: "right", seed: s(), litPct: 0.44 });

  // ── HERO right buildings (x=3.5) ───────────────────────────────────
  f.push({ x: 3.5, z: -2.0, width: 2.5, height: 15, facing: "right", seed: s(), litPct: 0.74, spireHeight: 1.0, sideDepth: 1.5, sideHeightRatio: 0.55 });
  f.push({ x: 3.5, z: -0.2, width: 3.0, height: 12, facing: "right", seed: s(), litPct: 0.68, sideDepth: 1.3, sideHeightRatio: 0.6 });
  f.push({ x: 3.5, z: 1.2, width: 2.5, height: 10, facing: "right", seed: s(), litPct: 0.62, sideDepth: 1.0, sideHeightRatio: 0.6 });

  // ── FILL right buildings (x=3.6) ───────────────────────────────────
  f.push({ x: 3.6, z: -1.0, width: 2.2, height: 9, facing: "right", seed: s(), litPct: 0.58 });
  f.push({ x: 3.6, z: 0.5, width: 2.0, height: 11, facing: "right", seed: s(), litPct: 0.55 });

  return f;
}

// ── High-res building facade texture generation ─────────────────────────────

const TEX_W = 256;
const TEX_H = 512;

function createBuildingFacade(
  seed: number,
  litPct: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = TEX_W;
  canvas.height = TEX_H;
  const ctx = canvas.getContext("2d")!;

  const rng = seededRandom(seed);

  // Building facade background — dark steel/glass
  const baseR = 8 + Math.floor(rng() * 12);
  const baseG = 12 + Math.floor(rng() * 16);
  const baseB = 20 + Math.floor(rng() * 20);
  ctx.fillStyle = `rgb(${baseR},${baseG},${baseB})`;
  ctx.fillRect(0, 0, TEX_W, TEX_H);

  // Floor and column configuration
  const numFloors = 18 + Math.floor(rng() * 12);
  const numCols = 5 + Math.floor(rng() * 4);
  const floorH = TEX_H / numFloors;
  const colW = TEX_W / numCols;
  const mullionW = 2 + Math.floor(rng() * 3);
  const spandrelH = Math.max(2, floorH * (0.18 + rng() * 0.12));

  // Structural columns — dark vertical lines
  for (let c = 0; c <= numCols; c++) {
    const x = c * colW;
    ctx.fillStyle = `rgba(${baseR - 4},${baseG - 4},${baseB - 4},0.9)`;
    ctx.fillRect(x - mullionW / 2, 0, mullionW, TEX_H);
  }

  // Floor-by-floor windows
  for (let fl = 0; fl < numFloors; fl++) {
    const floorY = fl * floorH;
    const floorDark = rng() < 0.12;
    const floorBrightness = floorDark ? 0 : 0.6 + rng() * 0.4;

    // Spandrel band
    ctx.fillStyle = `rgb(${baseR + 4},${baseG + 4},${baseB + 6})`;
    ctx.fillRect(0, floorY, TEX_W, spandrelH);

    if (floorDark) continue;

    for (let c = 0; c < numCols; c++) {
      const winLeft = c * colW + mullionW / 2 + 1;
      const winTop = floorY + spandrelH + 1;
      const winW = colW - mullionW - 2;
      const winH = floorH - spandrelH - 2;

      if (winW < 2 || winH < 2) continue;

      const isLit = rng() < litPct;
      const warmth = rng();

      if (!isLit) {
        ctx.fillStyle = `rgba(20,30,50,0.6)`;
        ctx.fillRect(winLeft, winTop, winW, winH);
        // Glass reflection
        const grad = ctx.createLinearGradient(winLeft, winTop, winLeft + winW, winTop + winH);
        grad.addColorStop(0, `rgba(60,80,120,${0.05 + rng() * 0.08})`);
        grad.addColorStop(0.5, "transparent");
        grad.addColorStop(1, `rgba(40,60,90,${0.03 + rng() * 0.05})`);
        ctx.fillStyle = grad;
        ctx.fillRect(winLeft, winTop, winW, winH);
        continue;
      }

      const brightness = floorBrightness * (0.7 + rng() * 0.3);
      let r: number, g: number, b: number;

      if (warmth > 0.5) {
        r = 255; g = 200 + Math.floor(rng() * 30); b = 100 + Math.floor(rng() * 50);
      } else if (warmth > 0.25) {
        r = 180 + Math.floor(rng() * 40); g = 200 + Math.floor(rng() * 30); b = 240;
      } else {
        r = 255; g = 160 + Math.floor(rng() * 40); b = 60 + Math.floor(rng() * 40);
      }

      const alpha = brightness * (0.5 + rng() * 0.35);
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
      ctx.fillRect(winLeft, winTop, winW, winH);

      // Interior depth gradient
      const interGrad = ctx.createLinearGradient(winLeft, winTop, winLeft, winTop + winH);
      interGrad.addColorStop(0, `rgba(0,0,0,${0.15 + rng() * 0.1})`);
      interGrad.addColorStop(0.5, "transparent");
      interGrad.addColorStop(1, `rgba(0,0,0,${0.05})`);
      ctx.fillStyle = interGrad;
      ctx.fillRect(winLeft, winTop, winW, winH);
    }
  }

  // Glass tint overlay
  ctx.fillStyle = `rgba(30,50,80,0.08)`;
  ctx.fillRect(0, 0, TEX_W, TEX_H);

  // Vertical reflection streak
  const streakX = TEX_W * (0.3 + rng() * 0.4);
  const streakGrad = ctx.createLinearGradient(streakX - 30, 0, streakX + 30, 0);
  streakGrad.addColorStop(0, "transparent");
  streakGrad.addColorStop(0.5, `rgba(100,130,180,${0.04 + rng() * 0.04})`);
  streakGrad.addColorStop(1, "transparent");
  ctx.fillStyle = streakGrad;
  ctx.fillRect(0, 0, TEX_W, TEX_H);

  return canvas;
}

// ── Facade component — single textured plane per building ───────────────────

const Facade: React.FC<{
  def: FacadeDef;
  frame: number;
}> = ({ def, frame }) => {
  const texture = useMemo(() => {
    const canvas = createBuildingFacade(def.seed, def.litPct);
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }, [def.seed, def.litPct]);

  // Side face gets its own texture (different seed for variety)
  const sideTexture = useMemo(() => {
    if (!def.sideDepth) return null;
    const canvas = createBuildingFacade(def.seed + 500, def.litPct * 0.85);
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }, [def.seed, def.litPct, def.sideDepth]);

  const emissiveFlicker = 1.1 + Math.sin(frame * 0.03 + def.seed) * 0.15;

  const isBack = def.facing === "back";
  const rotY = isBack ? 0 : -Math.PI / 2;

  // Side face geometry
  const sideDepth = def.sideDepth ?? 0;
  const sideH = def.height * (def.sideHeightRatio ?? 1);

  // Determine which edge gets the side face:
  // - Back buildings: side on the edge closest to camera center (x≈0)
  //   Left buildings (x<0) → side on right edge; Right buildings (x>0) → side on left edge
  // - Right buildings: side extends along -Z from the front edge of the building
  let sidePos: [number, number, number];
  let sideRot: [number, number, number];

  if (isBack) {
    // Camera is near x=0. Buildings left of center show their right side, vice versa
    const onRight = def.x > 0;
    const edgeX = onRight ? -def.width / 2 : def.width / 2;
    // Side plane center sits at facade edge, extending backward (-Z) by sideDepth/2
    sidePos = [edgeX, sideH / 2, -sideDepth / 2];
    // Rotate 90° so plane faces ±X (perpendicular to main facade)
    sideRot = [0, Math.PI / 2, 0];
  } else {
    // Right-facing building: main faces -X. Side extends from front edge along -Z
    // Front edge of building is at z + width/2 (the end closest to the room)
    sidePos = [-sideDepth / 2, sideH / 2, def.width / 2];
    // Side plane faces +Z (toward the room), so rotation=0
    sideRot = [0, 0, 0];
  }

  return (
    <group position={[def.x, 0, def.z]}>
      {/* Main facade plane */}
      <mesh position={[0, def.height / 2, 0]} rotation={[0, rotY, 0]}>
        <planeGeometry args={[def.width, def.height]} />
        <meshStandardMaterial
          map={texture}
          emissiveMap={texture}
          emissive={new THREE.Color("#ffffff")}
          emissiveIntensity={emissiveFlicker}
          toneMapped={false}
        />
      </mesh>

      {/* Side face — textured perpendicular plane for depth */}
      {sideDepth > 0 && sideTexture && (
        <mesh position={sidePos} rotation={sideRot}>
          <planeGeometry args={[sideDepth, sideH]} />
          <meshStandardMaterial
            map={sideTexture}
            emissiveMap={sideTexture}
            emissive={new THREE.Color("#ffffff")}
            emissiveIntensity={emissiveFlicker * 0.7}
            toneMapped={false}
          />
        </mesh>
      )}

      {/* Thin edge strip — only on facade edge WITHOUT side face */}
      {!def.sideDepth && (
        <mesh
          position={[
            isBack ? -def.width / 2 : 0,
            def.height / 2,
            isBack ? 0 : -def.width / 2,
          ]}
          rotation={[0, isBack ? Math.PI / 2 : 0, 0]}
        >
          <planeGeometry args={[0.15, def.height]} />
          <meshStandardMaterial color="#060a14" roughness={0.5} metalness={0.6} />
        </mesh>
      )}

      {/* Spire */}
      {def.spireHeight && (
        <group position={[0, def.height, 0]}>
          <mesh position={[0, def.spireHeight / 2, 0]}>
            <cylinderGeometry args={[0.02, 0.06, def.spireHeight, 4]} />
            <meshStandardMaterial color="#10141c" roughness={0.3} metalness={0.7} />
          </mesh>
          {/* Aviation light */}
          {Math.sin(frame * 0.08 + def.seed) > 0.2 && (
            <mesh position={[0, def.spireHeight, 0]}>
              <sphereGeometry args={[0.04, 6, 6]} />
              <meshStandardMaterial
                color="#ff5028"
                emissive={new THREE.Color("#ff3010")}
                emissiveIntensity={3}
                toneMapped={false}
              />
            </mesh>
          )}
        </group>
      )}

      {/* Art deco crown */}
      {def.artDeco && (
        <group position={[0, def.height, 0]} rotation={[0, rotY, 0]}>
          {[0, 1, 2].map((tier) => {
            const tierH = 0.3 - tier * 0.05;
            const tierScale = 1 - tier * 0.2;
            return (
              <mesh key={tier} position={[0, tier * 0.28 + tierH / 2, 0]}>
                <boxGeometry args={[def.width * tierScale * 0.9, tierH, 0.5 * tierScale]} />
                <meshStandardMaterial
                  color="#141c30"
                  roughness={0.25}
                  metalness={0.8}
                  emissive={new THREE.Color("#202840")}
                  emissiveIntensity={0.15}
                />
              </mesh>
            );
          })}
        </group>
      )}
    </group>
  );
};

// ── Street-level ground plane ───────────────────────────────────────────────

const StreetGround: React.FC = () => {
  const streetTex = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = "#030508";
    ctx.fillRect(0, 0, 256, 256);

    const rng = seededRandom(999);
    for (let i = 0; i < 60; i++) {
      const sx = rng() * 256;
      const sy = rng() * 256;
      const brightness = rng();
      if (brightness > 0.7) {
        ctx.fillStyle = `rgba(255,200,100,${0.15 + rng() * 0.3})`;
        ctx.fillRect(sx, sy, 2, 2);
      } else if (brightness > 0.5) {
        ctx.fillStyle = `rgba(200,220,255,${0.08 + rng() * 0.15})`;
        ctx.fillRect(sx, sy, 1, 1);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);
    return tex;
  }, []);

  return (
    <mesh position={[2, -0.5, -4]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[25, 25]} />
      <meshStandardMaterial
        map={streetTex}
        emissiveMap={streetTex}
        emissive={new THREE.Color("#ffffff")}
        emissiveIntensity={0.5}
        color="#020408"
        roughness={0.9}
        toneMapped={false}
      />
    </mesh>
  );
};

// ── SkyDome — hemisphere with gradient sky ──────────────────────────────────

export const SkyDome: React.FC<{ timeOfDay: number }> = ({ timeOfDay }) => {
  const quantizedToD = Math.round(timeOfDay * 20) / 20;

  const skyTex = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d")!;

    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    const t = Math.max(0, Math.min(1, quantizedToD));

    // Top — vivid sky blue to deep navy
    const topR = Math.round(70 + (6 - 70) * t);
    const topG = Math.round(150 + (16 - 150) * t);
    const topB = Math.round(240 + (50 - 240) * t);
    grad.addColorStop(0, `rgb(${topR},${topG},${topB})`);

    // Mid — bright azure to dark
    const midR = Math.round(100 + (12 - 100) * t);
    const midG = Math.round(180 + (30 - 180) * t);
    const midB = Math.round(245 + (65 - 245) * t);
    grad.addColorStop(0.35, `rgb(${midR},${midG},${midB})`);

    // Horizon — warm golden glow
    const horR = Math.round(245 + (80 - 245) * t);
    const horG = Math.round(200 + (50 - 200) * t);
    const horB = Math.round(130 + (30 - 130) * t);
    grad.addColorStop(0.7, `rgb(${horR},${horG},${horB})`);

    // Golden horizon band
    const golR = Math.round(255 + (100 - 255) * t);
    const golG = Math.round(210 + (60 - 210) * t);
    const golB = Math.round(120 + (25 - 120) * t);
    grad.addColorStop(0.85, `rgb(${golR},${golG},${golB})`);

    // Bottom — warm glow
    const botR = Math.round(200 + (35 - 200) * t);
    const botG = Math.round(150 + (22 - 150) * t);
    const botB = Math.round(90 + (15 - 90) * t);
    grad.addColorStop(1, `rgb(${botR},${botG},${botB})`);

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Stars at night
    if (t > 0.3) {
      const starAlpha = (t - 0.3) * 0.8;
      const rng = seededRandom(42);
      for (let i = 0; i < 80; i++) {
        const sx = rng() * 512;
        const sy = rng() * 300;
        const size = 0.5 + rng() * 1.5;
        ctx.fillStyle = `rgba(255,255,255,${starAlpha * (0.15 + rng() * 0.4)})`;
        ctx.beginPath();
        ctx.arc(sx, sy, size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Horizon glow
    const glowAlpha = 0.15 + t * 0.06;
    const glowGrad = ctx.createRadialGradient(256, 420, 0, 256, 420, 200);
    glowGrad.addColorStop(0, `rgba(230,170,80,${glowAlpha})`);
    glowGrad.addColorStop(0.5, `rgba(200,140,60,${glowAlpha * 0.4})`);
    glowGrad.addColorStop(1, "transparent");
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, 0, 512, 512);

    const tex = new THREE.CanvasTexture(canvas);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    return tex;
  }, [quantizedToD]);

  return (
    <mesh position={[2, 0, -4]}>
      <sphereGeometry args={[22, 32, 16]} />
      <meshBasicMaterial map={skyTex} side={THREE.BackSide} toneMapped={false} fog={false} />
    </mesh>
  );
};

// ── Main CityBuildings3D component ──────────────────────────────────────────

export const CityBuildings3D: React.FC<CityProps> = ({
  frame,
  timeOfDay = 0.3,
}) => {
  const facades = useMemo(() => generateFacades(), []);

  return (
    <group>
      <SkyDome timeOfDay={timeOfDay} />

      {facades.map((def, i) => (
        <Facade key={i} def={def} frame={frame} />
      ))}

      <StreetGround />

      {/* City glow lights */}
      <pointLight
        position={[0, 3, -3.5]}
        color="#FFD090"
        intensity={0.5 + timeOfDay * 0.3}
        distance={10}
        decay={2}
      />
      <pointLight
        position={[-2.5, 4, -4]}
        color="#FFC070"
        intensity={0.25 + timeOfDay * 0.15}
        distance={8}
        decay={2}
      />
      <pointLight
        position={[4.5, 4, -1.5]}
        color="#FFC070"
        intensity={0.25 + timeOfDay * 0.15}
        distance={8}
        decay={2}
      />
    </group>
  );
};
