// Source: https://antonbobrov.github.io/threejs-runic-alphabet/
import React, { useRef, useMemo } from "react";
import {
  AbsoluteFill,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useLoader, useThree } from "@react-three/fiber";
import {
  EffectComposer,
  Bloom,
} from "@react-three/postprocessing";
import * as THREE from "three";

// ── Constants matching the original ──

const RUNE_COUNT = 24;
const PLANE_SIZE = 550;
const PLANE_SEGMENTS = 150;

// ── GLSL shaders — verbatim from the original repo ──
// src/js/Items/Item/shaders/simplexNoise.glsl

const SIMPLEX_NOISE = /* glsl */ `
//	Simplex 3D Noise
//	by Ian McEwan, Ashima Arts
//
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

float snoise(vec3 v){
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

// First corner
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 =   v - i + dot(i, C.xxx) ;

// Other corners
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );

  //  x0 = x0 - 0. + 0.0 * C
  vec3 x1 = x0 - i1 + 1.0 * C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1. + 3.0 * C.xxx;

// Permutations
  i = mod(i, 289.0 );
  vec4 p = permute( permute( permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

// Gradients
// ( N*N points uniformly over a square, mapped onto an octahedron.)
  float n_ = 1.0/7.0; // N=7
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z *ns.z);  //  mod(p,N*N)

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );

  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);

//Normalise gradients
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

// Mix final noise value
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                dot(p2,x2), dot(p3,x3) ) );
}
`;

// src/js/Items/Item/shaders/rotation.glsl
// Source: https://github.com/dmnsgn/glsl-rotate/blob/main/rotation-3d-y.glsl.js

const ROTATION = /* glsl */ `
mat3 rotation3dX(float angle) {
  float s = sin(angle);
  float c = cos(angle);

  return mat3(
    1.0, 0.0, 0.0,
    0.0, c, s,
    0.0, -s, c
  );
}

mat3 rotation3dY(float angle) {
  float s = sin(angle);
  float c = cos(angle);
  return mat3(
    c, 0.0, -s,
    0.0, 1.0, 0.0,
    s, 0.0, c
  );
}

mat3 rotation3dZ(float angle) {
  float s = sin(angle);
  float c = cos(angle);

  return mat3(
    c, s, 0.0,
    -s, c, 0.0,
    0.0, 0.0, 1.0
  );
}
`;

// src/js/Items/Item/shaders/vertex.glsl

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

float scoped(float value, float mn, float mx) {
  return (value - mn) / (mx - mn);
}

float clampScoped(float value, float mn, float mx) {
  return clamp(scoped(value, mn, mx), 0.0, 1.0);
}

float getInProgress() {
  float yProgress = uv.y; // abs(uv.y - 0.5) * 2.0;

  float start = yProgress * 0.05;
  start += start * vRand;

  float end = clamp(yProgress, 0.0015, 1.0);

  float progress = clampScoped(u_inProgress, start, end);

  return progress;
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

vec3 getVarporPosition() {
  float threshold = 0.6;
  bool hasAnimation = vRand > threshold;

  if (!hasAnimation) {
    return vec3(0.0);
  }

  float direction = vRand > (1.0 - threshold / 2.0) ? 1.0 : -1.0;

  float piMultiplier = mod(1.0 + u_time * 0.0025 * pow(vRand, 2.0), 0.5);
  float progress = sin(3.1415926 * piMultiplier);

  float x = vStaticNoise * 500.0;
  float y = 0.0;
  float z = 600.0 * progress * direction;

  return vec3(x, y, z);
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

  // default coords
  vec3 transformed = vec3(position);

  // add volume
  transformed.z += vStaticNoise * 20.0 + mapAlpha * vRand * 20.0;

  // add noise
  transformed.xy += vStaticNoise * 5.0;

  // add in-rotation
  vec3 inRotation = getRotationPosition(inProgress);
  transformed += inRotation;

  // add out-rotation
  vec3 outRotation = getRotationPosition(1.0 - u_outProgress);
  transformed += outRotation;

  // varyings
  vGlobalAlpha = inProgress - u_outProgress;

  // vapor
  if (mapAlpha < 0.4) {
    transformed += getVarporPosition();
  }

  // blink
  float size = u_PointSize * dynamicNoise;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
  gl_PointSize = size * mapAlpha * (1.0 - vRand * 0.6);
}
`;

// src/js/Items/Item/shaders/fragment.glsl

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

// ── Clamp-scoped utility (mirrors vevet's clampScope) ──

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

  // Load the original rune PNG texture
  const texture = useLoader(
    THREE.TextureLoader,
    staticFile(`compositions/runic-alphabet/${index}.png`),
  );

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
      u_inProgress: { value: 1 },
      u_outProgress: { value: 0 },
      u_rotationRadius: { value: 5.0 },
      u_PointSize: { value: 20.0 },
    }),
    [texture],
  );

  // Compute in/out progress for this item
  // Original: src/js/Items/index.ts lines 88-89
  const inScope: [number, number] = [index - 0.9, index];
  const outScope: [number, number] = [index, index + 0.3];

  const inProgress = clampScope(globalProgress, inScope);
  const outProgress = clampScope(globalProgress, outScope);

  const visible = inProgress > 0 && outProgress < 1;

  // Mesh rotation driven by progress
  // Original: src/js/Items/Item/index.ts lines 77-80
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

// ── Scroll progress indicator ──
// Original: src/js/Items/ScrollLine — a div with transform: scale(1, progress)

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

// ── Camera setup ──
// Original: initScene.ts passes { fov: 50, perspective: 800 }
// WebglCamera uses fov directly when provided, position.z = perspective

const CameraRig: React.FC = () => {
  const { camera } = useThree();
  const cam = camera as THREE.PerspectiveCamera;
  cam.fov = 50;
  cam.near = 1;
  cam.far = 10000;
  cam.position.set(0, 0, 800);
  cam.updateProjectionMatrix();
  return null;
};

// ── Bloom post-processing ──
// Original: UnrealBloomPass(resolution, strength=0.65, radius=0.5, threshold=0.0)

const BloomPass: React.FC = () => {
  return (
    <EffectComposer>
      <Bloom
        luminanceThreshold={0.0}
        luminanceSmoothing={0.0}
        intensity={0.65}
        radius={0.5}
        mipmapBlur
      />
    </EffectComposer>
  );
};

// ── Scene root — contains all rune items + camera + bloom ──

const RunicScene: React.FC<{
  frame: number;
  fps: number;
  totalFrames: number;
}> = ({ frame, fps, totalFrames }) => {
  // Time as simple frame counter — original increments u_time by 1 per AnimationFrame
  const time = frame;

  // Global scroll progress: 0 to (RUNE_COUNT - 1)
  const rawProgress = frame / totalFrames;
  const globalProgress = rawProgress * (RUNE_COUNT - 1);

  // Simulated mouse parallax — gentle sinusoidal drift
  const mouseX = Math.sin(frame * 0.012) * 0.3;
  const mouseY = Math.cos(frame * 0.009) * 0.2;

  return (
    <>
      <CameraRig />

      {/* Original: src/js/Items/index.ts lines 100-104 */}
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

      <BloomPass />
    </>
  );
};

// ── Main composition ──

export const RunicAlphabet: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();

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
          toneMapping: THREE.NoToneMapping,
        }}
        style={{ background: "#000000" }}
      >
        <RunicScene frame={frame} fps={fps} totalFrames={durationInFrames} />
      </ThreeCanvas>

      <ScrollIndicator progress={scrollProgress} />
    </AbsoluteFill>
  );
};
