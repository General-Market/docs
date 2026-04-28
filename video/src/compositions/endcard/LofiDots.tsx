/**
 * LofiDots — graded broll dressed with paper grain, vignette, and the
 * red-bridge chroma isolation pass. The hex tessellation and metallic
 * dome shading have been retired; this is now a direct broll backdrop
 * with the lofi grade and selective colour kept intact.
 */

import React, { useMemo, useRef } from "react";
import {
  AbsoluteFill,
  Easing,
  Video,
  interpolate,
  staticFile,
  useCurrentFrame,
  useRemotionEnvironment,
  useVideoConfig,
} from "remotion";
import {
  ThreeCanvas,
  useOffthreadVideoTexture,
  useVideoTexture,
} from "@remotion/three";
import * as THREE from "three";

// ── Knobs ─────────────────────────────────────────────────────────────
// Paper tone behind the broll (used as fallback ground + grain base).
const PAPER = "#ece7da";
// 1 = full broll color, 0 = grayscale. Original colorimetry.
const SATURATION = 1.0;
// Lift toward paper. 0 = print as-is.
const FADE_TO_PAPER = 0.0;
// Warm shift / shadow lift. 0 disables — keeps the broll's grade.
const LOFI_GRADE = 0.0;
// Paper grain strength. 0 disables.
const GRAIN = 0.04;
// Subtle vignette at the corners. 0 disables.
const VIGNETTE = 0.18;
// Chroma isolation: keep red-dominant pixels colored, grey the rest.
// 1 = full isolation, 0 = bypass. Lower = lets more of the broll bleed.
const CHROMA_ISOLATE = 0.0;
// "Warmness" threshold a pixel (or its neighborhood) needs to count as
// bridge. Warmness = (R − lum) − ½·((G − lum) + (B − lum)) — a
// luminance-deviation projection onto the red axis. A cloud-covered red
// pixel keeps a small positive value here that the old r−max(g,b) test
// missed. Lower = more eager (catches hazy bridge); higher = stricter.
const RED_THRESHOLD = 0.04;
// Soft edge of the threshold — half this on either side.
const RED_FEATHER = 0.04;
// Spatial dilation in source pixels. The shader takes the max warmness
// over a 9-tap neighborhood at this radius, so cloud-covered or hazy
// bridge pixels inherit detection from clearer neighbors. Without it,
// thin clouds shred the bridge into red fragments separated by grey.
// Larger = bridges wider gaps but smears the colour into surroundings.
const DILATE_RADIUS = 6.0;
// Output red tint for the bridge — lerped with the original red value
// so the bridge keeps some of its texture rather than going flat poster-red.
const BRIDGE_RED: [number, number, number] = [0.86, 0.16, 0.18];
// 0 = keep original red color, 1 = force pure BRIDGE_RED. Mid keeps texture.
const BRIDGE_TINT = 0.55;

// YouTube extract — the actual cloud broll.
export const VIDEO_SRC =
  "broll/youtube-MLm07I49RiE/broll_1-55-39_to_2-00-50.mp4";

