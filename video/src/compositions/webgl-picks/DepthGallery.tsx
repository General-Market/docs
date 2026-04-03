// Source: https://tympanus.net/Tutorials/DepthGallery/
import React, { useRef, useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

// ── 5 mood palettes — background transitions as camera passes each plane ──

const MOODS = [
  { bg: "#FBE8CD", b1: "#FFD56D", b2: "#5D816A" },
  { bg: "#1E1E2E", b1: "#6B4F8A", b2: "#3A7D6E" },
  { bg: "#2A1A3A", b1: "#D4567A", b2: "#4A8B6E" },
  { bg: "#1A2A3A", b1: "#5BC0EB", b2: "#FDE74C" },
  { bg: "#0F2027", b1: "#2C5F2D", b2: "#97BC62" },
];

const DEPTH_GAP = 5;

// Plane layout: alternating x positions, all y = 0
const PLANE_X = [-0.9, 0.8, -0.7, 1.0, -0.7];

// Accent colors per plane (one per mood)
const PLANE_ACCENTS = ["#FFD56D", "#6B4F8A", "#D4567A", "#5BC0EB", "#97BC62"];

// Label text for each plane
const PLANE_LABELS = ["SOLITUDE", "DESCENT", "PASSAGE", "FRACTURE", "VANISHING"];

// Label color — light on dark moods, dark on light moods
const LABEL_COLORS = ["#2A1A0A", "#C8C0D8", "#E8C0D0", "#C0E0F8", "#A0C8A0"];

// ── Hex to THREE.Color helper ──

const hexToVec3 = (hex: string): [number, number, number] => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
};

// ── Lerp two hex colors, return vec3 ──

