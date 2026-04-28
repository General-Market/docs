/**
 * RectPixelate — wrap any video source in a grid of small unicolour
 * rectangles. Each cell takes one sample from the centre of the video
 * and prints it flat. No texture inside the cell, no shading at the
 * edge, no gradient. The image survives only as a mosaic of its means.
 *
 * Drop in over an OffthreadVideo or any video staticFile. Cell size
 * defaults to 12px; the source is cover-fit and the optional zoom is
 * applied inside the sampler so cells stay the same size on screen
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
  uniform vec2  uCellSize;
  uniform float uZoom;

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

  void main() {
    vec2 fragPx = vUv * uResolution;

    // Snap to cell centre. The whole rectangle inherits one sample.
    vec2 cellId = floor(fragPx / uCellSize);
    vec2 centrePx = (cellId + 0.5) * uCellSize;
    vec2 centreUv = centrePx / uResolution;

    // Cover-fit then scale around centre to bake the zoom into sampling.
    vec2 texUv = coverUv(centreUv, uResolution, uTexSize);
    texUv = (texUv - 0.5) / uZoom + 0.5;

    vec3 col = texture2D(uTex, texUv).rgb;
    gl_FragColor = vec4(col, 1.0);
  }
`;

interface PlaneProps {
  texture: THREE.Texture;
  width: number;
  height: number;
  cellSize: number;
  zoom: number;
}

const Plane: React.FC<PlaneProps> = ({
  texture,
  width,
  height,
  cellSize,
  zoom,
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
      uCellSize: { value: new THREE.Vector2(cellSize, cellSize) },
      uZoom: { value: zoom },
    }),
    [texture, width, height, texSize, cellSize, zoom],
  );

  if (matRef.current) {
    matRef.current.uniforms.uTex.value = texture;
    matRef.current.uniforms.uTexSize.value = texSize;
    matRef.current.uniforms.uZoom.value = zoom;
    matRef.current.uniforms.uCellSize.value.set(cellSize, cellSize);
    matRef.current.uniforms.uResolution.value.set(width, height);
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
  /** Cell side length in pixels. Smaller = denser mosaic. */
  cellSize?: number;
  /** Optional zoom applied to the underlying frame, around the centre. */
  zoom?: number;
};

export const RectPixelate: React.FC<Props> = ({
  src,
  width,
  height,
  cellSize = 12,
  zoom = 1,
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
          />
        ) : (
          <PreviewSource
            videoRef={videoRef}
            width={w}
            height={h}
            cellSize={cellSize}
            zoom={zoom}
            frame={frame}
          />
        )}
      </ThreeCanvas>
    </>
  );
};
