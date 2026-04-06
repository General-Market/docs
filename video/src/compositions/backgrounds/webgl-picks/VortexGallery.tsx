// Source: https://github.com/J0SUKE/vortex-gallery
//
// Cylindrical vortex gallery — 600 instanced image cards arranged in a helix,
// orbiting around the camera. Scroll drives vertical translation + angular
// rotation. A centered plane shows the "current" image. All shaders ported
// verbatim from the original GLSL.

import React, { useRef, useMemo, useEffect } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

// ── Configuration ───────────────────────────────────────────────────────

const RADIUS = 6;
const HEIGHT = 120;
const INSTANCE_COUNT = 600;
const CIRCLE_COUNT = Math.floor(HEIGHT / 3);
const CIRCLE_HEIGHT = HEIGHT / CIRCLE_COUNT;

// Scroll speed — how fast the cylinder advances per frame
const SCROLL_SPEED = 0.06;
// Angular rotation speed multiplier
const ANGULAR_SPEED = 0.4;

// Fallback colors for the "image atlas" — since we have no images in Remotion,
// we generate a procedural color grid as atlas texture.
const PALETTE = [
  "#1a1a2e", "#16213e", "#0f3460", "#533483", "#e94560",
  "#f38181", "#fce38a", "#eaffd0", "#95e1d3", "#aa96da",
  "#c9b1ff", "#f0a8d0", "#ffcfdf", "#a8d8ea", "#aa96da",
  "#fcbad3", "#ffe0ac", "#a0e7e5", "#b4f8c8", "#fbe7c6",
];

const IMAGE_COUNT = PALETTE.length;
const ATLAS_TILE = 64; // px per tile in the procedural atlas
const ATLAS_COLS = 5;
const ATLAS_ROWS = Math.ceil(IMAGE_COUNT / ATLAS_COLS);

// ── Shaders — ported verbatim from the original repo ────────────────────

const CYLINDER_VERTEX = /* glsl */ `
#define PI 3.14159265359

attribute float aAngle;
attribute float aHeight;
attribute float aRadius;
attribute float aAspectRatio;
attribute float aSpeed;
attribute vec4 aTextureCoords;

varying vec4 vTextureCoords;
varying vec2 vUv;

uniform float uMaxZ;
uniform float uZrange;
uniform float uTime;
uniform float uScrollY;
uniform float uSpeedY;
uniform float uDirection;

vec4 getQuaternionFromAxisAngle(vec3 axis, float angle) {
  float halfAngle = angle * 0.5;
  return vec4(axis.xyz * sin(halfAngle), cos(halfAngle));
}

void main() {
  vec3 scaledPosition = position;
  scaledPosition.y /= aAspectRatio;

  float zPos = aHeight + uScrollY;
  float zRange = uZrange;
  float minZ = uMaxZ - uZrange;
  zPos = mod(zPos - minZ, zRange) + minZ;

  float theta = aAngle + uSpeedY * ${ANGULAR_SPEED.toFixed(1)} * aSpeed;

  vec3 instancePosition = vec3(
    cos(theta) * aRadius,
    zPos,
    sin(theta) * aRadius
  );

  float angle = atan(instancePosition.x, instancePosition.z);
  vec4 rotation = getQuaternionFromAxisAngle(vec3(0.0, 1.0, 0.0), angle);

  vec3 finalPosition = scaledPosition +
    2.0 * cross(rotation.xyz, cross(rotation.xyz, scaledPosition) + rotation.w * scaledPosition);

  vec4 modelPosition = modelMatrix * vec4(instancePosition + finalPosition, 1.0);
  vec4 viewPosition = viewMatrix * modelPosition;
  gl_Position = projectionMatrix * viewPosition;

  vUv = uv;
  vTextureCoords = aTextureCoords;
}
`;

const CYLINDER_FRAGMENT = /* glsl */ `
varying vec2 vUv;
uniform sampler2D uAtlas;
varying vec4 vTextureCoords;

void main() {
  float xStart = vTextureCoords.x;
  float xEnd = vTextureCoords.y;
  float yStart = vTextureCoords.z;
  float yEnd = vTextureCoords.w;

  vec2 atlasUV = vec2(
    mix(xStart, xEnd, vUv.x),
    mix(yStart, yEnd, 1.0 - vUv.y)
  );

  vec4 color = texture2D(uAtlas, atlasUV);
  gl_FragColor = color;
}
`;

const CENTER_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vec4 modelPosition = modelMatrix * vec4(position, 1.0);
  vec4 viewPosition = viewMatrix * modelPosition;
  gl_Position = projectionMatrix * viewPosition;
  vUv = uv;
}
`;

const CENTER_FRAGMENT = /* glsl */ `
varying vec2 vUv;
uniform sampler2D uAtlas;
uniform vec4 uTextureCoords;

