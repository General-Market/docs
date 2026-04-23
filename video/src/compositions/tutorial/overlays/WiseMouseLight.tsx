/**
 * WiseMouseLight — GLSL text-shadow shader, adapted from WebGLPicks/MouseLight.
 *
 * "GM" in wiseGreen with ray-marched light casting green-spectrum shadows.
 * Lissajous cursor path provides the drifting light source.
 * Dark background creates a dramatic contrast moment in the behindWebcam layer.
 */

import React, { useMemo, useRef } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";
import { COLOR } from "../designTokens";

const ext = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// ── GLSL ────────────────────────────────────────────────────────────────────

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;
uniform vec2 uResolution;
uniform vec2 uMouse;
uniform sampler2D uSrc;

#define PI 3.141593
#define SAMPLES 64.

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(489., 589.))) * 492.) * 2. - 1.;
}
float hash(vec3 p) {
  return fract(sin(dot(p, vec3(489., 589., 58.))) * 492.) * 2. - 1.;
}
vec2 hash2(vec3 p) {
  return vec2(hash(p), hash(p + 1.));
}
vec4 readTex(vec2 uv) {
  if (uv.x < 0. || uv.x > 1. || uv.y < 0. || uv.y > 1.) { return vec4(0); }
  return texture2D(uSrc, uv);
}

// Wise green spectrum — darkGreen to wiseGreen
vec3 spectrum(float x) {
  float t = cos(x * PI) * 0.5 + 0.5;
  return vec3(0.09 + 0.53 * t, 0.20 + 0.71 * t, 0.00 + 0.44 * t);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;

  // Text in wiseGreen (#9fe870)
  if (readTex(uv).r > 0.) {
    gl_FragColor = vec4(0.624, 0.91, 0.44, 1.0);
    return;
  }

  vec2 p = uv * 2. - 1.;
  p.x *= uResolution.x / uResolution.y;

  vec2 mp = uMouse / uResolution;
  mp = mp * 2. - 1.;
  mp.x *= uResolution.x / uResolution.y;

  // Ray march toward light, accumulate text occlusion
  vec2 rp = p;
  vec2 d = (mp - p) / SAMPLES;
  float acc = 0.;

  for (float i = 0.; i < SAMPLES; i++) {
    rp += d;
    rp += hash2(vec3(rp, i)) * 0.5 / SAMPLES;
    vec2 uv2 = rp;
    uv2.x /= uResolution.x / uResolution.y;
    uv2 = uv2 * 0.5 + 0.5;
    acc += readTex(uv2).r / SAMPLES;
  }

  // Green-tinted glow from light source
  float lm = length(p - mp);
  float glow = smoothstep(0., 1., pow(.1 / lm, .2));
  vec4 c = vec4(glow * 0.62, glow * 0.91, glow * 0.44, glow);

  c -= acc;
  c += vec4(spectrum(cos(acc * 3.5)), 1) * acc * 2.5;
  c -= hash(vec3(uv.xyy)) * 0.01;

  gl_FragColor = c;
}
`;

// ── Text texture — "Not a Strategy Video" in Inter 900, three lines ────────

function createTextTexture(
  width: number,
  height: number,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, width, height);

  const fontSize = Math.round(width * 0.1);
  const lineHeight = fontSize * 1.05;
  ctx.font = `900 ${fontSize}px Inter, "Helvetica Neue", Helvetica, sans-serif`;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lines = ["Not a", "Strategy", "Video"];
  const totalHeight = lines.length * lineHeight;
  const startY = (height - totalHeight) / 2 + lineHeight / 2;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], width / 2, startY + i * lineHeight);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

// ── Lissajous cursor — smooth figure-eight drift ───────────────────────────

function lissajousMouse(
  t: number,
  width: number,
  height: number,
): [number, number] {
  const x = width * (0.5 + 0.35 * Math.sin(t * 0.7 + 0.3));
  const y = height * (0.5 + 0.25 * Math.cos(t * 1.1 + 1.7));
  return [x, y];
}

// ── Three.js scene ─────────────────────────────────────────────────────────

const LightPlane: React.FC<{
  mouseX: number;
  mouseY: number;
}> = ({ mouseX, mouseY }) => {
  const { width, height } = useVideoConfig();
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const textTexture = useMemo(
    () => createTextTexture(width, height),
    [width, height],
  );

  const uniforms = useMemo(
    () => ({
      uResolution: { value: new THREE.Vector2(width, height) },
      uMouse: { value: new THREE.Vector2(mouseX, mouseY) },
      uSrc: { value: textTexture },
    }),
    [width, height, textTexture],
  );

  if (matRef.current) {
    matRef.current.uniforms.uMouse.value.set(mouseX, mouseY);
  }

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={VERTEX}
        fragmentShader={FRAGMENT}
        uniforms={uniforms}
      />
    </mesh>
  );
};

// ── Component ──────────────────────────────────────────────────────────────

export const WiseMouseLight: React.FC<{ durationInFrames: number }> = ({
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const time = frame / fps;

  const [mouseX, mouseY] = lissajousMouse(time, width, height);

  const fadeIn = interpolate(frame, [0, 15], [0, 1], ext);
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 15, durationInFrames],
    [1, 0],
    ext,
  );
  const envelope = Math.min(fadeIn, fadeOut);

  return (
    <AbsoluteFill style={{ backgroundColor: COLOR.bgDark, opacity: envelope }}>
      <ThreeCanvas
        width={width}
        height={height}
        camera={{ fov: 50, near: 0.1, far: 10, position: [0, 0, 1] }}
        gl={{ antialias: false, powerPreference: "high-performance" }}
      >
        <LightPlane mouseX={mouseX} mouseY={mouseY} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
