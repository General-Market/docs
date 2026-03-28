import React, { useMemo, Suspense } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";

/**
 * Scene 02 — Public.com product showcase (Round 5 — Three.js glass rewrite)
 * 364 frames at 29fps (~12.5s)
 *
 * Segments:
 * 1. Stocks      (0-28)
 * 2. ETFs        (28-68)
 * 3. Crypto      (68-96)
 * 4. Treasuries  (96-152)
 * 5. "with even more→" + phones (152-212)
 * 6. "One place" glass text      (212-258)
 * 7. "build your portfolio→"     (258-308)
 * 8. "the way you want." + phone (308-364)
 */

const C = {
  bg: "#F5F5F7",
  navy: "#1B1B3A",
  blue: "#2845E0",
  green: "#22C55E",
  red: "#EF4444",
  card: "#FFFFFF",
};

const F = {
  h: "'SF Pro Display', 'Helvetica Neue', Arial, sans-serif",
  b: "'SF Pro Text', 'Helvetica Neue', Arial, sans-serif",
};

const CL = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

/* ─── Arrow ─── */
const Arrow: React.FC<{ opacity: number; size?: number }> = ({ opacity, size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" style={{ opacity, flexShrink: 0 }}>
    <path
      d="M5 14h16M15 8l6 6-6 6"
      stroke={C.blue}
      strokeWidth={2.5}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/* ─── Sparkline ─── */
const Spark: React.FC<{
  w?: number;
  h?: number;
  pts?: number[];
  color?: string;
  sw?: number;
  fill?: boolean;
  drawProgress?: number;
}> = ({ w = 60, h = 24, pts = [4, 8, 6, 12, 10, 16, 14, 18, 15, 20], color = C.green, sw = 1.5, fill = false, drawProgress }) => {
  const mx = Math.max(...pts);
  const mn = Math.min(...pts);
  const r = mx - mn || 1;
  const coords = pts.map((p, i) => ({
    x: (i / (pts.length - 1)) * w,
    y: h - ((p - mn) / r) * (h - 4) - 2,
  }));
  const prog = drawProgress !== undefined ? Math.max(0, Math.min(1, drawProgress)) : 1;
  const visibleCount = Math.max(2, Math.ceil(coords.length * prog));
  const visible = coords.slice(0, visibleCount);
  const d = visible.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");
  const lastX = visible[visible.length - 1].x;
  const fillD = d + `L${lastX},${h}L0,${h}Z`;
  return (
    <svg width={w} height={h}>
      {fill && prog > 0.1 && <path d={fillD} fill={`${color}15`} opacity={prog} />}
      <path d={d} stroke={color} strokeWidth={sw} fill="none" />
    </svg>
  );
};

/* ═══════════════════ THREE.JS GLASS OBJECTS ═══════════════════ */

/* ── Iridescent glass material (shared) ── */
const GLASS_MAT_PROPS = {
  transparent: true,
  opacity: 0.6,
  roughness: 0.03,
  metalness: 0.22,
  clearcoat: 1.0,
  clearcoatRoughness: 0.01,
  side: THREE.DoubleSide as THREE.Side,
  envMapIntensity: 3.0,
  emissiveIntensity: 0.25,
  specularIntensity: 2.8,
  iridescence: 1.0,
  iridescenceIOR: 1.5,
  iridescenceThicknessRange: [100, 400] as [number, number],
  sheen: 0.3,
  sheenRoughness: 0.15,
  sheenColor: new THREE.Color("#c8b0ff"),
};

/* ── Glass Orb (Stocks) ── */
const GlassOrbScene: React.FC<{ progress: number; frame: number }> = ({ progress, frame }) => {
  const rot = frame * 0.012;
  const wobble = Math.sin(frame * 0.05) * 0.08;
  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[3, 4, 5]} intensity={3.0} color="#e8e0ff" />
      <directionalLight position={[-4, 2, 3]} intensity={1.5} color="#d0b8ff" />
      <pointLight position={[0, -2, 3]} intensity={1.0} color="#b0c8ff" />
      <pointLight position={[2, 2, 4]} intensity={1.2} color="#ffc0e8" />
      <pointLight position={[-2, 1, 2]} intensity={0.8} color="#c0e0ff" />
      <mesh
        position={[0, wobble, 0]}
        rotation={[rot * 0.3, rot, 0]}
        scale={progress * 1.15}
      >
        <sphereGeometry args={[0.85, 64, 64]} />
        <meshPhysicalMaterial
          {...GLASS_MAT_PROPS}
          color="#d0c8e8"
          emissive="#a898d0"
          specularColor={new THREE.Color("#ffd0f0")}
        />
      </mesh>
    </>
  );
};

/* ── Glass Donut (ETFs) — segmented ring ── */
const GlassDonutScene: React.FC<{ progress: number; frame: number }> = ({ progress, frame }) => {
  const rot = frame * 0.008;
  const segments = useMemo(() => {
    const count = 8;
    const arr: Array<{ pos: [number, number, number]; rotZ: number }> = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const r = 0.75;
      arr.push({
        pos: [Math.cos(angle) * r, Math.sin(angle) * r, 0] as [number, number, number],
        rotZ: angle + Math.PI / 2,
      });
    }
    return arr;
  }, []);

  const blockGeo = useMemo(() => {
    const shape = new THREE.Shape();
    const w = 0.32;
    const h = 0.42;
    const rad = 0.08;
    shape.moveTo(-w / 2 + rad, -h / 2);
    shape.lineTo(w / 2 - rad, -h / 2);
    shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + rad);
    shape.lineTo(w / 2, h / 2 - rad);
    shape.quadraticCurveTo(w / 2, h / 2, w / 2 - rad, h / 2);
    shape.lineTo(-w / 2 + rad, h / 2);
    shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - rad);
    shape.lineTo(-w / 2, -h / 2 + rad);
    shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + rad, -h / 2);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.18,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.04,
      bevelSegments: 8,
    });
    geo.center();
    return geo;
  }, []);

  const colors = ["#b0a8e0", "#a8b8e8", "#b8a0d8", "#a0c0e8", "#c0a8d0", "#a8a8e0", "#b0b0e0", "#c0b0d8"];

  return (
    <>
      <ambientLight intensity={1.2} />
      <directionalLight position={[4, 4, 5]} intensity={2.2} color="#e0e8ff" />
      <directionalLight position={[-3, 1, 3]} intensity={0.8} color="#c4b8ff" />
      <pointLight position={[0, 0, 3]} intensity={0.6} color="#ffd0e0" />
      <group rotation={[0.4, rot, 0.1]} scale={progress * 1.0}>
        {segments.map((seg, i) => (
          <mesh
            key={i}
            position={seg.pos}
            rotation={[0, 0, seg.rotZ]}
            geometry={blockGeo}
          >
            <meshPhysicalMaterial
              {...GLASS_MAT_PROPS}
              opacity={0.52}
              color={colors[i]}
              emissive="#8878b0"
              specularColor={new THREE.Color("#e0d0ff")}
            />
          </mesh>
        ))}
      </group>
    </>
  );
};