// ── Shaders ───────────────────────────────────────────────────────────

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  precision highp float;

  uniform sampler2D uTex;
  uniform vec2  uResolution;
  uniform vec2  uTexSize;
  uniform vec3  uPaper;
  uniform float uSat;
  uniform float uFade;
  uniform float uLofi;
  uniform float uGrain;
  uniform float uVignette;
  uniform float uChroma;
  uniform float uRedThreshold;
  uniform float uRedFeather;
  uniform vec3  uBridgeRed;
  uniform float uBridgeTint;
  uniform float uDilateRadius;

  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  vec3 desaturate(vec3 c, float s) {
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    return mix(vec3(l), c, s);
  }

  // Sample as if the texture were "object-fit: cover".
  vec2 coverUv(vec2 uv, vec2 res, vec2 tex) {
    float rRes = res.x / res.y;
    float rTex = tex.x / tex.y;
    vec2 scale = (rTex > rRes)
      ? vec2(rRes / rTex, 1.0)
      : vec2(1.0, rTex / rRes);
    vec2 offset = (1.0 - scale) * 0.5;
    return uv * scale + offset;
  }

  // Lofi tone-grade: warm shift, lifted/tinted shadows, slight roll-off.
  vec3 lofiGrade(vec3 c, float strength) {
    vec3 warm   = c * vec3(1.06, 1.00, 0.86);
    vec3 lifted = mix(warm, vec3(0.92, 0.84, 0.66), 0.10);
    vec3 rolled = lifted - 0.04 * pow(lifted, vec3(1.6));
    return mix(c, rolled, strength);
  }

  // Warmness — projection onto the red axis in deviation-from-luminance
  // space. Returns >0 for warm pixels, =0 for neutral grey, <0 for cool.
  // Robust to desaturation: a cloud-covered red still scores positive.
  float warmness(vec3 c) {
    float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
    vec3 dev = c - vec3(lum);
    return dev.r - 0.5 * (dev.g + dev.b);
  }

  // Chroma isolation — keep warm pixels coloured, grey the rest. The
  // warmness signal (precomputed in main with a spatial dilation pass)
  // does the gating; no separate chroma-weight rejection because grey
  // pixels already score zero.
  vec3 chromaIsolate(vec3 c, float w, float strength) {
    float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
    vec3 grey = vec3(lum);

    float t0 = uRedThreshold - uRedFeather * 0.5;
    float t1 = uRedThreshold + uRedFeather * 0.5;
    float mask = smoothstep(t0, t1, w);

    vec3 redKept = mix(c, uBridgeRed, uBridgeTint);
    vec3 isolated = mix(grey, redKept, mask);

    return mix(c, isolated, strength);
  }

  void main() {
    vec2 fragPx = vUv * uResolution;

    // Direct broll sample — no per-cell averaging, no hex tessellation.
    vec2 sampleUv = coverUv(vUv, uResolution, uTexSize);
    vec3 col = texture2D(uTex, sampleUv).rgb;

    // Spatial dilation — max warmness over a 9-tap neighborhood at
    // uDilateRadius pixels. Cloud-covered or hazy bridge pixels inherit
    // detection from clearer neighbors so the bridge stays continuous
    // across weather edges instead of dropping out.
    vec2 stp = vec2(uDilateRadius) / uResolution;
    float w0 = warmness(col);
    float w1 = warmness(texture2D(uTex, sampleUv + vec2(stp.x, 0.0)).rgb);
    float w2 = warmness(texture2D(uTex, sampleUv - vec2(stp.x, 0.0)).rgb);
    float w3 = warmness(texture2D(uTex, sampleUv + vec2(0.0, stp.y)).rgb);
    float w4 = warmness(texture2D(uTex, sampleUv - vec2(0.0, stp.y)).rgb);
    float w5 = warmness(texture2D(uTex, sampleUv + stp).rgb);
    float w6 = warmness(texture2D(uTex, sampleUv - stp).rgb);
    float w7 = warmness(texture2D(uTex, sampleUv + vec2(stp.x, -stp.y)).rgb);
    float w8 = warmness(texture2D(uTex, sampleUv + vec2(-stp.x, stp.y)).rgb);
    float maxW = max(
      max(max(w0, w1), max(w2, w3)),
      max(max(w4, w5), max(max(w6, w7), w8))
    );

    col = chromaIsolate(col, maxW, uChroma);
    col = desaturate(col, uSat);
    col = lofiGrade(col, uLofi);
    col = mix(col, uPaper, uFade);

    // Paper grain — applied to the broll itself and to the vignette
    // fallback so the texture stays continuous across the falloff.
    float grain = (hash(floor(fragPx / 1.4)) - 0.5) * uGrain;
    col += vec3(grain);

    // Soft vignette pushes the corners back toward the paper tone.
    vec3 paper = uPaper + vec3(grain);
    vec2 p = vUv - 0.5;
    float v = smoothstep(0.75, 0.2, length(p));
    vec3 outCol = mix(col, paper, (1.0 - v) * uVignette);

    gl_FragColor = vec4(outCol, 1.0);
  }
