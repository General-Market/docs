/**
 * Scene 02: Dark Pulse
 * Concentric glowing rings expanding from center. Brand green on void.
 * Institutional, like a radar or heartbeat.
 */
import React from "react";
import { ShaderScene } from "./ShaderScene";

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
    float t = uTime;

    // Concentric expanding rings
    float rings = 0.0;
    for (int i = 0; i < 8; i++) {
      float fi = float(i);
      float radius = mod(t * 0.15 + fi * 0.15, 1.2);
      float ring = smoothstep(0.012, 0.0, abs(d - radius)) * (1.0 - radius / 1.2);
      rings += ring;
    }

    // Breathing center glow
    float breath = 0.5 + 0.5 * sin(t * 0.8);
    float centerGlow = exp(-d * 4.0) * breath * 0.6;

    // Secondary pulse wave
    float pulse = smoothstep(0.02, 0.0, abs(d - mod(t * 0.3, 1.5))) * 0.5;

    // Brand green: #00A36C
    vec3 brandGreen = vec3(0.0, 0.639, 0.424);
    vec3 mintGreen = vec3(0.133, 1.0, 0.667);
    vec3 darkGreen = vec3(0.0, 0.2, 0.13);

    vec3 color = brandGreen * rings * 1.5;
    color += mintGreen * centerGlow;
    color += brandGreen * pulse;

    // Radial gradient background
    color += darkGreen * (1.0 - d * 0.8) * 0.15;

    // Subtle grid lines
    vec2 grid = abs(fract(p * 8.0) - 0.5);
    float gridLine = smoothstep(0.48, 0.5, max(grid.x, grid.y));
    color += vec3(0.0, 0.05, 0.03) * gridLine * (1.0 - d * 0.7);

    // Vignette
    color *= 1.0 - 0.4 * d;

    gl_FragColor = vec4(color, 1.0);
  }
`;

export const DarkPulse: React.FC = () => <ShaderScene fragmentShader={FRAGMENT} />;

export const scene02Meta = {
  id: "GMLaunch-02-DarkPulse",
  component: DarkPulse,
  width: 1920, height: 1080, fps: 30,
  durationInFrames: 240,
};
