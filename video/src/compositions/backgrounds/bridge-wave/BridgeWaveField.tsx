// Procedural rebuild of public/crx-assets/bridge-wave-4k.mp4 — the
// bridge.xyz hero water. The source is a horizontally stratified
// watercolor field: emerald / teal / cyan washes drifting slowly left,
// contact lines rippling, an occasional warm-gray haze patch, the
// bottom third dissolving into near-white. Measured from the clip:
// leftward drift ≈ 10.8% of frame width per second, no vertical
// translation, an exact 18 s loop, white floor at rgb(251,253,251).
//
// Engine: one full-screen quad with a GLSL fragment shader. All noise
// is lattice-periodic per axis, and every drift advances an integer
// number of periods per loop — so the field loops exactly at
// `loopSeconds`, like the video it replaces. Time comes only from
// useCurrentFrame(), so rendering is deterministic.
import React, { useMemo, useRef } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";

// ── Parameter surface ───────────────────────────────────────────────────

export type BridgeWaveProps = {
  /** Gradient stops, low field value → high. Index 0 paints the lower,
   *  bluer washes; the last index paints the strip along the top. */
  colors?: string[];
  /** The warm gray that surfaces as occasional haze patches. */
  haze?: string;
  /** The near-white the bottom of the frame dissolves into. */
  base?: string;
  /** Vertical swing of the band edges. 1 = source match. */
  waveAmplitude?: number;
  /** Horizontal frequency of the fine ripple along contact lines. */
  waveFrequency?: number;
  /** Leftward drift. 1 = source match (~11% width/s). Snapped to keep
   *  the loop exact; for fine speed control adjust loopSeconds. */
  flowSpeed?: number;
  /** Vertical density of the color strata. */
  bandCount?: number;
  /** How much the large swell distorts the color patches. */
  warpStrength?: number;
  /** Film grain amount, 0–1. */
  grain?: number;
  /** Reseeds every noise field — a different water, same character. */
  seed?: number;
  /** Where the fade to `base` begins / completes, 0 = top, 1 = bottom. */
  fadeStart?: number;
  fadeEnd?: number;
  /** Exact loop period in seconds. */
  loopSeconds?: number;
  /** Canvas raster size. Defaults to the composition size. */
  width?: number;
  height?: number;
};

export const BRIDGE_WAVE_DEFAULTS = {
  // Index 0 paints the low washes (near the white floor), the last index the
  // strip along the top. Sampled from the source: pale teal → cyan → emerald.
  colors: ["#cdeee4", "#a9e0ea", "#8bddf1", "#79cfd0", "#6cc0a4", "#5fb28f"],
  haze: "#b7b0a2",
  base: "#fbfdfb",
  waveAmplitude: 1,
  waveFrequency: 1,
  flowSpeed: 1,
  bandCount: 2.6,
  warpStrength: 1,
  grain: 0.5,
  seed: 7,
  fadeStart: 0.54,
  fadeEnd: 0.9,
  loopSeconds: 18,
} satisfies BridgeWaveProps;

// ── Shaders ─────────────────────────────────────────────────────────────

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;

varying vec2 vUv;

uniform float uT01;        // 0..1 across one loop
uniform float uSeed;
uniform vec3  uColors[8];
uniform float uStopCount;
uniform vec3  uHaze;
uniform vec3  uBase;
uniform float uAmp;
uniform float uRippleFreq; // integer cells across the width
uniform float uDrift;      // integer pattern-widths per loop
uniform float uBands;
uniform float uWarp;
uniform float uGrain;
uniform float uFadeStart;
uniform float uFadeEnd;
uniform vec2  uRes;

// Lattice-periodic 2-D value noise. \`period\` is integer per axis; the field
// tiles at that period, which is what makes the loop exact. Two dimensions,
// four taps — half the cost of a trilinear 3-D lookup. There is no time axis
// in the noise: the field animates because its sample coordinates drift and
// the domain-warp that couples the two fields is itself drift-driven, so a
// fixed pixel sees genuine morph, not a rigid scroll.
float hash2(vec2 p) {
  p = fract(p * 0.3183099 + vec2(0.1031, 0.1703) + uSeed * 0.0137);
  p *= 17.0;
  return fract(p.x * p.y * (p.x + p.y));
}

float vnoise(vec2 p, vec2 period) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float n00 = hash2(mod(i, period));
  float n10 = hash2(mod(i + vec2(1.0, 0.0), period));
  float n01 = hash2(mod(i + vec2(0.0, 1.0), period));
  float n11 = hash2(mod(i + vec2(1.0, 1.0), period));
  return mix(mix(n00, n10, u.x), mix(n01, n11, u.x), u.y);
}

