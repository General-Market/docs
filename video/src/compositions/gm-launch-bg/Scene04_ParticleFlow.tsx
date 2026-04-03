/**
 * Scene 04: Particle Flow
 * Thousands of tiny particles streaming like financial data.
 * Brand green trails across dark void. Cosmic stock ticker.
 * Pure shader — GPU particles via fragment shader.
 */
import React, { useMemo, useRef, useEffect } from "react";
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

  // Hash for pseudo-random
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  // Smooth noise
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / uResolution.y;
    vec2 p = uv * vec2(aspect, 1.0);
    float t = uTime;

    vec3 color = vec3(0.0);

    // Layer 1: Fast-moving small particles (data points)
    for (int i = 0; i < 80; i++) {
      float fi = float(i);
      float h = hash(vec2(fi, fi * 1.3));
      float h2 = hash(vec2(fi * 2.1, fi * 0.7));

      // Particle position — flows right to left with varying speed
      float speed = 0.08 + h * 0.15;
      float px = mod(h * aspect + t * speed, aspect + 0.1) - 0.05;
      float py = h2 + sin(t * 0.3 + fi * 0.5) * 0.03;

      float dist = length(p - vec2(px, py));

      // Particle glow — tiny bright dot with soft falloff
      float glow = 0.0005 / (dist * dist + 0.0001);
      glow = min(glow, 3.0);

      // Brand green with brightness variation
      vec3 particleColor = mix(
        vec3(0.0, 0.639, 0.424),  // #00A36C
        vec3(0.133, 1.0, 0.667),  // bright mint
        h
      );

      // Some particles are white (highlights)
      if (h > 0.85) particleColor = vec3(0.9, 1.0, 0.95);

      // Trail — stretched glow behind the particle
      float trail = 0.0;
      for (int j = 1; j <= 4; j++) {
        float fj = float(j);
        float trailX = px + fj * 0.008;
        float trailDist = length(p - vec2(trailX, py));
        trail += 0.0002 / (trailDist * trailDist + 0.0002) * (1.0 - fj * 0.2);
      }

      color += particleColor * (glow + trail * 0.3);
    }

    // Layer 2: Slow-moving large nebula blobs (depth)
    float nebula = 0.0;
    nebula += noise(p * 3.0 + vec2(t * 0.05, 0.0)) * 0.5;
    nebula += noise(p * 6.0 + vec2(t * 0.08, t * 0.02)) * 0.25;
    nebula = smoothstep(0.35, 0.7, nebula);
    color += vec3(0.0, 0.08, 0.05) * nebula;

    // Layer 3: Horizontal scan lines (subtle)
    float scanline = sin(uv.y * uResolution.y * 0.5) * 0.02 + 0.98;
    color *= scanline;

    // Vignette
    float vig = 1.0 - 0.3 * length((uv - 0.5) * 1.5);
    color *= vig;

    // Tone mapping (simple Reinhard)
    color = color / (1.0 + color);

    gl_FragColor = vec4(color, 1.0);
  }
`;

export const ParticleFlow: React.FC = () => {
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

export const scene04Meta = {
  id: "GMLaunch-04-ParticleFlow",
  component: ParticleFlow,
  width: 1920, height: 1080, fps: 30,
  durationInFrames: 240,
};
