// Source: https://codepen.io/soju22/full/MYgbRwg
import React, { useRef, useMemo, useEffect } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

// ── Config — mirrors the original's default params ──

const HEX_N = 20;
const LIGHT1_COLOR = 0xffffff;
const LIGHT1_INTENSITY = 1000;
const LIGHT1_Z = 5;
const LIGHT2_COLOR = 0xff0000;
const LIGHT2_INTENSITY = 500;
const LIGHT2_Z = -20;
const COLORS = [0x0000ff, 0x202020, 0xffffff];
const METALNESS = 0.8;
const ROUGHNESS = 0.5;
const CLEARCOAT = 1;
const CLEARCOAT_ROUGHNESS = 0.1;
const TIME_COEF = 1;
const DEPTH_SCALE = 1;
const TILT_ROTATION_X = 0.15;
const TILT_ROTATION_Y = 0.15;

// ── Hex geometry params ──

const RADIUS = 50 / HEX_N;
const NX = HEX_N;
const NY = HEX_N;
const COUNT = NX * NY;

// ── Build the rounded hexagonal lathe geometry ──
// The original uses a LatheGeometry with 6 segments, creating a hexagonal prism
// with rounded edges via cosine/sine interpolation on the corners.

function createHexGeometry(): THREE.LatheGeometry {
  const segments = 6;
  const height = 5 * RADIUS;
  const cornerR = 0.125 * RADIUS;
  const cornerRZ = 0.125 * RADIUS;
  const cornerSteps = 6;

  const points: THREE.Vector2[] = [];
  // Bottom edge
  points.push(new THREE.Vector2(RADIUS, -height / 2));
  // Bottom-right corner (rounded)
  for (let i = 0; i < cornerSteps; i++) {
    const t = i / (cornerSteps - 1);
    const x = RADIUS - cornerR + Math.cos(t * Math.PI / 2) * cornerR;
    const z = height / 2 - cornerRZ + Math.sin(t * Math.PI / 2) * cornerRZ;
    points.push(new THREE.Vector2(x, z));
  }
  // Top center
  points.push(new THREE.Vector2(0, height / 2));

  const geo = new THREE.LatheGeometry(points, segments);
  geo.translate(0, -height / 2, 0);
  geo.rotateX(Math.PI / 2);

  return geo;
}

// ── Compute hex grid positions ──

interface CellPos {
  x: number;
  y: number;
  rotZ: number;
}

function computeHexPositions(): CellPos[] {
  const spacing = Math.cos(Math.PI / 6) * RADIUS * 2;
  const rowH = 1.5 * RADIUS;
  const ox = (-NX / 2) * spacing + spacing / 4;
  const oy = (-NY / 2) * rowH + rowH / 2;

  const positions: CellPos[] = new Array(COUNT);
  for (let col = 0; col < NX; col++) {
    for (let row = 0; row < NY; row++) {
      const idx = col * NY + row;
      positions[idx] = {
        x: ox + col * spacing + (row % 2) / 2 * spacing,
        y: oy + row * rowH,
        rotZ: 0,
      };
    }
  }
  return positions;
}

// ── Custom MeshPhysicalMaterial with subsurface scattering ──
// The original injects a scattering function into the lights_fragment_begin chunk.

