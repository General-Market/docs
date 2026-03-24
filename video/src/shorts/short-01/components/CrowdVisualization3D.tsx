import React, { useMemo, useRef, useEffect } from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  AbsoluteFill,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  variant: "growing" | "static";
  counterTarget?: number;
  hideCounter?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FIGURE_COUNT = 2500;
const PARTICLE_COUNT = 300;
const RING_COUNT = 35;

const COLOR_WHITE = "#FFFFFF";
const COLOR_YELLOW = "#FFE500";
const COLOR_GREEN = "#00FF88";
const COLOR_BG = "#0A0A0A";

const fontFamily = "'Courier New', 'Courier', monospace";
const MAX_TEXT_WIDTH = 940;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function formatNumber(n: number): string {
  return Math.floor(n).toLocaleString("en-US");
}

function hexToThreeColor(hex: string): THREE.Color {
  return new THREE.Color(hex);
}

const autoFontSize = (
  text: string,
  maxSize: number,
  charWidthRatio = 0.6,
  extraSpacingPerChar = 0,
): number => {
  const totalWidth =
    text.length * maxSize * charWidthRatio +
    (text.length - 1) * extraSpacingPerChar;
  if (totalWidth <= MAX_TEXT_WIDTH) return maxSize;
  return Math.floor(
    MAX_TEXT_WIDTH /
      (text.length * charWidthRatio +
        ((text.length - 1) * extraSpacingPerChar) / maxSize),
  );
};

// ---------------------------------------------------------------------------
// Figure data generation — concentric rings on ground plane
// ---------------------------------------------------------------------------

interface FigureData {
  x: number;
  z: number;
  scale: number;
  colorIndex: number; // 0=white, 1=yellow, 2=green
  distFromCenter: number; // normalized 0..1
  delay: number; // frame delay for wave
  idleSway: number; // random phase for idle animation
}

function buildCrowdFigures(count: number): FigureData[] {
  const rng = mulberry32(42069);
  const figures: FigureData[] = [];

  // Concentric rings from center outward
  const maxRadius = 28;

  for (let ring = 0; ring < RING_COUNT; ring++) {
    if (figures.length >= count) break;

    const ringT = ring / (RING_COUNT - 1); // 0..1
    const ringRadius = 1.5 + ringT * (maxRadius - 1.5);

    // More figures in outer rings (circumference grows)
    const circumference = 2 * Math.PI * ringRadius;
    const spacing = 0.85 + rng() * 0.15;
    const figuresInRing = Math.min(
      Math.floor(circumference / spacing),
      count - figures.length,
    );

    for (let i = 0; i < figuresInRing; i++) {
      if (figures.length >= count) break;

      const angle = (i / figuresInRing) * Math.PI * 2 + rng() * 0.3;
      const radiusJitter = ringRadius + (rng() - 0.5) * 0.6;

      const x = Math.cos(angle) * radiusJitter;
      const z = Math.sin(angle) * radiusJitter;

      const normalizedDist = Math.min(1, radiusJitter / maxRadius);

      // Scale: slight random variation, slightly smaller at edges
      const scale = (0.7 + rng() * 0.5) * (1 - normalizedDist * 0.2);

      // Color distribution: mostly white, some yellow, some green
      const colorRoll = rng();
      const colorIndex = colorRoll < 0.6 ? 0 : colorRoll < 0.82 ? 1 : 2;

      figures.push({
        x,
        z,
        scale,
        colorIndex,
        distFromCenter: normalizedDist,
        delay: normalizedDist * 30 + rng() * 8,
        idleSway: rng() * Math.PI * 2,
      });
    }
  }

  return figures;
}

// ---------------------------------------------------------------------------
// Particle data
// ---------------------------------------------------------------------------

interface ParticleData {
  x: number;
  y: number;
  z: number;
  speed: number;
  phase: number;
}