/* ── Glass Crypto Coins ── */
const GlassCryptoScene: React.FC<{ progress: number; frame: number }> = ({ progress, frame }) => {
  const rot = frame * 0.01;
  const wobble1 = Math.sin(frame * 0.05) * 0.06;
  const wobble2 = Math.cos(frame * 0.04) * 0.08;
  return (
    <>
      <ambientLight intensity={1.2} />
      <directionalLight position={[5, 5, 5]} intensity={2.2} color="#e0e8ff" />
      <directionalLight position={[-3, 2, 4]} intensity={0.8} color="#ffd4b8" />
      <pointLight position={[1, 1, 3]} intensity={0.6} color="#ffd0e0" />
      {/* Large BTC coin */}
      <mesh
        position={[0, wobble1, 0]}
        rotation={[0.3 + rot * 0.2, rot, 0]}
        scale={progress * 1.1}
      >
        <cylinderGeometry args={[0.5, 0.5, 0.12, 48]} />
        <meshPhysicalMaterial
          {...GLASS_MAT_PROPS}
          color="#d0c8e8"
          emissive="#9080c0"
          specularColor={new THREE.Color("#ffe0d0")}
        />
      </mesh>
      {/* ETH coin */}
      <mesh
        position={[-0.6, -0.5 + wobble2, 0.3]}
        rotation={[0.2, rot * 0.8 + 1, 0.1]}
        scale={progress * 0.7}
      >
        <cylinderGeometry args={[0.5, 0.5, 0.12, 48]} />
        <meshPhysicalMaterial
          {...GLASS_MAT_PROPS}
          opacity={0.48}
          color="#b8b0d8"
          emissive="#7070a0"
          specularColor={new THREE.Color("#d0e0ff")}
        />
      </mesh>
      {/* SOL coin */}
      <mesh
        position={[0.5, -0.3, -0.2]}
        rotation={[-0.2, rot * 1.2, 0.3]}
        scale={progress * 0.5}
      >
        <cylinderGeometry args={[0.5, 0.5, 0.12, 48]} />
        <meshPhysicalMaterial
          {...GLASS_MAT_PROPS}
          opacity={0.45}
          color="#c0b8e0"
          emissive="#8070b0"
          specularColor={new THREE.Color("#e0d0ff")}
        />
      </mesh>
    </>
  );
};

/* ── Glass Pillar (Treasuries) ── */
const GlassPillarScene: React.FC<{ progress: number; frame: number }> = ({ progress, frame }) => {
  const breathe = Math.sin(frame * 0.03) * 0.02;
  const shimmer = frame * 0.005;

  const columnGeo = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    const segments = 48;
    const baseR = 0.32;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const y = t * 2.8 - 1.4;
      const entasis = 1 + Math.sin(t * Math.PI) * 0.05;
      const taper = 1 - t * 0.08;
      const r = baseR * entasis * taper;
      pts.push(new THREE.Vector2(r, y));
    }
    return new THREE.LatheGeometry(pts, 48);
  }, []);

  const capitalGeo = useMemo(() => {
    const shape = new THREE.Shape();
    const w = 0.55;
    const h = 0.2;
    const r = 0.05;
    shape.moveTo(-w / 2 + r, -h / 2);
    shape.lineTo(w / 2 - r, -h / 2);
    shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    shape.lineTo(w / 2, h / 2 - r);
    shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
    shape.lineTo(-w / 2 + r, h / 2);
    shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
    shape.lineTo(-w / 2, -h / 2 + r);
    shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    return new THREE.ExtrudeGeometry(shape, {
      depth: 0.5,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.03,
      bevelSegments: 4,
    });
  }, []);

  const glassPillarMat = (
    <meshPhysicalMaterial
      {...GLASS_MAT_PROPS}
      color="#c8c0e8"
      emissive="#8878b8"
      specularColor={new THREE.Color("#e0d0ff")}
    />
  );

  return (
    <>
      <ambientLight intensity={1.3} />
      <directionalLight position={[4, 6, 5]} intensity={2.2} color="#e0e8ff" />
      <directionalLight position={[-4, 2, 3]} intensity={0.8} color="#d4b8ff" />
      <pointLight position={[0, -2, 2]} intensity={0.5} color="#b8d4ff" />
      <group
        rotation={[0, shimmer, 0]}
        scale={progress * (1 + breathe)}
      >
        <mesh geometry={columnGeo}>
          {glassPillarMat}
        </mesh>
        <mesh geometry={capitalGeo} position={[0, 1.5, -0.25]}>
          {glassPillarMat}
        </mesh>
        <mesh geometry={capitalGeo} position={[0, -1.5, -0.25]}>
          {glassPillarMat}
        </mesh>
      </group>
    </>
  );
};

