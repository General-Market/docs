// Source: https://antonbobrov.github.io/threejs-runic-alphabet/
import React, { useRef, useMemo } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

// ── Elder Futhark rune SVG-like path data ──
// Each rune is an array of line segments: [[x1,y1,x2,y2], ...]
// Coordinates in 0..1 space, drawn onto 256x256 canvas

const RUNE_PATHS: number[][][] = [
  // ᚠ Fehu
  [[0.3,0.9, 0.3,0.1], [0.3,0.1, 0.7,0.35], [0.3,0.4, 0.7,0.65]],
  // ᚢ Uruz
  [[0.3,0.1, 0.3,0.7], [0.3,0.7, 0.5,0.9], [0.5,0.9, 0.7,0.7], [0.7,0.7, 0.7,0.1]],
  // ᚦ Thurisaz
  [[0.3,0.9, 0.3,0.1], [0.3,0.2, 0.7,0.4], [0.7,0.4, 0.3,0.6]],
  // ᚨ Ansuz
  [[0.3,0.9, 0.3,0.1], [0.3,0.3, 0.7,0.1], [0.3,0.5, 0.7,0.3]],
  // ᚱ Raido
  [[0.3,0.9, 0.3,0.1], [0.3,0.1, 0.7,0.1], [0.7,0.1, 0.7,0.4], [0.7,0.4, 0.3,0.4], [0.3,0.4, 0.7,0.9]],
  // ᚲ Kaunan
  [[0.3,0.9, 0.3,0.1], [0.3,0.35, 0.65,0.1], [0.3,0.65, 0.65,0.9]],
  // ᚷ Gebo
  [[0.2,0.2, 0.8,0.8], [0.8,0.2, 0.2,0.8]],
  // ᚹ Wunjo
  [[0.3,0.9, 0.3,0.1], [0.3,0.1, 0.7,0.3], [0.7,0.3, 0.7,0.5]],
  // ᚺ Hagalaz
  [[0.3,0.9, 0.3,0.1], [0.7,0.9, 0.7,0.1], [0.3,0.6, 0.7,0.4]],
  // ᚾ Naudiz
  [[0.3,0.9, 0.3,0.1], [0.3,0.7, 0.7,0.3]],
  // ᛁ Isa
  [[0.5,0.9, 0.5,0.1]],
  // ᛃ Jera
  [[0.3,0.5, 0.5,0.3], [0.5,0.3, 0.7,0.5], [0.3,0.5, 0.5,0.7], [0.5,0.7, 0.7,0.5]],
  // ᛇ Eihwaz
  [[0.5,0.9, 0.5,0.1], [0.5,0.3, 0.3,0.15], [0.5,0.7, 0.7,0.85]],
  // ᛈ Pertho
  [[0.3,0.9, 0.3,0.1], [0.3,0.1, 0.6,0.25], [0.6,0.25, 0.6,0.5], [0.6,0.5, 0.3,0.65]],
  // ᛉ Algiz
  [[0.5,0.9, 0.5,0.1], [0.5,0.3, 0.25,0.1], [0.5,0.3, 0.75,0.1]],
  // ᛊ Sowilo
  [[0.3,0.2, 0.7,0.2], [0.7,0.2, 0.3,0.5], [0.3,0.5, 0.7,0.5], [0.7,0.5, 0.3,0.8], [0.3,0.8, 0.7,0.8]],
  // ᛏ Tiwaz
  [[0.5,0.9, 0.5,0.1], [0.25,0.1, 0.75,0.1]],
  // ᛒ Berkana
  [[0.3,0.9, 0.3,0.1], [0.3,0.1, 0.65,0.25], [0.65,0.25, 0.3,0.45], [0.3,0.45, 0.7,0.65], [0.7,0.65, 0.3,0.9]],
  // ᛖ Ehwaz
  [[0.3,0.9, 0.3,0.1], [0.7,0.9, 0.7,0.1], [0.3,0.35, 0.7,0.35], [0.3,0.65, 0.7,0.65]],
  // ᛗ Mannaz
  [[0.3,0.9, 0.3,0.1], [0.7,0.9, 0.7,0.1], [0.3,0.1, 0.5,0.35], [0.5,0.35, 0.7,0.1]],
  // ᛚ Laguz
  [[0.3,0.9, 0.3,0.1], [0.3,0.1, 0.65,0.45]],
  // ᛜ Ingwaz
  [[0.5,0.1, 0.8,0.5], [0.8,0.5, 0.5,0.9], [0.5,0.9, 0.2,0.5], [0.2,0.5, 0.5,0.1]],
  // ᛞ Dagaz
  [[0.3,0.1, 0.3,0.9], [0.7,0.1, 0.7,0.9], [0.3,0.1, 0.7,0.9], [0.7,0.1, 0.3,0.9]],
  // ᛟ Othala
  [[0.3,0.9, 0.5,0.65], [0.5,0.65, 0.7,0.9], [0.5,0.65, 0.5,0.3], [0.5,0.3, 0.3,0.1], [0.5,0.3, 0.7,0.1]],
];

