/**
 * LofiDotsTitled — the broll, made of metal.
 *
 * Two layers, both lit by the same world:
 *   1. A 3D hex prism grid borrowed from /WebGLPicks at 1:44
 *      (ParticleWave). Each prism is a tiny lathe — six segments, soft
 *      cornered — coloured by sampling the broll at its own screen
 *      position. The grid breathes: phase-offset depth, light tilt
 *      that follows a slow Lissajous, point-light specular pulled
 *      across the field. The world becomes ferromagnetic.
 *   2. The title glyphs, clipped over a full-resolution copy of the
 *      same broll. The metal coarsens it; the letters let it speak.
 *
 * Both videos play in lockstep — Remotion syncs every <Video> element
 * to the current frame, so the colour of any tile and the colour of
 * any pixel inside the words come from the same instant.
 */

import React, { useEffect, useMemo, useRef } from "react";
import {
  AbsoluteFill,
  Easing,
  Video,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { VIDEO_SRC } from "./LofiDots";

// ── Hex grid (mirrors ParticleWave; tuned for broll-sampled colour) ──
const HEX_N = 24;
const RADIUS = 50 / HEX_N;
const TIME_COEF = 0.7;
const DEPTH_SCALE = 0.55;
// ParticleWave runs metalness 0.8 — fine when its base colours are
// pure white/blue/black, since metal reflects the environment and
// those colours read either bright (white) or dark (black) under
// point lights. Our broll skews moody, mostly mid-grey clouds; the
// same metalness eats it. Drop to ~0.45 so the broll's diffuse
// channel survives, keep clearcoat for the wet gloss.
const METALNESS = 0.45;
const ROUGHNESS = 0.42;
const CLEARCOAT = 1;
const CLEARCOAT_ROUGHNESS = 0.18;
const TILT_X = 0.10;
const TILT_Y = 0.10;
// Pre-gain on the sampled colour. Even with metalness reduced the
// PBR shader compresses chroma — give it back here.
const COLOR_BOOST = 1.55;

// ── Broll sampler (video → 2D canvas → pixel buffer each render) ──
const SAMPLER_W = 256;
const SAMPLER_H = 144;

// ── Title knobs (broll inside the glyphs) ──
const TITLE_LINES = ["HEXAGONAL", "GRID"];
const TITLE_FONT = '"Arial Black", Impact, system-ui, sans-serif';
const TITLE_WEIGHTS = [900, 700];
const TITLE_FONT_SCALE = 0.20;
const TITLE_LINE_GAP_SCALE = 0.02;
const TITLE_LETTER_SPACING_EM = 0.11;
const MASK_ID = "lofi-dots-titled-mask";

// ── Hex prism — six-segment lathe, identical to ParticleWave's ──
function createHexGeometry(): THREE.LatheGeometry {
  const segments = 6;
  const height = 5 * RADIUS;
  const cornerR = 0.125 * RADIUS;
  const cornerRZ = 0.125 * RADIUS;
  const cornerSteps = 6;
  const points: THREE.Vector2[] = [];
  points.push(new THREE.Vector2(RADIUS, -height / 2));
  for (let i = 0; i < cornerSteps; i++) {
    const t = i / (cornerSteps - 1);
    const x = RADIUS - cornerR + Math.cos((t * Math.PI) / 2) * cornerR;
    const z = height / 2 - cornerRZ + Math.sin((t * Math.PI) / 2) * cornerRZ;
    points.push(new THREE.Vector2(x, z));
  }
  points.push(new THREE.Vector2(0, height / 2));
  const geo = new THREE.LatheGeometry(points, segments);
  geo.translate(0, -height / 2, 0);
  geo.rotateX(Math.PI / 2);
  return geo;
}

// ── Tile centres ──
interface TileData {
  x: number;
  y: number;
  phase: number;
}

function computeTiles(): TileData[] {
  const NX = HEX_N;
  const NY = HEX_N;
  const spacing = Math.cos(Math.PI / 6) * RADIUS * 2;
  const rowH = 1.5 * RADIUS;
  const ox = (-NX / 2) * spacing + spacing / 4;
  const oy = (-NY / 2) * rowH + rowH / 2;
  const tiles: TileData[] = [];
  for (let col = 0; col < NX; col++) {
    for (let row = 0; row < NY; row++) {
      tiles.push({
        x: ox + col * spacing + ((row % 2) / 2) * spacing,
        y: oy + row * rowH,
        phase: (((col * 7 + row * 13) % 100) / 100) * Math.PI * 2,
      });
    }
  }
  return tiles;
}

// ── Half-extent of the grid in tile units, for tile-pos → UV mapping ──
const GRID_HALF_X = (HEX_N / 2) * Math.cos(Math.PI / 6) * RADIUS * 2;
const GRID_HALF_Y = (HEX_N / 2) * 1.5 * RADIUS;

// ── Pixel sampler — kept across renders ──
interface Sampler {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  pixels: Uint8ClampedArray | null;
}

const useBrollSampler = (
  videoRef: React.RefObject<HTMLVideoElement | null>,
  frame: number,
): React.MutableRefObject<Sampler | null> => {
  const samplerRef = useRef<Sampler | null>(null);

  if (typeof document !== "undefined" && !samplerRef.current) {
    const canvas = document.createElement("canvas");
    canvas.width = SAMPLER_W;
    canvas.height = SAMPLER_H;
    samplerRef.current = {
      canvas,
      width: SAMPLER_W,
      height: SAMPLER_H,
      pixels: null,
    };
  }

  // Per-render: blit current video frame into the canvas, snapshot pixels.
  const sampler = samplerRef.current;
  const video = videoRef.current;
  if (sampler && video && video.readyState >= 2 && video.videoWidth > 0) {
    const ctx = sampler.canvas.getContext("2d", { willReadFrequently: true });
    if (ctx) {
      ctx.drawImage(
        video,
        0,
        0,
        video.videoWidth,
        video.videoHeight,
        0,
        0,
        SAMPLER_W,
        SAMPLER_H,
      );
      sampler.pixels = ctx.getImageData(0, 0, SAMPLER_W, SAMPLER_H).data;
    }
  }
  void frame;

  return samplerRef;
};

// ── 3D hex field ──
interface HexFieldProps {
  samplerRef: React.MutableRefObject<Sampler | null>;
  pointerX: number;
  pointerY: number;
  time: number;
}

const HexField: React.FC<HexFieldProps> = ({
  samplerRef,
  pointerX,
  pointerY,
  time,
}) => {
  const { size } = useThree();
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const geometry = useMemo(() => createHexGeometry(), []);
  const tiles = useMemo(() => computeTiles(), []);

  const aspect = size.width / size.height;
  const cameraZ = 100;
  const fov = 50;
  const vFov = (fov * Math.PI) / 180;
  const wHeight = 2 * Math.tan(vFov / 2) * cameraZ;
  const wWidth = wHeight * aspect;
  const scaleFactor =
    aspect > 1 ? (wWidth / 100) * 1.4 : (wHeight / 100) * 1.4;

  const targetX = (pointerX * wWidth) / 2;
  const targetY = (pointerY * wHeight) / 2;
  const tiltX = -pointerY * TILT_X;
  const tiltY = pointerX * TILT_Y;

  // Per-render: imperatively rewrite every instance matrix and colour.
  // useEffect with no deps fires after every render, before paint —
  // exactly when the InstancedMesh ref is populated and the WebGL
  // commit hasn't happened yet.
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const sampler = samplerRef.current;
    const pixels = sampler?.pixels ?? null;
    const sw = sampler?.width ?? 0;
    const sh = sampler?.height ?? 0;

    const dummy = new THREE.Object3D();
    const tmpColor = new THREE.Color();
    const maxDist = 20 * RADIUS * scaleFactor;

    for (let i = 0; i < tiles.length; i++) {
      const tile = tiles[i];
      const worldX = tile.x * scaleFactor;
      const worldY = tile.y * scaleFactor;
      const dx = worldX - targetX;
      const dy = worldY - targetY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const t = Math.max(0, Math.min(1, dist / maxDist));
      const proximity = 1 - t * t * (3 - 2 * t);

      const depth =
        0.5 *
        (Math.cos(tile.phase + time * TIME_COEF) - 1) *
        RADIUS *
        DEPTH_SCALE *
        proximity;

      dummy.position.set(tile.x, tile.y, depth);
      dummy.scale.setScalar(1);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      // Sample broll at this tile's UV. Y flipped — image space.
      if (pixels && sw > 0 && sh > 0) {
        const u = (tile.x + GRID_HALF_X) / (2 * GRID_HALF_X);
        const v = 1 - (tile.y + GRID_HALF_Y) / (2 * GRID_HALF_Y);
        const px = Math.max(0, Math.min(sw - 1, Math.floor(u * sw)));
        const py = Math.max(0, Math.min(sh - 1, Math.floor(v * sh)));
        const idx = (py * sw + px) * 4;
        const r = Math.min(1, (pixels[idx] / 255) * COLOR_BOOST);
        const g = Math.min(1, (pixels[idx + 1] / 255) * COLOR_BOOST);
        const b = Math.min(1, (pixels[idx + 2] / 255) * COLOR_BOOST);
        tmpColor.setRGB(r, g, b);
        mesh.setColorAt(i, tmpColor);
      } else {
        tmpColor.setRGB(0.45, 0.45, 0.5);
        mesh.setColorAt(i, tmpColor);
      }
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <>
      {/* Lights — key from the front, accent from behind, ambient
          floor, and a hemisphere fill so unlit prisms still carry
          their broll colour instead of going black. Without the
          hemisphere, metal-in-a-dark-room reads as a black field. */}
      <pointLight
        color={0xffffff}
        intensity={1100}
        decay={2}
        position={[targetX, targetY, 5]}
      />
      <pointLight
        color={0xff5040}
        intensity={520}
        decay={2}
        position={[targetX, targetY, -20]}
      />
      <ambientLight intensity={0.85} />
      <hemisphereLight
        args={[0xfff2dd, 0x1a1822, 0.9]}
        position={[0, 0, 30]}
      />

      <group
        scale={[scaleFactor, scaleFactor, 1]}
        rotation={[tiltX, tiltY, 0]}
      >
        <instancedMesh
          ref={meshRef}
          args={[geometry, undefined, tiles.length]}
        >
          {/* No `vertexColors` — the geometry has no per-vertex
              colour attribute, so enabling it would make the shader
              multiply by zero and paint every prism black. The
              InstancedMesh's instanceColor attribute is picked up
              automatically by USE_INSTANCING_COLOR. */}
          <meshPhysicalMaterial
            metalness={METALNESS}
            roughness={ROUGHNESS}
            clearcoat={CLEARCOAT}
            clearcoatRoughness={CLEARCOAT_ROUGHNESS}
            side={THREE.FrontSide}
          />
        </instancedMesh>
      </group>
    </>
  );
};

// ── Title fade-in ──
const useTitleFadeIn = (frame: number, fps: number): number =>
  interpolate(frame, [0, Math.round(fps * 1.0)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

// ── Main composition ──
export const LofiDotsTitled: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  // The hidden broll element drives both the hex sampler and stays
  // available for any future direct reads. Remotion will sync its
  // `currentTime` to the composition frame.
  const samplerVideoRef = useRef<HTMLVideoElement | null>(null);
  const samplerRef = useBrollSampler(samplerVideoRef, frame);

  // Slow Lissajous drift — gives the lighting and tilt a life of
  // their own without ever quite repeating.
  const time = frame / fps;
  const pointerX = Math.sin(time * 0.4) * Math.cos(time * 0.25) * 0.6;
  const pointerY = Math.sin(time * 0.3) * 0.5;

  const fadeIn = interpolate(frame, [0, Math.round(fps * 1.5)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const titleOpacity = useTitleFadeIn(frame, fps);

  // Title geometry — two lines, vertically centred on the cap block.
  const fontSize = Math.round(height * TITLE_FONT_SCALE);
  const gap = Math.round(height * TITLE_LINE_GAP_SCALE);
  const cap = fontSize * 0.72;
  const blockHeight = cap * TITLE_LINES.length + gap * (TITLE_LINES.length - 1);
  const firstBaseline = height / 2 - blockHeight / 2 + cap;
  const baselines = TITLE_LINES.map(
    (_, i) => firstBaseline + i * (cap + gap),
  );
  const letterSpacing = fontSize * TITLE_LETTER_SPACING_EM;

  const titleVideoStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: "center",
  };

  return (
    <AbsoluteFill style={{ background: "#050507" }}>
      {/* Hidden broll element fed straight into the pixel sampler. */}
      <Video
        ref={samplerVideoRef}
        src={staticFile(VIDEO_SRC)}
        style={{
          position: "absolute",
          opacity: 0,
          pointerEvents: "none",
          width: 1,
          height: 1,
        }}
        muted
      />

      {/* Layer 1 — 3D hex grid, broll-coloured, metallic, lit. */}
      <AbsoluteFill style={{ opacity: fadeIn }}>
        <ThreeCanvas
          width={width}
          height={height}
          camera={{ position: [0, 0, 100], fov: 50 }}
          gl={{
            antialias: true,
            alpha: false,
            powerPreference: "high-performance",
            toneMapping: THREE.ACESFilmicToneMapping,
          }}
        >
          <HexField
            samplerRef={samplerRef}
            pointerX={pointerX}
            pointerY={pointerY}
            time={time}
          />
        </ThreeCanvas>
      </AbsoluteFill>

      {/* Layer 2 — broll inside the title glyphs. */}
      <AbsoluteFill style={{ pointerEvents: "none", opacity: titleOpacity }}>
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          style={{ position: "absolute", inset: 0 }}
        >
          <defs>
            <clipPath id={MASK_ID} clipPathUnits="userSpaceOnUse">
              {TITLE_LINES.map((line, i) => (
                <text
                  key={i}
                  x={width / 2}
                  y={baselines[i]}
                  textAnchor="middle"
                  fontFamily={TITLE_FONT}
                  fontWeight={TITLE_WEIGHTS[i]}
                  fontSize={fontSize}
                  letterSpacing={letterSpacing}
                >
                  {line}
                </text>
              ))}
            </clipPath>
          </defs>
          <foreignObject
            x={0}
            y={0}
            width={width}
            height={height}
            clipPath={`url(#${MASK_ID})`}
          >
            <div
              {...{ xmlns: "http://www.w3.org/1999/xhtml" }}
              style={{ width: "100%", height: "100%" }}
            >
              <Video
                src={staticFile(VIDEO_SRC)}
                muted
                style={titleVideoStyle}
              />
            </div>
          </foreignObject>
        </svg>

        {/* Thin ink stroke so the silhouette survives over highlights. */}
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          style={{ position: "absolute", inset: 0 }}
        >
          {TITLE_LINES.map((line, i) => (
            <text
              key={i}
              x={width / 2}
              y={baselines[i]}
              textAnchor="middle"
              fontFamily={TITLE_FONT}
              fontWeight={TITLE_WEIGHTS[i]}
              fontSize={fontSize}
              letterSpacing={letterSpacing}
              fill="none"
              stroke="rgba(5,5,7,0.85)"
              strokeWidth={3}
              paintOrder="stroke"
            >
              {line}
            </text>
          ))}
        </svg>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