void main() {
  float xStart = uTextureCoords.x;
  float xEnd = uTextureCoords.y;
  float yStart = uTextureCoords.z;
  float yEnd = uTextureCoords.w;

  vec2 atlasUV = vec2(
    mix(xStart, xEnd, vUv.x),
    mix(yStart, yEnd, 1.0 - vUv.y)
  );

  vec4 color = texture2D(uAtlas, atlasUV);
  gl_FragColor = color;
}
`;

// ── Procedural atlas — generates a texture atlas of colored tiles ────────

interface TileUV {
  xStart: number;
  xEnd: number;
  yStart: number;
  yEnd: number;
  aspectRatio: number;
}

function buildAtlasTexture(): { texture: THREE.DataTexture; tiles: TileUV[] } {
  const atlasW = ATLAS_COLS * ATLAS_TILE;
  const atlasH = ATLAS_ROWS * ATLAS_TILE;
  const data = new Uint8Array(atlasW * atlasH * 4);

  const tiles: TileUV[] = [];
  const tmpColor = new THREE.Color();

  for (let i = 0; i < IMAGE_COUNT; i++) {
    const col = i % ATLAS_COLS;
    const row = Math.floor(i / ATLAS_COLS);

    tmpColor.set(PALETTE[i]);
    const r = Math.round(tmpColor.r * 255);
    const g = Math.round(tmpColor.g * 255);
    const b = Math.round(tmpColor.b * 255);

    // Fill tile pixels — add a subtle diagonal gradient for visual interest
    for (let py = 0; py < ATLAS_TILE; py++) {
      for (let px = 0; px < ATLAS_TILE; px++) {
        const globalX = col * ATLAS_TILE + px;
        const globalY = row * ATLAS_TILE + py;
        const idx = (globalY * atlasW + globalX) * 4;

        const grad = (px + py) / (ATLAS_TILE * 2);
        const bright = 0.7 + 0.3 * grad;

        // Add a subtle border (2px) to delineate cards
        const borderX = px < 2 || px >= ATLAS_TILE - 2;
        const borderY = py < 2 || py >= ATLAS_TILE - 2;
        const isBorder = borderX || borderY;

        if (isBorder) {
          data[idx] = Math.round(r * 0.3);
          data[idx + 1] = Math.round(g * 0.3);
          data[idx + 2] = Math.round(b * 0.3);
          data[idx + 3] = 255;
        } else {
          data[idx] = Math.round(r * bright);
          data[idx + 1] = Math.round(g * bright);
          data[idx + 2] = Math.round(b * bright);
          data[idx + 3] = 255;
        }
      }
    }

    // UV coordinates (OpenGL convention: Y=0 at bottom)
    const xStart = col * ATLAS_TILE / atlasW;
    const xEnd = (col + 1) * ATLAS_TILE / atlasW;
    const yStart = 1 - row * ATLAS_TILE / atlasH;
    const yEnd = 1 - (row + 1) * ATLAS_TILE / atlasH;

    tiles.push({ xStart, xEnd, yStart, yEnd, aspectRatio: 1.0 });
  }

  const texture = new THREE.DataTexture(data, atlasW, atlasH, THREE.RGBAFormat);
  texture.needsUpdate = true;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;

  return { texture, tiles };
}

// ── Instanced cylinder mesh ─────────────────────────────────────────────

const VortexCylinder: React.FC<{
  atlas: THREE.DataTexture;
  tiles: TileUV[];
  scrollY: number;
  speedY: number;
  time: number;
  direction: number;
}> = ({ atlas, tiles, scrollY, speedY, time, direction }) => {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const { geometry } =
    useMemo(() => {
      const geo = new THREE.BoxGeometry(1.5, 1.5, 0.075);

      const angles = new Float32Array(INSTANCE_COUNT);
      const heights = new Float32Array(INSTANCE_COUNT);
      const radii = new Float32Array(INSTANCE_COUNT);
      const aspects = new Float32Array(INSTANCE_COUNT);
      const speeds = new Float32Array(INSTANCE_COUNT);
      const texCoords = new Float32Array(INSTANCE_COUNT * 4);

      // Per-circle speeds (same as original)
      const circleSpeeds = new Float32Array(CIRCLE_COUNT);
      for (let j = 0; j < CIRCLE_COUNT; j++) {
        circleSpeeds[j] = Math.random() * 0.2 + 0.8;
      }

      for (let i = 0; i < INSTANCE_COUNT; i++) {
        const angle = (i / INSTANCE_COUNT) * Math.PI * 2;
        const imageIdx = Math.floor(Math.random() * tiles.length);
        const tile = tiles[imageIdx];

        texCoords[i * 4 + 0] = tile.xStart;
        texCoords[i * 4 + 1] = tile.xEnd;
        texCoords[i * 4 + 2] = tile.yStart;
        texCoords[i * 4 + 3] = tile.yEnd;

        angles[i] = angle;
        heights[i] = (i % CIRCLE_COUNT) * CIRCLE_HEIGHT - HEIGHT / 2;
        radii[i] = RADIUS;
        aspects[i] = tile.aspectRatio;
        speeds[i] = circleSpeeds[i % CIRCLE_COUNT];
      }

      geo.setAttribute("aAngle", new THREE.InstancedBufferAttribute(angles, 1));
      geo.setAttribute("aHeight", new THREE.InstancedBufferAttribute(heights, 1));
      geo.setAttribute("aRadius", new THREE.InstancedBufferAttribute(radii, 1));
      geo.setAttribute("aAspectRatio", new THREE.InstancedBufferAttribute(aspects, 1));
      geo.setAttribute("aSpeed", new THREE.InstancedBufferAttribute(speeds, 1));
      geo.setAttribute("aTextureCoords", new THREE.InstancedBufferAttribute(texCoords, 4));

      return { geometry: geo };
    }, [tiles]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAtlas: { value: atlas },
      uScrollY: { value: 0 },
      uZrange: { value: HEIGHT },
      uMaxZ: { value: HEIGHT * 0.5 },
      uSpeedY: { value: 0 },
      uDirection: { value: 1 },
    }),
    [atlas],
  );

  // Update uniforms every frame
  if (matRef.current) {
    matRef.current.uniforms.uTime.value = time;
    matRef.current.uniforms.uScrollY.value = scrollY;
    matRef.current.uniforms.uSpeedY.value = speedY;
    matRef.current.uniforms.uDirection.value = direction;
  }

  return (
    <instancedMesh ref={meshRef} args={[geometry, undefined, INSTANCE_COUNT]}>
      <shaderMaterial
        ref={matRef}
        vertexShader={CYLINDER_VERTEX}
        fragmentShader={CYLINDER_FRAGMENT}
        uniforms={uniforms}
        transparent
      />
    </instancedMesh>
  );
};

// ── Center plane — shows "current" image ────────────────────────────────

const CenterPlane: React.FC<{
  atlas: THREE.DataTexture;
  tiles: TileUV[];
  textureIndex: number;
}> = ({ atlas, tiles, textureIndex }) => {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const idx = Math.abs(textureIndex) % tiles.length;
  const tile = tiles[idx];

  const uniforms = useMemo(
    () => ({
      uAtlas: { value: atlas },
      uTextureCoords: {
        value: new THREE.Vector4(tile.xStart, tile.xEnd, tile.yStart, tile.yEnd),
      },
    }),
    [atlas, tile],
  );

  if (matRef.current) {
    matRef.current.uniforms.uTextureCoords.value.set(
      tile.xStart, tile.xEnd, tile.yStart, tile.yEnd,
    );
  }

  return (
    <mesh>
      <planeGeometry args={[1.7, 2.3]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={CENTER_VERTEX}
        fragmentShader={CENTER_FRAGMENT}
        uniforms={uniforms}
      />
    </mesh>
  );
};

// ── Camera rig — sits at z=5, looking into the cylinder ─────────────────

const CameraRig: React.FC = () => {
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = 50;
      camera.near = 0.1;
      camera.far = 200;
      camera.updateProjectionMatrix();
    }
  }, [camera]);

  return null;
};

// ── Scene root ──────────────────────────────────────────────────────────

const VortexScene: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const time = frame / fps;

  // Derive scroll values from frame — simulates continuous downward scrolling
  // with an acceleration curve in the middle for drama.
  const scrollProgress = frame / 480;
  const scrollAccel = interpolate(
    scrollProgress,
    [0, 0.15, 0.5, 0.85, 1],
    [0.3, 1.0, 1.2, 1.0, 0.3],
  );

  const scrollY = frame * SCROLL_SPEED * scrollAccel;
  const speedY = scrollY; // angular offset tracks vertical scroll
  const direction = 1;

  // Which image tile to show in the center — cycles through the palette
  const textureIndex = Math.floor(speedY % IMAGE_COUNT);

  const { texture: atlas, tiles } = useMemo(() => buildAtlasTexture(), []);

  return (
    <>
      <CameraRig />
      <VortexCylinder
        atlas={atlas}
        tiles={tiles}
        scrollY={scrollY}
        speedY={speedY}
        time={time}
        direction={direction}
      />
      <CenterPlane atlas={atlas} tiles={tiles} textureIndex={textureIndex} />
    </>
  );
};

// ── Remotion composition ────────────────────────────────────────────────

export const VortexGallery: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  return (
    <AbsoluteFill style={{ background: "#0a0a0a" }}>
      <ThreeCanvas
        width={width}
        height={height}
        style={{ width: "100%", height: "100%" }}
        camera={{ position: [0, 0, 5], fov: 50, near: 0.1, far: 200 }}
      >
        <VortexScene frame={frame} fps={fps} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