const RUNE_COUNT = RUNE_PATHS.length;
const PLANE_SIZE = 550;
const PLANE_SEGMENTS = 150;

// ── Generate a canvas texture for a rune ──

function createRuneTexture(runeIndex: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "rgba(0,0,0,0)";
  ctx.fillRect(0, 0, size, size);

  const paths = RUNE_PATHS[runeIndex % RUNE_PATHS.length];
  ctx.strokeStyle = "rgba(255,255,255,1)";
  ctx.lineWidth = 16;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Draw with a wide glow first
  ctx.shadowColor = "rgba(255,255,255,0.8)";
  ctx.shadowBlur = 24;

  for (const seg of paths) {
    ctx.beginPath();
    ctx.moveTo(seg[0] * size, seg[1] * size);
    ctx.lineTo(seg[2] * size, seg[3] * size);
    ctx.stroke();
  }

  // Second pass: narrower, sharper
  ctx.shadowBlur = 8;
  ctx.lineWidth = 10;
  for (const seg of paths) {
    ctx.beginPath();
    ctx.moveTo(seg[0] * size, seg[1] * size);
    ctx.lineTo(seg[2] * size, seg[3] * size);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

// ── GLSL shaders — ported from the original ──

const SIMPLEX_NOISE = /* glsl */ `
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 1.0/7.0;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
`;

const ROTATION = /* glsl */ `
mat3 rotation3dX(float angle) {
  float s = sin(angle);
  float c = cos(angle);
  return mat3(1.0,0.0,0.0, 0.0,c,s, 0.0,-s,c);
}
mat3 rotation3dY(float angle) {
  float s = sin(angle);
  float c = cos(angle);
  return mat3(c,0.0,-s, 0.0,1.0,0.0, s,0.0,c);
}
`;

const VERTEX_SHADER = /* glsl */ `
${SIMPLEX_NOISE}
${ROTATION}

uniform float u_time;
uniform sampler2D u_map;
uniform float u_inProgress;
uniform float u_outProgress;
uniform float u_rotationRadius;
uniform float u_PointSize;

varying vec2 vUv;
varying float vStaticNoise;
varying float vGlobalAlpha;
varying float vRand;
varying float vPointAlpha;

float rand(vec2 co){
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

float clampScoped(float value, float mn, float mx) {
  return clamp((value - mn) / (mx - mn), 0.0, 1.0);
}

float getInProgress() {
  float yProgress = uv.y;
  float start = yProgress * 0.05;
  start += start * vRand;
  float end = clamp(yProgress, 0.0015, 1.0);
  return clampScoped(u_inProgress, start, end);
}

vec3 getRotationPosition(float progress) {
  float timeProgress = clampScoped(progress, 0.0, 0.001);
  float rotationTime = 1.0 + (u_time * timeProgress) * 0.00005;
  float distanceFactor = distance(position, vec3(0.0));
  mat3 rotationX = rotation3dX(rotationTime * -distanceFactor);
  mat3 rotationY = rotation3dY(rotationTime * distanceFactor);
  mat3 rotationMat = rotationX * rotationY;
  vec3 additionalPosition = position * rotationMat * u_rotationRadius;
  additionalPosition = (additionalPosition - position) * (1.0 - progress);
  return additionalPosition;
}

vec3 getVaporPosition() {
  float threshold = 0.6;
  bool hasAnimation = vRand > threshold;
  if (!hasAnimation) return vec3(0.0);
  float direction = vRand > (1.0 - threshold / 2.0) ? 1.0 : -1.0;
  float piMultiplier = mod(1.0 + u_time * 0.0025 * pow(vRand, 2.0), 0.5);
  float progress = sin(3.1415926 * piMultiplier);
  float x = vStaticNoise * 500.0;
  float z = 600.0 * progress * direction;
  return vec3(x, 0.0, z);
}

void main() {
  vUv = uv;
  vRand = rand(uv);
  vStaticNoise = snoise(vec3(uv * 20.0, 0.0));
  float dynamicNoise = snoise(vec3(uv * 100.0, u_time * 0.005));
  float inProgress = getInProgress();

  vec4 mapColor = texture2D(u_map, uv);
  float mapAlpha = mapColor.a;
  vPointAlpha = mapColor.a > 0.2 ? 1.0 : 0.0;

  vec3 transformed = vec3(position);
  transformed.z += vStaticNoise * 20.0 + mapAlpha * vRand * 20.0;
  transformed.xy += vStaticNoise * 5.0;

  vec3 inRotation = getRotationPosition(inProgress);
  transformed += inRotation;

  vec3 outRotation = getRotationPosition(1.0 - u_outProgress);
  transformed += outRotation;

  vGlobalAlpha = inProgress - u_outProgress;

  if (mapAlpha < 0.4) {
    transformed += getVaporPosition();
  }

  float size = u_PointSize * dynamicNoise;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
  gl_PointSize = size * mapAlpha * (1.0 - vRand * 0.6);
}
`;

const FRAGMENT_SHADER = /* glsl */ `
uniform float u_time;
varying vec2 vUv;
varying float vGlobalAlpha;
varying float vRand;
varying float vPointAlpha;

void main() {
  float circle = distance(gl_PointCoord.xy, vec2(0.5));
  circle = 1.0 - smoothstep(0.3, 0.5, circle);
  vec3 color = vec3(0.17, 0.53, 0.96) * circle;
  float alpha = circle * vGlobalAlpha;
  alpha *= vPointAlpha;
  gl_FragColor = vec4(color, alpha);
}
`;

// ── Clamp-scoped utility (mirrors original SlideProgress logic) ──

function clampScope(value: number, scope: [number, number]): number {
  const [min, max] = scope;
  if (max === min) return value >= max ? 1 : 0;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

// ── Single rune item — a Points mesh with the rune's ShaderMaterial ──

const RuneItem: React.FC<{
  index: number;
  globalProgress: number;
  time: number;
}> = ({ index, globalProgress, time }) => {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const texture = useMemo(() => createRuneTexture(index), [index]);

  const geometry = useMemo(() => {
    return new THREE.PlaneGeometry(
      PLANE_SIZE,
      PLANE_SIZE,
      PLANE_SEGMENTS,
      PLANE_SEGMENTS,
    );
  }, []);

  const uniforms = useMemo(
    () => ({
      u_time: { value: 0 },
      u_map: { value: texture },
      u_inProgress: { value: 0 },
      u_outProgress: { value: 0 },
      u_rotationRadius: { value: 5.0 },
      u_PointSize: { value: 20.0 },
    }),
    [texture],
  );

  // Compute in/out progress for this item
  const inScope: [number, number] = [index - 0.9, index];
  const outScope: [number, number] = [index, index + 0.3];

  const inProgress = clampScope(globalProgress, inScope);
  const outProgress = clampScope(globalProgress, outScope);

  const visible = inProgress > 0 && outProgress < 1;

  // Mesh rotation driven by progress
  const inRotation = (1 - inProgress) * Math.PI * 0.5;
  const outRotation = outProgress * Math.PI * -2;
  const meshRotationY = inRotation + outRotation;

  // Update uniforms via ref
  if (matRef.current) {
    matRef.current.uniforms.u_time.value = time;
    matRef.current.uniforms.u_inProgress.value = inProgress;
    matRef.current.uniforms.u_outProgress.value = outProgress;
  }

  if (!visible) return null;

  return (
    <points geometry={geometry} rotation={[0, meshRotationY, 0]}>
      <shaderMaterial
        ref={matRef}
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
        uniforms={uniforms}
        depthWrite={false}
        transparent
      />
    </points>
  );
};

// ── Scroll progress indicator — thin white bar on the right ──

const ScrollIndicator: React.FC<{ progress: number }> = ({ progress }) => {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        width: 4,
        height: "100%",
        backgroundColor: "#fff",
        transformOrigin: "top left",
        transform: `scaleY(${progress})`,
        zIndex: 10,
      }}
    />
  );
};

