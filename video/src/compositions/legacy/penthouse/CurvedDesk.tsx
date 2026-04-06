import React, { useMemo } from "react";
import * as THREE from "three";

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a curved desk surface as a BufferGeometry.
 * The surface is an arc of `arcDeg` degrees, opening toward -Z (toward monitors).
 * The arc center is on the viewer side (+Z). rInner = front edge (near viewer),
 * rOuter = back edge (near monitors).
 * Y is constant (flat surface at `y`). Thickness via a separate bottom face.
 */
function createCurvedSurfaceGeometry(
  arcDeg: number,
  segments: number,
  rInner: number,
  rOuter: number,
): THREE.BufferGeometry {
  const arcRad = (arcDeg * Math.PI) / 180;
  const halfArc = arcRad / 2;

  const verts: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const angle = -halfArc + t * arcRad;

    // Inner edge (front, closer to viewer)
    const xi = rInner * Math.sin(angle);
    const zi = -rInner * Math.cos(angle);
    // Outer edge (back, closer to monitors)
    const xo = rOuter * Math.sin(angle);
    const zo = -rOuter * Math.cos(angle);

    // Two vertices per segment step: inner then outer
    verts.push(xi, 0, zi);
    normals.push(0, 1, 0);
    uvs.push(t, 0);

    verts.push(xo, 0, zo);
    normals.push(0, 1, 0);
    uvs.push(t, 1);
  }

  // Winding reversed from original to maintain correct top-face normals after Z flip
  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, b, c);
    indices.push(b, d, c);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

/**
 * Build a curved lip/edge strip — a thin vertical band along an edge of the arc.
 * Uses DoubleSide rendering for correct visibility from both directions.
 */
function createCurvedLipGeometry(
  arcDeg: number,
  segments: number,
  radius: number,
  height: number,
): THREE.BufferGeometry {
  const arcRad = (arcDeg * Math.PI) / 180;
  const halfArc = arcRad / 2;
  const halfH = height / 2;

  const verts: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const angle = -halfArc + t * arcRad;

    const x = radius * Math.sin(angle);
    const z = -radius * Math.cos(angle);
    const nx = Math.sin(angle);
    const nz = -Math.cos(angle);

    // Bottom vertex
    verts.push(x, -halfH, z);
    normals.push(nx, 0, nz);
    uvs.push(t, 0);

    // Top vertex
    verts.push(x, halfH, z);
    normals.push(nx, 0, nz);
    uvs.push(t, 1);
  }

  // Winding reversed for Z flip
  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, c, b);
    indices.push(b, c, d);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

// ── Component ────────────────────────────────────────────────────────────────

