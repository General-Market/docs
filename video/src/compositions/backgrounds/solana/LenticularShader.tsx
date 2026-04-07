import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { Environment, Lightformer } from "@react-three/drei";
import { EffectComposer, Bloom, ToneMapping } from "@react-three/postprocessing";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { ToneMappingMode } from "postprocessing";

const SLAT_COUNT = 48;
const SLAT_WIDTH = 0.065;
const SLAT_GAP = 0.001;
const SLAT_SPACING = SLAT_WIDTH + SLAT_GAP;
const TOTAL_WIDTH = SLAT_COUNT * SLAT_SPACING;
const SLAT_ANGLE = 0.2;

// ── Colored PointLights — localized prismatic pools ──
const AuroraLights: React.FC<{ time: number }> = ({ time }) => {
  const lights = useMemo(
    () => [
      { color: "#00cc88", s: 0.15, p: 0, y: 0.8, r: 2.0 },
      { color: "#7744cc", s: 0.18, p: 2.4, y: 1.0, r: 1.8 },
      { color: "#00bbaa", s: 0.16, p: 0.8, y: 0.9, r: 1.6 },
      { color: "#00ff88", s: 0.12, p: 1.2, y: 0.0, r: 2.2 },
      { color: "#ff6b00", s: 0.14, p: 4.8, y: 0.1, r: 1.9 },
      { color: "#0066ff", s: 0.1, p: 3.6, y: -0.1, r: 2.0 },
      { color: "#ff1493", s: 0.09, p: 5.0, y: 0.2, r: 1.7 },
      { color: "#ff69b4", s: 0.11, p: 2.0, y: -0.6, r: 2.3 },
      { color: "#33ff55", s: 0.13, p: 3.2, y: -0.8, r: 1.5 },
      { color: "#ffaa00", s: 0.17, p: 1.6, y: -0.9, r: 1.8 },
      { color: "#22cc66", s: 0.08, p: 0.5, y: 0.5, r: 2.8 },
      { color: "#00ddaa", s: 0.07, p: 3.0, y: -0.3, r: 3.0 },
      { color: "#9955ff", s: 0.06, p: 1.8, y: 0.7, r: 2.5 },
      { color: "#dd8800", s: 0.1, p: 4.2, y: -0.5, r: 2.6 },
    ],
    []
  );

  return (
    <>
      {lights.map((l, i) => {
        // Wave-like horizontal sweep: sin creates a traveling wave across X
        const wave = Math.sin(time * l.s * 1.5 + l.p + i * 0.4) * 0.3;
        const x = Math.sin(time * l.s * 2 + l.p) * l.r;
        const y = Math.cos(time * l.s * 1.5 + l.p * 0.7) * 1.2 + l.y + wave;
        const z = 0.3 + Math.sin(time * l.s + l.p * 1.3) * 0.4;
        return (
          <pointLight
            key={i}
            color={l.color}
            intensity={45}
            distance={8}
            decay={1.0}
            position={[x, y, z]}
          />
        );
      })}
      <ambientLight intensity={0.01} color="#080814" />
    </>
  );
};

// ── Sparse Lightformers — subtle colored tints in environment reflections ──
const EnvLightformers: React.FC<{ time: number }> = ({ time }) => (
  <>
    {/* Large soft colored panels — visible as broad tints in metal reflections */}
    <Lightformer form="rect" intensity={1.0} color="#ff2288" scale={[6, 2, 1]}
      position={[Math.sin(time * 0.08) * 6, 4, -6]}
      rotation={[0, time * 0.03, 0]} />
    <Lightformer form="rect" intensity={0.8} color="#00bb77" scale={[7, 2, 1]}
      position={[Math.cos(time * 0.06) * 7, -3, -5]}
      rotation={[0, time * 0.025 + 1.5, 0]} />
    <Lightformer form="circle" intensity={1.2} color="#6644dd" scale={3}
      position={[Math.sin(time * 0.1 + 2) * 5, 5, Math.cos(time * 0.08) * 6]} />
    <Lightformer form="rect" intensity={0.6} color="#ffaa22" scale={[5, 1.5, 1]}
      position={[0, -5, Math.sin(time * 0.05) * 7]}
      rotation={[0, time * 0.02 + 3, 0]} />
    {/* White key strips for specular definition */}
    <Lightformer form="rect" intensity={0.5} color="#ffffff" scale={[12, 0.5, 1]}
      position={[0, 7, -3]} />
    <Lightformer form="rect" intensity={0.3} color="#ffffff" scale={[12, 0.5, 1]}
      position={[0, -7, -3]} />
  </>
);

