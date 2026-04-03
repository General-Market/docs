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

// ── Extracted mood palettes — per-plane, from the original source ──

const PLANE_CONFIG = [
  {
    label: "golden",
    pms: "PMS 135 C",
    labelColor: "#2e2e2e",
    accent: "#feca4f",
    bg: "#fffaf0",
    b1: "#ffdf94",
    b2: "#fce7c4",
    x: -0.9,
    // Gradient tones for the plane shader (warm golden)
    gradA: "#feca4f",
    gradB: "#fffaf0",
    gradC: "#ffdf94",
  },
  {
    label: "violet",
    pms: "PMS 4985 C",
    labelColor: "#2e2e2e",
    accent: "#80455a",
    bg: "#fffaf0",
    b1: "#d29a41",
    b2: "#bb96af",
    x: 0.8,
    gradA: "#80455a",
    gradB: "#fffaf0",
    gradC: "#bb96af",
  },
  {
    label: "afterglow",
    pms: "PMS 170 C",
    labelColor: "#f4f4f4",
    accent: "#fa7b71",
    bg: "#5f81ab",
    b1: "#f88b8d",
    b2: "#cfbbdd",
    x: -0.7,
    gradA: "#fa7b71",
    gradB: "#5f81ab",
    gradC: "#cfbbdd",
  },
  {
    label: "cobalt",
    pms: "PMS 660 C",
    labelColor: "#f4f4f4",
    accent: "#3c72c6",
    bg: "#5b9bc2",
    b1: "#ffaa00",
    b2: "#00e1ff",
    x: 1.0,
    gradA: "#3c72c6",
    gradB: "#5b9bc2",
    gradC: "#00e1ff",
  },
  {
    label: "meadow",
    pms: "PMS 7507 C",
    labelColor: "#f4f4f4",
    accent: "#fdd895",
    bg: "#7d936e",
    b1: "#fdd895",
    b2: "#a5b599",
    x: -0.7,
    gradA: "#fdd895",
    gradB: "#7d936e",
    gradC: "#a5b599",
  },
];

const DEPTH_GAP = 5;

// ── Color helpers ──

const hexToVec3 = (hex: string): [number, number, number] => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
};