`;

// ── Three scene — fullscreen quad ─────────────────────────────────────

interface DotPlaneProps {
  texture: THREE.Texture;
  width: number;
  height: number;
}

const DotPlane: React.FC<DotPlaneProps> = ({ texture, width, height }) => {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const texSize = useMemo(() => {
    const img = texture.image as
      | HTMLVideoElement
      | HTMLImageElement
      | { width?: number; height?: number }
      | undefined;
    const w =
      (img as HTMLVideoElement | undefined)?.videoWidth ??
      (img as HTMLImageElement | undefined)?.width ??
      width;
    const h =
      (img as HTMLVideoElement | undefined)?.videoHeight ??
      (img as HTMLImageElement | undefined)?.height ??
      height;
    return new THREE.Vector2(w || width, h || height);
  }, [texture.image, width, height]);

  const uniforms = useMemo(
    () => ({
      uTex: { value: texture },
      uResolution: { value: new THREE.Vector2(width, height) },
      uTexSize: { value: texSize },
      uPaper: { value: new THREE.Color(PAPER) },
      uSat: { value: SATURATION },
      uFade: { value: FADE_TO_PAPER },
      uLofi: { value: LOFI_GRADE },
      uGrain: { value: GRAIN },
      uVignette: { value: VIGNETTE },
      uChroma: { value: CHROMA_ISOLATE },
      uRedThreshold: { value: RED_THRESHOLD },
      uRedFeather: { value: RED_FEATHER },
      uBridgeRed: {
        value: new THREE.Vector3(
          BRIDGE_RED[0],
          BRIDGE_RED[1],
          BRIDGE_RED[2],
        ),
      },
      uBridgeTint: { value: BRIDGE_TINT },
      uDilateRadius: { value: DILATE_RADIUS },
    }),
    [texture, width, height, texSize],
  );

  if (matRef.current) {
    matRef.current.uniforms.uTex.value = texture;
    matRef.current.uniforms.uTexSize.value = texSize;
  }

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={VERTEX}
        fragmentShader={FRAGMENT}
        uniforms={uniforms}
        depthTest={false}
        depthWrite={false}
        transparent={false}
      />
    </mesh>
  );
};

// ── Source switch — preview uses <Video>, render uses offthread ───────

const RenderSource: React.FC<{
  src: string;
  width: number;
  height: number;
}> = ({ src, width, height }) => {
  const texture = useOffthreadVideoTexture({ src });
  if (!texture) return null;
  return <DotPlane texture={texture} width={width} height={height} />;
};

const PreviewSource: React.FC<{
  videoRef: React.RefObject<HTMLVideoElement | null>;
  width: number;
  height: number;
}> = ({ videoRef, width, height }) => {
  const texture = useVideoTexture(videoRef);
  if (!texture) return null;
  return <DotPlane texture={texture} width={width} height={height} />;
};

// ── Main composition ──────────────────────────────────────────────────

export const LofiDots: React.FC<{
  skipFadeIn?: boolean;
}> = ({ skipFadeIn = false }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const env = useRemotionEnvironment();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const fadeIn = skipFadeIn
    ? 1
    : interpolate(frame, [0, 18], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.bezier(0.16, 1, 0.3, 1),
      });

  return (
    <AbsoluteFill style={{ background: PAPER }}>
      {!env.isRendering && (
        <Video
          ref={videoRef}
          src={staticFile(VIDEO_SRC)}
          style={{
            position: "absolute",
            opacity: 0,
            pointerEvents: "none",
            width: 1,
            height: 1,
          }}
          muted
        />
      )}

      <AbsoluteFill style={{ opacity: fadeIn }}>
        <ThreeCanvas
          width={width}
          height={height}
          gl={{
            antialias: false,
            powerPreference: "high-performance",
            alpha: false,
          }}
        >
          {env.isRendering ? (
            <RenderSource
              src={staticFile(VIDEO_SRC)}
              width={width}
              height={height}
            />
          ) : (
            <PreviewSource
              videoRef={videoRef}
              width={width}
              height={height}
            />
          )}
        </ThreeCanvas>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
