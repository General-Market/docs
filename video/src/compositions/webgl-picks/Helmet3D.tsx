// Source: https://github.com/matdn/helmet
import React, { useEffect, useMemo, useRef } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  staticFile,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { useGLTF, useTexture, Environment } from "@react-three/drei";
import * as THREE from "three";

const HELMET_URL = staticFile("models/helmet.glb");
useGLTF.preload(HELMET_URL);

const IMAGE_URLS = Array.from({ length: 9 }, (_, i) =>
  staticFile(`tube/im${i + 1}.jpg`),
);

// ── Grid background — vertex-displaced plane with scrolling grid lines ──

const GRID_VERT = `
  varying vec2 vUv;
  uniform float uEdgeWidth;
  uniform float uEdgeAmp;
  uniform float uCenterRadius;
  uniform float uCenterAmp;
  uniform vec2 uCenter;

  void main() {
    vUv = uv;
    vec3 p = position;

    float dEdge = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
    float edgeMask = 1.0 - smoothstep(0.0, uEdgeWidth, dEdge);

    float dCenter = distance(vUv, uCenter);
    float centerMask = 1.0 - smoothstep(0.0, uCenterRadius, dCenter);

    p.z += edgeMask * uEdgeAmp + centerMask * uCenterAmp;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const GRID_FRAG = `
  varying vec2 vUv;
  uniform float uGridScale;
  uniform float uLineWidth;
  uniform float uTime;
  uniform float uScrollSpeed;

  float gridLine(float coord, float width) {
    float fw = fwidth(coord);
    float p = abs(fract(coord - 0.5) - 0.5);
    return 1.0 - smoothstep(width * fw, (width + 1.0) * fw, p);
  }

  void main() {
    vec2 uv = (vUv + vec2(uTime * uScrollSpeed, 0.0)) * uGridScale;
    float gx = gridLine(uv.x, uLineWidth);
    float gy = gridLine(uv.y, uLineWidth);
    float g = max(gx, gy);

    vec3 base = vec3(0.0);
    vec3 line = vec3(0.1);
    vec3 col = mix(base, line, g);
    gl_FragColor = vec4(col, 1.0);
  }
