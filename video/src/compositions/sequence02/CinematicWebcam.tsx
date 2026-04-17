/**
 * CinematicWebcam — video-textured plane inside <ThreeCanvas> with a
 * postprocessing stack. Color is preserved; no vignette.
 *
 * Stack: Bloom → HueSaturation → BrightnessContrast → ToneMapping (ACES) → Noise.
 *
 * Zoom is applied by scaling the textured plane — same PunchZoom contract as
 * the old OffthreadVideo path. Container keeps border-radius + overflow so the
 * WebGL canvas inherits the rounded rect clip.
 */

import React, { useRef } from "react";
import {
  Video,
  staticFile,
  useRemotionEnvironment,
} from "remotion";
import {
  ThreeCanvas,
  useOffthreadVideoTexture,
  useVideoTexture,
} from "@remotion/three";
import {
  EffectComposer,
  Bloom,
  BrightnessContrast,
  HueSaturation,
  Noise,
  ToneMapping,
} from "@react-three/postprocessing";
import { BlendFunction, ToneMappingMode } from "postprocessing";

type VideoPlaneProps = {
  src: string;
  zoom: number;
  width: number;
  height: number;
  videoRef: React.RefObject<HTMLVideoElement | null>;
};

const RenderingPlane: React.FC<
  Omit<VideoPlaneProps, "videoRef">
> = ({ src, zoom, width, height }) => {
  const texture = useOffthreadVideoTexture({ src });
  if (!texture) return null;
  return (
    <mesh scale={[zoom, zoom, 1]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
};

const PreviewPlane: React.FC<VideoPlaneProps> = ({
  zoom,
  width,
  height,
  videoRef,
}) => {
  const texture = useVideoTexture(videoRef);
  if (!texture) return null;
  return (
    <mesh scale={[zoom, zoom, 1]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
};

const VideoPlane: React.FC<VideoPlaneProps> = (props) => {
  const env = useRemotionEnvironment();
  if (env.isRendering) {
    return (
      <RenderingPlane
        src={props.src}
        zoom={props.zoom}
        width={props.width}
        height={props.height}
      />
    );
  }
  return <PreviewPlane {...props} />;
};

type Props = {
  src: string;
  width: number;
  height: number;
  zoom: number;
};

export const CinematicWebcam: React.FC<Props> = ({
  src,
  width,
  height,
  zoom,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const env = useRemotionEnvironment();
  const resolved = src.startsWith("http") ? src : staticFile(src);

  return (
    <>
      {/* Hidden video feeds the texture during Studio preview. */}
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
        width={width}
        height={height}
        orthographic
        camera={{ zoom: 1, position: [0, 0, 5] }}
      >
        <VideoPlane
          src={resolved}
          zoom={zoom}
          width={width}
          height={height}
          videoRef={videoRef}
        />
        <EffectComposer>
          {/* Selective bloom on highlights — cinematic shimmer, not a haze */}
          <Bloom
            luminanceThreshold={0.6}
            luminanceSmoothing={0.35}
            intensity={0.55}
            mipmapBlur
          />
          {/* Saturation lift — color gets richer, not cartoonish */}
          <HueSaturation hue={0} saturation={0.22} />
          {/* Gentle S-curve — shadow density without crushing */}
          <BrightnessContrast brightness={-0.02} contrast={0.18} />
          {/* ACES filmic — the Hollywood tone curve */}
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          {/* Film grain — subtle, multiplicative */}
          <Noise
            opacity={0.06}
            blendFunction={BlendFunction.OVERLAY}
            premultiply
          />
        </EffectComposer>
      </ThreeCanvas>
    </>
  );
};
