/**
 * Scene 05: Gradient Morph
 * Organic blob shapes with brand green gradients, slowly morphing.
 * Minimal, institutional, hypnotic. Pure shader.
 */
import React, { useRef, useEffect } from "react";
import { useCurrentFrame, useVideoConfig, AbsoluteFill } from "remotion";

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
  uniform float uTime;
  uniform vec2 uResolution;

  // Simplex 2D noise
  vec3 mod289(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                       -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m; m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  // SDF for smooth blob
  float blob(vec2 p, vec2 center, float radius, float time, float seed) {
    vec2 d = p - center;
    float dist = length(d);
    // Organic deformation
    float angle = atan(d.y, d.x);
    float deform = snoise(vec2(angle * 2.0 + seed, time * 0.3)) * 0.15;
    deform += snoise(vec2(angle * 4.0 + seed * 2.0, time * 0.5)) * 0.08;
    return dist - radius - deform;
  }

  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / uResolution.y;
    vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
    float t = uTime;

    // Three morphing blobs
    float b1 = blob(p, vec2(
      sin(t * 0.12) * 0.3,
      cos(t * 0.1) * 0.2
    ), 0.35, t, 0.0);

    float b2 = blob(p, vec2(
      cos(t * 0.1 + 1.0) * 0.25 - 0.15,
      sin(t * 0.08 + 2.0) * 0.25
    ), 0.28, t, 10.0);

    float b3 = blob(p, vec2(
      sin(t * 0.09 + 3.0) * 0.2 + 0.2,
      cos(t * 0.11 + 1.5) * 0.2 - 0.1
    ), 0.22, t, 20.0);

    // Smooth union of blobs
    float d = min(min(b1, b2), b3);
    // Smooth blend
    float blend = 0.08;
    float su = -log(exp(-b1/blend) + exp(-b2/blend) + exp(-b3/blend)) * blend;

    // Color: brand green gradient based on distance
    vec3 brandGreen = vec3(0.0, 0.639, 0.424);   // #00A36C
    vec3 deepGreen = vec3(0.0, 0.541, 0.353);     // #008A5A
    vec3 darkForest = vec3(0.039, 0.18, 0.11);    // #0A2E1C
    vec3 mint = vec3(0.9, 1.0, 0.94);             // #E6F7F0

    // Inside blob
    float inside = smoothstep(0.02, -0.02, su);
    // Edge glow
    float edge = smoothstep(0.06, 0.0, abs(su)) * 0.8;
    // Outer glow
    float outer = exp(-su * 3.0) * 0.3 * step(0.0, su);

    // Noise-based color variation inside blobs
    float colorNoise = snoise(p * 3.0 + t * 0.15) * 0.5 + 0.5;
    vec3 insideColor = mix(deepGreen, brandGreen, colorNoise);
    insideColor = mix(insideColor, mint, pow(colorNoise, 4.0) * 0.3);

    vec3 color = vec3(0.0);
    color += insideColor * inside * 0.8;
    color += brandGreen * edge * 1.5;
    color += darkForest * outer;

    // Subtle background noise
    float bgNoise = snoise(p * 8.0 + t * 0.05) * 0.02;
    color += vec3(0.0, bgNoise, bgNoise * 0.7);

    // Vignette
    color *= 1.0 - 0.35 * length((uv - 0.5) * 1.6);

    // Gamma
    color = pow(max(color, 0.0), vec3(1.0 / 2.2));

    gl_FragColor = vec4(color, 1.0);
  }
`;

export const GradientMorph: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { antialias: true, alpha: false });
    if (!gl) return;
    glRef.current = gl;

    const vs = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vs, VERTEX);
    gl.compileShader(vs);

    const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fs, FRAGMENT);
    gl.compileShader(fs);

    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    programRef.current = prog;

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,0,0, 1,-1,1,0, -1,1,0,1, 1,1,1,1]), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(prog, "position");
    const uv = gl.getAttribLocation(prog, "uv");
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(uv);
    gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 16, 8);
  }, []);

  useEffect(() => {
    const gl = glRef.current;
    const prog = programRef.current;
    if (!gl || !prog) return;
    gl.viewport(0, 0, width, height);
    gl.useProgram(prog);
    gl.uniform1f(gl.getUniformLocation(prog, "uTime"), frame / fps);
    gl.uniform2f(gl.getUniformLocation(prog, "uResolution"), width, height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }, [frame, fps, width, height]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      <canvas ref={canvasRef} width={width} height={height} style={{ width: "100%", height: "100%" }} />
    </AbsoluteFill>
  );
};

export const scene05Meta = {
  id: "GMLaunch-05-GradientMorph",
  component: GradientMorph,
  width: 1920, height: 1080, fps: 30,
  durationInFrames: 240,
};
