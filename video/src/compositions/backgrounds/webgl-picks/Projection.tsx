// Projection — a screen mesh emits chromatic fbm noise. A spotlight
// directly below shares the same shader (with halftone + luma threshold)
// and projects it onto the keyboard and floor. The source ran a real-time
// render loop with two WebGLRenderTargets; we keep the same architecture,
// just driven by Remotion's frame clock.

import React, { useEffect, useMemo, useRef } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

// ── Shader (verbatim from the source, minus the bloom-handled bits) ────────

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uProjectionIntensity;
uniform float uReflectionGain;
uniform float uHighlightBoost;
uniform float uLumaVisibilityThreshold;
uniform float uInvertColor;
uniform float uHalftone;
uniform float uToneCut;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * snoise(p);
    p = p * 2.0 + vec2(17.0, 31.0);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = vUv;
  vec2 p = uv * 2.0 - 1.0;
  float t = uTime;

  vec2 flow = vec2(t * 0.19, t * 0.13);
  vec2 q = vec2(fbm(p * 1.05 + flow), fbm(p * 1.05 + vec2(-flow.y * 1.1, flow.x * 0.9)));
  vec2 w = p + q * 0.62;

  float nA = 0.5 + 0.5 * fbm(w * 2.15 + flow * 0.8);
  float nB = 0.5 + 0.5 * fbm(w * 4.8 + vec2(-flow.x * 0.5, flow.y * 0.35));
  float ridge = 1.0 - abs(2.0 * nB - 1.0);
  float mask = clamp(0.18 + 1.12 * (0.58 * nA + 0.42 * ridge), 0.0, 1.0);
  float edgeFade = 1.0 - clamp(length(p) * 0.7, 0.0, 1.0);
  float intensity = pow(clamp(mask * (0.72 + edgeFade * 0.45), 0.0, 1.0), 1.05);

  float base = nA * 0.82 + ridge * 0.18;
  vec3 col = vec3(
    0.18 + 0.86 * (0.5 + 0.5 * cos(6.28318 * (base + 0.02 + t * 0.07))),
    0.14 + 0.9  * (0.5 + 0.5 * cos(6.28318 * (base + 0.37 + t * 0.06))),
    0.2  + 0.9  * (0.5 + 0.5 * cos(6.28318 * (base + 0.72 + t * 0.065)))
  );
  col *= intensity;

  float highlight = pow(clamp((nA * 1.1 + ridge * 0.75) - 1.1, 0.0, 1.0), 2.2);
  col = mix(col, vec3(1.0, 0.96, 0.92), highlight * vec3(0.22, 0.16, 0.1));
  vec3 tex = clamp(col, 0.0, 1.0);

  if (uInvertColor > 0.5) tex = vec3(1.0) - tex;

  if (uToneCut > 0.5) {
    float toneLevels = 5.0;
    tex = floor(tex * (toneLevels - 1.0) + 0.5) / (toneLevels - 1.0);
  }

  float lum = dot(tex, vec3(0.2126, 0.7152, 0.0722));
  float lumaStart = clamp(uLumaVisibilityThreshold, 0.0, 1.0);
  float lumaEnd = min(1.0, lumaStart + 0.1);
  float darkMask = 1.0;
  if (lumaStart > 1e-4) darkMask = smoothstep(lumaStart, lumaEnd, lum);

  if (uHalftone > 0.5) {
    vec2 hUv = vUv * vec2(180.0, 120.0);
    vec2 hCell = fract(hUv) - 0.5;
    float dotRadius = mix(0.02, 0.45, clamp(lum, 0.0, 1.0));
    float dotMask = 1.0 - smoothstep(dotRadius, dotRadius + 0.035, length(hCell));
    tex *= dotMask * darkMask;
  }

  float hi = smoothstep(0.5, 1.0, lum);
  tex *= darkMask;
  tex *= mix(1.0, uHighlightBoost, hi);
  tex *= max(0.0, uProjectionIntensity) * max(0.0, uReflectionGain);

  gl_FragColor = vec4(tex, 1.0);
}
`;

// ── A self-contained shader-to-texture target ───────────────────────────────

interface ShaderTarget {
  texture: THREE.Texture;
  update: (time: number, effects: Effects) => void;
  render: (gl: THREE.WebGLRenderer) => void;
  dispose: () => void;
}

interface Effects {
  projectionIntensity: number;
  reflectionGain: number;
  highlightBoost: number;
  lumaVisibilityThreshold: number;
  invertColor: boolean;
  halftone: boolean;
  toneCut: boolean;
}

function makeShaderTarget(w: number, h: number): ShaderTarget {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uTime: { value: 0 },
      uProjectionIntensity: { value: 0.5 },
      uReflectionGain: { value: 1.0 },
      uHighlightBoost: { value: 1.65 },
      uLumaVisibilityThreshold: { value: 0.3 },
      uInvertColor: { value: 0 },
      uHalftone: { value: 0 },
      uToneCut: { value: 0 },
    },
    depthTest: false,
    depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  scene.add(quad);

  const target = new THREE.WebGLRenderTarget(w, h, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    colorSpace: THREE.SRGBColorSpace,
    depthBuffer: false,
    stencilBuffer: false,
  });

  return {
    texture: target.texture,
    update(time, e) {
      mat.uniforms.uTime.value = time;
      mat.uniforms.uProjectionIntensity.value = e.projectionIntensity;
      mat.uniforms.uReflectionGain.value = e.reflectionGain;
      mat.uniforms.uHighlightBoost.value = e.highlightBoost;
      mat.uniforms.uLumaVisibilityThreshold.value = e.lumaVisibilityThreshold;
      mat.uniforms.uInvertColor.value = e.invertColor ? 1 : 0;
      mat.uniforms.uHalftone.value = e.halftone ? 1 : 0;
      mat.uniforms.uToneCut.value = e.toneCut ? 1 : 0;
    },
    render(gl) {
      const prev = gl.getRenderTarget();
      gl.setRenderTarget(target);
      gl.clear();
      gl.render(scene, camera);
      gl.setRenderTarget(prev);
    },
    dispose() {
      quad.geometry.dispose();
      mat.dispose();
      target.dispose();
    },
  };
}

// ── Keyboard mesh ───────────────────────────────────────────────────────────

const KEYS_COLS = 10;
const KEYS_ROWS = 3;
const KEY_W = 0.09;
const KEY_H = 0.072;
const KEY_D = 0.07;
const GAP_X = 0.012;
const GAP_Z = 0.01;
const START_X = -((KEYS_COLS - 1) * (KEY_W + GAP_X)) / 2;
const START_Z = -((KEYS_ROWS - 1) * (KEY_D + GAP_Z)) / 2;

const Keyboard: React.FC<{ material: THREE.Material }> = ({ material }) => (
  <group position={[0, 0, 1.28]}>
    <mesh material={material} position={[0, 0.0225, 0]} castShadow receiveShadow>
      <boxGeometry args={[1.15, 0.045, 0.42]} />
    </mesh>
    {Array.from({ length: KEYS_ROWS }).map((_, rz) =>
      Array.from({ length: KEYS_COLS }).map((_, cx) => (
        <mesh
          key={`${rz}-${cx}`}
          material={material}
          position={[
            START_X + cx * (KEY_W + GAP_X),
            0.045 + KEY_H * 0.5 + 0.002,
            START_Z + rz * (KEY_D + GAP_Z),
          ]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[KEY_W, KEY_H, KEY_D]} />
        </mesh>
      )),
    )}
  </group>
);

// ── Main R3F scene ──────────────────────────────────────────────────────────

const EFFECTS_SCREEN: Effects = {
  projectionIntensity: 1.64,
  reflectionGain: 1.0,
  highlightBoost: 1.65,
  lumaVisibilityThreshold: 0,
  invertColor: false,
  halftone: false,
  toneCut: false,
};

const EFFECTS_PROJ: Effects = {
  projectionIntensity: 1.64,
  reflectionGain: 1.0,
  highlightBoost: 1.65,
  lumaVisibilityThreshold: 0.12,
  invertColor: false,
  halftone: true,
  toneCut: false,
};

const ProjectionScene: React.FC<{ time: number }> = ({ time }) => {
  const { gl, scene } = useThree();
  const spotRef = useRef<THREE.SpotLight>(null);

  const sources = useMemo(
    () => ({
      screen: makeShaderTarget(1024, 576),
      projection: makeShaderTarget(1024, 576),
    }),
    [],
  );

  const floorMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: 0x1a1a22,
        roughness: 0.88,
        metalness: 0.06,
      }),
    [],
  );

  // Wire spotlight texture and target once
  useEffect(() => {
    if (!spotRef.current) return;
    spotRef.current.map = sources.projection.texture;
    spotRef.current.target.position.set(0, 0.02, 1.15);
    scene.add(spotRef.current.target);
  }, [sources.projection.texture, scene]);

  // Configure renderer for shadow + colour pipeline once
  useEffect(() => {
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.PCFSoftShadowMap;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 0.78;
  }, [gl]);

  // Render shader targets each Remotion frame
  sources.screen.update(time, EFFECTS_SCREEN);
  sources.projection.update(time, EFFECTS_PROJ);
  sources.screen.render(gl);
  sources.projection.render(gl);

  return (
    <>
      {/* The screen */}
      <mesh position={[0, 1.0, 0.5]}>
        <planeGeometry args={[2, 1.3]} />
        <meshBasicMaterial
          map={sources.screen.texture}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Floor */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        material={floorMat}
        receiveShadow
      >
        <planeGeometry args={[100, 100, 64, 64]} />
      </mesh>

      {/* Keyboard */}
      <Keyboard material={floorMat} />

      {/* Projection light */}
      <spotLight
        ref={spotRef}
        position={[0, 1.0, 0.52]}
        intensity={220}
        decay={6}
        distance={35}
        angle={Math.PI / 3.1}
        penumbra={0.58}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0002}
        shadow-normalBias={0.02}
      />

      {/* Faint sky fill */}
      <hemisphereLight args={["#ffffff", "#060608", 0.04]} position={[0, 10, 0]} />
    </>
  );
};

export const Projection: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const time = frame / fps;

  return (
    <AbsoluteFill style={{ backgroundColor: "#101014" }}>
      <ThreeCanvas
        width={width}
        height={height}
        camera={{ fov: 45, near: 0.1, far: 100, position: [0, 1.2, 5.5] }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <ProjectionScene time={time} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