function buildParticles(count: number): ParticleData[] {
  const rng = mulberry32(7777);
  return Array.from({ length: count }, () => ({
    x: (rng() - 0.5) * 50,
    y: rng() * 20,
    z: (rng() - 0.5) * 50,
    speed: 0.01 + rng() * 0.03,
    phase: rng() * Math.PI * 2,
  }));
}

// ---------------------------------------------------------------------------
// Three.js color palette
// ---------------------------------------------------------------------------

const PALETTE_COLORS = [
  hexToThreeColor(COLOR_WHITE),
  hexToThreeColor(COLOR_YELLOW),
  hexToThreeColor(COLOR_GREEN),
];

// ---------------------------------------------------------------------------
// CrowdInstances — the instanced mesh of capsule figures
// ---------------------------------------------------------------------------

const CrowdInstances: React.FC<{
  figures: FigureData[];
  frame: number;
  isGrowing: boolean;
  crowdProgress: number;
}> = ({ figures, frame, isGrowing, crowdProgress }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Pre-compute colors once
  const colorArray = useMemo(() => {
    const arr = new Float32Array(figures.length * 3);
    for (let i = 0; i < figures.length; i++) {
      const col = PALETTE_COLORS[figures[i].colorIndex];
      arr[i * 3] = col.r;
      arr[i * 3 + 1] = col.g;
      arr[i * 3 + 2] = col.b;
    }
    return arr;
  }, [figures]);

  // Update instance matrices every frame
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    // Set per-instance colors via instanced buffer attribute
    const colorAttr = new THREE.InstancedBufferAttribute(colorArray, 3);
    mesh.geometry.setAttribute("color", colorAttr);
  }, [colorArray]);

  // Update transforms each render
  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    for (let i = 0; i < figures.length; i++) {
      const fig = figures[i];

      // Wave appearance
      const waveThreshold = fig.delay / 38;
      let figAppear = 1;
      if (isGrowing) {
        figAppear = Math.max(
          0,
          Math.min(
            1,
            (crowdProgress - Math.max(0, waveThreshold - 0.05)) /
              Math.max(0.01, Math.min(1, waveThreshold + 0.12) - Math.max(0, waveThreshold - 0.05)),
          ),
        );
      }

      if (figAppear <= 0) {
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        continue;
      }

      // Idle sway — gentle rocking
      const sway = Math.sin(frame * 0.025 + fig.idleSway) * 0.06;

      // Scale with wave pop-in
      const s = fig.scale * (isGrowing ? 0.4 + 0.6 * figAppear : 1);

      dummy.position.set(fig.x, s * 0.35, fig.z);
      dummy.rotation.set(0, sway, 0);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
  });

  // Capsule geometry: 4 cap segments, 8 radial = ~80 tris per figure
  const geometry = useMemo(
    () => new THREE.CapsuleGeometry(0.15, 0.5, 4, 8),
    [],
  );

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, figures.length]}
      frustumCulled={false}
    >
      <meshStandardMaterial
        vertexColors
        roughness={0.6}
        metalness={0.1}
        emissive={new THREE.Color(COLOR_YELLOW)}
        emissiveIntensity={0.2}
      />
    </instancedMesh>
  );
};

// ---------------------------------------------------------------------------
// Atmospheric particles — Points with additive blending
// ---------------------------------------------------------------------------

const AtmosphericParticles: React.FC<{
  particles: ParticleData[];
  frame: number;
}> = ({ particles, frame }) => {
  const pointsRef = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const arr = new Float32Array(particles.length * 3);
    for (let i = 0; i < particles.length; i++) {
      arr[i * 3] = particles[i].x;
      arr[i * 3 + 1] = particles[i].y;
      arr[i * 3 + 2] = particles[i].z;
    }
    return arr;
  }, [particles]);

  useFrame(() => {
    const pts = pointsRef.current;
    if (!pts) return;

    const posAttr = pts.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      // Drift upward, wrap around
      let y = p.y + p.speed * frame;
      y = ((y % 25) + 25) % 25;
      arr[i * 3 + 1] = y;
      // Subtle horizontal sway
      arr[i * 3] = p.x + Math.sin(frame * 0.015 + p.phase) * 0.5;
    }

    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.08}
        color={COLOR_YELLOW}
        transparent
        opacity={0.4}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
};