/* ── Glass "One" text (3D extruded letter shapes) ── */
const GlassOneTextScene: React.FC<{ progress: number; frame: number }> = ({ progress, frame }) => {
  const rot = Math.sin(frame * 0.02) * 0.08;

  // "O" — ring shape
  const oGeo = useMemo(() => {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, 0.85, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, 0.55, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.35,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.06,
      bevelSegments: 12,
      curveSegments: 48,
    });
    geo.center();
    return geo;
  }, []);

  // "n" — left vertical + arch + right vertical
  const nGeo = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-0.35, -0.7);
    shape.lineTo(-0.35, 0.7);
    shape.lineTo(-0.15, 0.7);
    shape.lineTo(-0.15, 0.1);
    shape.quadraticCurveTo(-0.15, 0.7, 0.25, 0.7);
    shape.lineTo(0.35, 0.7);
    shape.lineTo(0.35, -0.7);
    shape.lineTo(0.15, -0.7);
    shape.lineTo(0.15, 0.4);
    shape.quadraticCurveTo(0.15, 0.5, 0.0, 0.5);
    shape.quadraticCurveTo(-0.15, 0.5, -0.15, 0.4);
    shape.lineTo(-0.15, -0.7);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.35,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.04,
      bevelSegments: 8,
    });
    geo.center();
    return geo;
  }, []);

  // "e" — open arc with crossbar (proper letter e shape)
  const eGeo = useMemo(() => {
    const shape = new THREE.Shape();
    const outer = 0.55;
    const inner = 0.35;
    const strokeW = outer - inner;
    // Outer arc from bottom-right gap, going counter-clockwise around
    // Gap at bottom-right: ~330deg to ~350deg open
    shape.absarc(0, 0, outer, -0.4, Math.PI * 2 - 0.6, false);
    // Close to inner radius
    shape.lineTo(inner * Math.cos(Math.PI * 2 - 0.6), inner * Math.sin(Math.PI * 2 - 0.6));
    // Inner arc back
    shape.absarc(0, 0, inner, Math.PI * 2 - 0.6, -0.4, true);
    shape.closePath();

    // Crossbar through the middle
    const bar = new THREE.Shape();
    bar.moveTo(-outer, -strokeW * 0.4);
    bar.lineTo(outer * 0.9, -strokeW * 0.4);
    bar.lineTo(outer * 0.9, strokeW * 0.4);
    bar.lineTo(-outer, strokeW * 0.4);
    bar.closePath();

    const extOpts = {
      depth: 0.35,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.04,
      bevelSegments: 8,
      curveSegments: 32,
    };
    const geo1 = new THREE.ExtrudeGeometry(shape, extOpts);
    const geo2 = new THREE.ExtrudeGeometry(bar, extOpts);
    // Merge geometries
    const merged = new THREE.BufferGeometry();
    const m1 = geo1.toNonIndexed();
    const m2 = geo2.toNonIndexed();
    const positions = new Float32Array(m1.attributes.position.count * 3 + m2.attributes.position.count * 3);
    positions.set(m1.attributes.position.array, 0);
    positions.set(m2.attributes.position.array, m1.attributes.position.count * 3);
    const normals = new Float32Array(m1.attributes.normal.count * 3 + m2.attributes.normal.count * 3);
    normals.set(m1.attributes.normal.array, 0);
    normals.set(m2.attributes.normal.array, m1.attributes.normal.count * 3);
    merged.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    merged.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    merged.center();
    return merged;
  }, []);

  const glassTextMat = (
    <meshPhysicalMaterial
      {...GLASS_MAT_PROPS}
      opacity={0.5}
      color="#c8c0e8"
      emissive="#9088c0"
      specularColor={new THREE.Color("#ffd0f0")}
    />
  );

  return (
    <>
      <ambientLight intensity={1.4} />
      <directionalLight position={[5, 5, 5]} intensity={2.5} color="#e0e8ff" />
      <directionalLight position={[-4, 3, 4]} intensity={1.0} color="#d4b8ff" />
      <pointLight position={[0, 0, 3]} intensity={0.8} color="#ffd0e0" />
      <group scale={progress * 1.05} rotation={[0, rot, 0]}>
        <mesh geometry={oGeo} position={[-1.6, 0.15, 0]}>
          {glassTextMat}
        </mesh>
        <mesh geometry={nGeo} position={[-0.15, 0, 0]}>
          {glassTextMat}
        </mesh>
        <mesh geometry={eGeo} position={[1.15, 0, 0]}>
          {glassTextMat}
        </mesh>
      </group>
    </>
  );
};

/* ═══════════════ SHARED THREE CANVAS WRAPPER ═══════════════ */
const GlassCanvas: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
  camPos?: [number, number, number];
  fov?: number;
}> = ({ children, style, camPos = [0, 0, 3.5], fov = 50 }) => (
  <div style={{ position: "absolute", ...style }}>
    <ThreeCanvas
      width={460}
      height={420}
      style={{ width: 460, height: 420 }}
      camera={{ position: camPos, fov }}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.1,
      }}
    >
      <Suspense fallback={null}>
        {children}
      </Suspense>
    </ThreeCanvas>
  </div>
);

/* ═══════════════════ 2D COMPONENTS ═══════════════════ */

/* ─── Stock Card ─── */
const StockCard: React.FC<{
  name: string;
  ticker: string;
  price: string;
  x: number;
  y: number;
  opacity: number;
  scale?: number;
  pts?: number[];
  ic?: string;
  z?: number;
  drawProgress?: number;
  float?: number;
}> = ({ name, ticker, price, x, y, opacity, scale = 1, pts, ic = "#6B7AED", z = 1, drawProgress, float = 0 }) => {
  const fy = Math.sin(float * 0.08) * 2.5;
  const shadowBlur = 32 + Math.sin(float * 0.08) * 4;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y + fy,
        opacity,
        background: C.card,
        borderRadius: 16,
        padding: "10px 14px",
        boxShadow: `0 ${8 + fy}px ${shadowBlur}px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)`,
        display: "flex",
        alignItems: "center",
        gap: 10,
        transform: `scale(${scale})`,
        zIndex: z,
      }}
    >
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: 15,
          background: ic,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontSize: 12,
          fontWeight: 700,
          fontFamily: F.b,
          boxShadow: `0 2px 8px ${ic}40`,
        }}
      >
        {ticker.charAt(0)}
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.navy, fontFamily: F.b, whiteSpace: "nowrap" }}>
          {name}
        </div>
        <div style={{ fontSize: 10, color: "#999", fontFamily: F.b }}>{ticker}</div>
      </div>
      <div style={{ textAlign: "right", marginLeft: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.navy, fontFamily: F.b }}>{price}</div>
        <Spark w={40} h={16} pts={pts} drawProgress={drawProgress} />
      </div>
    </div>
  );
};