// Four-octave value-noise fbm. The k-loop is NOT unrolled by SwiftShader,
// so octaves cost runtime only — but every *textual* fbm() call site is a
// separate inline frame, and each trilinear frame is expensive enough that
// SwiftShader silently drops the whole draw once a fragment carries more than
// about two of them plus the shading tail. The whole field is therefore built
// from exactly two 2-D fbm evaluations (see main); ripple, haze and sheen are
// recovered as cheap analytic functions of those two.
float fbm(vec2 p, vec2 period) {
  float s = 0.0;
  float a = 0.5;
  for (int k = 0; k < 4; k++) {
    s += a * vnoise(p, period);
    p *= 2.0;
    period *= 2.0;
    a *= 0.5;
  }
  return s / 0.9375; // normalize back to ~0..1
}

// Piecewise-linear ramp over up to 8 stops. Constant-index only — GLSL ES /
// SwiftShader (Remotion's headless GL) silently drops the whole draw if a
// uniform array is indexed by a loop counter, so the mix chain is unrolled.
vec3 ramp(float m) {
  float x = clamp(m, 0.0, 1.0) * (uStopCount - 1.0);
  vec3 c = uColors[0];
  c = mix(c, uColors[1], clamp(x - 0.0, 0.0, 1.0) * step(1.5, uStopCount));
  c = mix(c, uColors[2], clamp(x - 1.0, 0.0, 1.0) * step(2.5, uStopCount));
  c = mix(c, uColors[3], clamp(x - 2.0, 0.0, 1.0) * step(3.5, uStopCount));
  c = mix(c, uColors[4], clamp(x - 3.0, 0.0, 1.0) * step(4.5, uStopCount));
  c = mix(c, uColors[5], clamp(x - 4.0, 0.0, 1.0) * step(5.5, uStopCount));
  c = mix(c, uColors[6], clamp(x - 5.0, 0.0, 1.0) * step(6.5, uStopCount));
  c = mix(c, uColors[7], clamp(x - 6.0, 0.0, 1.0) * step(7.5, uStopCount));
  return c;
}