export const CurvedDesk: React.FC = () => {
  // Arc parameters — the desk curves ~120 degrees, wrapping AROUND the viewer.
  // The arc center (pivot) is on the viewer's side. The concave surface faces
  // the viewer, and the desk wings extend back toward the monitors/windows.
  // The desk is pushed back toward the windows so monitors are near the window wall.
  const arcDeg = 120;
  const segments = 48;
  // Radii measured from the arc center.
  // rInner = front edge (closest to viewer), rOuter = back edge (near windows).
  const rInner = 1.3; // front edge (at z ~ -0.5)
  const rOuter = 2.55; // back edge (at z ~ -1.75, close to windows at z=-2.75)
  const surfaceY = 0.74;
  const lipHeight = 0.06;
  const deskThickness = 0.04;

  // The arc center (pivot) is near the viewer position.
  // Front edge at angle=0: z_world = pivotZ - rInner = 0.8 - 1.3 = -0.5
  // Back edge at angle=0:  z_world = pivotZ - rOuter = 0.8 - 2.55 = -1.75
  // Desk depth = 1.25m, back edge close to windows
  const pivotZ = 0.8;

  const surfaceGeo = useMemo(
    () => createCurvedSurfaceGeometry(arcDeg, segments, rInner, rOuter),
    [],
  );
  const bottomGeo = useMemo(() => {
    const geo = createCurvedSurfaceGeometry(arcDeg, segments, rInner, rOuter);
    // Flip normals downward for the bottom face
    const normals = geo.attributes.normal;
    for (let i = 0; i < normals.count; i++) {
      normals.setY(i, -1);
    }
    // Reverse winding
    const idx = geo.index!;
    const arr = Array.from(idx.array);
    for (let i = 0; i < arr.length; i += 3) {
      const tmp = arr[i + 1];
      arr[i + 1] = arr[i + 2];
      arr[i + 2] = tmp;
    }
    geo.setIndex(arr);
    return geo;
  }, []);

  const lipGeo = useMemo(
    () => createCurvedLipGeometry(arcDeg, segments, rInner, lipHeight),
    [],
  );

  // Back edge lip — thinner, subtle
  const backLipGeo = useMemo(
    () => createCurvedLipGeometry(arcDeg, segments, rOuter, lipHeight * 0.6),
    [],
  );

  // ── Leg positions — 3 pedestal legs under the curved surface ──
  const legPositions = useMemo(() => {
    const arcRad = (arcDeg * Math.PI) / 180;
    const halfArc = arcRad / 2;
    const rMid = (rInner + rOuter) / 2;
    const angles = [-halfArc * 0.65, 0, halfArc * 0.65];
    return angles.map((a) => ({
      x: rMid * Math.sin(a),
      z: -rMid * Math.cos(a),
    }));
  }, []);

  const legHeight = surfaceY - deskThickness / 2;

  // ── Desk prop positions ──
  const arcRad = (arcDeg * Math.PI) / 180;
  const halfArc = arcRad / 2;

  // Helper: XZ on the surface at normalized angle (-1 to 1) and radius (0=inner, 1=outer)
  const surfacePos = (
    angleFrac: number,
    radiusFrac: number,
  ): [number, number, number] => {
    const angle = angleFrac * halfArc;
    const r = rInner + radiusFrac * (rOuter - rInner);
    return [r * Math.sin(angle), surfaceY + 0.005, -r * Math.cos(angle) + pivotZ];
  };

  const paper1Pos = surfacePos(-0.55, 0.65);
  const paper2Pos = surfacePos(-0.38, 0.45);
  const paper3Pos = surfacePos(0.72, 0.55);
  const notepadPos = surfacePos(0.52, 0.7);
  const penPos = surfacePos(0.6, 0.55);

  return (
    <group>
      {/* ── Main curved desk surface (top face) ── */}
      <mesh
        geometry={surfaceGeo}
        position={[0, surfaceY + deskThickness / 2, pivotZ]}
      >
        <meshStandardMaterial
          color="#1c1c24"
          roughness={0.25}
          metalness={0.35}
          envMapIntensity={0.8}
        />
      </mesh>

      {/* ── Bottom face ── */}
      <mesh
        geometry={bottomGeo}
        position={[0, surfaceY - deskThickness / 2, pivotZ]}
      >
        <meshStandardMaterial
          color="#14141a"
          roughness={0.5}
          metalness={0.2}
        />
      </mesh>

      {/* ── Front lip (inner curved edge, facing viewer) ── */}
      <mesh geometry={lipGeo} position={[0, surfaceY, pivotZ]}>
        <meshStandardMaterial
          color="#14141a"
          roughness={0.3}
          metalness={0.4}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* ── Back lip (outer curved edge, facing monitors) ── */}
      <mesh geometry={backLipGeo} position={[0, surfaceY, pivotZ]}>
        <meshStandardMaterial
          color="#111118"
          roughness={0.35}
          metalness={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* ── Side caps (left and right ends of the arc) ── */}
      {[1, -1].map((side) => {
        const angle = side * halfArc;
        const xi = rInner * Math.sin(angle);
        const zi = -rInner * Math.cos(angle);
        const xo = rOuter * Math.sin(angle);
        const zo = -rOuter * Math.cos(angle);
        const cx = (xi + xo) / 2;
        const cz = (zi + zo) / 2;
        const dx = xo - xi;
        const dz = zo - zi;
        const len = Math.sqrt(dx * dx + dz * dz);
        const rotY = Math.atan2(dx, dz);
        return (
          <mesh
            key={side}
            position={[cx, surfaceY, cz + pivotZ]}
            rotation={[0, rotY, 0]}
          >
            <boxGeometry args={[len, deskThickness + lipHeight * 0.5, 0.01]} />
            <meshStandardMaterial
              color="#14141a"
              roughness={0.3}
              metalness={0.3}
            />
          </mesh>
        );
      })}

      {/* ── Pedestal legs — modern T-shaped pedestals ── */}
      {legPositions.map((leg, i) => (
        <group key={`leg-${i}`} position={[leg.x, 0, leg.z + pivotZ]}>
          {/* Vertical column */}
          <mesh position={[0, legHeight / 2, 0]}>
            <cylinderGeometry args={[0.035, 0.04, legHeight, 12]} />
            <meshStandardMaterial
              color="#14141a"
              roughness={0.3}
              metalness={0.5}
            />
          </mesh>
          {/* Base plate (flat disc on the floor) */}
          <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.12, 16]} />
            <meshStandardMaterial
              color="#111118"
              roughness={0.3}
              metalness={0.6}
            />
          </mesh>
          {/* Top mounting plate (where leg meets desk underside) */}
          <mesh position={[0, legHeight - 0.005, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 0.01, 12]} />
            <meshStandardMaterial
              color="#18181f"
              roughness={0.3}
              metalness={0.4}
            />
          </mesh>
        </group>
      ))}

      {/* ── Desk Props ── */}

      {/* Paper 1 — A4-ish, slight rotation */}
      <mesh position={paper1Pos} rotation={[-Math.PI / 2, 0, 0.12]}>
        <planeGeometry args={[0.14, 0.19]} />
        <meshStandardMaterial
          color="#e8e4dc"
          roughness={0.85}
          metalness={0.0}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Paper 2 — smaller, different angle */}
      <mesh position={paper2Pos} rotation={[-Math.PI / 2, 0, -0.25]}>
        <planeGeometry args={[0.12, 0.16]} />
        <meshStandardMaterial
          color="#e0dcd4"
          roughness={0.9}
          metalness={0.0}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Paper 3 — right side, tucked */}
      <mesh position={paper3Pos} rotation={[-Math.PI / 2, 0, 0.35]}>
        <planeGeometry args={[0.11, 0.15]} />
        <meshStandardMaterial
          color="#ddd8d0"
          roughness={0.85}
          metalness={0.0}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Sticky notepad — small yellow square pad */}
      <group position={notepadPos}>
        {/* Pad body */}
        <mesh rotation={[-Math.PI / 2, 0, 0.08]}>
          <boxGeometry args={[0.065, 0.065, 0.008]} />
          <meshStandardMaterial
            color="#f0d850"
            roughness={0.7}
            metalness={0.0}
          />
        </mesh>
        {/* Top sheet slightly peeled */}
        <mesh
          position={[0.002, 0.005, -0.005]}
          rotation={[-Math.PI / 2 + 0.04, 0, 0.08]}
        >
          <planeGeometry args={[0.06, 0.06]} />
          <meshStandardMaterial
            color="#f5e060"
            roughness={0.8}
            metalness={0.0}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/* Pen — thin dark cylinder at a diagonal */}
      <group position={penPos} rotation={[0, 0.5, 0]}>
        {/* Pen body */}
        <mesh
          position={[0, 0.006, 0]}
          rotation={[0, 0, Math.PI / 2 - 0.15]}
        >
          <cylinderGeometry args={[0.004, 0.003, 0.14, 8]} />
          <meshStandardMaterial
            color="#1a1a2e"
            roughness={0.3}
            metalness={0.6}
          />
        </mesh>
        {/* Pen tip */}
        <mesh
          position={[-0.068, 0.005, 0]}
          rotation={[0, 0, Math.PI / 2 - 0.15]}
        >
          <coneGeometry args={[0.003, 0.015, 8]} />
          <meshStandardMaterial
            color="#c0c0c0"
            roughness={0.2}
            metalness={0.7}
          />
        </mesh>
        {/* Pen clip */}
        <mesh position={[0.055, 0.01, 0]} rotation={[0, 0, 0.05]}>
          <boxGeometry args={[0.025, 0.002, 0.004]} />
          <meshStandardMaterial
            color="#c0c0c0"
            roughness={0.2}
            metalness={0.7}
          />
        </mesh>
      </group>
    </group>
  );
};
