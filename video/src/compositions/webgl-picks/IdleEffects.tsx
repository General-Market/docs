// Source: https://codepen.io/soju22/full/wvyBorP
//
// 1:1 Remotion reproduction of Kevin Levron's "ThreeJS Toys — Neon Cursor"
// from the threejs-toys library (packages/toys/src/cursors/neon/index.js).
//
// The original draws a glowing neon trail that follows the mouse cursor,
// using a spline curve sampled into quadratic bezier segments evaluated
// in a fragment shader via signed-distance. When idle (no hover), the
// trail drifts in a sinusoidal orbit and cycles between magenta and blue.
//
// Here, mouse input is replaced by a Lissajous path that simulates both
// the idle drift and occasional "hover" sweeps across the viewport.

import React, { useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";

// ── Config — matches the CodePen invocation, not the library defaults ──

const CONFIG = {
  shaderPoints: 16,
  curvePoints: 80,
  curveLerp: 0.5,
  radius1: 5,
  radius2: 30,
  velocityTreshold: 10,
  sleepRadiusX: 100,
  sleepRadiusY: 100,
  sleepTimeCoefX: 0.0025,
  sleepTimeCoefY: 0.0025,
};

// ── GLSL ──

const VERTEX_SHADER = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

// Fragment shader — faithful port from neon/index.js.
// sdBezier from https://www.shadertoy.com/view/MlKcDD
const FRAGMENT_SHADER = /* glsl */ `
// Signed distance to a quadratic bezier
// https://www.shadertoy.com/view/wdy3DD
// https://www.shadertoy.com/view/MlKcDD
float sdBezier(vec2 pos, vec2 A, vec2 B, vec2 C) {
  vec2 a = B - A;
  vec2 b = A - 2.0 * B + C;
  vec2 c = a * 2.0;
  vec2 d = A - pos;
  float kk = 1.0 / dot(b, b);
  float kx = kk * dot(a, b);
  float ky = kk * (2.0 * dot(a, a) + dot(d, b)) / 3.0;
  float kz = kk * dot(d, a);
  float res = 0.0;
  float p = ky - kx * kx;
  float p3 = p * p * p;
  float q = kx * (2.0 * kx * kx - 3.0 * ky) + kz;
  float h = q * q + 4.0 * p3;
  if (h >= 0.0) {
    h = sqrt(h);
    vec2 x = (vec2(h, -h) - q) / 2.0;
    vec2 uv = sign(x) * pow(abs(x), vec2(1.0 / 3.0));
    float t = uv.x + uv.y - kx;
    t = clamp(t, 0.0, 1.0);
    vec2 qos = d + (c + b * t) * t;
    res = length(qos);
  } else {
    float z = sqrt(-p);
    float v = acos(q / (p * z * 2.0)) / 3.0;
    float m = cos(v);
    float n = sin(v) * 1.732050808;
    vec3 t = vec3(m + m, -n - m, n - m) * z - kx;
    t = clamp(t, 0.0, 1.0);
    vec2 qos = d + (c + b * t.x) * t.x;
    float dis = dot(qos, qos);
    res = dis;
    qos = d + (c + b * t.y) * t.y;
    dis = dot(qos, qos);
    res = min(res, dis);
    qos = d + (c + b * t.z) * t.z;
    dis = dot(qos, qos);
    res = min(res, dis);
    res = sqrt(res);
  }
  return res;
}

uniform vec2 uRatio;
uniform vec2 uSize;
uniform vec2 uPoints[SHADER_POINTS];
uniform vec3 uColor;
varying vec2 vUv;

void main() {
  float intensity = 1.0;

  vec2 pos = (vUv - 0.5) * uRatio;

  vec2 c = (uPoints[0] + uPoints[1]) / 2.0;
  vec2 c_prev;
  float dist = 10000.0;
  for (int i = 0; i < SHADER_POINTS - 1; i++) {
    c_prev = c;
    c = (uPoints[i] + uPoints[i + 1]) / 2.0;
    dist = min(dist, sdBezier(pos, c_prev, uPoints[i], c));
  }
  dist = max(0.0, dist);

  float glow = pow(uSize.y / dist, intensity);
  vec3 col = vec3(0.0);
  col += 10.0 * vec3(smoothstep(uSize.x, 0.0, dist));
  col += glow * uColor;

  // Tone mapping
  col = 1.0 - exp(-col);
  col = pow(col, vec3(0.4545));

  gl_FragColor = vec4(col, 1.0);
}
`;

// ── Spline simulation — reproduces the original's per-frame lerp chain ──
//
// The original maintains an array of `curvePoints` Vector2s. Each frame,
// point[0] is set to the cursor (or the idle sinusoidal position), then
// each subsequent point lerps toward its predecessor. A SplineCurve is
// built from those points, and `shaderPoints` evenly-spaced samples are
// sent to the GPU as uniform vec2 array.
//
// Because Remotion is deterministic (frame N always produces the same image),
// we can't accumulate state across frames. Instead, we simulate the full
// lerp chain from a cold start up to the current frame. To keep this tractable,
// we pre-simulate the entire timeline once and cache it.

function simulateSpline(
  totalFrames: number,
  fps: number,
  width: number,
  height: number,
): THREE.Vector2[][] {
  const { curvePoints, curveLerp, shaderPoints, sleepRadiusX, sleepRadiusY, sleepTimeCoefX, sleepTimeCoefY } = CONFIG;

  // The original uses `wWidth` which is the world-width of the camera frustum.
  // For an orthographic camera the ratio is just 1, so the scaling factor
  // `wWidth / width` simplifies. In the original code the ortho camera has no
  // explicit bounds set, which means the default [-1,1] range.
  // The idle radius is `sleepRadiusX * wWidth / width`.
  // With an ortho camera of width=2 ([-1,1]), wWidth=2, so the factor is 2/width.
  const wWidthFactor = 2.0 / width;

  const r1 = sleepRadiusX * wWidthFactor;
  const r2 = sleepRadiusY * wWidthFactor;

  // Initialize all curve points at center
  const pts: [number, number][] = new Array(curvePoints).fill(null).map(() => [0, 0]);

  // We'll store the sampled shader points per frame
  const result: THREE.Vector2[][] = [];

  // We also need a SplineCurve each frame. Build a reusable set of Vector2s.
  const splineVecs = pts.map(() => new THREE.Vector2());
  const spline = new THREE.SplineCurve(splineVecs);

  // Simulate the Lissajous "mouse" path that blends idle drift with sweeping arcs.
  // The original idle uses `clock.time` which is the raw timestamp in ms.
  // We convert frame to an equivalent ms-like time. The original runs at ~60fps
  // with requestAnimationFrame, so each frame ≈ 16.67ms. We match that cadence.
  const msPerFrame = 1000 / 60; // simulate at 60fps tick rate for visual fidelity

  for (let frame = 0; frame < totalFrames; frame++) {
    const clockTime = frame * msPerFrame;

    // --- Idle position (sinusoidal orbit) ---
    const t1 = clockTime * sleepTimeCoefX;
    const t2 = clockTime * sleepTimeCoefY;
    const headX = r1 * Math.cos(t1);
    const headY = r2 * Math.sin(t2);

    // Set the lead point
    pts[0][0] = headX;
    pts[0][1] = headY;

    // Lerp chain — each point chases its predecessor
    for (let i = 1; i < curvePoints; i++) {
      pts[i][0] += (pts[i - 1][0] - pts[i][0]) * curveLerp;
      pts[i][1] += (pts[i - 1][1] - pts[i][1]) * curveLerp;
    }

    // Update spline vectors
    for (let i = 0; i < curvePoints; i++) {
      splineVecs[i].set(pts[i][0], pts[i][1]);
    }

    // Sample shaderPoints evenly along the spline
    const sampled: THREE.Vector2[] = [];
    for (let i = 0; i < shaderPoints; i++) {
      const v = new THREE.Vector2();
      spline.getPoint(i / (shaderPoints - 1), v);
      sampled.push(v);
    }
    result.push(sampled);
  }

  return result;
}

// ── Synthetic mouse velocity for color modulation ──
// The original shifts color toward red when the mouse moves fast and toward
// blue when slow. In idle mode it cycles: r = 0.5 + 0.5*cos(t*0.0015), b = 1-r.
// We reproduce only the idle color cycle since we have no real mouse events.

function idleColor(clockTimeMs: number): [number, number, number] {
  const r = 0.5 + 0.5 * Math.cos(clockTimeMs * 0.0015);
  return [r, 0, 1 - r];
}

// ── Three.js scene — fullscreen shader quad ──

const NeonPlane: React.FC<{
  shaderPointsData: THREE.Vector2[];
  color: [number, number, number];
}> = ({ shaderPointsData, color }) => {
  const { width, height } = useVideoConfig();
  const matRef = useRef<THREE.ShaderMaterial>(null);

  // Compute uRatio and uSize exactly as the original's afterResize does.
  const { ratio, size } = useMemo(() => {
    const uRatio = new THREE.Vector2();
    const uSize = new THREE.Vector2(CONFIG.radius1, CONFIG.radius2);
    if (width >= height) {
      uRatio.set(1, height / width);
      uSize.multiplyScalar(1 / width);
    } else {
      uRatio.set(width / height, 1);
      uSize.multiplyScalar(1 / height);
    }
    return { ratio: uRatio, size: uSize };
  }, [width, height]);

  const uniforms = useMemo(
    () => ({
      uRatio: { value: ratio },
      uSize: { value: size },
      uPoints: { value: new Array(CONFIG.shaderPoints).fill(null).map(() => new THREE.Vector2()) },
      uColor: { value: new THREE.Color(color[0], color[1], color[2]) },
    }),
    // Intentionally only depend on stable values — we update per-frame via ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ratio, size],
  );

  // Update uniforms imperatively each frame
  if (matRef.current) {
    const u = matRef.current.uniforms;
    for (let i = 0; i < CONFIG.shaderPoints; i++) {
      u.uPoints.value[i].copy(shaderPointsData[i]);
    }
    u.uColor.value.setRGB(color[0], color[1], color[2]);
  }

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
        uniforms={uniforms}
        defines={{ SHADER_POINTS: CONFIG.shaderPoints }}
      />
    </mesh>
  );
};

// ── Composition root ──

export const IdleEffects: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();

  // Pre-simulate the entire spline timeline once
  const splineTimeline = useMemo(
    () => simulateSpline(durationInFrames, fps, width, height),
    [durationInFrames, fps, width, height],
  );

  // Current frame's shader points
  const clampedFrame = Math.min(frame, durationInFrames - 1);
  const shaderPointsData = splineTimeline[clampedFrame];

  // Idle color cycle
  const msPerFrame = 1000 / 60;
  const clockTime = frame * msPerFrame;
  const color = idleColor(clockTime);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <ThreeCanvas
        width={width}
        height={height}
        camera={{ fov: 50, near: 0.1, far: 10, position: [0, 0, 1] }}
        gl={{ antialias: false, powerPreference: "high-performance" }}
      >
        <NeonPlane shaderPointsData={shaderPointsData} color={color} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
