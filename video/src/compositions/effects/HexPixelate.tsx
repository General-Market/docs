/**
 * HexPixelate — wrap any video source in a tessellation of small flat
 * hexagons. Each cell takes one sample from the centre of the video
 * and prints it across the whole hex. No texture inside, no shading,
 * no dome. The image survives only as a mosaic of its means.
 *
 * Drop in over an OffthreadVideo or any video staticFile. Cell size
 * is the hex circumradius in pixels — default 14. The optional zoom
 * is baked into the sampler, so cells stay the same size on screen
 * while the underlying frame zooms in.
 */

import React, { useEffect, useMemo, useRef } from "react";
import {
  Video,
  staticFile,
  useCurrentFrame,
  useRemotionEnvironment,
} from "remotion";
import {
  ThreeCanvas,
  useOffthreadVideoTexture,
} from "@remotion/three";
import * as THREE from "three";

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
  uniform float uHexSize;
  uniform float uZoom;
  uniform float uHexInset;
  uniform float uContrast;
  uniform float uLevels;
  uniform vec3  uLineColor;

  varying vec2 vUv;

  // Cover-fit: one axis matches the container, the other overflows.
  vec2 coverUv(vec2 uv, vec2 res, vec2 tex) {
    float rRes = res.x / res.y;
    float rTex = tex.x / tex.y;
    vec2 scale = (rTex > rRes)
      ? vec2(rRes / rTex, 1.0)
      : vec2(1.0, rTex / rRes);
    vec2 offset = (1.0 - scale) * 0.5;
    return uv * scale + offset;
  }

  // Two interleaved rectangular grids, one hex centre each. For any
  // point we test both candidates and keep the closer — that is the
  // Voronoi cell of a hex tessellation. The Inigo Quilez two-grid
  // trick. Returns (centre, local) packed into a vec4.
  vec4 hexCentre(vec2 p) {
    float SQRT3 = 1.7320508;
    vec2 cell = vec2(SQRT3, 3.0);
    vec2 a = mod(p + cell * 0.5, cell) - cell * 0.5;
    vec2 b = mod(p, cell) - cell * 0.5;
    vec2 gv = dot(a, a) < dot(b, b) ? a : b;
    return vec4(p - gv, gv);
  }

  // Signed distance to a pointy-top hexagon of circumradius 1, centred
  // at the origin. Negative inside, zero on edge, positive outside.
  float hexDist(vec2 p) {
    float APOTHEM = 0.8660254;
    vec2 q = abs(p);
    return max(q.x - APOTHEM, q.x * 0.5 + q.y * APOTHEM - APOTHEM);
  }

  // Posterise — snap each channel to N evenly spaced levels, edges
  // included. Fewer levels, harder cliffs, fewer hesitations.
  vec3 posterise(vec3 c, float n) {
    return floor(c * (n - 1.0) + 0.5) / (n - 1.0);
  }

  // Contrast about mid grey. k > 1 = more abrupt, k < 1 = washed out.
  vec3 contrast(vec3 c, float k) {
    return clamp((c - 0.5) * k + 0.5, 0.0, 1.0);
  }

  void main() {
    vec2 fragPx = vUv * uResolution;
    vec2 p = fragPx / uHexSize;

    vec4 hc = hexCentre(p);
    vec2 centreP = hc.xy;
    vec2 local   = hc.zw;
    vec2 centrePx = centreP * uHexSize;
    vec2 centreUv = centrePx / uResolution;

    // Cover-fit then scale around centre to bake the zoom into sampling.
    vec2 texUv = coverUv(centreUv, uResolution, uTexSize);
    texUv = (texUv - 0.5) / uZoom + 0.5;

    vec3 col = texture2D(uTex, texUv).rgb;

    // Crank the contrast, then quantise to a small number of levels.
    // The image stops being a gradient and becomes a small set of facts.
    col = contrast(col, uContrast);
    col = posterise(col, uLevels);

    // Black line between hexes. The SDF is in circumradius units, so
    // the inset and edge widths are too — small numbers, nice clean
    // tessellation lines.
    float d = hexDist(local);
    float fill = 1.0 - smoothstep(-uHexInset - 0.012,
                                  -uHexInset + 0.012, d);
    col = mix(uLineColor, col, fill);

    gl_FragColor = vec4(col, 1.0);
  }
