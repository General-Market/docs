// Fork of video/src/compositions/backgrounds/webgl-picks/VortexGallery.tsx.
//
// Keeps every shader, the 600-instance cylinder, the per-circle angular
// speeds and continuous scroll. The atlas is a 2D canvas rasterisation
// of the real homepage FeaturedCard — logo box, name, LIVE pill, market
// count, stat rows with letter badges, and a sparkline chart. Logos
// load async via delayRender so the atlas is complete before the first
// Three.js frame touches it.

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  delayRender,
  continueRender,
  staticFile,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { FEATURED_SOURCES } from "./SourceCardsWall";

// ── Configuration ───────────────────────────────────────────────────────

const RADIUS = 6;
const HEIGHT = 120;
const INSTANCE_COUNT = 600;
const CIRCLE_COUNT = Math.floor(HEIGHT / 3);
const CIRCLE_HEIGHT = HEIGHT / CIRCLE_COUNT;

// Slow scroll so cards stay readable, but keep a gentle visible
// rotation. The shader does `theta += uSpeedY * ANGULAR_SPEED` so
// cutting SCROLL_SPEED already dampens rotation twice — bump
// ANGULAR_SPEED up to compensate. Result: ~30-40° rotation across
// Point 1's 120 frames, readable and visibly moving.
const SCROLL_SPEED = 0.04;
const ANGULAR_SPEED = 0.18;

// Atlas tile — one tile per FEATURED_SOURCE. Match the real card's
// aspect ratio (~380×460 rendered) at 400×520 so detail survives.
const TILE_W = 400;
const TILE_H = 520;
const ATLAS_COLS = 5;
const IMAGE_COUNT = FEATURED_SOURCES.length;
const ATLAS_ROWS = Math.ceil(IMAGE_COUNT / ATLAS_COLS);

// Card palette — mirrors the FeaturedCard constants so the atlas
// doesn't drift away from the on-site look when the source updates.
const CHART_COLORS = ["#2563EB", "#059669", "#D97706", "#7C3AED"] as const;
const LOGO_BG = "#F4F4F5";
const NAME_COLOR = "#0A0A0A";
const MARKET_COLOR = "#A1A1AA";
const ROW_DIVIDER = "#F4F4F5";

const CARD_FONT =
  "'Inter', 'Helvetica Neue', -apple-system, BlinkMacSystemFont, system-ui, sans-serif";
const MONO_FONT = "'JetBrains Mono', ui-monospace, monospace";

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

  float theta = aAngle + uSpeedY * ${ANGULAR_SPEED.toFixed(4)} * aSpeed;

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

// ── Tile types + helpers ────────────────────────────────────────────────

interface TileUV {
  xStart: number;
  xEnd: number;
  yStart: number;
  yEnd: number;
  aspectRatio: number;
}

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

