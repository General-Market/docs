/**
 * HalftoneVideo — full-frame WebGL layer that resamples a video source into a
 * dot-matrix halftone. Cell size and tint are configurable; luminance drives
 * dot radius, color stays close to the source so the B-roll still reads.
 */

import React, { useMemo, useRef } from "react";
import { ThreeCanvas, useOffthreadVideoTexture } from "@remotion/three";
import { AbsoluteFill, useVideoConfig } from "remotion";
import * as THREE from "three";

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform sampler2D tVideo;
  uniform vec2  uResolution;
  uniform float uDotSize;
  uniform float uContrast;
  uniform float uRadiusBoost;
  uniform float uTintMix;
  uniform vec3  uDotTint;
  uniform vec3  uBgColor;

  varying vec2 vUv;

  void main() {
    vec2 px = vUv * uResolution;

    vec2 cell          = floor(px / uDotSize);
    vec2 cellCenterPx  = (cell + 0.5) * uDotSize;
    vec2 cellCenterUv  = cellCenterPx / uResolution;

    vec3 sampleColor = texture2D(tVideo, cellCenterUv).rgb;
    float lum = dot(sampleColor, vec3(0.299, 0.587, 0.114));
    lum = pow(clamp(lum, 0.0, 1.0), 1.0 / uContrast);

    vec2 offset = px - cellCenterPx;
    float dist  = length(offset);

    float maxR    = uDotSize * 0.5;
    float radius  = lum * maxR * uRadiusBoost;
    float edge    = 0.8;
    float dotMask = 1.0 - smoothstep(radius - edge, radius + edge, dist);

    vec3 dotColor = mix(sampleColor, uDotTint, uTintMix);
    dotColor = mix(dotColor, vec3(1.0), lum * 0.35);

    vec3 outColor = mix(uBgColor, dotColor, dotMask);
    gl_FragColor = vec4(outColor, 1.0);
  }
`;

type HalftoneUniforms = {
  tVideo: { value: THREE.Texture | null };
  uResolution: { value: THREE.Vector2 };
  uDotSize: { value: number };
  uContrast: { value: number };
  uRadiusBoost: { value: number };
  uTintMix: { value: number };
  uDotTint: { value: THREE.Color };
  uBgColor: { value: THREE.Color };
};

type HalftoneOptions = {
  dotSize: number;
  contrast: number;
  radiusBoost: number;
  tintMix: number;
  dotTint: [number, number, number];
  bgColor: [number, number, number];
};

const DEFAULTS: HalftoneOptions = {
  dotSize: 10,
  contrast: 1.35,
  radiusBoost: 1.12,
  tintMix: 0.45,
  dotTint: [0.55, 0.85, 0.95],
  bgColor: [0.012, 0.045, 0.075],
};

const HalftonePlane: React.FC<{
  src: string;
  playbackRate: number;
  width: number;
  height: number;
  opts: HalftoneOptions;
}> = ({ src, playbackRate, width, height, opts }) => {
  const texture = useOffthreadVideoTexture({ src, playbackRate });
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo<HalftoneUniforms>(
    () => ({
      tVideo: { value: null },
      uResolution: { value: new THREE.Vector2(width, height) },
      uDotSize: { value: opts.dotSize },
      uContrast: { value: opts.contrast },
      uRadiusBoost: { value: opts.radiusBoost },
      uTintMix: { value: opts.tintMix },
      uDotTint: { value: new THREE.Color(...opts.dotTint) },
      uBgColor: { value: new THREE.Color(...opts.bgColor) },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  if (matRef.current) {
    const u = matRef.current.uniforms as unknown as HalftoneUniforms;
    u.tVideo.value = texture;
    u.uResolution.value.set(width, height);
    u.uDotSize.value = opts.dotSize;
    u.uContrast.value = opts.contrast;
    u.uRadiusBoost.value = opts.radiusBoost;
    u.uTintMix.value = opts.tintMix;
    u.uDotTint.value.setRGB(...opts.dotTint);
    u.uBgColor.value.setRGB(...opts.bgColor);
  }

  if (!texture) return null;

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
        uniforms={uniforms}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
};

export type HalftoneVideoProps = {
  src: string;
  playbackRate?: number;
} & Partial<HalftoneOptions>;

export const HalftoneVideo: React.FC<HalftoneVideoProps> = ({
  src,
  playbackRate = 1,
  ...overrides
}) => {
  const { width, height } = useVideoConfig();
  const opts: HalftoneOptions = { ...DEFAULTS, ...overrides };

  return (
    <AbsoluteFill>
      <ThreeCanvas
        width={width}
        height={height}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        style={{ background: "#020406" }}
      >
        <React.Suspense fallback={null}>
          <HalftonePlane
            src={src}
            playbackRate={playbackRate}
            width={width}
            height={height}
            opts={opts}
          />
        </React.Suspense>
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