// ---------------------------------------------------------------------------
// Ground plane — dark disc beneath the crowd
// ---------------------------------------------------------------------------

const GroundPlane: React.FC = () => (
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
    <circleGeometry args={[35, 64]} />
    <meshStandardMaterial
      color="#050505"
      roughness={0.95}
      metalness={0}
    />
  </mesh>
);

// ---------------------------------------------------------------------------
// Camera controller — animated push-in
// ---------------------------------------------------------------------------

const CameraController: React.FC<{
  frame: number;
  durationFrames: number;
}> = ({ frame, durationFrames }) => {
  const { camera } = useThree();

  useFrame(() => {
    // Animate over the full shot duration
    const t = Math.min(1, frame / Math.max(1, durationFrames));

    // Start: high and back, looking down at the crowd
    // End: lower and closer, more immersed
    const startPos = { x: 0, y: 18, z: 22 };
    const endPos = { x: 0, y: 5, z: 10 };

    const x = startPos.x + (endPos.x - startPos.x) * t;
    const y = startPos.y + (endPos.y - startPos.y) * t;
    const z = startPos.z + (endPos.z - startPos.z) * t;

    camera.position.set(x, y, z);

    // Look at point also descends slightly
    const lookY = 2 - t * 1.5;
    camera.lookAt(0, lookY, 0);
  });

  return null;
};

// ---------------------------------------------------------------------------
// CrowdScene — full 3D scene
// ---------------------------------------------------------------------------

const CrowdScene: React.FC<{
  frame: number;
  isGrowing: boolean;
  crowdProgress: number;
  durationFrames: number;
  figures: FigureData[];
  particles: ParticleData[];
}> = ({ frame, isGrowing, crowdProgress, durationFrames, figures, particles }) => {
  const { scene } = useThree();

  // Set fog once
  useEffect(() => {
    scene.fog = new THREE.FogExp2(COLOR_BG, 0.045);
    scene.background = new THREE.Color(COLOR_BG);
    return () => {
      scene.fog = null;
      scene.background = null;
    };
  }, [scene]);

  return (
    <>
      {/* Lighting */}
      {/* Dim ambient fill */}
      <ambientLight intensity={0.15} color="#aaaaaa" />

      {/* Warm top-down key light */}
      <directionalLight
        position={[0, 20, 2]}
        intensity={1.2}
        color="#FFF5E0"
      />

      {/* Golden rim light from behind the crowd */}
      <directionalLight
        position={[0, 8, -15]}
        intensity={0.8}
        color="#FFD700"
      />

      {/* Subtle green fill from side */}
      <pointLight
        position={[15, 5, 0]}
        intensity={0.4}
        color="#00FF88"
        distance={30}
        decay={2}
      />

      {/* Camera animation */}
      <CameraController frame={frame} durationFrames={durationFrames} />

      {/* Ground plane */}
      <GroundPlane />

      {/* Crowd instances */}
      <CrowdInstances
        figures={figures}
        frame={frame}
        isGrowing={isGrowing}
        crowdProgress={crowdProgress}
      />

      {/* Atmospheric particles */}
      <AtmosphericParticles particles={particles} frame={frame} />
    </>
  );
};

// ---------------------------------------------------------------------------
// Main component — CrowdVisualization3D
// ---------------------------------------------------------------------------

