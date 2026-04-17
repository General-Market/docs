/**
 * HalftoneVideo — full-frame WebGL layer that resamples a video source into a
 * dot-matrix halftone. Luminance drives dot radius; tint pushes the palette.
 *
 * Dual-mode: Studio preview uses `useVideoTexture` against a hidden <Video>;
 * headless rendering uses `useOffthreadVideoTexture`. Each path is its own
 * child component so hook order stays stable on either side of the branch.
 */

import React, { useMemo, useRef } from "react";
import {
  ThreeCanvas,
  useOffthreadVideoTexture,
  useVideoTexture,
} from "@remotion/three";
import {
  AbsoluteFill,
  Video,
  useRemotionEnvironment,
  useVideoConfig,
} from "remotion";
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
  uniform float uDotFill;      // 0..1 — fraction of cell occupied by the dot
  uniform float uContrast;
  uniform vec3  uDotTint;      // mid-tone tint (cyan)
  uniform vec3  uBgColor;      // background between dots

  varying vec2 vUv;

  void main() {
    vec2 px = vUv * uResolution;

    vec2 cell          = floor(px / uDotSize);
    vec2 cellCenterPx  = (cell + 0.5) * uDotSize;
    vec2 cellCenterUv  = cellCenterPx / uResolution;

    vec3 sampleColor = texture2D(tVideo, cellCenterUv).rgb;
    float lum = dot(sampleColor, vec3(0.299, 0.587, 0.114));
    lum = pow(clamp(lum, 0.0, 1.0), 1.0 / uContrast);

    // Every dot is the same radius; gaps between dots reveal uBgColor.
    vec2 offset = px - cellCenterPx;
    float dist  = length(offset);
    float radius  = uDotSize * 0.5 * uDotFill;
    float edge    = 0.8;
    float dotMask = 1.0 - smoothstep(radius - edge, radius + edge, dist);

    // Luminance drives color along a three-stop ramp: deep → tint → white.
    vec3 lowColor  = mix(uBgColor, uDotTint, 0.18);
    vec3 midColor  = uDotTint;
    vec3 highColor = vec3(1.0);

    vec3 dotColor = mix(lowColor, midColor, smoothstep(0.12, 0.55, lum));
    dotColor = mix(dotColor, highColor, smoothstep(0.55, 0.95, lum));

    vec3 outColor = mix(uBgColor, dotColor, dotMask);
    gl_FragColor = vec4(outColor, 1.0);
  }
`;

type HalftoneUniforms = {
  tVideo: { value: THREE.Texture | null };
  uResolution: { value: THREE.Vector2 };
  uDotSize: { value: number };
  uDotFill: { value: number };
  uContrast: { value: number };
  uDotTint: { value: THREE.Color };
  uBgColor: { value: THREE.Color };
};

type HalftoneOptions = {
  dotSize: number;
  dotFill: number;
  contrast: number;
  dotTint: [number, number, number];
  bgColor: [number, number, number];
};

const DEFAULTS: HalftoneOptions = {
  dotSize: 10,
  dotFill: 0.85,
  contrast: 1.35,
  dotTint: [0.55, 0.85, 0.95],
  bgColor: [0.012, 0.045, 0.075],
};

const ShaderPlane: React.FC<{
  texture: THREE.Texture | null;
  width: number;
  height: number;
  opts: HalftoneOptions;
}> = ({ texture, width, height, opts }) => {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo<HalftoneUniforms>(
    () => ({
      tVideo: { value: null },
      uResolution: { value: new THREE.Vector2(width, height) },
      uDotSize: { value: opts.dotSize },
      uDotFill: { value: opts.dotFill },
      uContrast: { value: opts.contrast },
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
    u.uDotFill.value = opts.dotFill;
    u.uContrast.value = opts.contrast;
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

const StudioPlane: React.FC<{
  videoRef: React.RefObject<HTMLVideoElement | null>;
  width: number;
  height: number;
  opts: HalftoneOptions;
}> = ({ videoRef, width, height, opts }) => {
  const texture = useVideoTexture(videoRef);
  return <ShaderPlane texture={texture} width={width} height={height} opts={opts} />;
};

const RenderPlane: React.FC<{
  src: string;
  playbackRate: number;
  width: number;
  height: number;
  opts: HalftoneOptions;
}> = ({ src, playbackRate, width, height, opts }) => {
  const texture = useOffthreadVideoTexture({ src, playbackRate });
  return <ShaderPlane texture={texture} width={width} height={height} opts={opts} />;
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
  const { isRendering } = useRemotionEnvironment();
  const opts: HalftoneOptions = { ...DEFAULTS, ...overrides };
  const videoRef = useRef<HTMLVideoElement>(null);

  return (
    <AbsoluteFill>
      {/* Hidden <Video> driven by Remotion — used as texture source in Studio.
          Kept offscreen so only the shader output is visible. */}
      {!isRendering && (
        <Video
          ref={videoRef}
          src={src}
          playbackRate={playbackRate}
          muted
          volume={0}
          loop
          style={{
            position: "absolute",
            width: 2,
            height: 2,
            left: -4,
            top: -4,
            opacity: 0,
            pointerEvents: "none",
          }}
        />
      )}

      <ThreeCanvas
        width={width}
        height={height}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        style={{ background: "#020406" }}
      >
        <React.Suspense fallback={null}>
          {isRendering ? (
            <RenderPlane
              src={src}
              playbackRate={playbackRate}
              width={width}
              height={height}
              opts={opts}
            />
          ) : (
            <StudioPlane
              videoRef={videoRef}
              width={width}
              height={height}
              opts={opts}
            />
          )}
        </React.Suspense>
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
