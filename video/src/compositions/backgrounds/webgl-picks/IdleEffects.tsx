// Source: https://codepen.io/soju22/full/wvyBorP
//
// Remotion reproduction of Kevin Levron's "Neon Cursor" from threejs-toys
// (packages/toys/src/cursors/neon/index.js). A glowing bezier trail drifts
// in a sinusoidal orbit, cycling between magenta and blue.

import React, { useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";

// Config — exact library defaults (the CodePen passes no overrides)
const CONFIG = {
  shaderPoints: 8,
  curvePoints: 80,
  curveLerp: 0.75,
  radius1: 3,
  radius2: 5,
  velocityTreshold: 10,
  sleepRadiusX: 150,
  sleepRadiusY: 150,
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

// Spline simulation — deterministic replay of the original's per-frame lerp chain.
// Pre-simulates the full timeline so frame N is always reproducible.

function simulateSpline(
  totalFrames: number,
  _fps: number,
  width: number,
  _height: number,
): THREE.Vector2[][] {
  const { curvePoints, curveLerp, shaderPoints, sleepRadiusX, sleepRadiusY, sleepTimeCoefX, sleepTimeCoefY } = CONFIG;

  // OrthographicCamera default bounds are [-1,1], so wWidth = top - bottom = 2.
  // The original idle radius: sleepRadiusX * wWidth / width
  const wWidth = 2.0;
  const r1 = sleepRadiusX * wWidth / width;
  const r2 = sleepRadiusY * wWidth / width;

  const splineVecs = new Array(curvePoints).fill(null).map(() => new THREE.Vector2());
  const spline = new THREE.SplineCurve(splineVecs);

  const result: THREE.Vector2[][] = [];

  // The original runs at ~60fps via requestAnimationFrame.
  // clock.time is the raw performance.now() timestamp, but since it starts
  // from 0 effectively (first frame), we simulate with 60fps ticks.
  const msPerFrame = 1000 / 60;

  for (let frame = 0; frame < totalFrames; frame++) {
    const clockTime = frame * msPerFrame;

    // Original beforeRender order:
    // 1) Lerp chain — each point chases its predecessor
    for (let i = 1; i < curvePoints; i++) {
      splineVecs[i].lerp(splineVecs[i - 1], curveLerp);
    }

    // 2) Sample shaderPoints evenly along the spline
    const sampled: THREE.Vector2[] = [];
    for (let i = 0; i < shaderPoints; i++) {
      const v = new THREE.Vector2();
      spline.getPoint(i / (shaderPoints - 1), v);
      sampled.push(v);
    }
    result.push(sampled);

    // 3) Set head point for NEXT frame (matches original's post-sample update)
    const t1 = clockTime * sleepTimeCoefX;
    const t2 = clockTime * sleepTimeCoefY;
    splineVecs[0].set(r1 * Math.cos(t1), r2 * Math.sin(t2));
  }

  return result;
}

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
