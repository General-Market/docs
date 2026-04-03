/**
 * Scene 04: Particle Flow
 * Streaming data points with green trails across dark void.
 * Cosmic stock ticker. GPU particles via fragment shader.
 */
import React from "react";
import { ShaderScene } from "./ShaderScene";

const FRAGMENT = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec2 uResolution;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

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

    // 80 streaming particles
    for (int i = 0; i < 80; i++) {
      float fi = float(i);
      float h = hash(vec2(fi, fi * 1.3));
      float h2 = hash(vec2(fi * 2.1, fi * 0.7));

      float speed = 0.08 + h * 0.15;
      float px = mod(h * aspect + t * speed, aspect + 0.1) - 0.05;
      float py = h2 + sin(t * 0.3 + fi * 0.5) * 0.03;

      float dist = length(p - vec2(px, py));
      float glow = 0.0005 / (dist * dist + 0.0001);
      glow = min(glow, 3.0);

      vec3 particleColor = mix(
        vec3(0.0, 0.639, 0.424),
        vec3(0.133, 1.0, 0.667),
        h
      );
      if (h > 0.85) particleColor = vec3(0.9, 1.0, 0.95);

      // Trail
      float trail = 0.0;
      for (int j = 1; j <= 5; j++) {
        float fj = float(j);
        float trailX = px + fj * 0.006;
        float trailDist = length(p - vec2(trailX, py));
        trail += 0.0002 / (trailDist * trailDist + 0.0002) * (1.0 - fj * 0.18);
      }

      color += particleColor * (glow + trail * 0.3);
    }

    // Nebula depth
    float nebula = noise(p * 3.0 + vec2(t * 0.05, 0.0)) * 0.5;
    nebula += noise(p * 6.0 + vec2(t * 0.08, t * 0.02)) * 0.25;
    nebula = smoothstep(0.35, 0.7, nebula);
    color += vec3(0.0, 0.06, 0.04) * nebula;

    // Scanlines
    float scanline = sin(uv.y * uResolution.y * 0.5) * 0.015 + 0.985;
    color *= scanline;

    // Vignette
    color *= 1.0 - 0.3 * length((uv - 0.5) * 1.5);

    // Reinhard
    color = color / (1.0 + color);

    gl_FragColor = vec4(color, 1.0);
  }
`;

export const ParticleFlow: React.FC = () => <ShaderScene fragmentShader={FRAGMENT} />;

export const scene04Meta = {
  id: "GMLaunch-04-ParticleFlow",
  component: ParticleFlow,
  width: 1920, height: 1080, fps: 30,
  durationInFrames: 240,
};
