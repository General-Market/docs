// Source: https://codepen.io/fand/full/YzoWyqJ
import React, { useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";

// ── GLSL: vertex shader — fullscreen quad ──

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// ── GLSL: fragment shader — faithful port of fand's VFX-JS text shadow effect ──
// The original reads a rasterized text texture via `src`, ray-marches from each
// pixel toward the light (mouse) position, accumulates occlusion, and composites
// a smooth glow with rainbow-spectrum shadow coloring.

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
vec3 spectrum(float x) {
  return cos((x - vec3(0, .5, 1)) * vec3(.6, 1., .5) * PI);
}

void main() {
  // Map fragment to 0..1 UV space
  vec2 uv = gl_FragCoord.xy / uResolution;

  // Text pixels render as solid white (original uses discard + DOM text underneath,
  // but we have no DOM layer — the texture IS the text)
  if (readTex(uv).r > 0.) {
    gl_FragColor = vec4(1.0);
    return;
  }

  // Aspect-corrected coordinate system centered at origin
  vec2 p = uv * 2. - 1.;
  p.x *= uResolution.x / uResolution.y;

  // Light position in the same coordinate space
  vec2 mp = uMouse / uResolution;
  mp = mp * 2. - 1.;
  mp.x *= uResolution.x / uResolution.y;

  // Ray march from pixel toward the light, accumulating text occlusion
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

  // Smooth glow falloff from light source
  float lm = length(p - mp);
  vec4 c = vec4(smoothstep(0., 1., pow(.1 / lm, .2)));

  c -= acc; // shadow
  c += vec4(spectrum(cos(acc * 3.5)), 1) * acc * 2.5; // rainbow

  c -= hash(vec3(uv.xyy)) * 0.01; // dither
  gl_FragColor = c;
}
`;

// ── Text rasterization — creates a canvas texture of "Thru." matching the original ──

function createTextTexture(width: number, height: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, width, height);

  // The original uses `font-size: 20vw; font-weight: 900` on an <h1>
  const fontSize = Math.round(width * 0.2);
  ctx.font = `900 ${fontSize}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Thru.", width / 2, height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

// ── Lissajous cursor path — natural-looking synthetic mouse movement ──

function lissajousMouse(
  t: number,
  width: number,
  height: number,
): [number, number] {
  // Two incommensurate frequencies produce a non-repeating figure-eight drift.
  // Amplitude keeps the light within the interesting zone around the text.
  const x = width * (0.5 + 0.35 * Math.sin(t * 0.7 + 0.3));
  const y = height * (0.5 + 0.25 * Math.cos(t * 1.1 + 1.7));
  return [x, y];
}

// ── Three.js scene: fullscreen shader quad ──

const LightPlane: React.FC<{
  mouseX: number;
  mouseY: number;
}> = ({ mouseX, mouseY }) => {
  const { width, height } = useVideoConfig();
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const textTexture = useMemo(() => createTextTexture(width, height), [width, height]);

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

// ── Composition root ──

export const MouseLight: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const time = frame / fps;

  const [mouseX, mouseY] = lissajousMouse(time, width, height);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
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