function createSSSMaterial(): THREE.MeshPhysicalMaterial {
  const mat = new THREE.MeshPhysicalMaterial({
    metalness: METALNESS,
    roughness: ROUGHNESS,
    clearcoat: CLEARCOAT,
    clearcoatRoughness: CLEARCOAT_ROUGHNESS,
    side: THREE.FrontSide,
    vertexColors: true,
  });

  mat.defines = mat.defines || {};
  mat.defines.USE_UV = "";

  mat.onBeforeCompile = (shader) => {
    // Add SSS uniforms
    shader.uniforms.thicknessPower = { value: 2 };
    shader.uniforms.thicknessScale = { value: 10 };
    shader.uniforms.thicknessDistortion = { value: 0.1 };
    shader.uniforms.thicknessAmbient = { value: 0 };
    shader.uniforms.thicknessAttenuation = { value: 0.1 };

    // Prepend SSS uniforms to fragment shader
    shader.fragmentShader =
      `
      uniform float thicknessPower;
      uniform float thicknessScale;
      uniform float thicknessDistortion;
      uniform float thicknessAmbient;
      uniform float thicknessAttenuation;
      ` + shader.fragmentShader;

    // Inject SSS function before main()
    shader.fragmentShader = shader.fragmentShader.replace(
      "void main() {",
      `
      void RE_Direct_Scattering(
        const in IncidentLight directLight,
        const in vec2 uv,
        const in vec3 geometryPosition,
        const in vec3 geometryNormal,
        const in vec3 geometryViewDir,
        const in vec3 geometryClearcoatNormal,
        inout ReflectedLight reflectedLight
      ) {
        vec3 scatteringHalf = normalize(directLight.direction + (geometryNormal * thicknessDistortion));
        float scatteringDot = pow(saturate(dot(geometryViewDir, -scatteringHalf)), thicknessPower) * thicknessScale;
        vec3 scatteringIllu = (scatteringDot + thicknessAmbient) * vColor;
        reflectedLight.directDiffuse += scatteringIllu * thicknessAttenuation * directLight.color;
      }

      void main() {
      `
    );

    // Inject SSS call after each RE_Direct call in the lights loop
    const lightsChunk = THREE.ShaderChunk.lights_fragment_begin;
    const reDirectCall = "RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );";
    const replacement = reDirectCall + "\n       RE_Direct_Scattering(directLight, vUv, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, reflectedLight);";
    const modifiedChunk = lightsChunk.split(reDirectCall).join(replacement);
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <lights_fragment_begin>",
      modifiedChunk
    );
  };

  return mat;
}

// ── Color gradient helper ──

function getColorAt(colors: number[], t: number): THREE.Color {
  const cArr = colors.map((c) => new THREE.Color(c));
  const n = Math.max(0, Math.min(1, t)) * (cArr.length - 1);
  const i = Math.floor(n);
  if (i >= cArr.length - 1) return cArr[cArr.length - 1].clone();
  const f = n - i;
  const a = cArr[i];
  const b = cArr[i + 1];
  return new THREE.Color(
    a.r + f * (b.r - a.r),
    a.g + f * (b.g - a.g),
    a.b + f * (b.b - a.b)
  );
}

// ── Seeded random for deterministic colors ──

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

// ── The Three.js scene ──