/* ─── Info Card ─── */
const InfoCard: React.FC<{
  title: string;
  sub?: string;
  val?: string;
  badge?: string;
  badgeColor?: string;
  x: number;
  y: number;
  op: number;
  scale?: number;
  w?: number;
  ic?: string;
  chart?: boolean;
  chartPts?: number[];
  chartDraw?: number;
}> = ({ title, sub, val, badge, badgeColor = C.green, x, y, op, scale = 1, w = 180, ic = "#6B7AED", chart, chartPts, chartDraw }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      opacity: op,
      background: C.card,
      borderRadius: 16,
      padding: "12px 16px",
      boxShadow: "0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)",
      width: w,
      transform: `scale(${scale})`,
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          background: ic,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontSize: 10,
          fontWeight: 700,
          fontFamily: F.b,
          boxShadow: `0 2px 8px ${ic}40`,
        }}
      >
        {title.charAt(0)}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.navy, fontFamily: F.b }}>{title}</div>
        {sub && <div style={{ fontSize: 10, color: "#999", fontFamily: F.b }}>{sub}</div>}
      </div>
    </div>
    {chart && (
      <div style={{ marginTop: 8 }}>
        <Spark w={w - 32} h={36} pts={chartPts || [10, 12, 11, 14, 13, 16, 15, 18, 17, 20]} color={C.green} fill drawProgress={chartDraw} />
      </div>
    )}
    {val && (
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 6 }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: C.navy, fontFamily: F.h }}>{val}</span>
        {badge && (
          <span style={{ fontSize: 10, fontWeight: 600, color: badgeColor, fontFamily: F.b }}>{badge}</span>
        )}
      </div>
    )}
  </div>
);

/* ─── Holdings Card ─── */
const HoldingsCard: React.FC<{ x: number; y: number; op: number; scale?: number }> = ({ x, y, op, scale = 1 }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      opacity: op,
      background: C.card,
      borderRadius: 16,
      padding: "12px 16px",
      boxShadow: "0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)",
      width: 185,
      transform: `scale(${scale})`,
    }}
  >
    <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, fontFamily: F.b, marginBottom: 10 }}>Holdings</div>
    {[
      { name: "Treasury bill", pct: 60, color: "#3949AB" },
      { name: "Treasury bill", pct: 30, color: "#5C6BC0" },
      { name: "Cash", pct: 10, color: "#9FA8DA" },
    ].map((item, i) => (
      <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 7, height: 7, borderRadius: 4, background: item.color }} />
        <div style={{ fontSize: 10, color: C.navy, fontFamily: F.b, flex: 1 }}>{item.name}</div>
        <div style={{ width: 55, height: 5, background: "#f0f0f0", borderRadius: 3 }}>
          <div style={{ width: `${item.pct}%`, height: 5, background: item.color, borderRadius: 3 }} />
        </div>
        <div style={{ fontSize: 9, color: "#999", fontFamily: F.b, width: 26, textAlign: "right" }}>{item.pct}%</div>
      </div>
    ))}
  </div>
);

/* ─── Phone Mockup ─── */
const Phone: React.FC<{
  w?: number;
  h?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ w = 160, h = 310, children, style }) => (
  <div
    style={{
      width: w,
      height: h,
      borderRadius: w * 0.14,
      background: "#fff",
      boxShadow: "0 12px 48px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.08)",
      overflow: "hidden",
      position: "relative",
      ...style,
    }}
  >
    <div
      style={{
        position: "absolute",
        top: 0,
        left: "50%",
        transform: "translateX(-50%)",
        width: w * 0.3,
        height: 18,
        borderRadius: "0 0 12px 12px",
        background: "#000",
        zIndex: 5,
      }}
    />
    {children}
  </div>
);

/* ─── Desktop Mockup ─── */
const Desktop: React.FC<{
  w?: number;
  h?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ w = 420, h = 260, children, style }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", ...style }}>
    <div
      style={{
        width: w,
        height: h,
        borderRadius: 12,
        background: "#fff",
        boxShadow: "0 12px 48px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
        overflow: "hidden",
        border: "1px solid rgba(0,0,0,0.06)",
      }}
    >
      <div
        style={{
          height: 24,
          background: "#f8f8f8",
          borderBottom: "1px solid #eee",
          display: "flex",
          alignItems: "center",
          padding: "0 10px",
          gap: 5,
        }}
      >
        {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
          <div key={c} style={{ width: 8, height: 8, borderRadius: 4, background: c }} />
        ))}
      </div>
      <div style={{ display: "flex", height: h - 24 }}>
        <div style={{ width: 65, borderRight: "1px solid #f0f0f0", padding: "10px 8px" }}>
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 5,
              background: C.blue,
              margin: "0 auto 10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 10,
              fontWeight: 700,
              fontFamily: F.b,
            }}
          >
            P
          </div>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                width: 34,
                height: 4,
                background: i === 0 ? C.navy : "#eee",
                borderRadius: 2,
                margin: "0 auto 7px",
              }}
            />
          ))}
        </div>
        <div style={{ flex: 1, padding: 12 }}>{children}</div>
      </div>
    </div>
    <div style={{ width: 55, height: 20, background: "linear-gradient(180deg, #d0d0d0, #e0e0e0)", borderRadius: "0 0 4px 4px" }} />
    <div style={{ width: 110, height: 6, background: "#d0d0d0", borderRadius: 3 }} />
  </div>
);