export const CrowdVisualization3D: React.FC<Props> = ({
  variant,
  counterTarget = 800_000_000,
  hideCounter = false,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const isGrowing = variant === "growing";

  // Memoize generated data
  const figures = useMemo(() => buildCrowdFigures(FIGURE_COUNT), []);
  const particles = useMemo(() => buildParticles(PARTICLE_COUNT), []);

  // ---------------------------------------------------------------------------
  // Animation timing (matching 2D version)
  // ---------------------------------------------------------------------------

  const crowdProgress = isGrowing
    ? interpolate(frame, [0, 50], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1;

  // Counter animation
  const counterEndFrame = isGrowing ? 70 : 0;
  const counterRaw = isGrowing
    ? interpolate(frame, [5, counterEndFrame], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1;
  const counterEased =
    counterRaw < 0.5
      ? 4 * counterRaw * counterRaw * counterRaw
      : 1 - Math.pow(-2 * counterRaw + 2, 3) / 2;
  const counterValue = Math.floor(counterEased * counterTarget);

  // Counter slam spring
  const counterLandFrame = counterEndFrame + 1;
  const counterScaleSpring = isGrowing
    ? spring({
        frame: Math.max(0, frame - counterLandFrame),
        fps,
        config: { damping: 8, stiffness: 300, mass: 0.4 },
        durationInFrames: 15,
      })
    : 1;
  const counterScale =
    isGrowing && frame >= counterLandFrame
      ? 1 + (1 - counterScaleSpring) * 0.3
      : 1;

  // Glow pulse
  const glowSize =
    frame >= counterLandFrame
      ? 30 + Math.sin(frame * 0.15) * 10
      : interpolate(frame, [0, counterEndFrame], [4, 20], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

  // Shot duration estimate (used for camera animation pace)
  const durationFrames = 120; // ~4s at 30fps — typical shot length

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: COLOR_BG }}>
      {/* 3D Canvas */}
      <ThreeCanvas
        width={width}
        height={height}
        camera={{
          fov: 55,
          near: 0.1,
          far: 80,
          position: [0, 18, 22],
        }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
        }}
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        <CrowdScene
          frame={frame}
          isGrowing={isGrowing}
          crowdProgress={crowdProgress}
          durationFrames={durationFrames}
          figures={figures}
          particles={particles}
        />
      </ThreeCanvas>

      {/* Counter overlay — 2D on top of the 3D scene */}
      {!hideCounter && (
        <div
          style={{
            position: "absolute",
            top: height * 0.1,
            left: 0,
            right: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
            pointerEvents: "none",
          }}
        >
          {/* Main number */}
          <span
            style={{
              fontFamily,
              color: COLOR_WHITE,
              fontSize: autoFontSize(
                formatNumber(counterValue),
                120,
                0.6,
                3,
              ),
              fontWeight: 900,
              letterSpacing: 3,
              transform: `scale(${counterScale})`,
              textShadow: [
                `0 0 ${glowSize}px ${hexRgba(COLOR_YELLOW, 0.8)}`,
                `0 0 ${glowSize * 2}px ${hexRgba(COLOR_YELLOW, 0.4)}`,
                `0 0 ${glowSize * 3}px ${hexRgba(COLOR_YELLOW, 0.2)}`,
                `0 2px 20px rgba(0,0,0,0.9)`,
              ].join(", "),
              textAlign: "center",
              display: "inline-block",
            }}
          >
            {formatNumber(counterValue)}
          </span>

          {/* "ANALYSTS" label */}
          <span
            style={{
              fontFamily,
              color: hexRgba(COLOR_WHITE, 0.85),
              fontSize: autoFontSize("ANALYSTS", 60, 0.62, 16),
              fontWeight: 700,
              letterSpacing: 16,
              marginTop: 10,
              textShadow: [
                `0 0 ${glowSize * 0.6}px ${hexRgba(COLOR_YELLOW, 0.4)}`,
                `0 2px 15px rgba(0,0,0,0.9)`,
              ].join(", "),
              textAlign: "center",
              opacity: isGrowing
                ? interpolate(frame, [20, 35], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  })
                : 1,
            }}
          >
            ANALYSTS
          </span>
        </div>
      )}

      {/* Vignette for depth — over both 3D and counter */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 50% 55%, transparent 30%, rgba(0,0,0,0.6) 100%)",
          pointerEvents: "none",
          zIndex: 11,
        }}
      />
    </AbsoluteFill>
  );
};
