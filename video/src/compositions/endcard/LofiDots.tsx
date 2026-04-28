/**
 * LofiDots — a hex grid of identically sized circles, each one carved
 * into the paper to a different depth. No video, no texture sampling.
 * Pure shader: paper, grain, vignette, and a per-cell noise that decides
 * how deeply the punch struck the page. Some dots barely register.
 * Others sit in their own little shadow.
 */

import React, { useMemo, useRef } from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";

// ── Knobs ─────────────────────────────────────────────────────────────
// Paper tone behind the dots.
const PAPER = "#ece7da";
// Centre-to-centre horizontal spacing of the hex grid, in source pixels.
const SPACING_PX = 64;
// Dot radius, in source pixels. Same for every dot — that's the point.
const RADIUS_PX = 20;
// Anti-aliased rim width, in pixels.
const EDGE_PX = 1.4;
// Average carve depth across the grid. 0 = flat, 1 = aggressive.
const CARVE_BASE = 0.55;
// How far each dot can stray from the average. Higher = louder rhythm.
const CARVE_VAR = 0.45;
// Slow drift of the per-cell noise, in carve-units per second. Subtle.
const CARVE_DRIFT = 0.025;
// Light direction in radians. 2.356 ≈ 135°, light from the top-left.
const LIGHT_ANGLE = 2.356;
// Strength of the directional rim shading inside each dot.
const RIM_SHADE = 0.22;
// Slight darkening at the floor of deeper dots — fake AO.
const AO_STRENGTH = 0.14;
// Paper grain amplitude. Keep it gentle; print, not noise art.
const GRAIN = 0.04;
// Soft vignette toward the corners.
const VIGNETTE = 0.18;

// ── Shaders ───────────────────────────────────────────────────────────

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  precision highp float;

  uniform vec2  uResolution;
  uniform vec3  uPaper;
  uniform float uSpacing;
  uniform float uRadius;
  uniform float uEdge;
  uniform float uCarveBase;
  uniform float uCarveVar;
  uniform float uTime;
  uniform float uDrift;
  uniform float uLightAngle;
  uniform float uRimShade;
  uniform float uAoStrength;
  uniform float uGrain;
  uniform float uVignette;

  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  // Smooth value noise on a 2D integer lattice — used to wobble the
  // per-cell carve depth across time without ever snapping.
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  void main() {
    vec2 fragPx = vUv * uResolution;

    // Hex packing: rows alternate by half a column. Vertical spacing is
    // sqrt(3)/2 of horizontal — gives the printer's six-around-one ring.
    float vSpacing = uSpacing * 0.8660254;
    float row = floor(fragPx.y / vSpacing);
    float xOffset = mod(row, 2.0) > 0.5 ? 0.5 * uSpacing : 0.0;
    float colIdx = floor((fragPx.x - xOffset) / uSpacing);
    vec2 cellId = vec2(colIdx, row);
    vec2 cellCenter = vec2(
      (colIdx + 0.5) * uSpacing + xOffset,
      (row + 0.5) * vSpacing
    );
    vec2 cellLocal = fragPx - cellCenter;
    float r = length(cellLocal);

    // Anti-aliased disk mask. 1 inside, 0 outside, smooth at the rim.
    float dotMask = 1.0 - smoothstep(uRadius - uEdge, uRadius + uEdge, r);

    // Carve depth: per-cell noise, drifting slowly. Same radius for all,
    // but the depth of the punch varies — that is the entire concept.
    float n = vnoise(cellId * 0.37 + vec2(uTime * uDrift, uTime * uDrift * 0.6));
    float carve = clamp(uCarveBase + uCarveVar * (n - 0.5), 0.0, 1.0);

    // Inside-the-hole shading. For a depression, the inner wall facing
    // the light catches the brightness; the wall behind sits in shadow.
    // -dir is the inward-facing normal in 2D; dotting it with the light
    // direction gives a clean Lambertian split across the cup.
    float rNorm = clamp(r / uRadius, 0.0, 1.0);
    vec2 dir = r > 0.001 ? cellLocal / r : vec2(0.0, 1.0);
    vec2 lightDir = vec2(cos(uLightAngle), sin(uLightAngle));
    float shade = dot(-dir, lightDir);
    float rim = smoothstep(0.0, 1.0, rNorm);

    // Floor of the depression dims slightly — fake ambient occlusion.
    float ao = 1.0 - uAoStrength * carve * (1.0 - 0.4 * rNorm);

    vec3 paper = uPaper;
    vec3 dotCol = paper * ao + shade * rim * carve * uRimShade * vec3(1.0);
    vec3 col = mix(paper, dotCol, dotMask);

    // Paper grain — a uniform layer over both the dots and the field, so
    // nothing feels dropped on top of clean glass.
    float grain = (hash(floor(fragPx / 1.4)) - 0.5) * uGrain;
    col += vec3(grain);

    // Soft vignette pushes the corners toward the paper. Almost subliminal.
    vec3 paperGrain = uPaper + vec3(grain);
    vec2 p = vUv - 0.5;
    float v = smoothstep(0.75, 0.2, length(p));
    col = mix(col, paperGrain, (1.0 - v) * uVignette);

    gl_FragColor = vec4(col, 1.0);
  }
`;

// ── Three scene — fullscreen quad ─────────────────────────────────────

interface DotPlaneProps {
  width: number;
  height: number;
  time: number;
}

const DotPlane: React.FC<DotPlaneProps> = ({ width, height, time }) => {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uResolution: { value: new THREE.Vector2(width, height) },
      uPaper: { value: new THREE.Color(PAPER) },
      uSpacing: { value: SPACING_PX },
      uRadius: { value: RADIUS_PX },
      uEdge: { value: EDGE_PX },
      uCarveBase: { value: CARVE_BASE },
      uCarveVar: { value: CARVE_VAR },
      uTime: { value: time },
      uDrift: { value: CARVE_DRIFT },
      uLightAngle: { value: LIGHT_ANGLE },
      uRimShade: { value: RIM_SHADE },
      uAoStrength: { value: AO_STRENGTH },
      uGrain: { value: GRAIN },
      uVignette: { value: VIGNETTE },
    }),
    [width, height, time],
  );

  if (matRef.current) {
    matRef.current.uniforms.uTime.value = time;
  }

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={VERTEX}
        fragmentShader={FRAGMENT}
        uniforms={uniforms}
        depthTest={false}
        depthWrite={false}
        transparent={false}
      />
    </mesh>
  );
};

// ── Main composition ──────────────────────────────────────────────────

export const LofiDots: React.FC<{
  skipFadeIn?: boolean;
}> = ({ skipFadeIn = false }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  const fadeIn = skipFadeIn
    ? 1
    : interpolate(frame, [0, 18], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.bezier(0.16, 1, 0.3, 1),
      });

  const time = frame / fps;

  return (
    <AbsoluteFill style={{ background: PAPER }}>
      <AbsoluteFill style={{ opacity: fadeIn }}>
        <ThreeCanvas
          width={width}
          height={height}
          gl={{
            antialias: false,
            powerPreference: "high-performance",
            alpha: false,
          }}
        >
          <DotPlane width={width} height={height} time={time} />
        </ThreeCanvas>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