const HexGridScene: React.FC<{ time: number; pointerX: number; pointerY: number }> = ({
  time,
  pointerX,
  pointerY,
}) => {
  const { size: threeSize } = useThree();
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const light1Ref = useRef<THREE.PointLight>(null);
  const light2Ref = useRef<THREE.PointLight>(null);
  const lerpedPointer = useRef(new THREE.Vector3(0, 0, 0));
  const lerpedTilt = useRef(new THREE.Vector3(0, 0, 0));
  const dummy = useRef(new THREE.Object3D());
  const vec2 = useRef(new THREE.Vector2());

  const hexGeo = useMemo(() => createHexGeometry(), []);
  const hexMat = useMemo(() => createSSSMaterial(), []);
  const positions = useMemo(() => computeHexPositions(), []);
  const phaseOffsets = useMemo(() => {
    const rng = seededRandom(42);
    return new Float32Array(COUNT).fill(0).map(() => (rng() - 0.5) * 2 * Math.PI);
  }, []);

  // Compute world-space dimensions for scale
  const aspect = threeSize.width / threeSize.height;
  const cameraZ = 100;
  const fov = 50;
  const vFov = (fov * Math.PI) / 180;
  const wHeight = 2 * Math.tan(vFov / 2) * cameraZ;
  const wWidth = wHeight * aspect;

  // Scale factor to fill viewport (matches original: wWidth/100 * 1.4)
  const scaleFactor = aspect > 1
    ? (wWidth / 100) * 1.4
    : (wHeight / 100) * 1.4;

  // Set colors once
  useEffect(() => {
    if (!meshRef.current) return;
    const rng = seededRandom(123);
    for (let i = 0; i < COUNT; i++) {
      const color = getColorAt(COLORS, rng());
      meshRef.current.setColorAt(i, color);
    }
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  }, []);

  // Convert normalized pointer to world-space target
  const nx = pointerX;
  const ny = pointerY;
  const targetX = (nx * wWidth) / 2;
  const targetY = (ny * wHeight) / 2;

  // Lerp pointer and tilt
  const lerpFactor = 0.1;
  lerpedPointer.current.lerp(new THREE.Vector3(targetX, targetY, 0), lerpFactor);
  const tiltTarget = new THREE.Vector3(-ny, nx, 0);
  lerpedTilt.current.lerp(tiltTarget, lerpFactor);

  const pX = lerpedPointer.current.x;
  const pY = lerpedPointer.current.y;

  // Update instance matrices
  if (meshRef.current) {
    for (let col = 0; col < NX; col++) {
      for (let row = 0; row < NY; row++) {
        const idx = col * NY + row;
        const pos = positions[idx];

        // Distance from pointer in scaled world space
        vec2.current.set(pos.x, pos.y).multiplyScalar(scaleFactor);
        const dist = vec2.current.sub(new THREE.Vector2(pX, pY)).length();

        // Proximity falloff: smoothstep from 0 to 20*RADIUS
        const maxDist = 20 * RADIUS;
        const t = Math.max(0, Math.min(1, dist / maxDist));
        // Smooth hermite interpolation (smoothstep)
        const proximity = 1 - (t * t * (3 - 2 * t));

        // Depth oscillation — cosine wave with per-cell phase offset
        const depth =
          0.5 *
          (Math.cos(phaseOffsets[idx] + time * TIME_COEF) - 1) *
          RADIUS *
          DEPTH_SCALE *
          proximity;

        dummy.current.position.set(pos.x, pos.y, depth);
        dummy.current.rotation.set(0, 0, pos.rotZ);
        dummy.current.updateMatrix();
        meshRef.current.setMatrixAt(idx, dummy.current.matrix);
      }
    }
    meshRef.current.instanceMatrix.needsUpdate = true;

    // Apply grid scale and tilt rotation
    meshRef.current.scale.set(scaleFactor, scaleFactor, scaleFactor);
    meshRef.current.rotation.set(
      lerpedTilt.current.x * TILT_ROTATION_X,
      lerpedTilt.current.y * TILT_ROTATION_Y,
      0
    );
  }

  // Position lights at pointer
  if (light1Ref.current) {
    light1Ref.current.position.set(pX, pY, LIGHT1_Z);
  }
  if (light2Ref.current) {
    light2Ref.current.position.set(pX, pY, LIGHT2_Z);
  }

  return (
    <>
      <perspectiveCamera
        args={[fov, aspect, 0.1, 1000]}
        position={[0, 0, cameraZ]}
      />
      <pointLight
        ref={light1Ref}
        color={LIGHT1_COLOR}
        intensity={LIGHT1_INTENSITY}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <pointLight
        ref={light2Ref}
        color={LIGHT2_COLOR}
        intensity={LIGHT2_INTENSITY}
      />
      <instancedMesh
        ref={meshRef}
        args={[hexGeo, hexMat, COUNT]}
        castShadow
        receiveShadow
      />
    </>
  );
};

// ── Main Remotion component ──

export const ParticleWave: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const time = frame / fps;

  // Synthetic pointer movement — replaces mouse interaction.
  // Smooth figure-8 lemniscate traversal across the grid.
  const pointerX = Math.sin(time * 0.4) * Math.cos(time * 0.25) * 0.6;
  const pointerY = Math.sin(time * 0.3) * 0.5;

  // Gentle intro: fade from black over 1.5s
  const introOpacity = interpolate(frame, [0, Math.floor(fps * 1.5)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <div style={{ width: "100%", height: "100%", opacity: introOpacity }}>
        <ThreeCanvas
          width={width}
          height={height}
          camera={{ position: [0, 0, 100], fov: 50 }}
          gl={{
            antialias: true,
            powerPreference: "high-performance",
          }}
          shadows
          style={{ width: "100%", height: "100%" }}
        >
          <HexGridScene
            time={time}
            pointerX={pointerX}
            pointerY={pointerY}
          />
        </ThreeCanvas>
      </div>
    </AbsoluteFill>
  );
};
