/**
 * LofiDots — broll resolved into a square grid of soft dots on paper.
 * Reference look: faded magazine print, halftone screen, the kind of
 * thing that pretends a photograph and a printer had a tired
 * conversation about how to remember a face.
 *
 * Pipeline: cloud broll → fullscreen quad shader → per-cell averaged
 * sample → uniform circle on a paper background. No hex tricks. The
 * lofi comes from the pitch, the desaturation, and the grain.
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
// Pitch of the hex grid in screen pixels (horizontal cell width).
const CELL_PX = 11;
// Hex size as fraction of full tessellation. 1.0 = no gap, 0.85 = visible paper.
const HEX_RATIO = 0.92;
// Soft edge in pixels. Smaller = harder hex edges.
const EDGE_PX = 0.5;
// Paper between hexes. Neutral so it doesn't tint the broll's own colors.
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
// Metallic shading per hex: fake dome normal lit from upper-left.
// 0 = flat, 1 = strong specular. The reference is around 0.3.
const METALLIC = 0.32;
// Specular sharpness — bigger = tighter highlight.
const METAL_SHININESS = 22.0;

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
  uniform float uCellPx;
  uniform float uHexRatio;
  uniform float uEdgePx;
  uniform vec3  uPaper;
  uniform float uSat;
  uniform float uFade;
  uniform float uLofi;
  uniform float uGrain;
  uniform float uVignette;
  uniform float uMetal;
  uniform float uMetalShine;

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

  // Pointy-top regular hexagon, signed distance from center, R = circumradius.
  float sdHex(vec2 p, float R) {
    p = abs(p);
    float d = max(p.x, p.x * 0.5 + p.y * 0.866025);
    return d - R * 0.866025;
  }

  // Find nearest hex center for a fragment. Pointy-top staggered grid:
  // horizontal pitch = uCellPx, row pitch = sqrt(3)/2 * uCellPx. Each
  // pixel may sit closest to one of four candidate centers.
  vec2 nearestHexCenter(vec2 p) {
    float rowH = uCellPx * 0.866025;
    float halfCell = uCellPx * 0.5;
    float jStart = floor((p.y - rowH * 0.5) / rowH);

    vec2 best = vec2(0.0);
    float bestD = 1.0e9;

    for (int dj = 0; dj <= 1; dj++) {
      float j = jStart + float(dj);
      float xOff = mod(j, 2.0) * halfCell;
      float iStart = floor((p.x - xOff - halfCell) / uCellPx);
      for (int di = 0; di <= 1; di++) {
        float i = iStart + float(di);
        vec2 c = vec2(i * uCellPx + xOff + halfCell,
                      j * rowH + rowH * 0.5);
        float d = distance(p, c);
        if (d < bestD) { bestD = d; best = c; }
      }
    }
    return best;
  }

  // Lofi tone-grade: warm shift, lifted/tinted shadows, slight roll-off.
  vec3 lofiGrade(vec3 c, float strength) {
    vec3 warm   = c * vec3(1.06, 1.00, 0.86);
    vec3 lifted = mix(warm, vec3(0.92, 0.84, 0.66), 0.10);
    vec3 rolled = lifted - 0.04 * pow(lifted, vec3(1.6));
    return mix(c, rolled, strength);
  }

  void main() {
    vec2 fragPx = vUv * uResolution;

    vec2 cellCenter = nearestHexCenter(fragPx);

    vec2 sampleUv = coverUv(cellCenter / uResolution, uResolution, uTexSize);
    vec3 col = texture2D(uTex, sampleUv).rgb;
    col = desaturate(col, uSat);
    col = lofiGrade(col, uLofi);
    col = mix(col, uPaper, uFade);

    // Hex tessellation: max circumradius without overlap is uCellPx / sqrt(3).
    float Rmax = uCellPx * 0.5773503;
    float R = Rmax * uHexRatio;
    vec2 localPx = fragPx - cellCenter;
    float sd = sdHex(localPx, R);
    float hexMask = 1.0 - smoothstep(-uEdgePx, uEdgePx, sd);

    // Metallic — treat each hex as a small dome. Local pos normalised to
    // hex apothem becomes a fake surface normal; light from upper-left.
    float apothem = R * 0.866025;
    vec2 lp = clamp(localPx / apothem, vec2(-1.0), vec2(1.0));
    float r2 = min(1.0, dot(lp, lp));
    float nz = sqrt(1.0 - r2);
    vec3 N = normalize(vec3(lp.x, -lp.y, nz));
    vec3 L = normalize(vec3(0.45, -0.55, 0.7));
    float diff = clamp(dot(N, L), 0.0, 1.0);
    vec3 H  = normalize(L + vec3(0.0, 0.0, 1.0));
    float spec = pow(clamp(dot(N, H), 0.0, 1.0), uMetalShine);
    // Shade: dim opposite the light, brighten toward it, sharp specular.
    vec3 metal = col * (0.55 + 0.95 * diff) + vec3(spec * 0.6);
    col = mix(col, metal, uMetal);

    // Paper grain frozen to the surface, not animated.
    float grain = (hash(floor(fragPx / 1.4)) - 0.5) * uGrain;
    vec3 paper = uPaper + grain;

    vec3 outCol = mix(paper, col, hexMask);

    // Soft vignette to push the corners back into the paper.
    vec2 p = vUv - 0.5;
    float v = smoothstep(0.75, 0.2, length(p));
    outCol = mix(outCol, paper, (1.0 - v) * uVignette);

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
      uCellPx: { value: CELL_PX },
      uHexRatio: { value: HEX_RATIO },
      uEdgePx: { value: EDGE_PX },
      uPaper: { value: new THREE.Color(PAPER) },
      uSat: { value: SATURATION },
      uFade: { value: FADE_TO_PAPER },
      uLofi: { value: LOFI_GRADE },
      uGrain: { value: GRAIN },
      uVignette: { value: VIGNETTE },
      uMetal: { value: METALLIC },
      uMetalShine: { value: METAL_SHININESS },
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

export const LofiDots: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const env = useRemotionEnvironment();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const fadeIn = interpolate(frame, [0, 18], [0, 1], {
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
