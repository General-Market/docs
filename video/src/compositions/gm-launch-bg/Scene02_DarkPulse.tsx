/**
 * Scene 02: Dark Pulse
 * Concentric glowing rings expanding from center. Brand green on void.
 * Institutional, like a radar or heartbeat. Pure shader — no 3D geometry.
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

  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / uResolution.y;
    vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
    float d = length(p);

    // Concentric expanding rings
    float rings = 0.0;
    for (int i = 0; i < 6; i++) {
      float fi = float(i);
      float radius = mod(uTime * 0.15 + fi * 0.18, 1.2);
      float ring = smoothstep(0.015, 0.0, abs(d - radius)) * (1.0 - radius / 1.2);
      rings += ring;
    }

    // Breathing center glow
    float breath = 0.5 + 0.5 * sin(uTime * 0.8);
    float centerGlow = exp(-d * 4.0) * breath * 0.6;

    // Brand green: #00A36C = (0.0, 0.639, 0.424)
    vec3 brandGreen = vec3(0.0, 0.639, 0.424);
    vec3 mintGreen = vec3(0.133, 1.0, 0.667);

    vec3 color = brandGreen * rings * 1.5 + mintGreen * centerGlow;

    // Subtle radial gradient in background
    color += vec3(0.0, 0.04, 0.03) * (1.0 - d * 0.8);

    // Vignette
    color *= 1.0 - 0.4 * d;

    gl_FragColor = vec4(color, 1.0);
  }
`;

export const DarkPulse: React.FC = () => {
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

export const scene02Meta = {
  id: "GMLaunch-02-DarkPulse",
  component: DarkPulse,
  width: 1920, height: 1080, fps: 30,
  durationInFrames: 240,
};
