/**
 * HexPixelate — wrap any video source in a hex-packed grid of flat
 * unicolour dots. Each disk takes one sample from its centre and
 * prints it solid; between the dots, the same broll prints at a
 * fraction of its brightness so the silhouette of the underlying
 * frame survives the decimation. No quantisation, no palette — the
 * image is its own palette, just sparser.
 *
 * Drop in over an OffthreadVideo or any video staticFile. Cell size
 * is the hex circumradius in pixels — default 14. Optional zoom is
 * baked into the sampler so dots keep their size on screen while the
 * underlying frame zooms in.
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
  uniform float uDotRadius;
  uniform float uBgDim;

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

  // Apply cover-fit + zoom-around-centre. Pulled out since we sample the
  // texture twice — once for the dot, once for the dim background.
  vec2 sampleUv(vec2 uv) {
    vec2 cov = coverUv(uv, uResolution, uTexSize);
    return (cov - 0.5) / uZoom + 0.5;
  }

  // Two interleaved rectangular grids, one hex centre each. For any
  // point we test both candidates and keep the closer — that is the
  // Voronoi cell of a hex tessellation. Returns (centre, local) packed
  // into a vec4. Inigo Quilez's two-grid trick.
  vec4 hexCentre(vec2 p) {
    float SQRT3 = 1.7320508;
    vec2 cell = vec2(SQRT3, 3.0);
    vec2 a = mod(p + cell * 0.5, cell) - cell * 0.5;
    vec2 b = mod(p, cell) - cell * 0.5;
    vec2 gv = dot(a, a) < dot(b, b) ? a : b;
    return vec4(p - gv, gv);
  }

  void main() {
    vec2 fragPx = vUv * uResolution;
    vec2 p = fragPx / uHexSize;

    vec4 hc = hexCentre(p);
    vec2 centreP = hc.xy;
    vec2 local   = hc.zw;

    // Sample at the dot's centre — that is the dot's flat colour.
    vec2 centrePx = centreP * uHexSize;
    vec2 dotUv = sampleUv(centrePx / uResolution);
    vec3 dotCol = texture2D(uTex, dotUv).rgb;

    // Sample at the actual fragment for the dimmed background that
    // shows between the dots. Same broll, just darker — so the silhouette
    // of the underlying frame survives the decimation.
    vec2 bgUvSrc = sampleUv(vUv);
    vec3 bgCol = texture2D(uTex, bgUvSrc).rgb * uBgDim;

    // Disk mask inside the hex cell. Anti-aliased rim, in p-units —
    // small numbers since p is already scaled by hex circumradius.
    float r = length(local);
    float disk = 1.0 - smoothstep(uDotRadius - 0.04,
                                  uDotRadius + 0.04, r);

    vec3 col = mix(bgCol, dotCol, disk);
    gl_FragColor = vec4(col, 1.0);
  }
`;

interface PlaneProps {
  texture: THREE.Texture;
  width: number;
  height: number;
  cellSize: number;
  zoom: number;
  dotRadius: number;
  bgDim: number;
}

const Plane: React.FC<PlaneProps> = ({
  texture,
  width,
  height,
  cellSize,
  zoom,
  dotRadius,
  bgDim,
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
      uDotRadius: { value: dotRadius },
      uBgDim: { value: bgDim },
    }),
    [texture, width, height, texSize, cellSize, zoom, dotRadius, bgDim],
  );

  if (matRef.current) {
    matRef.current.uniforms.uTex.value = texture;
    matRef.current.uniforms.uTexSize.value = texSize;
    matRef.current.uniforms.uZoom.value = zoom;
    matRef.current.uniforms.uHexSize.value = cellSize;
    matRef.current.uniforms.uResolution.value.set(width, height);
    matRef.current.uniforms.uDotRadius.value = dotRadius;
    matRef.current.uniforms.uBgDim.value = bgDim;
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
  /** Hex circumradius in pixels. Smaller = denser dot grid. */
  cellSize?: number;
  /** Optional zoom applied to the underlying frame, around the centre. */
  zoom?: number;
  /** Disk radius inside the hex cell, in circumradius units. 0.866 is
   *  the apothem (touching neighbours). Default 0.78 — tight packing
   *  with a small breath of background showing through. */
  dotRadius?: number;
  /** Brightness of the underlying frame between dots. 0 = black,
   *  1 = full broll, default 0.32 — image survives without competing. */
  bgDim?: number;
};

export const HexPixelate: React.FC<Props> = ({
  src,
  width,
  height,
  cellSize = 14,
  zoom = 1,
  dotRadius = 0.78,
  bgDim = 0.32,
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
            dotRadius={dotRadius}
            bgDim={bgDim}
          />
        ) : (
          <PreviewSource
            videoRef={videoRef}
            width={w}
            height={h}
            cellSize={cellSize}
            zoom={zoom}
            frame={frame}
            dotRadius={dotRadius}
            bgDim={bgDim}
          />
        )}
      </ThreeCanvas>
    </>
  );
};
