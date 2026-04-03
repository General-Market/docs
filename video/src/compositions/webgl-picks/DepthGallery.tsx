// Source: https://tympanus.net/Tutorials/DepthGallery/
import React, { useRef, useMemo } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

// ── Plane configuration — exact values from the original ──────────────

interface PlaneConfig {
  label: string;
  pms: string;
  labelColor: string;
  accentColor: string;
  fallbackColor: string;
  backgroundColor: string;
  blob1Color: string;
  blob2Color: string;
  x: number;
  y: number;
}

const PLANE_CONFIG: PlaneConfig[] = [
  {
    label: "golden",
    pms: "PMS 135 C",
    labelColor: "#2e2e2e",
    accentColor: "#feca4f",
    fallbackColor: "#feca4f",
    backgroundColor: "#fffaf0",
    blob1Color: "#ffdf94",
    blob2Color: "#fce7c4",
    x: -0.9,
    y: 0,
  },
  {
    label: "violet",
    pms: "PMS 4985 C",
    labelColor: "#2e2e2e",
    accentColor: "#80455a",
    fallbackColor: "#80455a",
    backgroundColor: "#fffaf0",
    blob1Color: "#d29a41",
    blob2Color: "#bb96af",
    x: 0.8,
    y: 0,
  },
  {
    label: "afterglow",
    pms: "PMS 170 C",
    labelColor: "#f4f4f4",
    accentColor: "#fa7b71",
    fallbackColor: "#fa7b71",
    backgroundColor: "#5f81ab",
    blob1Color: "#f88b8d",
    blob2Color: "#cfbbdd",
    x: -0.7,
    y: 0,
  },
  {
    label: "cobalt",
    pms: "PMS 660 C",
    labelColor: "#f4f4f4",
    accentColor: "#3c72c6",
    fallbackColor: "#3c72c6",
    backgroundColor: "#5b9bc2",
    blob1Color: "#ffaa00",
    blob2Color: "#00e1ff",
    x: 1.0,
    y: 0,
  },
  {
    label: "meadow",
    pms: "PMS 7507 C",
    labelColor: "#f4f4f4",
    accentColor: "#fdd895",
    fallbackColor: "#fdd895",
    backgroundColor: "#7d936e",
    blob1Color: "#fdd895",
    blob2Color: "#a5b599",
    x: -0.7,
    y: 0,
  },
];

// ── Constants — from extraction ──────────────────────────────────────

const planeGap = 5;
const planeCount = PLANE_CONFIG.length;
const firstPlaneViewOffset = 5;
const lastPlaneViewOffset = 5;
const maxCameraZ = 0 + firstPlaneViewOffset; // 5
const minCameraZ = -(planeCount - 1) * planeGap + lastPlaneViewOffset; // -15
const planeFadeSampleOffset = 1;
const moodSampleOffset = 1;
const desktopPlaneScale = 1;
const imageAspectRatio = 0.75; // 1500x2000 images

// Breathing
const breathTiltAmount = 0.045;
const breathScaleAmount = 0.03;

// Blob defaults
const baseBlobRadius = 0.65;
const secondaryBlobRadiusRatio = 0.78;
const baseBlobStrength = 0.9;
const noiseStrength = 0.04;

// Trail path
const trailStartX = -0.96;
const trailStartY = -1.05;
const trailHorizontalWidth = 3;
const trailHorizontalCycles = 1.85;
const trailVerticalAmplitude = 0.78;
const trailVerticalCycles = 2.1;
const trailDistanceAheadOfCamera = 1.65;
const trailBaseDepthOffset = 4.78;
const trailDepthSpan = 6.52;
const trailProgressDepthOffset = -0.1;

// Trail tube
const trailMaxPoints = 220;
const trailCurveTension = 0.67;
const trailCurveSegments = 220;
const trailRadialSegments = 8;
const trailRadiusHead = 0.012;
const trailRadiusTail = 0.003;

// Trail opacity
const trailBaseOpacity = 0.51;
const trailIdleOpacityAtStart = 0.55;
const trailStartVisibilityBias = 0.1;
const trailEdgeFadeStart = 0.04;
const trailEdgeFadeEnd = 0.2;

