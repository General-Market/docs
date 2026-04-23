// Fork of video/src/compositions/backgrounds/webgl-picks/VortexGallery.tsx.
//
// Keeps every shader, the 600-instance cylinder, the per-circle angular
// speeds and continuous scroll — only the atlas changes. Instead of a
// procedural color grid, we rasterise a simplified FeaturedCard into a
// 2D canvas per source, stitch them into an atlas texture, and hand
// that to the same cylinder material. Cards now carry source name,
// market count, unit, four stat rows and a mock chart — legible at
// rest, shuffled as they spiral past.

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
import { FEATURED_SOURCES } from "./SourceCardsWall";

// ── Configuration (same as original) ────────────────────────────────────

const RADIUS = 6;
const HEIGHT = 120;
const INSTANCE_COUNT = 600;
const CIRCLE_COUNT = Math.floor(HEIGHT / 3);
const CIRCLE_HEIGHT = HEIGHT / CIRCLE_COUNT;

const SCROLL_SPEED = 0.06;
const ANGULAR_SPEED = 0.4;

// Atlas — one tile per FEATURED_SOURCE. Tiles are 3:4 portrait like
// the real cards. Atlas dims fall out of IMAGE_COUNT rounded up to the
// column grid.
const TILE_W = 288;
const TILE_H = 384;
const ATLAS_COLS = 5;
const IMAGE_COUNT = FEATURED_SOURCES.length;
const ATLAS_ROWS = Math.ceil(IMAGE_COUNT / ATLAS_COLS);

// ── Shaders — identical to VortexGallery ─────────────────────────────────

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

// ── Source-card atlas — canvas-rasterised mini FeaturedCards ─────────────

interface TileUV {
  xStart: number;
  xEnd: number;
  yStart: number;
  yEnd: number;
  aspectRatio: number;
}