`;

const GridPlane: React.FC<{ time: number; centerX: number; centerY: number }> =
  ({ time, centerX, centerY }) => {
    const matRef = useRef<THREE.ShaderMaterial>(null);

    const uniforms = useMemo(
      () => ({
        uGridScale: { value: 28.0 },
        uLineWidth: { value: 0.5 },
        uEdgeWidth: { value: 0.14 },
        uEdgeAmp: { value: 1.35 },
        uCenterRadius: { value: 0.22 },
        uCenterAmp: { value: 0.9 },
        uCenter: { value: new THREE.Vector2(0.5, 0.5) },
        uTime: { value: 0.0 },
        uScrollSpeed: { value: 0.01 },
      }),
      [],
    );

    if (matRef.current) {
      matRef.current.uniforms.uTime.value = time;
      matRef.current.uniforms.uCenter.value.set(centerX, centerY);
    }

    return (
      <mesh position={[0, 0, -5.2]}>
        <planeGeometry args={[18, 18, 512, 512]} />
        <shaderMaterial
          ref={matRef}
          uniforms={uniforms}
          vertexShader={GRID_VERT}
          fragmentShader={GRID_FRAG}
          side={THREE.DoubleSide}
        />
      </mesh>
    );
  };

// ── Helmet — glass-material GLB that counter-rotates with the tube ──

const HelmetModel: React.FC<{ angle: number }> = ({ angle }) => {
  const { scene } = useGLTF(HELMET_URL);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  const ref = useRef<THREE.Object3D>(null);

  const glassMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        transmission: 1,
        thickness: 10,
        roughness: 0,
        metalness: 0.1,
        ior: 1.9,
        dispersion: 1,
        clearcoat: 0.1,
        clearcoatRoughness: 1.1,
        iridescenceThicknessRange: [100, 400],
        color: new THREE.Color("transparent"),
        transparent: true,
        depthWrite: true,
      }),
    [],
  );

  useEffect(() => {
    cloned.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.scale.set(0.7, 0.7, 0.7);
        obj.material = glassMat;
        obj.material.needsUpdate = true;
      }
    });
    return () => {
      glassMat.dispose();
    };
  }, [cloned, glassMat]);

  const baseX = Math.PI / 8;
  const baseY = Math.PI / 2;

  if (ref.current) {
    ref.current.rotation.x = baseX;
    ref.current.rotation.y = baseY - angle;
  }

  return (
    <primitive
      ref={ref}
      object={cloned}
      rotation={[baseX, baseY, 0]}
    />
  );
};

// ── Image Tube — cylindrical rows of image tiles, each row at its own speed ──

const ROWS = 5;
const COLS = 12;
const RADIUS = 4;
const TILE_W = 0.72;
const TILE_H = 1.0;
const Y_SPACING = 2.7;
const REPEAT_COUNT = 3;
const TOTAL_ROWS = ROWS * REPEAT_COUNT;

const ROW_SPEEDS = (() => {
  const speeds: number[] = [];
  for (let r = 0; r < ROWS; r++) {
    const t = ROWS <= 1 ? 0 : r / (ROWS - 1);
    speeds.push(0.65 + t * 0.9);
  }
  return speeds;
})();

const ROW_POSITIONS = (() => {
  const out: Array<{ rowIndex: number; y: number; baseRow: number; rowOffset: number }> = [];
  for (let ri = 0; ri < TOTAL_ROWS; ri++) {
    const y = (ri - (TOTAL_ROWS - 1) / 2) * Y_SPACING;
    const baseRow = ri % ROWS;
    const rowOffset = baseRow % 2 === 0 ? 0 : 0.5;
    out.push({ rowIndex: ri, y, baseRow, rowOffset });
  }
  return out;
})();

const ImageTube: React.FC<{ angle: number; scrollY: number }> = ({
  angle,
  scrollY,
}) => {
  const textures = useTexture(IMAGE_URLS);

  return (
    <group position={[0, -scrollY, 0]}>
      {ROW_POSITIONS.map(({ rowIndex, y, baseRow, rowOffset }) => {
        const rowAngle = angle * ROW_SPEEDS[baseRow];
        return (
          <group key={rowIndex} position={[0, y, 0]} rotation={[0, rowAngle, 0]}>
            {Array.from({ length: COLS }, (_, col) => {
              const theta = ((col + rowOffset) / COLS) * Math.PI * 2;
              const x = Math.cos(theta) * RADIUS;
              const z = Math.sin(theta) * RADIUS;
              const ry = -(theta + Math.PI / 2);
              const texIdx = (baseRow * COLS + col) % IMAGE_URLS.length;

              return (
                <mesh key={col} position={[x, 0, z]} rotation={[0, ry, 0]}>
                  <planeGeometry args={[TILE_W, TILE_H]} />
                  <meshBasicMaterial
                    map={textures[texIdx]}
                    toneMapped={false}
                    side={THREE.DoubleSide}
                  />
                </mesh>
              );
            })}
          </group>
        );
      })}
    </group>
  );
};

// ── Camera controller — orbits gently through the scene ──

const CameraRig: React.FC<{ frame: number; totalFrames: number }> = ({
  frame,
  totalFrames,
}) => {
  const { camera } = useThree();

  const progress = frame / totalFrames;

  // Gentle vertical drift
  const camY = interpolate(progress, [0, 0.5, 1], [1.5, -0.5, 1.5], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Subtle lateral sway
  const sway = Math.sin(progress * Math.PI * 2) * 0.8;

  // Distance breathe — pull in then out
  const camZ = interpolate(progress, [0, 0.35, 0.7, 1], [6.5, 5.2, 5.8, 6.5], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  camera.position.set(sway, camY, camZ);
  camera.lookAt(0, 0, 0);
  (camera as THREE.PerspectiveCamera).fov = 50;
  (camera as THREE.PerspectiveCamera).updateProjectionMatrix();

  return null;
};

// ── Main composition ──

const Scene: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  const time = frame / fps;
  const progress = frame / durationInFrames;

  // Tube rotation — constant base speed plus a gentle acceleration mid-sequence
  const baseSpeed = 0.25;
  const angle = time * baseSpeed + Math.sin(progress * Math.PI) * 0.6;

  // Vertical scroll — slow drift down then back up
  const scrollY = interpolate(progress, [0, 0.5, 1], [0, 2.5, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Grid center wanders in a slow figure-eight
  const cx = 0.5 + Math.sin(time * 0.4) * 0.15;
  const cy = 0.5 + Math.cos(time * 0.3) * 0.15;

  return (
    <>
      <CameraRig frame={frame} totalFrames={durationInFrames} />

      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <Environment preset="studio" />

      <GridPlane time={time} centerX={cx} centerY={cy} />
      <ImageTube angle={angle} scrollY={scrollY} />
      <HelmetModel angle={angle} />
    </>
  );
};

export const Helmet3D: React.FC = () => {
  const { width, height } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <ThreeCanvas
        width={width}
        height={height}
        camera={{ position: [0, 1.5, 6.5], fov: 50 }}
        style={{ width: "100%", height: "100%" }}
      >
        <Scene />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