const lerpVec3 = (
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

// ── Precomputed mood vec3 arrays ──

const MOOD_VEC3 = MOODS.map((m) => ({
  bg: hexToVec3(m.bg),
  b1: hexToVec3(m.b1),
  b2: hexToVec3(m.b2),
}));

// ── Background blob shader — fullscreen GLSL quad ──

const BLOB_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const BLOB_FRAGMENT = /* glsl */ `
varying vec2 vUv;
uniform vec3 uBackgroundColor;
uniform vec3 uBlob1Color;
uniform vec3 uBlob2Color;
uniform float uNoiseStrength;
uniform float uBlobRadius;
uniform float uBlobRadiusSecondary;
uniform float uBlobStrength;
uniform float uTime;
uniform float uVelocityIntensity;

float random(vec2 coord) {
  return fract(sin(dot(coord, vec2(12.9898, 78.233))) * 43758.5453123);
}

void main() {
  vec3 color = uBackgroundColor;
  float animTime = uTime * 0.00028;

  // Golden-ratio-adjacent frequencies
  vec2 blob1Center = vec2(
    0.50 + sin(animTime * 1.000) * 0.13 + sin(animTime * 1.618) * 0.05,
    0.48 + cos(animTime * 0.794) * 0.09 + cos(animTime * 1.272) * 0.03
  );
  vec2 blob2Center = vec2(
    0.35 + cos(animTime * 0.927) * 0.11 + cos(animTime * 1.414) * 0.04,
    0.55 + sin(animTime * 1.175) * 0.07 + sin(animTime * 0.618) * 0.03
  );

  float blob1 = smoothstep(uBlobRadius, 0.0, distance(vUv, blob1Center));
  float blob2 = smoothstep(uBlobRadiusSecondary, 0.0, distance(vUv, blob2Center));

  vec3 blob1Soft = mix(uBlob1Color, uBackgroundColor, 0.35);
  vec3 blob2Soft = mix(uBlob2Color, uBackgroundColor, 0.35);

  color = mix(color, blob1Soft, blob1 * uBlobStrength);
  color = mix(color, blob2Soft, blob2 * uBlobStrength);

  color += uVelocityIntensity * 0.10;

  float grain = random(vUv * vec2(1387.13, 947.91)) - 0.5;
  color += grain * uNoiseStrength;
  color = clamp(color, 0.0, 1.0);

  gl_FragColor = vec4(color, 1.0);
}
`;

// ── Blob background plane — sits behind everything at z=-25 ──

const BlobBackground: React.FC<{
  timeMs: number;
  bgColor: [number, number, number];
  b1Color: [number, number, number];
  b2Color: [number, number, number];
}> = ({ timeMs, bgColor, b1Color, b2Color }) => {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uBackgroundColor: { value: new THREE.Vector3(...bgColor) },
      uBlob1Color: { value: new THREE.Vector3(...b1Color) },
      uBlob2Color: { value: new THREE.Vector3(...b2Color) },
      uNoiseStrength: { value: 0.04 },
      uBlobRadius: { value: 0.65 },
      uBlobRadiusSecondary: { value: 0.507 },
      uBlobStrength: { value: 0.9 },
      uTime: { value: timeMs },
      uVelocityIntensity: { value: 0.0 },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Update uniforms every frame via ref
  if (matRef.current) {
    matRef.current.uniforms.uTime.value = timeMs;
    matRef.current.uniforms.uBackgroundColor.value.set(...bgColor);
    matRef.current.uniforms.uBlob1Color.value.set(...b1Color);
    matRef.current.uniforms.uBlob2Color.value.set(...b2Color);
  }

  return (
    <mesh renderOrder={-100}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={BLOB_VERTEX}
        fragmentShader={BLOB_FRAGMENT}
        uniforms={uniforms}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
};

// ── Camera dolly — z from 5 to -15 over duration ──

const CameraRig: React.FC<{
  frame: number;
  fps: number;
  totalFrames: number;
}> = ({ frame, fps, totalFrames }) => {
  const { camera } = useThree();
  const time = frame / fps;
  const progress = frame / totalFrames;

  const z = interpolate(progress, [0, 1], [5, -15], {
    extrapolateRight: "clamp",
  });
  const x = Math.sin(time * 0.3) * 0.15;
  const y = Math.cos(time * 0.2) * 0.08;

  camera.position.set(x, y, z);
  camera.lookAt(x * 0.3, y * 0.3, z - 5);
  return null;
};

// ── Gallery planes — 5 planes, PlaneGeometry(3,3), breathing + tilt ──

const GalleryPlanes: React.FC<{ time: number }> = ({ time }) => {
  return (
    <group>
      {PLANE_ACCENTS.map((color, i) => {
        const z = -i * DEPTH_GAP;
        const x = PLANE_X[i];
        const phase = i * 1.3;

        // Breathing: 3% amplitude
        const breath = 1.0 + Math.sin(time * 0.5 + phase) * 0.03;
        // Tilt: 0.045 radians max, smoothed with per-plane offset
        const tiltX = Math.sin(time * 0.3 + phase) * 0.045;
        const tiltY = Math.cos(time * 0.25 + phase * 0.7) * 0.03;

        return (
          <mesh
            key={i}
            position={[x, 0, z]}
            rotation={[tiltX, tiltY, 0]}
            scale={[breath, breath, 1]}
          >
            <planeGeometry args={[3, 3]} />
            <meshBasicMaterial color={color} toneMapped={false} />
          </mesh>
        );
      })}
    </group>
  );
};

// ── Trail tube — CatmullRomCurve3, tension 0.67 ──

const TrailTube: React.FC = () => {
  const geometry = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const segments = 120;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      // x: sinusoidal with width amplitude 1.5
      const px = Math.sin(t * Math.PI * 1.85 * 2) * 1.5;
      // y: cosine with amplitude ~0.39
      const py = Math.cos(t * Math.PI * 2.1 * 2) * 0.39;
      // z: spans the full gallery depth, leading camera by 1.65
      const pz = 5 + 1.65 - t * 25;
      points.push(new THREE.Vector3(px, py, pz));
    }
    const curve = new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.67);
    return new THREE.TubeGeometry(curve, 300, 0.008, 6, false);
  }, []);

  return (
    <mesh geometry={geometry} renderOrder={10}>
      <meshStandardMaterial
        color="#ffffff"
        emissive="#ffffff"
        emissiveIntensity={1.35}
        transparent
        opacity={0.6}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
};

// ── Head particles — 18 small spheres near camera tip ──