// Head particles
const particleCount = 18;
const particleSpawnRadius = 0.52;
const particleSizeMin = 0.007;
const particleSizeMax = 0.02;
const particleSpeedMin = 0.05;
const particleSpeedMax = 0.22;
const particleLifeMin = 0.25;
const particleLifeMax = 0.6;

// Default mood (initial Background state before plane 0 comes into view)
const DEFAULT_BG = "#FBE8CD";
const DEFAULT_B1 = "#FFD56D";
const DEFAULT_B2 = "#5D816A";

// ── Helpers ──────────────────────────────────────────────────────────

type Vec3 = [number, number, number];

const hexToVec3 = (hex: string): Vec3 => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
};

const lerpVec3 = (a: Vec3, b: Vec3, t: number): Vec3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

const smoothstep = (x: number, edge0: number, edge1: number) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

const hexToRgb = (hex: string): [number, number, number] => {
  const c = new THREE.Color(hex);
  return [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)];
};

const rgbToCmyk = (
  r: number,
  g: number,
  b: number,
): [number, number, number, number] => {
  const r1 = r / 255;
  const g1 = g / 255;
  const b1 = b / 255;
  const k = 1 - Math.max(r1, g1, b1);
  if (k === 1) return [0, 0, 0, 100];
  const c = Math.round(((1 - r1 - k) / (1 - k)) * 100);
  const m = Math.round(((1 - g1 - k) / (1 - k)) * 100);
  const y = Math.round(((1 - b1 - k) / (1 - k)) * 100);
  return [c, m, y, Math.round(k * 100)];
};

// Precomputed mood colors for blob blending
const MOOD_COLORS = PLANE_CONFIG.map((p) => ({
  bg: hexToVec3(p.backgroundColor),
  b1: hexToVec3(p.blob1Color),
  b2: hexToVec3(p.blob2Color),
}));

const DEFAULT_MOOD = {
  bg: hexToVec3(DEFAULT_BG),
  b1: hexToVec3(DEFAULT_B1),
  b2: hexToVec3(DEFAULT_B2),
};

// ── Blend data computation (shared by Gallery, Background, Labels) ──

interface BlendData {
  currentPlaneIndex: number;
  nextPlaneIndex: number;
  blend: number;
  progress: number;
}

const getPlaneBlendData = (cameraZ: number, sampleOffset: number): BlendData => {
  const sampleZ = cameraZ - planeGap * sampleOffset;
  const normalizedProgress = (0 - sampleZ) / planeGap; // planes[0].z = 0
  const progress = clamp(normalizedProgress, 0, planeCount - 1);
  const currentPlaneIndex = Math.min(Math.floor(progress), planeCount - 2);
  const nextPlaneIndex = Math.min(currentPlaneIndex + 1, planeCount - 1);
  const blend = progress - currentPlaneIndex;
  return { currentPlaneIndex, nextPlaneIndex, blend, progress };
};

// ── Background blob shaders — exact GLSL from the original ──────────

const BLOB_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.999, 1.0);
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

  vec3 blob1SoftColor = mix(uBlob1Color, uBackgroundColor, 0.35);
  vec3 blob2SoftColor = mix(uBlob2Color, uBackgroundColor, 0.35);
  color = mix(color, blob1SoftColor, blob1 * uBlobStrength);
  color = mix(color, blob2SoftColor, blob2 * uBlobStrength);

  color += uVelocityIntensity * 0.10;

  float grain = random(vUv * vec2(1387.13, 947.91)) - 0.5;
  color += grain * uNoiseStrength;
  color = clamp(color, 0.0, 1.0);

  gl_FragColor = vec4(color, 1.0);
}
`;

// ── Plane gradient shader — replaces original MeshBasicMaterial+texture ─

const PLANE_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const PLANE_FRAGMENT = /* glsl */ `
varying vec2 vUv;
uniform vec3 uFallbackColor;
uniform vec3 uAccentColor;
uniform vec3 uBgColor;
uniform float uTime;
uniform float uOpacity;