void main() {
  float x = vUv.x;
  float yd = 1.0 - vUv.y; // 0 = top, 1 = bottom
  float drift = uT01 * uDrift;

  // The whole field rests on ONE fbm evaluation. Each noise inline very nearly
  // fills SwiftShader's fragment temporary file; a second inline, or too much
  // held live across it, tips the register allocator past its limit and the
  // entire draw is silently dropped — a blank white frame, no compile error.
  // With a single evaluation the rest of the file is free, so everything below
  // is analytic and rides under the ceiling. The band undulation, the ripple
  // along contact lines and the colour variation are all read off this one
  // field at different scales; the fine ripple is a low-frequency sine so it
  // scallops the bands instead of combing them.
  // The horizontal scale equals the x-period (3), so drift * scale advances a
  // whole number of lattice cells per loop and the field tiles back exactly.
  // The field is deliberately anisotropic — wide in x, ~3x finer in y — so it
  // reads as long horizontal streaks (brushed silk), not round blobs. uWarp
  // shears the sample column by height, giving the bands their slow lateral
  // wave; it is folded into the coordinate (no stored temporary) and carries
  // no time term, so the exact loop is untouched.
  vec2 pBase = vec2(
    x * 3.0 + drift * 3.0 + sin(yd * 5.0 + 1.3) * uWarp * 0.35,
    yd * 8.0
  );
  float base = fbm(pBase, vec2(3.0, 128.0));

  // ── From here down, no more noise: everything is analytic. ──

  // Fine scallop along the contact lines. uRippleFreq and uDrift are integers,
  // so the phase turns a whole number of times per loop and stays loop-exact.
  float ripple = sin(
    (x * (1.0 + floor(uRippleFreq * 0.18)) + drift) * 6.2831853 + base * 9.0
  );

  float yW = yd + (base - 0.5) * 0.22 * uAmp + ripple * 0.02 * uAmp;

  // Colour: a vertical march through the ramp (uBands sets how many stops the
  // frame spans) plus a wide wash from the field, so the strata drift and
  // dissolve rather than sit in flat horizontal stripes.
  float m = 0.44 + (0.5 - yW) * uBands * 0.62 + (base - 0.5) * 0.62;
  vec3 col = ramp(clamp(m, 0.0, 1.0));

  // Warm-gray haze — patches where the field runs high, never everywhere.
  col = mix(col, uHaze, smoothstep(0.72, 0.94, base) * 0.5);

  // The dissolve into white. The boundary rides the warped y, so the white
  // line ripples like the rest of the field.
  col = mix(col, uBase, smoothstep(uFadeStart, uFadeEnd, yW));

  // Grain — subtle re-grain of the 4K master.
  float g = fract(sin(dot(gl_FragCoord.xy + uT01 * 913.0, vec2(12.9898, 78.233))) * 43758.5453);
  col += (g - 0.5) * uGrain * 0.045;

  gl_FragColor = vec4(col, 1.0);
}
`;

// ── Scene ───────────────────────────────────────────────────────────────

const MAX_STOPS = 8;

const hexToVec3 = (hex: string): THREE.Vector3 => {
  const h = hex.replace("#", "");
  const n = parseInt(
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h,
    16,
  );
  return new THREE.Vector3(
    ((n >> 16) & 255) / 255,
    ((n >> 8) & 255) / 255,
    (n & 255) / 255,
  );
};

type ResolvedParams = {
  t01: number;
  colors: string[];
  haze: string;
  base: string;
  waveAmplitude: number;
  waveFrequency: number;
  flowSpeed: number;
  bandCount: number;
  warpStrength: number;
  grain: number;
  seed: number;
  fadeStart: number;
  fadeEnd: number;
  width: number;
  height: number;
};

const WaveQuad: React.FC<ResolvedParams> = (p) => {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  // Flat Float32Array of MAX_STOPS × vec3 — the canonical, allocation-free way
  // to drive a `vec3 uColors[8]` uniform (three.js flattens it once and reuses
  // the buffer, rather than re-packing an array of Vector3 every frame).
  const stops = useMemo(() => {
    const arr = new Float32Array(MAX_STOPS * 3);
    for (let i = 0; i < MAX_STOPS; i++) {
      const src = p.colors[Math.min(i, p.colors.length - 1)];
      const v = hexToVec3(src);
      arr[i * 3] = v.x;
      arr[i * 3 + 1] = v.y;
      arr[i * 3 + 2] = v.z;
    }
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.colors.join("|")]);

  // Drift snaps to whole pattern-widths per loop so the loop stays exact.
  const drift = Math.max(1, Math.round(p.flowSpeed * 2));
  const rippleFreq = Math.max(4, Math.round(32 * p.waveFrequency));

  const uniforms = useMemo(
    () => ({
      uT01: { value: 0 },
      uSeed: { value: p.seed },
      uColors: { value: stops },
      uStopCount: { value: Math.min(MAX_STOPS, p.colors.length) },
      uHaze: { value: hexToVec3(p.haze) },
      uBase: { value: hexToVec3(p.base) },
      uAmp: { value: p.waveAmplitude },
      uRippleFreq: { value: rippleFreq },
      uDrift: { value: drift },
      uBands: { value: p.bandCount },
      uWarp: { value: p.warpStrength },
      uGrain: { value: p.grain },
      uFadeStart: { value: p.fadeStart },
      uFadeEnd: { value: p.fadeEnd },
      uRes: { value: new THREE.Vector2(p.width, p.height) },
    }),
    // Built once; every value is re-driven per frame below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  if (matRef.current) {
    const u = matRef.current.uniforms;
    u.uT01.value = p.t01;
    u.uSeed.value = p.seed;
    u.uColors.value = stops;
    u.uStopCount.value = Math.min(MAX_STOPS, p.colors.length);
    u.uHaze.value = hexToVec3(p.haze);
    u.uBase.value = hexToVec3(p.base);
    u.uAmp.value = p.waveAmplitude;
    u.uRippleFreq.value = rippleFreq;
    u.uDrift.value = drift;
    u.uBands.value = p.bandCount;
    u.uWarp.value = p.warpStrength;
    u.uGrain.value = p.grain;
    u.uFadeStart.value = p.fadeStart;
    u.uFadeEnd.value = p.fadeEnd;
    u.uRes.value.set(p.width, p.height);
  } else {
    uniforms.uT01.value = p.t01;
  }

  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={VERTEX}
        fragmentShader={FRAGMENT}
        uniforms={uniforms}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
};

// ── Public component — fills its container ──────────────────────────────

export const BridgeWaveField: React.FC<BridgeWaveProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps, width: vw, height: vh } = useVideoConfig();
  const d = { ...BRIDGE_WAVE_DEFAULTS, ...props };
  const width = d.width ?? vw;
  const height = d.height ?? vh;
  const t01 = (frame / fps / d.loopSeconds) % 1;

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <ThreeCanvas
        width={width}
        height={height}
        style={{ width: "100%", height: "100%" }}
        camera={{ position: [0, 0, 1] }}
        gl={{ antialias: false, powerPreference: "high-performance" }}
      >
        <WaveQuad
          t01={t01}
          colors={d.colors}
          haze={d.haze}
          base={d.base}
          waveAmplitude={d.waveAmplitude}
          waveFrequency={d.waveFrequency}
          flowSpeed={d.flowSpeed}
          bandCount={d.bandCount}
          warpStrength={d.warpStrength}
          grain={d.grain}
          seed={d.seed}
          fadeStart={d.fadeStart}
          fadeEnd={d.fadeEnd}
          width={width}
          height={height}
        />
      </ThreeCanvas>
    </div>
  );
};