// ── Twist field for the curtain ──
// Each slat is a thin ribbon. We twist its vertices around the Y axis so
// the visible rotation varies with the vertex's Y position. The twist
// amount also depends on the slat's X position. Result is a saddle/
// hyperbolic surface where opposite-sign quadrants (BR/TL) lie flat to
// the camera and same-sign quadrants (BL/TR) read edge-on, with smooth
// tension linking the two. The diagonals of the curtain pull against
// each other.
const SLAT_HEIGHT = 5.0;
const TWIST_SHARPNESS = 2.4; // higher = corners snap harder to flat/edge

const twistAt = (slatX: number, vertexY: number) => {
  const xn = slatX / (TOTAL_WIDTH / 2); // -1..1
  const yn = vertexY / (SLAT_HEIGHT / 2); // -1..1
  // tanh maps R → (-1, 1). product xn*yn carries the diagonal sign.
  // Output is in (0, π/2). At BR / TL → 0 (flat). At BL / TR → π/2 (edge-on).
  return (Math.PI / 4) * (1 + Math.tanh(xn * yn * TWIST_SHARPNESS));
};

const buildTwistedSlatGeometry = (slatX: number) => {
  const segments = 36;
  const geom = new THREE.PlaneGeometry(SLAT_WIDTH, SLAT_HEIGHT, 1, segments);
  const positions = geom.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const px = positions.getX(i);
    const py = positions.getY(i);
    const pz = positions.getZ(i);
    const angle = twistAt(slatX, py);
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    // Rotate (x, z) around the Y axis through the slat's center.
    positions.setX(i, px * c - pz * s);
    positions.setZ(i, px * s + pz * c);
  }
  positions.needsUpdate = true;
  geom.computeVertexNormals();
  return geom;
};