/* ─── Background panel chart ─── */
const PanelChart: React.FC<{ w: number; h: number; drawProgress?: number }> = ({ w, h, drawProgress = 1 }) => {
  const pts = [20, 22, 18, 24, 21, 28, 25, 30, 27, 32, 29, 35, 31, 38, 34, 40, 36, 42, 39, 44];
  const mx = Math.max(...pts);
  const mn = Math.min(...pts);
  const r = mx - mn || 1;
  const prog = Math.max(0, Math.min(1, drawProgress));
  const visCount = Math.max(2, Math.ceil(pts.length * prog));
  const visible = pts.slice(0, visCount);
  const d = visible
    .map((p, i) => {
      const px = (i / (pts.length - 1)) * w;
      const py = h - ((p - mn) / r) * (h * 0.5) - h * 0.25;
      return `${i === 0 ? "M" : "L"}${px},${py}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} style={{ position: "absolute", left: 0, top: 0, opacity: 0.3 * prog }}>
      <path d={d} stroke="rgba(180,170,210,0.4)" strokeWidth={1.5} fill="none" />
    </svg>
  );
};

/* ─── Background dots ─── */
const BgDots: React.FC<{ opacity: number; frame?: number }> = ({ opacity, frame = 0 }) => {
  const dx = Math.sin(frame * 0.018) * 6;
  const dy = Math.cos(frame * 0.014) * 4.5;
  return (
    <div
      style={{
        position: "absolute",
        inset: -8,
        opacity,
        backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.03) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
        backgroundPosition: `${dx}px ${dy}px`,
      }}
    />
  );
};

/* ─── Showcase Panel (with 3D glass overlay) ─── */
const Showcase: React.FC<{
  frame: number;
  fps: number;
  start: number;
  dur: number;
  label: string;
  glassScene: React.ReactNode;
  cards: React.ReactNode;
  glassCamPos?: [number, number, number];
  glassFov?: number;
}> = ({ frame, fps, start, dur, label, glassScene, cards, glassCamPos, glassFov }) => {
  const lf = frame - start;
  const enter = spring({ frame: lf, fps, config: { damping: 13, mass: 0.5, stiffness: 130 }, durationInFrames: 15 });
  const exit = spring({ frame: lf - (dur - 10), fps, config: { damping: 200 }, durationInFrames: 10 });
  const op = Math.min(enter, 1) * (1 - exit);
  const tx = interpolate(enter, [0, 1], [35, 0]) + interpolate(exit, [0, 1], [0, -30]);
  const arrowOp = interpolate(lf, [dur * 0.3, dur * 0.42], [0, 1], CL) * (1 - exit);
  const glassProgress = interpolate(lf, [0, 18], [0, 1], CL);

  return (
    <div style={{ position: "absolute", inset: 0, opacity: op, transform: `translateX(${tx}px)` }}>
      <BgDots opacity={0.5} frame={frame} />
      {/* White panel */}
      <div
        style={{
          position: "absolute",
          left: 110,
          top: 80,
          width: 460,
          height: 420,
          borderRadius: 24,
          background: "rgba(255,255,255,0.7)",
          boxShadow: "0 8px 40px rgba(0,0,0,0.06)",
          backdropFilter: "blur(12px)",
          overflow: "hidden",
        }}
      >
        <PanelChart w={460} h={420} drawProgress={interpolate(lf, [4, 25], [0, 1], CL)} />
      </div>
      {/* Three.js glass overlay */}
      <GlassCanvas
        style={{ left: 110, top: 80 }}
        camPos={glassCamPos}
        fov={glassFov}
      >
        {React.cloneElement(glassScene as React.ReactElement, {
          progress: glassProgress,
          frame,
        })}
      </GlassCanvas>
      {/* Cards */}
      {cards}
      {/* Label */}
      <div style={{ position: "absolute", right: 95, top: "50%", transform: "translateY(-50%)" }}>
        <div style={{ fontSize: 68, fontWeight: 700, color: C.navy, fontFamily: F.h, letterSpacing: -1.5 }}>
          {label}
        </div>
        <div style={{ marginTop: 6 }}>
          <Arrow opacity={arrowOp} size={32} />
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════ MAIN SCENE ═══════════════════════ */

export const Scene02: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const sp = (f: number) => spring({ frame: f, fps, config: { damping: 14, mass: 0.6 } });

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>

      {/* ── 1. Stocks (0-28) ── */}
      {frame < 38 && (
        <Showcase
          frame={frame}
          fps={fps}
          start={0}
          dur={28}
          label="Stocks"
          glassScene={<GlassOrbScene progress={0} frame={0} />}
          cards={
            <>
              <StockCard
                name="Green Waters"
                ticker="GREW"
                price="$345.42"
                x={250}
                y={120}
                opacity={sp(frame - 2)}
                scale={sp(frame - 2)}
                pts={[4, 6, 5, 8, 7, 10, 9, 12, 11, 14]}
                ic="#4CAF50"
                z={3}
                drawProgress={interpolate(frame, [4, 12], [0, 1], CL)}
                float={frame}
              />
              <StockCard
                name="StandFindr"
                ticker="STF"
                price="$51.55"
                x={130}
                y={320}
                opacity={sp(frame - 5)}
                scale={sp(frame - 5)}
                pts={[3, 5, 4, 7, 6, 5, 8, 9, 7, 10]}
                ic="#9C27B0"
                z={3}
                drawProgress={interpolate(frame, [7, 15], [0, 1], CL)}
                float={frame + 10}
              />
              <StockCard
                name="Fly Fit"
                ticker="FLF"
                price="$254.24"
                x={320}
                y={410}
                opacity={sp(frame - 8)}
                scale={sp(frame - 8)}
                pts={[6, 8, 7, 10, 12, 11, 14, 13, 16, 15]}
                ic="#FF9800"
                z={3}
                drawProgress={interpolate(frame, [10, 18], [0, 1], CL)}
                float={frame + 20}
              />
            </>
          }
        />
      )}

      {/* ── 2. ETFs (28-68) ── */}
      {frame >= 18 && frame < 78 && (
        <Showcase
          frame={frame}
          fps={fps}
          start={28}
          dur={40}
          label="ETFs"
          glassScene={<GlassDonutScene progress={0} frame={0} />}
          glassCamPos={[0, 0.2, 3.2]}
          cards={
            <>
              <InfoCard
                title="Citizen S&P 500 ETF"
                val="$300.25"
                badge="+2.1%"
                x={160}
                y={115}
                op={sp(frame - 31)}
                scale={sp(frame - 31)}
                w={210}
                ic="#2196F3"
                chart
                chartPts={[8, 10, 9, 12, 11, 14, 13, 16, 15, 18, 17, 20]}
                chartDraw={interpolate(frame, [34, 48], [0, 1], CL)}
              />
              <InfoCard
                title="Citizen S&P 500 is Up"
                x={280}
                y={420}
                op={sp(frame - 38)}
                scale={sp(frame - 38)}
                w={210}
                ic="#FFC107"
              />
            </>
          }
        />
      )}

      {/* ── 3. Crypto (68-96) ── */}
      {frame >= 58 && frame < 106 && (
        <Showcase
          frame={frame}
          fps={fps}
          start={68}
          dur={28}
          label="Crypto"
          glassScene={<GlassCryptoScene progress={0} frame={0} />}
          glassCamPos={[0, 0, 3.0]}
          cards={
            <>
              <InfoCard title="Bitcoin" sub="BTC" x={155} y={115} op={sp(frame - 71)} scale={sp(frame - 71)} w={140} ic="#F7931A" />
              <InfoCard title="Solana" sub="SOL" x={130} y={370} op={sp(frame - 74)} scale={sp(frame - 74)} w={130} ic="#00D18C" />
              <InfoCard title="Ethereum" sub="ETH" x={350} y={390} op={sp(frame - 77)} scale={sp(frame - 77)} w={140} ic="#627EEA" />
            </>
          }
        />
      )}

      {/* ── 4. Treasuries (96-152) ── */}
      {frame >= 86 && frame < 162 && (
        <Showcase
          frame={frame}
          fps={fps}
          start={96}
          dur={56}
          label="Treasuries"
          glassScene={<GlassPillarScene progress={0} frame={0} />}
          glassCamPos={[0, 0, 3.8]}
          cards={
            <>
              <InfoCard
                title="Treasury Account"
                val="$5,585.00"
                badge="+3.44%"
                x={270}
                y={110}
                op={sp(frame - 100)}
                scale={sp(frame - 100)}
                w={220}
                ic="#5C6BC0"
              />
              <HoldingsCard
                x={140}
                y={340}
                op={sp(frame - 106)}
                scale={sp(frame - 106)}
              />
            </>
          }
        />
      )}

      {/* ── 5. "with even more→" + phones (152-212) ── */}
      {frame >= 144 && frame < 220 && (() => {
        const lf = frame - 152;
        const en = sp(lf);
        const ex = spring({ frame: lf - 50, fps, config: { damping: 200 }, durationInFrames: 12 });
        const op = en * (1 - ex);
        const phoneLabels = ["Commercial Real Estate\nPortfolio", "The Rare Sneaker\nPortfolio", "Music Royalties"];
        const phoneColors = ["#4A90D9", "#E91E63", "#9C27B0"];
        const phonePrices = ["$1,289.43", "$345.55", "$345.55"];
        const phonePts = [
          [2, 4, 3, 6, 5, 8, 7, 10, 9, 12],
          [10, 8, 9, 6, 7, 4, 5, 3, 4, 2],
          [4, 6, 8, 6, 9, 7, 10, 12, 10, 14],
        ];
        /* Photographic-style header backgrounds */
        const headerBgs = [
          "linear-gradient(160deg, #5BA0D0 0%, #3B8CC0 20%, #4A9DD8 40%, #2D7AB4 60%, #6CB0E0 80%, #87C4EB 100%)",
          "linear-gradient(160deg, #E8A0B0 0%, #F0B0C0 20%, #E88898 40%, #D87888 60%, #F0A0B0 80%, #F8C0C8 100%)",
          "linear-gradient(160deg, #8B2020 0%, #6B1818 20%, #A03030 40%, #5A1010 60%, #7A2828 80%, #602020 100%)",
        ];
        const phoneXs = [350, 555, 830];
        const phoneWs = [195, 220, 220];
        return (
          <div style={{ position: "absolute", inset: 0, opacity: op }}>
            <BgDots opacity={0.4} frame={frame} />
            <div
              style={{
                position: "absolute",
                left: 60,
                top: "50%",
                transform: `translateY(-50%) translateX(${interpolate(en, [0, 1], [-20, 0])}px)`,
              }}
            >
              <div style={{ fontSize: 52, fontWeight: 700, color: C.navy, fontFamily: F.h, lineHeight: 1.1 }}>
                with even
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 52, fontWeight: 700, color: C.navy, fontFamily: F.h }}>more</span>
                <Arrow opacity={interpolate(lf, [10, 18], [0, 1], CL)} size={32} />
              </div>
            </div>
            {[0, 1, 2].map((i) => {
              const pEn = spring({ frame: lf - i * 6, fps, config: { damping: 12, mass: 0.55, stiffness: 105 } });
              const blurPx = i === 2 ? 1.5 : i === 1 ? 0.3 : 0;
              const floatY = Math.sin((frame + i * 15) * 0.06) * 3 * Math.min(1, pEn);
              return (
                <Phone
                  key={i}
                  w={phoneWs[i]}
                  h={420}
                  style={{
                    position: "absolute",
                    left: phoneXs[i],
                    top: Math.round(interpolate(pEn, [0, 1], [550, 120]) + floatY),
                    opacity: pEn,
                    transform: `perspective(800px) rotateY(${[-3, 0, 3][i]}deg) rotate(${[-1.5, 0, 1.5][i]}deg)`,
                    zIndex: 3 - i,
                    filter: blurPx > 0 ? `blur(${blurPx}px)` : "none",
                  }}
                >
                  {/* Icon + label header */}
                  <div style={{ padding: "24px 14px 6px", display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 14, background: phoneColors[i], display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10, fontWeight: 700, fontFamily: F.b, flexShrink: 0 }}>
                      {phoneLabels[i].charAt(0)}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: C.navy, fontFamily: F.b, lineHeight: 1.2, whiteSpace: "pre-line" }}>
                      {phoneLabels[i]}
                    </div>
                  </div>
                  {/* Photo area */}
                  <div
                    style={{
                      width: "100%",
                      height: 140,
                      background: headerBgs[i],
                    }}
                  />
                  {/* Chart + price */}
                  <div style={{ padding: "10px 14px" }}>
                    <div style={{ fontSize: 9, color: "#999", fontFamily: F.b, marginBottom: 2 }}>Asset value</div>
                    <Spark w={phoneWs[i] - 32} h={40} color={phoneColors[i]} pts={phonePts[i]} fill />
                    <div style={{ fontSize: 16, fontWeight: 700, color: C.navy, fontFamily: F.h, marginTop: 6 }}>{phonePrices[i]}</div>
                    <div style={{ fontSize: 9, color: i === 1 ? C.red : C.green, fontFamily: F.b, marginTop: 2 }}>
                      {i === 1 ? "-5.29%" : "+1.32%"}
                    </div>
                  </div>
                </Phone>
              );
            })}
          </div>
        );
      })()}

      {/* ── 6. "One place" — Three.js glass text (212-258) ── */}
      {frame >= 204 && frame < 266 && (() => {
        const lf = frame - 212;
        const en = sp(lf);
        const ex = spring({ frame: lf - 38, fps, config: { damping: 200 }, durationInFrames: 10 });
        const op = en * (1 - ex);
        const glassProgress = interpolate(lf, [0, 15], [0, 1], CL);
        return (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              opacity: op,
            }}
          >
            {/* Three.js glass "One" */}
            <div style={{ position: "relative", width: 600, height: 280 }}>
              <ThreeCanvas
                width={600}
                height={280}
                style={{ width: 600, height: 280 }}
                camera={{ position: [0, 0, 3.5], fov: 50 }}
                gl={{
                  antialias: true,
                  alpha: true,
                  powerPreference: "high-performance",
                  toneMapping: THREE.ACESFilmicToneMapping,
                  toneMappingExposure: 1.2,
                }}
              >
                <Suspense fallback={null}>
                  <GlassOneTextScene progress={glassProgress} frame={frame} />
                </Suspense>
              </ThreeCanvas>
            </div>
            {/* "place" text below */}
            <div
              style={{
                fontSize: 110,
                fontWeight: 700,
                fontFamily: F.h,
                color: C.blue,
                marginTop: -55,
                letterSpacing: -3,
                textShadow: "0 2px 20px rgba(40,69,224,0.15)",
              }}
            >
              place
            </div>
          </div>
        );
      })()}

      {/* ── 7. "build your portfolio→" (258-308) ── */}
      {frame >= 250 && frame < 316 && (() => {
        const lf = frame - 258;
        const en = sp(lf);
        const ex = spring({ frame: lf - 42, fps, config: { damping: 200 }, durationInFrames: 10 });
        const op = en * (1 - ex);
        return (
          <div style={{ position: "absolute", inset: 0, opacity: op }}>
            <BgDots opacity={0.3} frame={frame} />
            <div
              style={{
                position: "absolute",
                left: 50,
                top: "50%",
                transform: `translateY(calc(-50% + ${interpolate(en, [0, 1], [15, 0])}px)) translateX(${interpolate(en, [0, 1], [-25, 0])}px)`,
              }}
            >
              <Desktop w={420} h={250}>
                <div>
                  <div style={{ fontSize: 9, color: "#999", fontFamily: F.b, marginBottom: 2 }}>Portfolio</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: C.navy, fontFamily: F.h }}>$125,367.10</div>
                  <Spark w={320} h={75} color={C.green} pts={[20, 22, 21, 25, 24, 28, 30, 29, 34, 36, 35, 40, 38, 42, 45]} sw={2} fill />
                  <div style={{ display: "flex", gap: 7, marginTop: 8 }}>
                    {[
                      { l: "S", c: "#4CAF50" },
                      { l: "E", c: "#2196F3" },
                      { l: "C", c: "#F7931A" },
                      { l: "T", c: "#5C6BC0" },
                    ].map(({ l, c }) => (
                      <div
                        key={l}
                        style={{
                          width: 24, height: 24, borderRadius: 12, background: c,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: "#fff", fontSize: 10, fontWeight: 600, fontFamily: F.b,
                          boxShadow: `0 2px 6px ${c}40`,
                        }}
                      >
                        {l}
                      </div>
                    ))}
                  </div>
                </div>
              </Desktop>
              <Phone
                w={90}
                h={175}
                style={{
                  position: "absolute",
                  right: -50,
                  bottom: 25,
                  transform: `perspective(800px) rotateY(-5deg) translateY(${interpolate(sp(lf - 5), [0, 1], [30, 0])}px)`,
                  zIndex: 2,
                }}
              >
                <div style={{ padding: "22px 10px 8px" }}>
                  <Spark w={68} h={38} color={C.green} pts={[4, 6, 5, 8, 10, 12, 11, 15]} fill />
                </div>
              </Phone>
            </div>
            <div
              style={{
                position: "absolute",
                right: 70,
                top: "50%",
                transform: `translateY(-50%) translateX(${interpolate(en, [0, 1], [20, 0])}px)`,
                textAlign: "right",
              }}
            >
              <div style={{ fontSize: 46, fontWeight: 700, color: C.navy, fontFamily: F.h, lineHeight: 1.15 }}>build your</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10 }}>
                <span style={{ fontSize: 46, fontWeight: 700, color: C.navy, fontFamily: F.h }}>portfolio</span>
                <Arrow opacity={interpolate(lf, [12, 18], [0, 1], CL)} size={32} />
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── 8. "the way you want." + phone with 3D rotation (308-364) ── */}
      {frame >= 300 && (() => {
        const lf = frame - 308;
        const leftEn = sp(lf);
        const phoneSpring = spring({ frame: lf - 3, fps, config: { damping: 11, mass: 0.45, stiffness: 95 } });
        const rightEn = sp(Math.max(0, lf - 5));
        const overallOp = sp(lf);

        const rotStart = Math.round(fps * 1.2);
        const rotDur = Math.round(fps * 1.5);
        const rotationY = interpolate(lf, [rotStart, rotStart + rotDur], [0, 180], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.inOut(Easing.cubic),
        });

        const screenOpacity = interpolate(rotationY, [0, 70, 90], [1, 0.3, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        const rotScale = interpolate(lf, [rotStart, rotStart + rotDur * 0.6], [1, 1.08], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        });

        const textFade = interpolate(lf, [rotStart, rotStart + 12], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        const bgBlue = interpolate(lf, [rotStart + rotDur * 0.6, rotStart + rotDur], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.in(Easing.cubic),
        });
        const bgColor = bgBlue > 0
          ? `rgb(${Math.round(245 - 241 * bgBlue)}, ${Math.round(245 - 198 * bgBlue)}, ${Math.round(247 - 3 * bgBlue)})`
          : C.bg;

        const shadowOp = interpolate(rotationY, [0, 90, 180], [0.08, 0.03, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const shadowW = interpolate(rotationY, [0, 180], [160, 60], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        return (
          <div style={{ position: "absolute", inset: 0, opacity: overallOp, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: bgColor }}>
            <BgDots opacity={0.3 * (1 - bgBlue)} frame={frame} />
            <div style={{ position: "absolute", left: 60, top: "50%", transform: `translateY(-50%) translateX(${interpolate(leftEn, [0, 1], [-20, 0])}px)`, opacity: leftEn * textFade }}>
              <span style={{ fontSize: 54, fontWeight: 700, color: C.navy, fontFamily: F.h }}>the way</span>
            </div>
            <div style={{
              position: "relative",
              zIndex: 2,
              opacity: phoneSpring,
              transform: `scale(${rotScale})`,
            }}>
              <Phone
                w={200}
                h={390}
                style={{
                  transform: `perspective(800px) rotateY(${rotationY}deg) rotateX(${2 * (1 - rotationY / 180)}deg) translateY(${interpolate(phoneSpring, [0, 1], [50, 0])}px)`,
                  backfaceVisibility: "hidden",
                }}
              >
                <div style={{ padding: "28px 16px 12px", opacity: screenOpacity }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 12, color: "#999", fontFamily: F.b }}>&#9776;</div>
                    <div style={{ fontSize: 8, color: "#999", fontFamily: F.b }}>Invite</div>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: C.navy, fontFamily: F.h, marginTop: 4 }}>$125,367.10</div>
                  <div style={{ fontSize: 10, color: C.green, fontFamily: F.b, marginTop: 2 }}>Today  +6.40% ($7,540.88)</div>
                  <Spark w={165} h={50} color={C.green} pts={[20, 22, 24, 23, 26, 25, 28, 30, 32, 34, 33, 36, 38, 40, 42]} sw={1.5} fill />
                  <div style={{ display: "flex", gap: 3, marginTop: 6 }}>
                    {["1D", "1W", "1M", "3M", "YTD", "1Y", "ALL"].map((p, i) => (
                      <div key={p} style={{ fontSize: 8, fontWeight: i === 0 ? 700 : 400, color: i === 0 ? C.navy : "#999", background: i === 0 ? "#f0f0f0" : "transparent", borderRadius: 6, padding: "2px 6px", fontFamily: F.b }}>
                        {p}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                    {[{ l: "Equities", v: "$65,190" }, { l: "Crypto", v: "$33,923" }, { l: "Alts", v: "$7,604" }, { l: "Cash", v: "$7,327" }].map(({ l, v }) => (
                      <div key={l} style={{ flex: 1 }}>
                        <div style={{ fontSize: 6, color: "#999", fontFamily: F.b }}>{l}</div>
                        <div style={{ fontSize: 7, fontWeight: 600, color: C.navy, fontFamily: F.b, marginTop: 1 }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ height: 1, background: "#f0f0f0", margin: "10px 0" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontFamily: F.b }}>
                    <span style={{ color: "#999" }}>Buying power</span>
                    <span style={{ color: C.navy, fontWeight: 600 }}>$1,231.40</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    {["Deposit", "Invest"].map((btn) => (
                      <div key={btn} style={{ flex: 1, textAlign: "center", padding: "6px 0", borderRadius: 10, background: btn === "Invest" ? C.navy : "#f5f5f5", color: btn === "Invest" ? "#fff" : C.navy, fontSize: 10, fontWeight: 600, fontFamily: F.b }}>
                        {btn}
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 10, background: "#f8f8fa", borderRadius: 10, padding: "8px 10px", position: "relative" }}>
                    <div style={{ fontSize: 9, color: "#999", fontFamily: F.b }}>Account action</div>
                    <div style={{ fontSize: 8, color: C.navy, fontFamily: F.b, marginTop: 2, lineHeight: 1.3 }}>Transfer an existing portfolio into Public in less than 2 minutes</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                      <span style={{ fontSize: 9, color: C.green, fontFamily: F.b, fontWeight: 600 }}>Transfer a portfolio</span>
                      <span style={{ fontSize: 10, color: "#ccc" }}>&#8250;</span>
                    </div>
                    <div style={{ position: "absolute", top: 8, right: 10, width: 7, height: 7, borderRadius: 4, background: C.blue }} />
                  </div>
                  <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", fontSize: 10, fontWeight: 600, color: C.navy, fontFamily: F.b }}>
                    <span>Assets</span>
                    <span style={{ color: C.blue, fontSize: 9 }}>Price &#8593;</span>
                  </div>
                </div>
              </Phone>
              {/* Phone back face */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  width: 200,
                  height: 390,
                  borderRadius: 200 * 0.14,
                  background: "linear-gradient(180deg, #2A2A2A 0%, #1A1A1A 100%)",
                  boxShadow: "0 12px 48px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.08)",
                  transform: `perspective(800px) rotateY(${rotationY + 180}deg) rotateX(${2 * (1 - rotationY / 180)}deg) translateY(${interpolate(phoneSpring, [0, 1], [50, 0])}px)`,
                  backfaceVisibility: "hidden",
                  overflow: "hidden",
                }}
              >
                <div style={{
                  position: "absolute",
                  top: 20,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 50,
                  height: 50,
                  borderRadius: 14,
                  background: "linear-gradient(135deg, #333 0%, #222 100%)",
                  boxShadow: "inset 0 1px 3px rgba(255,255,255,0.1), 0 2px 6px rgba(0,0,0,0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <div style={{ width: 22, height: 22, borderRadius: 11, background: "linear-gradient(135deg, #111 0%, #1a1a2e 100%)", boxShadow: "inset 0 1px 2px rgba(255,255,255,0.08), 0 0 4px rgba(0,0,0,0.5)" }} />
                </div>
                <div style={{
                  position: "absolute",
                  bottom: 40,
                  left: "50%",
                  transform: "translateX(-50%)",
                  fontSize: 12,
                  color: "rgba(255,255,255,0.15)",
                  fontFamily: F.h,
                  fontWeight: 700,
                  letterSpacing: 2,
                }}>
                  PUBLIC
                </div>
              </div>
              <div style={{ position: "absolute", bottom: -20, left: "50%", transform: "translateX(-50%)", width: shadowW, height: 20, borderRadius: "50%", background: `radial-gradient(ellipse, rgba(0,0,0,${shadowOp}) 0%, transparent 70%)` }} />
            </div>
            <div style={{ position: "absolute", right: 60, top: "50%", transform: `translateY(-50%) translateX(${interpolate(rightEn, [0, 1], [20, 0])}px)`, opacity: rightEn * textFade }}>
              <span style={{ fontSize: 54, fontWeight: 700, color: C.navy, fontFamily: F.h }}>you want.</span>
            </div>
          </div>
        );
      })()}
    </AbsoluteFill>
  );
};

export const scene02Meta = {
  id: "ReplicateScene02",
  component: Scene02,
  width: 1280,
  height: 720,
  fps: 29,
  durationInFrames: 364,
};