const HeadParticles: React.FC<{ cameraX: number; cameraY: number; cameraZ: number; time: number }> = ({
  cameraX,
  cameraY,
  cameraZ,
  time,
}) => {
  const particles = useMemo(() => {
    const arr: { offsetX: number; offsetY: number; offsetZ: number; phase: number; opacity: number }[] = [];
    for (let i = 0; i < 18; i++) {
      // Pseudo-random but deterministic offsets
      const angle = (i / 18) * Math.PI * 2 + i * 0.37;
      const radius = 0.12 + (i % 5) * 0.08;
      arr.push({
        offsetX: Math.cos(angle) * radius,
        offsetY: Math.sin(angle) * radius * 0.6,
        offsetZ: -0.3 - (i % 4) * 0.15,
        phase: i * 0.9,
        opacity: 0.2 + (i % 5) * 0.1,
      });
    }
    return arr;
  }, []);

  const sphereGeo = useMemo(() => new THREE.SphereGeometry(1, 5, 4), []);

  return (
    <group>
      {particles.map((p, i) => {
        // Gentle drift
        const drift = Math.sin(time * 0.4 + p.phase) * 0.08;
        const driftY = Math.cos(time * 0.35 + p.phase * 1.3) * 0.05;
        return (
          <mesh
            key={i}
            geometry={sphereGeo}
            position={[
              cameraX + p.offsetX + drift,
              cameraY + p.offsetY + driftY,
              cameraZ + p.offsetZ,
            ]}
            scale={[0.015, 0.015, 0.015]}
            renderOrder={20}
          >
            <meshStandardMaterial
              color="#ffffff"
              emissive="#ffffff"
              emissiveIntensity={1.35}
              transparent
              opacity={p.opacity}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        );
      })}
    </group>
  );
};

// ── Labels — monospace text overlaid near bottom-left of each plane ──
// Using a simple canvas texture approach for text in Three.js

const PlaneLabel: React.FC<{
  text: string;
  color: string;
  position: [number, number, number];
}> = ({ text, color, position }) => {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, 512, 64);
    ctx.font = "24px 'IBM Plex Mono', 'Courier New', monospace";
    ctx.fillStyle = color;
    ctx.letterSpacing = "2px";
    ctx.textBaseline = "middle";
    ctx.fillText(text.toUpperCase(), 16, 32);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, [text, color]);

  return (
    <mesh position={position}>
      <planeGeometry args={[1.8, 0.22]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={0.85}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
};

// ── Three.js scene ──

const DepthScene: React.FC<{ frame: number }> = ({ frame }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const time = frame / fps;
  const progress = frame / durationInFrames;
  const timeMs = (frame / fps) * 1000;

  // Camera z position
  const cameraZ = interpolate(progress, [0, 1], [5, -15], {
    extrapolateRight: "clamp",
  });
  const cameraX = Math.sin(time * 0.3) * 0.15;
  const cameraY = Math.cos(time * 0.2) * 0.08;

  // Mood interpolation based on camera position relative to planes
  // Camera starts at z=5, planes at z=0,-5,-10,-15,-20
  // Map camera z to mood index
  const moodProgress = interpolate(-cameraZ, [-5, 20], [0, MOODS.length - 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const moodIdx = Math.min(Math.floor(moodProgress), MOODS.length - 2);
  const moodT = moodProgress - moodIdx;

  const bgColor = lerpVec3(MOOD_VEC3[moodIdx].bg, MOOD_VEC3[moodIdx + 1].bg, moodT);
  const b1Color = lerpVec3(MOOD_VEC3[moodIdx].b1, MOOD_VEC3[moodIdx + 1].b1, moodT);
  const b2Color = lerpVec3(MOOD_VEC3[moodIdx].b2, MOOD_VEC3[moodIdx + 1].b2, moodT);

  return (
    <>
      <CameraRig frame={frame} fps={fps} totalFrames={durationInFrames} />
      <ambientLight intensity={0.4} />

      {/* Fullscreen blob background — rendered first, behind all geometry */}
      <BlobBackground timeMs={timeMs} bgColor={bgColor} b1Color={b1Color} b2Color={b2Color} />

      {/* Gallery planes */}
      <GalleryPlanes time={time} />

      {/* Labels on each plane */}
      {PLANE_LABELS.map((label, i) => (
        <PlaneLabel
          key={i}
          text={label}
          color={LABEL_COLORS[i]}
          position={[PLANE_X[i] - 0.55, -1.25, -i * DEPTH_GAP + 0.01]}
        />
      ))}

      {/* Trail tube */}
      <TrailTube />

      {/* Head particles near camera */}
      <HeadParticles cameraX={cameraX} cameraY={cameraY} cameraZ={cameraZ} time={time} />
    </>
  );
};

// ── Composition ──

export const DepthGallery: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  return (
    <AbsoluteFill>
      <ThreeCanvas
        width={width}
        height={height}
        camera={{ fov: 45, near: 0.1, far: 100, position: [0, 0, 5] }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
        }}
        style={{ background: "#000000" }}
      >
        <DepthScene frame={frame} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