// Load an image via fetch + blob URL so the canvas isn't tainted by
// cross-origin concerns. Remotion's staticFile URLs sometimes refuse
// canvas readback when loaded via `new Image()` with crossOrigin set;
// a same-origin fetch sidesteps the issue entirely.
async function loadImage(url: string): Promise<HTMLImageElement | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.warn(`[vortex-atlas] logo fetch failed ${res.status}: ${url}`);
      return null;
    }
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    return await new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => {
        // eslint-disable-next-line no-console
        console.warn(`[vortex-atlas] logo decode failed: ${url}`);
        resolve(null);
      };
      img.src = objUrl;
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[vortex-atlas] logo load error:`, url, err);
    return null;
  }
}

function formatMarkets(n: number): string {
  if (n >= 1000) return n.toLocaleString();
  return String(n);
}

function pctColor(pct: number): string {
  if (pct > 0.001) return "#059669";
  if (pct < -0.001) return "#DC2626";
  return "#6B7280";
}

function pctText(pct: number): string {
  if (Math.abs(pct) < 0.01) return "0.00%";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

// Deterministic hash → seeded PRNG for the sparkline shape.
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function seededRand(seed: number): () => number {
  let s = seed || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}
function sparklineValues(id: string, count: number, seedSalt: number): number[] {
  const rnd = seededRand(hashStr(id + "_" + seedSalt));
  const raw: number[] = [];
  let v = 0.5 + (rnd() - 0.5) * 0.2;
  for (let i = 0; i < count; i++) {
    v += (rnd() - 0.5) * 0.12;
    if (v < 0.1) v = 0.1;
    if (v > 0.9) v = 0.9;
    raw.push(v);
  }
  return raw;
}

// ── Atlas builder — loads logos then rasterises each source card ────────

async function buildSourceAtlas(): Promise<{
  texture: THREE.CanvasTexture;
  tiles: TileUV[];
}> {
  // Kick off all logo loads in parallel. Use the round-framed homepage
  // icons (/source-imgs/icons/<id>.png) rather than the raw brand
  // logomarks — they already sit in circular accent-tinted frames and
  // read cleanly on the vortex cards. Any failure resolves to null.
  const logos = await Promise.all(
    FEATURED_SOURCES.map((s) =>
      loadImage(staticFile(`source-imgs/icons/${s.id}.png`)),
    ),
  );

  const atlasW = ATLAS_COLS * TILE_W;
  const atlasH = ATLAS_ROWS * TILE_H;
  const canvas = document.createElement("canvas");
  canvas.width = atlasW;
  canvas.height = atlasH;
  const ctx = canvas.getContext("2d")!;

  ctx.textBaseline = "alphabetic";
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Fill the whole atlas white so the 3D box's side faces and any
  // atlas-edge sampling at mipmap boundaries never grab transparent or
  // dark pixels — that was the source of the black fringe around cards.
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, atlasW, atlasH);

  const tiles: TileUV[] = [];

  for (let i = 0; i < IMAGE_COUNT; i++) {
    const source = FEATURED_SOURCES[i];
    const col = i % ATLAS_COLS;
    const row = Math.floor(i / ATLAS_COLS);
    const ox = col * TILE_W;
    const oy = row * TILE_H;

    // Draw card edge-to-edge. No rounded corners, no inset, no stroke —
    // clean flat rectangles like the original VortexGallery tiles.
    const cx = ox;
    const cy = oy;
    const cw = TILE_W;
    const ch = TILE_H;

    // ─ Accent gradient bar (4px, flat)
    const accentGrad = ctx.createLinearGradient(cx, cy, cx + cw, cy);
    accentGrad.addColorStop(0, source.accent);
    accentGrad.addColorStop(1, source.accent + "44");
    ctx.fillStyle = accentGrad;
    ctx.fillRect(cx, cy, cw, 5);

    // ─ Header row. Logo box bumped to 64×64 per request — much more
    //   prominent brand mark when seen on the cylinder.
    const headerY = cy + 22;
    const padX = 18;

    const logoSize = 64;
    const logoX = cx + padX;
    const logoY = headerY;

    // The icons already carry their own circular accent frame — draw
    // them straight onto the white card, no gray plate underneath.
    const logoImg = logos[i];
    if (logoImg && logoImg.width > 0 && logoImg.height > 0) {
      const ratio = Math.min(
        logoSize / logoImg.width,
        logoSize / logoImg.height,
      );
      const lw = logoImg.width * ratio;
      const lh = logoImg.height * ratio;
      ctx.drawImage(
        logoImg,
        logoX + (logoSize - lw) / 2,
        logoY + (logoSize - lh) / 2,
        lw,
        lh,
      );
    } else {
      // Fallback: a subtle placeholder so the layout doesn't collapse
      // if an icon happens to be missing.
      ctx.fillStyle = LOGO_BG;
      drawRoundedRect(ctx, logoX, logoY, logoSize, logoSize, 12);
      ctx.fill();
    }

    // Source name
    const textX = logoX + logoSize + 14;
    ctx.fillStyle = NAME_COLOR;
    ctx.font = `800 26px ${CARD_FONT}`;
    ctx.textAlign = "left";
    ctx.fillText(source.name, textX, headerY + 28);

    // LIVE pill (top-right)
    const pillW = 70;
    const pillH = 24;
    const pillX = cx + cw - padX - pillW;
    const pillY = headerY + 6;
    ctx.fillStyle = source.accent + "22";
    drawRoundedRect(ctx, pillX, pillY, pillW, pillH, 12);
    ctx.fill();
    ctx.fillStyle = source.accent;
    ctx.beginPath();
    ctx.arc(pillX + 12, pillY + pillH / 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `700 13px ${CARD_FONT}`;
    ctx.textAlign = "left";
    ctx.fillText("Live", pillX + 22, pillY + 17);

    // Markets subline
    ctx.fillStyle = MARKET_COLOR;
    ctx.font = `600 14px ${MONO_FONT}`;
    ctx.textAlign = "left";
    const marketsStr = formatMarkets(source.markets);
    ctx.fillText(marketsStr, textX, headerY + 54);
    ctx.font = `500 14px ${CARD_FONT}`;
    const marketsWidth = ctx.measureText(marketsStr).width;
    ctx.fillText(
      ` markets · ${source.unit}`,
      textX + marketsWidth,
      headerY + 54,
    );

    // ─ Top divider
    ctx.strokeStyle = ROW_DIVIDER;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx + padX, cy + 106);
    ctx.lineTo(cx + cw - padX, cy + 106);
    ctx.stroke();

    // ─ Stat rows — up to 4
    const rowH = 28;
    const rowStart = cy + 118;
    const rows = source.subs.slice(0, 4);
    rows.forEach((sub, j) => {
      const rowY = rowStart + j * rowH;
      const rowCenterY = rowY + rowH / 2;

      // Color dot (left)
      const dotColor = CHART_COLORS[j % 4];
      ctx.fillStyle = dotColor;
      ctx.beginPath();
      ctx.arc(cx + padX + 4, rowCenterY, 4.5, 0, Math.PI * 2);
      ctx.fill();

      // Letter badge / sub badge
      const badgeSize = 20;
      const badgeX = cx + padX + 16;
      const badgeY = rowCenterY - badgeSize / 2;
      if (sub.badge) {
        ctx.fillStyle = sub.badgeBg ?? "#71717A";
        drawRoundedRect(
          ctx,
          badgeX,
          badgeY,
          Math.max(badgeSize, 28),
          badgeSize,
          4,
        );
        ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        ctx.font = `800 10px ${CARD_FONT}`;
        ctx.textAlign = "center";
        ctx.fillText(
          sub.badge,
          badgeX + Math.max(badgeSize, 28) / 2,
          rowCenterY + 3,
        );
      } else {
        ctx.fillStyle = "#E4E4E7";
        ctx.beginPath();
        ctx.arc(
          badgeX + badgeSize / 2,
          rowCenterY,
          badgeSize / 2,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        ctx.fillStyle = "#71717A";
        ctx.font = `800 11px ${CARD_FONT}`;
        ctx.textAlign = "center";
        ctx.fillText(
          sub.name.charAt(0).toUpperCase(),
          badgeX + badgeSize / 2,
          rowCenterY + 4,
        );
      }

      // Market name (middle, ellipsis)
      const nameX = badgeX + 30;
      const valueX = cx + cw - padX - 62;
      const pctX = cx + cw - padX;
      const nameMaxW = valueX - nameX - 10;

      ctx.fillStyle = NAME_COLOR;
      ctx.font = `500 13px ${CARD_FONT}`;
      ctx.textAlign = "left";
      let displayName = sub.name;
      while (
        ctx.measureText(displayName).width > nameMaxW &&
        displayName.length > 4
      ) {
        displayName = displayName.slice(0, -1);
      }
      if (displayName !== sub.name) displayName = displayName.slice(0, -1) + "…";
      ctx.fillText(displayName, nameX, rowCenterY + 4);

      // Value (monospace, right-aligned to 62px before pct)
      ctx.fillStyle = NAME_COLOR;
      ctx.font = `600 13px ${MONO_FONT}`;
      ctx.textAlign = "right";
      ctx.fillText(sub.value, valueX + 58, rowCenterY + 4);

      // Pct (monospace, right-aligned, colored)
      ctx.fillStyle = pctColor(sub.pct);
      ctx.font = `600 12px ${MONO_FONT}`;
      ctx.textAlign = "right";
      ctx.fillText(pctText(sub.pct), pctX, rowCenterY + 4);
    });
    ctx.textAlign = "left";

    // ─ Bottom divider above chart
    const chartTop = rowStart + rows.length * rowH + 4;
    ctx.strokeStyle = ROW_DIVIDER;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, chartTop);
    ctx.lineTo(cx + cw, chartTop);
    ctx.stroke();

    // ─ Chart — 2 series, area fill + line
    const chartX = cx + 12;
    const chartY = chartTop + 10;
    const chartW = cw - 24;
    const chartH = cy + ch - chartY - 10;

    // Subtle accent tint on the chart background
    const chartBgGrad = ctx.createLinearGradient(
      chartX,
      chartY,
      chartX,
      chartY + chartH,
    );
    chartBgGrad.addColorStop(0, "rgba(255,255,255,0)");
    chartBgGrad.addColorStop(1, source.accent + "10");
    ctx.fillStyle = chartBgGrad;
    ctx.fillRect(chartX, chartY, chartW, chartH);

    const series: { color: string; values: number[] }[] = [
      { color: CHART_COLORS[0], values: sparklineValues(source.id, 36, 0) },
      { color: source.accent, values: sparklineValues(source.id, 36, 3) },
    ];

    for (let s = 0; s < series.length; s++) {
      const { color, values } = series[s];
      const pts = values.map((v, k) => ({
        x: chartX + (k / (values.length - 1)) * chartW,
        y: chartY + (1 - v) * chartH,
      }));

      // Area fill
      const areaGrad = ctx.createLinearGradient(
        chartX,
        chartY,
        chartX,
        chartY + chartH,
      );
      areaGrad.addColorStop(0, color + "33");
      areaGrad.addColorStop(1, color + "00");
      ctx.fillStyle = areaGrad;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, chartY + chartH);
      for (const p of pts) ctx.lineTo(p.x, p.y);
      ctx.lineTo(pts[pts.length - 1].x, chartY + chartH);
      ctx.closePath();
      ctx.fill();

      // Line
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.8;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y);
      ctx.stroke();

      // End dot
      const end = pts[pts.length - 1];
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(end.x, end.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

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
  texture.anisotropy = 8;

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
    // Base 1.5 × 1.5 from VortexGallery, 1.4× per request.
    const geo = new THREE.BoxGeometry(2.1, 2.1, 0.075);

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

// ── Center plane ────────────────────────────────────────────────────────

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
      <planeGeometry args={[2.38, 3.22]} />
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

const VortexScene: React.FC<{
  frame: number;
  fps: number;
  atlas: THREE.CanvasTexture;
  tiles: TileUV[];
  centerIndex: number;
}> = ({ frame, fps, atlas, tiles, centerIndex }) => {
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
      <CenterPlane atlas={atlas} tiles={tiles} textureIndex={centerIndex} />
    </>
  );
};

// ── Remotion composition export ─────────────────────────────────────────

export const SourceVortexGallery: React.FC<{
  /** Source ID to show on the center card. Defaults to cycling by scroll. */
  centerSourceId?: string;
}> = ({ centerSourceId }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const [atlasState, setAtlasState] = useState<{
    texture: THREE.CanvasTexture;
    tiles: TileUV[];
  } | null>(null);
  const [handle] = useState(() => delayRender("source-vortex-atlas"));

  useEffect(() => {
    let cancelled = false;
    buildSourceAtlas()
      .then((result) => {
        if (cancelled) return;
        setAtlasState(result);
        continueRender(handle);
      })
      .catch((err) => {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.error("Failed to build source vortex atlas:", err);
        continueRender(handle);
      });
    return () => {
      cancelled = true;
    };
  }, [handle]);

  if (!atlasState) {
    return <AbsoluteFill style={{ background: "#0a0a0a" }} />;
  }

  // Resolve centerIndex: an explicit source ID wins; otherwise cycle.
  let centerIndex = 0;
  if (centerSourceId) {
    const idx = FEATURED_SOURCES.findIndex((s) => s.id === centerSourceId);
    if (idx >= 0) centerIndex = idx;
  } else {
    centerIndex = Math.floor(
      (frame * SCROLL_SPEED) % FEATURED_SOURCES.length,
    );
  }

  return (
    <AbsoluteFill style={{ background: "#0a0a0a" }}>
      <ThreeCanvas
        width={width}
        height={height}
        style={{ width: "100%", height: "100%" }}
        camera={{ position: [0, 0, 5], fov: 50, near: 0.1, far: 200 }}
      >
        <VortexScene
          frame={frame}
          fps={fps}
          atlas={atlasState.texture}
          tiles={atlasState.tiles}
          centerIndex={centerIndex}
        />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