`;

interface PlaneProps {
  texture: THREE.Texture;
  width: number;
  height: number;
  cellSize: number;
  zoom: number;
  inset: number;
  contrast: number;
  levels: number;
  lineColor: [number, number, number];
}

const Plane: React.FC<PlaneProps> = ({
  texture,
  width,
  height,
  cellSize,
  zoom,
  inset,
  contrast,
  levels,
  lineColor,
}) => {
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
      uHexSize: { value: cellSize },
      uZoom: { value: zoom },
      uHexInset: { value: inset },
      uContrast: { value: contrast },
      uLevels: { value: Math.max(2, Math.floor(levels)) },
      uLineColor: {
        value: new THREE.Vector3(lineColor[0], lineColor[1], lineColor[2]),
      },
    }),
    [texture, width, height, texSize, cellSize, zoom, inset, contrast, levels, lineColor],
  );

  if (matRef.current) {
    matRef.current.uniforms.uTex.value = texture;
    matRef.current.uniforms.uTexSize.value = texSize;
    matRef.current.uniforms.uZoom.value = zoom;
    matRef.current.uniforms.uHexSize.value = cellSize;
    matRef.current.uniforms.uResolution.value.set(width, height);
    matRef.current.uniforms.uHexInset.value = inset;
    matRef.current.uniforms.uContrast.value = contrast;
    matRef.current.uniforms.uLevels.value = Math.max(2, Math.floor(levels));
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

const RenderSource: React.FC<Omit<PlaneProps, "texture"> & { src: string }> = ({
  src,
  ...rest
}) => {
  const texture = useOffthreadVideoTexture({ src });
  if (!texture) return null;
  return <Plane texture={texture} {...rest} />;
};

const PREVIEW_CANVAS_W = 1280;
const PREVIEW_CANVAS_H = 720;

const PreviewSource: React.FC<
  Omit<PlaneProps, "texture"> & {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    frame: number;
  }
> = ({ videoRef, frame, ...rest }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textureRef = useRef<THREE.CanvasTexture | null>(null);

  if (!canvasRef.current) {
    const c = document.createElement("canvas");
    c.width = PREVIEW_CANVAS_W;
    c.height = PREVIEW_CANVAS_H;
    canvasRef.current = c;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    textureRef.current = tex;
  }

  const ctx = canvasRef.current.getContext("2d");
  const video = videoRef.current;
  if (ctx && video && video.readyState >= 2 && video.videoWidth > 0) {
    ctx.drawImage(
      video,
      0,
      0,
      video.videoWidth,
      video.videoHeight,
      0,
      0,
      PREVIEW_CANVAS_W,
      PREVIEW_CANVAS_H,
    );
    if (textureRef.current) textureRef.current.needsUpdate = true;
  }
  void frame;

  useEffect(() => {
    const tex = textureRef.current;
    return () => {
      tex?.dispose();
    };
  }, []);

  if (!textureRef.current) return null;
  return <Plane texture={textureRef.current} {...rest} />;
};

type Props = {
  /** Video source — either a staticFile path or a full URL. */
  src: string;
  /** Container width, in pixels. Floats are rounded. */
  width: number;
  /** Container height, in pixels. Floats are rounded. */
  height: number;
  /** Hex circumradius in pixels. Smaller = denser tessellation. */
  cellSize?: number;
  /** Optional zoom applied to the underlying frame, around the centre. */
  zoom?: number;
  /** Width of the dark line between hexes, in circumradius units.
   *  0 = perfect tessellation, no separators. */
  inset?: number;
  /** Contrast about mid grey before quantisation. >1 sharpens. */
  contrast?: number;
  /** Number of evenly spaced levels per RGB channel after quantisation.
   *  Lower = more abrupt cliffs. 5 is the default — 125 colours total. */
  levels?: number;
  /** Colour of the line between hexes. Defaults to black. */
  lineColor?: [number, number, number];
};

export const HexPixelate: React.FC<Props> = ({
  src,
  width,
  height,
  cellSize = 14,
  zoom = 1,
  inset = 0.06,
  contrast = 1.45,
  levels = 5,
  lineColor = [0, 0, 0],
}) => {
  const env = useRemotionEnvironment();
  const frame = useCurrentFrame();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const resolved = src.startsWith("http") ? src : staticFile(src);

  const w = Math.max(2, Math.round(width));
  const h = Math.max(2, Math.round(height));

  return (
    <>
      {!env.isRendering && (
        <Video
          ref={videoRef}
          src={resolved}
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
      <ThreeCanvas
        width={w}
        height={h}
        gl={{
          antialias: false,
          powerPreference: "high-performance",
          alpha: false,
        }}
        style={{ pointerEvents: "none" }}
      >
        {env.isRendering ? (
          <RenderSource
            src={resolved}
            width={w}
            height={h}
            cellSize={cellSize}
            zoom={zoom}
            inset={inset}
            contrast={contrast}
            levels={levels}
            lineColor={lineColor}
          />
        ) : (
          <PreviewSource
            videoRef={videoRef}
            width={w}
            height={h}
            cellSize={cellSize}
            zoom={zoom}
            frame={frame}
            inset={inset}
            contrast={contrast}
            levels={levels}
            lineColor={lineColor}
          />
        )}
      </ThreeCanvas>
    </>
  );
};