float random(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  float t = uTime * 0.15;
  vec2 center = vec2(0.5 + sin(t) * 0.06, 0.5 + cos(t * 0.7) * 0.04);
  float d = distance(vUv, center);

  // Three-tone radial gradient: accent at center, through fallback, to bg at edge
  vec3 color = mix(uAccentColor, uFallbackColor, smoothstep(0.0, 0.35, d));
  color = mix(color, uBgColor, smoothstep(0.25, 0.7, d));

  // Subtle diagonal wash
  float diag = (vUv.x + vUv.y) * 0.5;
  color = mix(color, uFallbackColor, smoothstep(0.3, 0.8, diag) * 0.25);

  // Film grain
  float grain = random(vUv * vec2(873.13, 547.91) + uTime * 0.01) - 0.5;
  color += grain * 0.03;
  color = clamp(color, 0.0, 1.0);

  gl_FragColor = vec4(color, uOpacity);
}
`;

// ── Background component ─────────────────────────────────────────────
// Original: separate Scene + OrthographicCamera, rendered BEFORE main scene.
// Here: fullscreen quad with renderOrder=-1000, z=0.999, no depth test/write.

const Background: React.FC<{
  timeMs: number;
  bgColor: Vec3;
  b1Color: Vec3;
  b2Color: Vec3;
  velocityIntensity: number;
  depthProgress: number;
}> = ({ timeMs, bgColor, b1Color, b2Color, velocityIntensity, depthProgress }) => {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  // Blob radius responds to depth progress
  const blobRadius = clamp(
    baseBlobRadius + depthProgress * 0.08,
    0.05,
    1.0,
  );
  const blobStrength = clamp(
    baseBlobStrength + velocityIntensity * 0.1,
    0.0,
    1.0,
  );

  const uniforms = useMemo(
    () => ({
      uBackgroundColor: { value: new THREE.Vector3(...bgColor) },
      uBlob1Color: { value: new THREE.Vector3(...b1Color) },
      uBlob2Color: { value: new THREE.Vector3(...b2Color) },
      uNoiseStrength: { value: noiseStrength },
      uBlobRadius: { value: blobRadius },
      uBlobRadiusSecondary: { value: blobRadius * secondaryBlobRadiusRatio },
      uBlobStrength: { value: blobStrength },
      uTime: { value: timeMs },
      uVelocityIntensity: { value: velocityIntensity },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  if (matRef.current) {
    const u = matRef.current.uniforms;
    u.uTime.value = timeMs;
    u.uBackgroundColor.value.set(...bgColor);
    u.uBlob1Color.value.set(...b1Color);
    u.uBlob2Color.value.set(...b2Color);
    u.uBlobRadius.value = blobRadius;
    u.uBlobRadiusSecondary.value = blobRadius * secondaryBlobRadiusRatio;
    u.uBlobStrength.value = blobStrength;
    u.uVelocityIntensity.value = velocityIntensity;
  }

  return (
    <mesh renderOrder={-1000}>
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

// ── Gallery — 5 image planes along z-axis ────────────────────────────
// Original: PlaneGeometry(3,3), DoubleSide, transparent, depthWrite false.
// Opacity controlled by blend data. Breathing = velocity-driven scale + tilt.

const GalleryPlane: React.FC<{
  config: PlaneConfig;
  index: number;
  opacity: number;
  time: number;
}> = ({ config, index, opacity, time }) => {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const phase = index * 1.3;
  const z = -index * planeGap;

  // Breathing — in the original this is velocity-driven. Here we derive a
  // gentle oscillation from time as a substitute (no scroll velocity).
  const breathIntensity = 0.5 + Math.sin(time * 0.4) * 0.3;
  const breathWeight = breathIntensity * opacity;
  const breathScale = desktopPlaneScale * (1 + breathScaleAmount * breathWeight);
  const tiltX = -Math.sin(time * 0.3 + phase) * breathTiltAmount * breathWeight;
  const tiltY = Math.cos(time * 0.25 + phase * 0.7) * breathTiltAmount * breathWeight;

  // Scale: x = planeScale * aspectRatio * breathScale, y = planeScale * breathScale
  const sx = imageAspectRatio * breathScale;
  const sy = 1.0 * breathScale;

  const uniforms = useMemo(
    () => ({
      uFallbackColor: { value: new THREE.Color(config.fallbackColor) },
      uAccentColor: { value: new THREE.Color(config.accentColor) },
      uBgColor: { value: new THREE.Color(config.backgroundColor) },
      uTime: { value: time },
      uOpacity: { value: opacity },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  if (matRef.current) {
    matRef.current.uniforms.uTime.value = time;
    matRef.current.uniforms.uOpacity.value = opacity;
  }

  return (
    <mesh
      position={[config.x, config.y, z]}
      rotation={[tiltX, tiltY, 0]}
      scale={[sx, sy, 1]}
    >
      <planeGeometry args={[3, 3]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={PLANE_VERTEX}
        fragmentShader={PLANE_FRAGMENT}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

const Gallery: React.FC<{
  blendData: BlendData;
  time: number;
}> = ({ blendData, time }) => {
  const { currentPlaneIndex, nextPlaneIndex, blend } = blendData;

  return (
    <group>
      {PLANE_CONFIG.map((cfg, i) => {
        let opacity = 0;
        if (i === currentPlaneIndex) opacity = 1 - blend;
        else if (i === nextPlaneIndex) opacity = blend;

        return (
          <GalleryPlane
            key={i}
            config={cfg}
            index={i}
            opacity={opacity}
            time={time}
          />
        );
      })}
    </group>
  );
};

// ── ScrollController — maps frame progress to camera z ───────────────
// Original: scroll → cameraZ = cameraStartZ - scrollCurrent * scrollToWorldFactor
// Here: frame/durationInFrames → linear interpolation from maxCameraZ to minCameraZ

const ScrollController: React.FC<{
  progress: number;
  time: number;
}> = ({ progress, time }) => {
  const { camera } = useThree();

  const cameraZ = interpolate(progress, [0, 1], [maxCameraZ, minCameraZ], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  // Parallax drift — in the original this comes from pointer position.
  // Here: gentle sinusoidal drift to give life.
  const parallaxX = Math.sin(time * 0.3) * 0.16;
  const parallaxY = Math.cos(time * 0.2) * 0.08;

  camera.position.set(parallaxX, parallaxY, cameraZ);
  camera.lookAt(parallaxX * 0.3, parallaxY * 0.3, cameraZ - 5);

  return null;
};

// ── TrailController — CatmullRom tube + head particles ──────────────

const TrailTube: React.FC<{
  cameraZ: number;
  progress: number;
}> = ({ cameraZ, progress }) => {
  const geometry = useMemo(() => {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= trailMaxPoints; i++) {
      const t = i / trailMaxPoints;
      const px =
        trailStartX +
        Math.sin(t * Math.PI * 2 * trailHorizontalCycles) *
          trailHorizontalWidth *
          0.5;
      const py =
        trailStartY + Math.sin(t * Math.PI * 2 * trailVerticalCycles) * trailVerticalAmplitude;
      const depthFactor = trailProgressDepthOffset + t * (1 - trailProgressDepthOffset);
      const pz =
        maxCameraZ +
        trailDistanceAheadOfCamera -
        (trailBaseDepthOffset + depthFactor * trailDepthSpan);
      points.push(new THREE.Vector3(px, py, pz));
    }

    const curve = new THREE.CatmullRomCurve3(
      points,
      false,
      "catmullrom",
      trailCurveTension,
    );

    // Tapered radius: radiusHead + (radiusTail - radiusHead) * pow(t, 1.5)
    const radiusFn = (t: number): number =>
      trailRadiusHead + (trailRadiusTail - trailRadiusHead) * Math.pow(t, 1.5);

    const frames = curve.computeFrenetFrames(trailCurveSegments, false);
    const vertices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i <= trailCurveSegments; i++) {
      const u = i / trailCurveSegments;
      const pos = curve.getPointAt(u);
      const N = frames.normals[i];
      const B = frames.binormals[i];
      const r = radiusFn(u);

      for (let j = 0; j <= trailRadialSegments; j++) {
        const v = (j / trailRadialSegments) * Math.PI * 2;
        const sin = Math.sin(v);
        const cos = -Math.cos(v);

        const nx = cos * N.x + sin * B.x;
        const ny = cos * N.y + sin * B.y;
        const nz = cos * N.z + sin * B.z;

        vertices.push(pos.x + r * nx, pos.y + r * ny, pos.z + r * nz);
        normals.push(nx, ny, nz);
        uvs.push(u, j / trailRadialSegments);
      }
    }

    for (let i = 0; i < trailCurveSegments; i++) {
      for (let j = 0; j < trailRadialSegments; j++) {
        const a = i * (trailRadialSegments + 1) + j;
        const b = (i + 1) * (trailRadialSegments + 1) + j;
        const c = (i + 1) * (trailRadialSegments + 1) + (j + 1);
        const d = i * (trailRadialSegments + 1) + (j + 1);
        indices.push(a, b, d);
        indices.push(b, c, d);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setIndex(indices);
    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertices, 3),
    );
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    return geo;
  }, []);

  // Trail opacity from extraction
  const headFade = clamp(progress + trailStartVisibilityBias, 0, 1);
  const tailFade = 1 - progress;
  const minFade = Math.min(headFade, tailFade);
  const edgeFade = smoothstep(minFade, trailEdgeFadeStart, trailEdgeFadeEnd);
  const idleFallback = progress <= 0.01 ? trailIdleOpacityAtStart : 0;
  const trailOpacity = trailBaseOpacity * Math.max(edgeFade, idleFallback);

  return (
    <mesh geometry={geometry} renderOrder={1200}>
      <meshStandardMaterial
        color="#f6f9ff"
        emissive="#ffffff"
        emissiveIntensity={1.35}
        roughness={0.2}
        metalness={0.05}
        transparent
        opacity={trailOpacity}
        depthWrite={false}
        depthTest={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
};

// ── Head particles — 18 low-poly spheres, SphereGeometry(1,5,4) ─────

interface ParticleSeed {
  angle: number;
  radius: number;
  size: number;
  speed: number;
  totalLife: number;
  phaseOffset: number;
}

const TrailHeadParticles: React.FC<{
  headPosition: THREE.Vector3;
  time: number;
  trailOpacity: number;
}> = ({ headPosition, time, trailOpacity }) => {
  const particles = useMemo<ParticleSeed[]>(() => {
    const arr: ParticleSeed[] = [];
    for (let i = 0; i < particleCount; i++) {
      const frac = i / particleCount;
      arr.push({
        angle: frac * Math.PI * 2 + i * 0.37,
        radius: ((i * 7 + 3) % 13) / 13 * particleSpawnRadius,
        size: particleSizeMin + (particleSizeMax - particleSizeMin) * ((i % 7) / 6),
        speed: particleSpeedMin + (particleSpeedMax - particleSpeedMin) * ((i % 5) / 4),
        totalLife: particleLifeMin + (particleLifeMax - particleLifeMin) * ((i % 4) / 3),
        phaseOffset: i * 0.9,
      });
    }
    return arr;
  }, []);

  const sphereGeo = useMemo(() => new THREE.SphereGeometry(1, 5, 4), []);

  return (
    <group renderOrder={1300}>
      {particles.map((p, i) => {
        // Position: head + spawn offset + drift
        const drift = Math.sin(time * 0.4 + p.phaseOffset) * p.speed * 0.4;
        const driftY = Math.cos(time * 0.35 + p.phaseOffset * 1.3) * p.speed * 0.25;
        const driftZ = Math.sin(time * 0.3 + p.phaseOffset * 0.7) * p.speed * 0.3;

        const x = headPosition.x + Math.cos(p.angle) * p.radius + drift;
        const y =
          headPosition.y +
          (Math.sin(p.angle) - 0.5) * particleSpawnRadius * 0.6 +
          driftY;
        const z = headPosition.z + Math.sin(p.angle) * p.radius + driftZ;

        // Life cycle: repeating fade, capped at 0.4 initial opacity
        const life = ((time + p.phaseOffset * 0.3) % p.totalLife) / p.totalLife;
        const lifeRemaining = 1 - life;
        const opacity = lifeRemaining * trailOpacity * 0.75;

        return (
          <mesh
            key={i}
            geometry={sphereGeo}
            position={[x, y, z]}
            scale={[p.size, p.size, p.size]}
          >
            <meshBasicMaterial
              color="#f6f9ff"
              transparent
              opacity={Math.max(0, Math.min(0.4, opacity))}
              depthWrite={false}
              depthTest={false}
            />
          </mesh>
        );
      })}
    </group>
  );
};

// ── Label overlay — HTML positioned over the ThreeCanvas ─────────────
// Original: HTML overlay with index, word, color chip, CMYK/RGB/HEX/PMS specs.
// Here: JSX overlay matching the original CSS layout.

const LabelOverlay: React.FC<{
  blendData: BlendData;
}> = ({ blendData }) => {
  const { currentPlaneIndex, nextPlaneIndex, blend } = blendData;

  // Show whichever plane is more visible
  const activePlaneIndex = blend >= 0.5 ? nextPlaneIndex : currentPlaneIndex;
  const cfg = PLANE_CONFIG[activePlaneIndex];

  // Label opacity: peaks when near a plane, fades between
  const distFromCenter = Math.abs(blend - 0.5) * 2; // 0 at center, 1 at edges
  const labelOpacity = 1 - distFromCenter;

  // Dark text for first 2 planes, light for rest
  const isDark = activePlaneIndex < 2;
  const textColor = isDark ? "#121212" : "#f4f4f4";

  // Compute color specs from accent
  const [r, g, b] = hexToRgb(cfg.accentColor);
  const [c, m, y, k] = rgbToCmyk(r, g, b);

  const fontFamily =
    '"IBM Plex Mono", "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 80,
        pointerEvents: "none",
        opacity: labelOpacity,
        transition: "opacity 0.26s ease",
        color: textColor,
        fontFamily,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        fontSize: "9.84px",
        lineHeight: 1.2,
      }}
    >
      {/* Left side: index, word, color chip */}
      <div
        style={{
          position: "absolute",
          left: "clamp(2.5rem, 8vw, 12rem)",
          top: "50%",
          display: "grid",
          gap: "0.75rem",
        }}
      >
        <p style={{ margin: 0, fontSize: "9px" }}>
          {String(activePlaneIndex + 1).padStart(2, "0")} / {String(planeCount).padStart(2, "0")}
        </p>
        <p
          style={{
            margin: 0,
            fontSize: "clamp(9px, 0.78vw, 11px)",
            whiteSpace: "nowrap",
          }}
        >
          {cfg.label}
        </p>
        <span
          style={{
            width: 18,
            height: 18,
            borderRadius: "50%",
            display: "inline-block",
            backgroundColor: cfg.accentColor,
            boxShadow: "0 0 0 1px rgba(255, 255, 255, 0.14)",
          }}
        />
      </div>

      {/* Right side: color specs card */}
      <div
        style={{
          position: "absolute",
          right: "clamp(2.5rem, 7vw, 10rem)",
          top: "50%",
          width: "min(28vw, 360px)",
          display: "grid",
          gridTemplateColumns: "1fr",
          alignItems: "start",
          lineHeight: 1.15,
        }}
      >
        {[
          { dt: "CMYK", dd: `${c} ${m} ${y} ${k}` },
          { dt: "RGB", dd: `${r} ${g} ${b}` },
          { dt: "HEX", dd: cfg.accentColor.toUpperCase() },
          { dt: "PMS", dd: cfg.pms },
        ].map((row) => (
          <div
            key={row.dt}
            style={{
              display: "grid",
              gridTemplateColumns: "3.5rem 1fr",
              alignItems: "baseline",
              gap: "0.8rem",
              marginBottom: "0.25rem",
            }}
          >
            <span style={{ fontSize: "9px" }}>{row.dt}</span>
            <span style={{ fontSize: "clamp(9px, 0.72vw, 11px)" }}>
              {row.dd}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Three.js scene (everything inside ThreeCanvas) ───────────────────

const DepthScene: React.FC<{ frame: number }> = ({ frame }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const time = frame / fps;
  const progress = clamp(frame / durationInFrames, 0, 1);
  const timeMs = time * 1000;

  // Camera z from scroll mapping
  const cameraZ = interpolate(progress, [0, 1], [maxCameraZ, minCameraZ], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  // Simulated velocity: derivative of progress, scaled
  const prevProgress = clamp((frame - 1) / durationInFrames, 0, 1);
  const velocity = (progress - prevProgress) * fps;
  const velocityNorm = clamp(Math.abs(velocity) / 1.5, 0, 1);

  // Blend data for plane visibility
  const fadeBlend = getPlaneBlendData(cameraZ, planeFadeSampleOffset);

  // Blend data for mood colors
  const moodBlend = getPlaneBlendData(cameraZ, moodSampleOffset);
  const moodCurrent =
    moodBlend.currentPlaneIndex >= 0
      ? MOOD_COLORS[moodBlend.currentPlaneIndex]
      : DEFAULT_MOOD;
  const moodNext = MOOD_COLORS[moodBlend.nextPlaneIndex];

  const bgColor = lerpVec3(moodCurrent.bg, moodNext.bg, moodBlend.blend);
  const b1Color = lerpVec3(moodCurrent.b1, moodNext.b1, moodBlend.blend);
  const b2Color = lerpVec3(moodCurrent.b2, moodNext.b2, moodBlend.blend);

  // Velocity-to-blob motion mapping from ExperienceCoordinator
  const transitionIntensity = Math.abs(moodBlend.blend - 0.5) * 2;
  const motionSmoothed = smoothstep(transitionIntensity, 0.35, 1.0);
  const velocityIntensity = velocityNorm * motionSmoothed;
  const depthProgress = clamp(moodBlend.progress / (planeCount - 1), 0, 1);

  // Trail head position (from TrailController path formula)
  const trailProgress = clamp(progress, 0, 1);
  const trailHeadX =
    trailStartX +
    Math.sin(trailProgress * Math.PI * 2 * trailHorizontalCycles) *
      trailHorizontalWidth *
      0.5;
  const trailHeadY =
    trailStartY +
    Math.sin(trailProgress * Math.PI * 2 * trailVerticalCycles) *
      trailVerticalAmplitude;
  const trailDepthFactor =
    trailProgressDepthOffset + trailProgress * (1 - trailProgressDepthOffset);
  const trailHeadZ =
    cameraZ +
    trailDistanceAheadOfCamera -
    (trailBaseDepthOffset + trailDepthFactor * trailDepthSpan);

  // Trail opacity
  const headFade = clamp(trailProgress + trailStartVisibilityBias, 0, 1);
  const tailFade = 1 - trailProgress;
  const minFade = Math.min(headFade, tailFade);
  const edgeFade = smoothstep(minFade, trailEdgeFadeStart, trailEdgeFadeEnd);
  const idleFallback = trailProgress <= 0.01 ? trailIdleOpacityAtStart : 0;
  const trailOpacity = trailBaseOpacity * Math.max(edgeFade, idleFallback);

  return (
    <>
      <ScrollController progress={progress} time={time} />
      <ambientLight intensity={0.4} />

      <Background
        timeMs={timeMs}
        bgColor={bgColor}
        b1Color={b1Color}
        b2Color={b2Color}
        velocityIntensity={velocityIntensity}
        depthProgress={depthProgress}
      />

      <Gallery blendData={fadeBlend} time={time} />

      <TrailTube cameraZ={cameraZ} progress={progress} />

      <TrailHeadParticles
        headPosition={new THREE.Vector3(trailHeadX, trailHeadY, trailHeadZ)}
        time={time}
        trailOpacity={Math.max(0.3, trailOpacity)}
      />
    </>
  );
};

// ── Composition ──────────────────────────────────────────────────────

export const DepthGallery: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // Compute blend data for the label overlay (needs to be outside ThreeCanvas)
  const { durationInFrames } = useVideoConfig();
  const progress = clamp(frame / durationInFrames, 0, 1);
  const cameraZ = interpolate(progress, [0, 1], [maxCameraZ, minCameraZ], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });
  const labelBlend = getPlaneBlendData(cameraZ, planeFadeSampleOffset);

  return (
    <AbsoluteFill>
      <ThreeCanvas
        width={width}
        height={height}
        camera={{ fov: 45, near: 0.1, far: 100, position: [0, 0, maxCameraZ] }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
        }}
        style={{ background: "#000000" }}
      >
        <DepthScene frame={frame} />
      </ThreeCanvas>
      <LabelOverlay blendData={labelBlend} />
    </AbsoluteFill>
  );
};