const lerpVec3 = (
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

// Precomputed mood colors for background blob blending
const MOOD_VEC3 = PLANE_CONFIG.map((p) => ({
  bg: hexToVec3(p.bg),
  b1: hexToVec3(p.b1),
  b2: hexToVec3(p.b2),
}));

// Default mood (initial state before plane 0)
const DEFAULT_MOOD = {
  bg: hexToVec3("#FBE8CD"),
  b1: hexToVec3("#FFD56D"),
  b2: hexToVec3("#5D816A"),
};

// ── Background blob shader — exact GLSL from the original ──

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

// ── Per-plane gradient shader — replaces flat MeshBasicMaterial ──
// Paints a soft radial gradient using the plane's palette colors,
// simulating the richly toned flower photographs from the original.

const PLANE_GRAD_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const PLANE_GRAD_FRAGMENT = /* glsl */ `
varying vec2 vUv;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
uniform float uTime;

float random(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  // Animate center slightly for life
  float t = uTime * 0.15;
  vec2 center = vec2(0.5 + sin(t) * 0.06, 0.5 + cos(t * 0.7) * 0.04);
  float d = distance(vUv, center);

  // Three-tone radial gradient: A at center, blending through C to B at edge
  vec3 color = mix(uColorA, uColorC, smoothstep(0.0, 0.35, d));
  color = mix(color, uColorB, smoothstep(0.25, 0.7, d));

  // Subtle diagonal wash
  float diag = (vUv.x + vUv.y) * 0.5;
  color = mix(color, uColorC, smoothstep(0.3, 0.8, diag) * 0.25);

  // Film grain to match the background
  float grain = random(vUv * vec2(873.13, 547.91) + uTime * 0.01) - 0.5;
  color += grain * 0.03;
  color = clamp(color, 0.0, 1.0);

  gl_FragColor = vec4(color, 1.0);
}
`;

// ── Blob background ──

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
      uBlobRadiusSecondary: { value: 0.65 * 0.78 },
      uBlobStrength: { value: 0.9 },
      uTime: { value: timeMs },
      uVelocityIntensity: { value: 0.0 },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

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

// ── Camera dolly — z from 5 to -15 with gentle drift ──

const CameraRig: React.FC<{
  frame: number;
  fps: number;
  totalFrames: number;
}> = ({ frame, fps, totalFrames }) => {
  const { camera } = useThree();
  const time = frame / fps;
  const progress = frame / totalFrames;

  // Camera z: 5 (above plane 0) to -15 (past plane 3, viewing plane 4)
  const z = interpolate(progress, [0, 1], [5, -15], {
    extrapolateRight: "clamp",
  });

  // Extracted parallax drift amounts
  const x = Math.sin(time * 0.3) * 0.16;
  const y = Math.cos(time * 0.2) * 0.08;

  camera.position.set(x, y, z);
  camera.lookAt(x * 0.3, y * 0.3, z - 5);
  return null;
};

// ── Gradient plane component ──

const GradientPlane: React.FC<{
  colorA: string;
  colorB: string;
  colorC: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scaleXY: [number, number];
  time: number;
  opacity: number;
}> = ({ colorA, colorB, colorC, position, rotation, scaleXY, time, opacity }) => {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uColorA: { value: new THREE.Color(colorA) },
      uColorB: { value: new THREE.Color(colorB) },
      uColorC: { value: new THREE.Color(colorC) },
      uTime: { value: time },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  if (matRef.current) {
    matRef.current.uniforms.uTime.value = time;
  }

  return (
    <mesh
      position={position}
      rotation={rotation}
      scale={[scaleXY[0], scaleXY[1], 1]}
    >
      <planeGeometry args={[3, 3]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={PLANE_GRAD_VERTEX}
        fragmentShader={PLANE_GRAD_FRAGMENT}
        uniforms={uniforms}
        transparent
        opacity={opacity}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

// ── Gallery planes — 5 planes, PlaneGeometry(3,3), portrait aspect, breathing ──

const GalleryPlanes: React.FC<{
  time: number;
  cameraZ: number;
}> = ({ time, cameraZ }) => {
  // Plane visibility: fade based on camera z relative to planes
  // Uses planeFadeSampleOffset=1 and planeFadeSmoothing=0.14 from extraction
  const sampleZ = cameraZ - DEPTH_GAP * 1; // planeFadeSampleOffset = 1
  const rawProgress = (0 - sampleZ) / DEPTH_GAP; // planes[0].z=0
  const progress = Math.max(0, Math.min(PLANE_CONFIG.length - 1, rawProgress));
  const currentIdx = Math.min(
    Math.floor(progress),
    PLANE_CONFIG.length - 2,
  );
  const blend = progress - currentIdx;

  return (
    <group>
      {PLANE_CONFIG.map((cfg, i) => {
        const z = -i * DEPTH_GAP;
        const phase = i * 1.3;

        // Opacity: current plane fades out, next fades in
        let opacity = 0;
        if (i === currentIdx) opacity = 1 - blend;
        else if (i === currentIdx + 1) opacity = blend;

        // Breathing: velocity-driven in original, here time-driven as substitute
        // breathScaleAmount = 0.03, breathTiltAmount = 0.045
        const breathScale = 1.0 + Math.sin(time * 0.5 + phase) * 0.03;
        const tiltX = Math.sin(time * 0.3 + phase) * 0.045;
        const tiltY = Math.cos(time * 0.25 + phase * 0.7) * 0.03;

        // Portrait aspect: scale.x = 0.75 * breathScale, scale.y = 1.0 * breathScale
        const sx = 0.75 * breathScale;
        const sy = 1.0 * breathScale;

        return (
          <GradientPlane
            key={i}
            colorA={cfg.gradA}
            colorB={cfg.gradB}
            colorC={cfg.gradC}
            position={[cfg.x, 0, z]}
            rotation={[tiltX, tiltY, 0]}
            scaleXY={[sx, sy]}
            time={time}
            opacity={opacity}
          />
        );
      })}
    </group>
  );
};

// ── Trail tube — CatmullRom, tapered from 0.012 (head) to 0.003 (tail) ──

const TrailTube: React.FC = () => {
  const geometry = useMemo(() => {
    // Build trail path points
    const points: THREE.Vector3[] = [];
    const segments = 220;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      // Path from extraction: sinusoidal x/y, spanning gallery depth
      const px =
        -0.96 + Math.sin(t * Math.PI * 2 * 1.85) * 3 * 0.5;
      const py = -1.05 + Math.sin(t * Math.PI * 2 * 2.1) * 0.78;
      // z: from camera start region, spanning through the gallery
      const depthFactor = -0.1 + t * 1.1;
      const pz = 5 + 1.65 - (4.78 + depthFactor * 6.52);
      points.push(new THREE.Vector3(px, py, pz));
    }

    // CatmullRom curve with tension 0.67
    const curve = new THREE.CatmullRomCurve3(
      points,
      false,
      "catmullrom",
      0.67,
    );

    // Tapered tube: radius = radiusHead + (radiusTail - radiusHead) * pow(t, 1.5)
    // radiusHead = 0.012, radiusTail = 0.003
    const tubularSegments = 220;
    const radialSegments = 8;
    const radiusHead = 0.012;
    const radiusTail = 0.003;

    const radiusFn = (t: number): number => {
      return radiusHead + (radiusTail - radiusHead) * Math.pow(t, 1.5);
    };

    // Build custom tube geometry with tapered radius
    const frames = curve.computeFrenetFrames(tubularSegments, false);
    const vertices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i <= tubularSegments; i++) {
      const u = i / tubularSegments;
      const pos = curve.getPointAt(u);
      const N = frames.normals[i];
      const B = frames.binormals[i];
      const r = radiusFn(u);

      for (let j = 0; j <= radialSegments; j++) {
        const v = (j / radialSegments) * Math.PI * 2;
        const sin = Math.sin(v);
        const cos = -Math.cos(v);

        const nx = cos * N.x + sin * B.x;
        const ny = cos * N.y + sin * B.y;
        const nz = cos * N.z + sin * B.z;

        vertices.push(pos.x + r * nx, pos.y + r * ny, pos.z + r * nz);
        normals.push(nx, ny, nz);
        uvs.push(u, j / radialSegments);
      }
    }

    for (let i = 0; i < tubularSegments; i++) {
      for (let j = 0; j < radialSegments; j++) {
        const a = i * (radialSegments + 1) + j;
        const b = (i + 1) * (radialSegments + 1) + j;
        const c = (i + 1) * (radialSegments + 1) + (j + 1);
        const d = i * (radialSegments + 1) + (j + 1);
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

  return (
    <mesh geometry={geometry} renderOrder={1200}>
      <meshStandardMaterial
        color="#f6f9ff"
        emissive="#ffffff"
        emissiveIntensity={1.35}
        roughness={0.2}
        metalness={0.05}
        transparent
        opacity={0.84}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        depthTest={false}
        toneMapped={false}
      />
    </mesh>
  );
};

// ── Head particles — 18 low-poly spheres, SphereGeometry(1,5,4) ──
// Sizes range 0.007 to 0.02, spawn radius 0.52

const HeadParticles: React.FC<{
  cameraX: number;
  cameraY: number;
  cameraZ: number;
  time: number;
  trailOpacity: number;
}> = ({ cameraX, cameraY, cameraZ, time, trailOpacity }) => {
  const particles = useMemo(() => {
    const arr: {
      offsetX: number;
      offsetY: number;
      offsetZ: number;
      phase: number;
      size: number;
      speed: number;
    }[] = [];
    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2 + i * 0.37;
      const radius = Math.random() * 0.52;
      // Size: lerp between sizeMin=0.007 and sizeMax=0.02
      const sizeFrac = (i % 7) / 6;
      const size = 0.007 + (0.02 - 0.007) * sizeFrac;
      // Speed: lerp between speedMin=0.05 and speedMax=0.22
      const speed = 0.05 + (0.22 - 0.05) * ((i % 5) / 4);
      arr.push({
        offsetX: Math.cos(angle) * radius,
        offsetY: (Math.sin(angle) - 0.5) * 0.52 * 0.6,
        offsetZ: -0.3 - (i % 4) * 0.15,
        phase: i * 0.9,
        size,
        speed,
      });
    }
    return arr;
  }, []);

  const sphereGeo = useMemo(() => new THREE.SphereGeometry(1, 5, 4), []);

  return (
    <group renderOrder={1300}>
      {particles.map((p, i) => {
        // Drift using speed for variety
        const drift = Math.sin(time * 0.4 + p.phase) * p.speed * 0.4;
        const driftY = Math.cos(time * 0.35 + p.phase * 1.3) * p.speed * 0.25;
        // Life cycle: opacity fades based on a repeating cycle
        const life = ((time * 0.8 + p.phase * 0.3) % 0.6) / 0.6;
        const lifeOpacity = (1 - life) * 0.4 * trailOpacity * 0.75;

        return (
          <mesh
            key={i}
            geometry={sphereGeo}
            position={[
              cameraX + p.offsetX + drift,
              cameraY + p.offsetY + driftY,
              cameraZ + p.offsetZ,
            ]}
            scale={[p.size, p.size, p.size]}
          >
            <meshBasicMaterial
              color="#f6f9ff"
              transparent
              opacity={Math.max(0, lifeOpacity)}
              depthWrite={false}
              depthTest={false}
              toneMapped={false}
            />
          </mesh>
        );
      })}
    </group>
  );
};

// ── Label — canvas texture for text, positioned near each plane ──

const PlaneLabel: React.FC<{
  word: string;
  pms: string;
  color: string;
  position: [number, number, number];
  opacity: number;
}> = ({ word, pms, color, position, opacity }) => {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 96;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, 512, 96);

    // Word
    ctx.font = "600 20px 'IBM Plex Mono', 'Courier New', monospace";
    ctx.fillStyle = color;
    ctx.letterSpacing = "2px";
    ctx.textBaseline = "top";
    ctx.fillText(word.toUpperCase(), 16, 12);

    // PMS label below, smaller
    ctx.font = "400 13px 'IBM Plex Mono', 'Courier New', monospace";
    ctx.globalAlpha = 0.7;
    ctx.fillText(pms, 16, 44);

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, [word, pms, color]);

  return (
    <mesh position={position}>
      <planeGeometry args={[1.6, 0.3]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={opacity * 0.85}
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

  // Camera z
  const cameraZ = interpolate(progress, [0, 1], [5, -15], {
    extrapolateRight: "clamp",
  });
  const cameraX = Math.sin(time * 0.3) * 0.16;
  const cameraY = Math.cos(time * 0.2) * 0.08;

  // Mood interpolation: use moodSampleOffset=1
  // sampleZ = cameraZ - planeGap * 1
  const sampleZ = cameraZ - DEPTH_GAP;
  const rawMoodProgress = (0 - sampleZ) / DEPTH_GAP;
  const moodProgress = Math.max(
    0,
    Math.min(PLANE_CONFIG.length - 1, rawMoodProgress),
  );
  const moodIdx = Math.min(
    Math.floor(moodProgress),
    PLANE_CONFIG.length - 2,
  );
  const moodT = moodProgress - moodIdx;

  // Blend between current and next mood
  const bgColor = lerpVec3(
    moodIdx < 0 ? DEFAULT_MOOD.bg : MOOD_VEC3[moodIdx].bg,
    MOOD_VEC3[Math.min(moodIdx + 1, MOOD_VEC3.length - 1)].bg,
    moodT,
  );
  const b1Color = lerpVec3(
    moodIdx < 0 ? DEFAULT_MOOD.b1 : MOOD_VEC3[moodIdx].b1,
    MOOD_VEC3[Math.min(moodIdx + 1, MOOD_VEC3.length - 1)].b1,
    moodT,
  );
  const b2Color = lerpVec3(
    moodIdx < 0 ? DEFAULT_MOOD.b2 : MOOD_VEC3[moodIdx].b2,
    MOOD_VEC3[Math.min(moodIdx + 1, MOOD_VEC3.length - 1)].b2,
    moodT,
  );

  // Plane visibility for labels
  const fadeSampleZ = cameraZ - DEPTH_GAP;
  const fadeProgress = Math.max(
    0,
    Math.min(PLANE_CONFIG.length - 1, (0 - fadeSampleZ) / DEPTH_GAP),
  );
  const fadeIdx = Math.min(
    Math.floor(fadeProgress),
    PLANE_CONFIG.length - 2,
  );
  const fadeBlend = fadeProgress - fadeIdx;

  // Trail opacity: approximation of the extracted formula
  const trailProgress = Math.max(0, Math.min(1, progress));
  const headFade = Math.min(1, trailProgress + 0.1);
  const tailFade = 1 - trailProgress;
  const minFade = Math.min(headFade, tailFade);
  const edgeFade =
    minFade <= 0.04
      ? 0
      : minFade >= 0.2
        ? 1
        : (minFade - 0.04) / (0.2 - 0.04);
  const trailOpacity = 0.51 * Math.max(edgeFade, progress <= 0.01 ? 0.55 : 0);

  return (
    <>
      <CameraRig frame={frame} fps={fps} totalFrames={durationInFrames} />
      <ambientLight intensity={0.4} />

      <BlobBackground
        timeMs={timeMs}
        bgColor={bgColor}
        b1Color={b1Color}
        b2Color={b2Color}
      />

      <GalleryPlanes time={time} cameraZ={cameraZ} />

      {/* Labels per plane — visible when plane is visible */}
      {PLANE_CONFIG.map((cfg, i) => {
        let labelOpacity = 0;
        if (i === fadeIdx) labelOpacity = 1 - fadeBlend;
        else if (i === fadeIdx + 1) labelOpacity = fadeBlend;

        return (
          <PlaneLabel
            key={i}
            word={cfg.label}
            pms={cfg.pms}
            color={cfg.labelColor}
            position={[cfg.x - 0.55, -1.25, -i * DEPTH_GAP + 0.01]}
            opacity={labelOpacity}
          />
        );
      })}

      <TrailTube />

      <HeadParticles
        cameraX={cameraX}
        cameraY={cameraY}
        cameraZ={cameraZ}
        time={time}
        trailOpacity={Math.max(0.3, trailOpacity)}
      />
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