const CARD_FONT =
  "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif";

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function buildSourceAtlas(): {
  texture: THREE.CanvasTexture;
  tiles: TileUV[];
} {
  const atlasW = ATLAS_COLS * TILE_W;
  const atlasH = ATLAS_ROWS * TILE_H;
  const canvas = document.createElement("canvas");
  canvas.width = atlasW;
  canvas.height = atlasH;
  const ctx = canvas.getContext("2d")!;

  ctx.textBaseline = "alphabetic";
  ctx.imageSmoothingEnabled = true;

  const tiles: TileUV[] = [];

  for (let i = 0; i < IMAGE_COUNT; i++) {
    const source = FEATURED_SOURCES[i];
    const col = i % ATLAS_COLS;
    const row = Math.floor(i / ATLAS_COLS);
    const ox = col * TILE_W;
    const oy = row * TILE_H;

    // ─ Card background + inset so neighbouring tiles don't bleed
    const pad = 6;
    const cx = ox + pad;
    const cy = oy + pad;
    const cw = TILE_W - pad * 2;
    const ch = TILE_H - pad * 2;

    ctx.fillStyle = "#FFFFFF";
    drawRoundedRect(ctx, cx, cy, cw, ch, 16);
    ctx.fill();

    // ─ Accent top-bar
    ctx.save();
    drawRoundedRect(ctx, cx, cy, cw, 10, 16);
    ctx.clip();
    ctx.fillStyle = source.accent;
    ctx.fillRect(cx, cy, cw, 10);
    ctx.restore();

    // ─ Header: source name + LIVE pill
    ctx.fillStyle = "#0A0A0A";
    ctx.font = `800 32px ${CARD_FONT}`;
    ctx.textAlign = "left";
    ctx.fillText(source.name, cx + 18, cy + 58);

    // LIVE pill
    const pillW = 58;
    const pillH = 22;
    const pillX = cx + cw - 18 - pillW;
    const pillY = cy + 34;
    ctx.fillStyle = "rgba(16,169,106,0.12)";
    drawRoundedRect(ctx, pillX, pillY, pillW, pillH, 11);
    ctx.fill();
    ctx.fillStyle = "#10A96A";
    ctx.font = `700 13px ${CARD_FONT}`;
    ctx.textAlign = "center";
    ctx.fillText("LIVE", pillX + pillW / 2, pillY + 15);

    // ─ Markets count + unit
    ctx.textAlign = "left";
    ctx.fillStyle = "#0A0A0A";
    ctx.font = `800 28px ${CARD_FONT}`;
    ctx.fillText(
      `${source.markets.toLocaleString()} markets`,
      cx + 18,
      cy + 106,
    );
    ctx.fillStyle = "#888";
    ctx.font = `500 17px ${CARD_FONT}`;
    ctx.fillText(`• ${source.unit}`, cx + 18, cy + 132);

    // ─ Stat rows — up to 4
    const rows = source.subs.slice(0, 4);
    rows.forEach((sub, j) => {
      const rowY = cy + 176 + j * 36;

      // Dot
      ctx.fillStyle = source.accent;
      ctx.beginPath();
      ctx.arc(cx + 26, rowY, 5, 0, Math.PI * 2);
      ctx.fill();

      // Name (truncate to fit)
      const name =
        sub.name.length > 18 ? sub.name.slice(0, 16) + "…" : sub.name;
      ctx.fillStyle = "#1A1A1A";
      ctx.font = `600 17px ${CARD_FONT}`;
      ctx.textAlign = "left";
      ctx.fillText(name, cx + 42, rowY + 5);

      // Value
      ctx.fillStyle = "#0A0A0A";
      ctx.font = `700 16px ${CARD_FONT}`;
      ctx.textAlign = "right";
      ctx.fillText(sub.value, cx + cw - 74, rowY + 5);

      // Pct
      ctx.fillStyle = sub.pct >= 0 ? "#10A96A" : "#DC2626";
      ctx.font = `700 14px ${CARD_FONT}`;
      ctx.fillText(
        `${sub.pct >= 0 ? "+" : ""}${sub.pct.toFixed(1)}%`,
        cx + cw - 18,
        rowY + 5,
      );
    });
    ctx.textAlign = "left";

    // ─ Chart strip at the bottom
    const chartY = cy + ch - 44;
    const chartH = 34;
    const points = 18;
    ctx.strokeStyle = source.accent;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (let t = 0; t < points; t++) {
      const px = cx + 18 + (t / (points - 1)) * (cw - 36);
      const phase = t * 0.62 + i * 0.73;
      const py = chartY + chartH * 0.5 + Math.sin(phase) * 12 + Math.cos(phase * 1.7 + i) * 5;
      if (t === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // ─ Tile UVs (OpenGL Y=0 at bottom)
    const xStart = ox / atlasW;
    const xEnd = (ox + TILE_W) / atlasW;
    const yStart = 1 - oy / atlasH;
    const yEnd = 1 - (oy + TILE_H) / atlasH;

    tiles.push({
      xStart,
      xEnd,
      yStart,
      yEnd,
      aspectRatio: TILE_W / TILE_H,
    });
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;

  return { texture, tiles };
}

// ── Instanced cylinder mesh ─────────────────────────────────────────────

const VortexCylinder: React.FC<{
  atlas: THREE.CanvasTexture;
  tiles: TileUV[];
  scrollY: number;
  speedY: number;
  time: number;
  direction: number;
}> = ({ atlas, tiles, scrollY, speedY, time, direction }) => {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const { geometry } = useMemo(() => {
    const geo = new THREE.BoxGeometry(1.5, 1.5, 0.075);

    const angles = new Float32Array(INSTANCE_COUNT);
    const heights = new Float32Array(INSTANCE_COUNT);
    const radii = new Float32Array(INSTANCE_COUNT);
    const aspects = new Float32Array(INSTANCE_COUNT);
    const speeds = new Float32Array(INSTANCE_COUNT);
    const texCoords = new Float32Array(INSTANCE_COUNT * 4);

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
    geo.setAttribute(
      "aAspectRatio",
      new THREE.InstancedBufferAttribute(aspects, 1),
    );
    geo.setAttribute("aSpeed", new THREE.InstancedBufferAttribute(speeds, 1));
    geo.setAttribute(
      "aTextureCoords",
      new THREE.InstancedBufferAttribute(texCoords, 4),
    );

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

// ── Center plane — shows the "current" card ─────────────────────────────

const CenterPlane: React.FC<{
  atlas: THREE.CanvasTexture;
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
        value: new THREE.Vector4(
          tile.xStart,
          tile.xEnd,
          tile.yStart,
          tile.yEnd,
        ),
      },
    }),
    [atlas, tile],
  );

  if (matRef.current) {
    matRef.current.uniforms.uTextureCoords.value.set(
      tile.xStart,
      tile.xEnd,
      tile.yStart,
      tile.yEnd,
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

// ── Camera rig ──────────────────────────────────────────────────────────

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

const VortexScene: React.FC<{ frame: number; fps: number }> = ({
  frame,
  fps,
}) => {
  const time = frame / fps;

  const scrollProgress = frame / 480;
  const scrollAccel = interpolate(
    scrollProgress,
    [0, 0.15, 0.5, 0.85, 1],
    [0.3, 1.0, 1.2, 1.0, 0.3],
  );

  const scrollY = frame * SCROLL_SPEED * scrollAccel;
  const speedY = scrollY;
  const direction = 1;

  const textureIndex = Math.floor(speedY % IMAGE_COUNT);

  const { texture: atlas, tiles } = useMemo(() => buildSourceAtlas(), []);

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

// ── Remotion composition export ─────────────────────────────────────────

export const SourceVortexGallery: React.FC = () => {
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