// ── Iridescent metallic slats ──
const SlatArray: React.FC<{ time: number }> = ({ time }) => {
  const slats = useMemo(() => {
    const arr: {
      x: number;
      roughness: number;
      thMin: number;
      thMax: number;
      geometry: THREE.PlaneGeometry;
    }[] = [];
    for (let i = 0; i < SLAT_COUNT; i++) {
      const x = -TOTAL_WIDTH / 2 + i * SLAT_SPACING + SLAT_WIDTH / 2;
      arr.push({
        x,
        roughness: 0.2 + (i % 7) * 0.025,
        thMin: 80 + (i % 5) * 50,
        thMax: 350 + (i % 3) * 180,
        geometry: buildTwistedSlatGeometry(x),
      });
    }
    return arr;
  }, []);

  // Slow global oscillation — the whole field breathes
  const breathe = Math.sin(time * 0.12) * 0.02;

  return (
    <group rotation={[0, breathe, 0]}>
      {slats.map((s, i) => (
        <mesh key={i} position={[s.x, 0, 0]} geometry={s.geometry}>
          <meshPhysicalMaterial
            color="#0a0a14"
            metalness={0.85}
            roughness={s.roughness}
            clearcoat={0.8}
            clearcoatRoughness={0.08}
            reflectivity={0.95}
            envMapIntensity={3.0}
            iridescence={0.9}
            iridescenceIOR={2.0}
            iridescenceThicknessRange={[s.thMin, s.thMax]}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
};

// ── Emissive backdrop ribbons ──
const AuroraBackdrop: React.FC<{ time: number }> = ({ time }) => {
  const ribbons = useMemo(
    () => [
      { color: "#ff1493", y: 0.4, w: 6, h: 2.5 },
      { color: "#00cc66", y: -0.6, w: 5.5, h: 2.0 },
      { color: "#6633ff", y: 1.2, w: 5, h: 1.8 },
      { color: "#ff8800", y: -1.0, w: 6.5, h: 2.2 },
      { color: "#00aaff", y: 0.0, w: 6, h: 2.0 },
      { color: "#ff44aa", y: -1.5, w: 5.5, h: 1.8 },
      { color: "#22ffbb", y: 0.9, w: 5, h: 1.5 },
      { color: "#aa44ff", y: -0.3, w: 6, h: 2.3 },
      { color: "#ff6644", y: 1.5, w: 5, h: 1.6 },
      { color: "#44ccff", y: -1.8, w: 5.5, h: 1.8 },
    ],
    []
  );

  return (
    <group position={[0, 0, -1.5]}>
      {ribbons.map((r, i) => {
        // Horizontal wave motion — ribbons sweep left-right like aurora
        const waveX = Math.sin(time * 0.18 + i * 1.1) * 2.0;
        const waveY =
          r.y +
          Math.cos(time * 0.13 + i * 0.8) * 0.6 +
          Math.sin(time * 0.22 + i * 0.6) * 0.3;
        const rot = Math.sin(time * 0.09 + i * 0.5) * 0.3;
        return (
          <mesh
            key={i}
            position={[waveX, waveY, -i * 0.04]}
            rotation={[0, 0, rot]}
          >
            <planeGeometry args={[r.w, r.h]} />
            <meshBasicMaterial
              color={r.color}
              transparent
              opacity={0.9}
              side={THREE.DoubleSide}
              toneMapped={false}
            />
          </mesh>
        );
      })}
    </group>
  );
};

// ── Camera ──
const CameraRig: React.FC<{ time: number; progress: number }> = ({
  time,
  progress,
}) => {
  const { camera } = useThree();

  const x = Math.sin(time * 0.07) * 0.06;
  const y = Math.cos(time * 0.05) * 0.03;
  const z = interpolate(progress, [0, 0.5, 1], [1.5, 1.3, 1.5], {
    extrapolateRight: "clamp",
  });

  camera.position.set(x, y, z);
  camera.lookAt(0, 0, 0);
  return null;
};

// ── Scene ──
const LenticularScene: React.FC<{ frame: number }> = ({ frame }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const time = frame / fps;
  const progress = frame / durationInFrames;

  return (
    <>
      <CameraRig time={time} progress={progress} />

      {/* Dark environment with sparse Lightformers for subtle reflection color */}
      <Environment
        frames={Infinity}
        resolution={256}
        background={false}
        environmentIntensity={0.15}
      >
        <color attach="background" args={["#000000"]} />
        <EnvLightformers time={time} />
      </Environment>

      {/* White directional for iridescence activation — iridescence needs
          actual light hitting the surface to trigger the thin-film color shift */}
      <directionalLight
        color="#ffffff"
        intensity={4}
        position={[
          -2 + Math.sin(time * 0.12) * 1.5,
          2 + Math.cos(time * 0.09) * 1,
          3.5,
        ]}
      />

      {/* Colored PointLights for localized prismatic pools */}
      <AuroraLights time={time} />
      <AuroraBackdrop time={time} />
      <SlatArray time={time} />

      {/* Post-processing: bloom softens specular highlights into glow halos,
          AgX tone mapping preserves prismatic hue separation */}
      <EffectComposer>
        <Bloom
          luminanceThreshold={0.8}
          luminanceSmoothing={0.3}
          intensity={0.6}
          mipmapBlur
        />
        <ToneMapping mode={ToneMappingMode.AGX} />
      </EffectComposer>
    </>
  );
};

export const LenticularBackground: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  return (
    <ThreeCanvas
      width={width}
      height={height}
      camera={{
        fov: 50,
        near: 0.001,
        far: 50,
        position: [0, 0, 1.5],
      }}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
        // Disable built-in tone mapping — EffectComposer handles it via AgX
        toneMapping: THREE.NoToneMapping,
      }}
      style={{ background: "#000000" }}
    >
      <React.Suspense fallback={null}>
        <LenticularScene frame={frame} />
      </React.Suspense>
    </ThreeCanvas>
  );
};