// ── Camera setup — perspective 800, fov computed from container ──

const CameraRig: React.FC<{
  mouseX: number;
  mouseY: number;
}> = ({ mouseX, mouseY }) => {
  const { camera } = useThree();
  const fov =
    180 * ((2 * Math.atan(1080 / 2 / 800)) / Math.PI);
  (camera as THREE.PerspectiveCamera).fov = fov;
  (camera as THREE.PerspectiveCamera).near = 1;
  (camera as THREE.PerspectiveCamera).far = 10000;
  camera.position.set(0, 0, 800);
  (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
  return null;
};

// ── Post-processing bloom emulation ──
// The original uses UnrealBloomPass(0.65, 0.5, 0.0). In R3F / Remotion we can't
// easily use EffectComposer, so we layer a screen-space additive glow via a
// fullscreen quad that reads the scene texture. For simplicity and compatibility
// we skip the post-processing and rely on the additive blending of the particles
// themselves plus a CSS glow overlay on the canvas.

// ── Scene root — contains all rune items + camera ──

const RunicScene: React.FC<{
  frame: number;
  fps: number;
  totalFrames: number;
}> = ({ frame, fps, totalFrames }) => {
  // Time in "ticks" matching the original's AnimationFrame increment
  const time = frame * (1000 / fps) * 0.06;

  // Global scroll progress: 0 to (RUNE_COUNT - 1)
  // Ease: slight ease-in-out via smoothstep-like curve
  const rawProgress = frame / totalFrames;
  const easedProgress = rawProgress; // linear is closer to the original scroll feel
  const globalProgress = easedProgress * (RUNE_COUNT - 1);

  // Simulated mouse parallax — gentle sinusoidal drift
  const mouseX = Math.sin(frame * 0.012) * 0.3;
  const mouseY = Math.cos(frame * 0.009) * 0.2;

  return (
    <>
      <CameraRig mouseX={mouseX} mouseY={mouseY} />

      <group
        position={[mouseX * -25, mouseY * 25, 0]}
        rotation={[mouseY * Math.PI * 0.1, mouseX * Math.PI * 0.2, 0]}
      >
        {Array.from({ length: RUNE_COUNT }, (_, i) => (
          <RuneItem
            key={i}
            index={i}
            globalProgress={globalProgress}
            time={time}
          />
        ))}
      </group>
    </>
  );
};

// ── Main composition ──

export const RunicAlphabet: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();

  // Scroll indicator: 0..1
  const scrollProgress = frame / durationInFrames;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <ThreeCanvas
        width={width}
        height={height}
        camera={{ fov: 50, near: 1, far: 10000, position: [0, 0, 800] }}
        gl={{
          antialias: false,
          alpha: false,
          powerPreference: "high-performance",
        }}
        style={{
          background: "#000000",
          // CSS bloom approximation
          filter: "brightness(1.15) contrast(1.1)",
        }}
      >
        <RunicScene frame={frame} fps={fps} totalFrames={durationInFrames} />
      </ThreeCanvas>

      {/* Additive glow overlay — duplicates the canvas with screen blend */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backdropFilter: "blur(2px) brightness(1.05)",
          mixBlendMode: "screen",
          opacity: 0.15,
          pointerEvents: "none",
        }}
      />

      <ScrollIndicator progress={scrollProgress} />
    </AbsoluteFill>
  );
};
