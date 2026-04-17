/**
 * CinematicWebcam — video-textured plane inside <ThreeCanvas> with a
 * punch-driven postprocessing stack. Every effect reads the zoom.
 *
 * Proper-lib grade stack, from @react-three/postprocessing:
 *   HueSaturation → BrightnessContrast → Bloom (broad)
 *   → Bloom (tight specular) → LensFlare (anamorphic)
 *   → ChromaticAberration → Vignette → ToneMapping (ACES) → Noise
 *
 * Punch intensity = (zoom − 1) / 0.6 clamped. At rest the grade is flat
 * cinematic. Under a punch, contrast deepens, bloom flares, vignette
 * closes, chromatic fringe widens, lens flare blooms. Shadows feel cut
 * because contrast + vignette scale together.
 *
 * DPR=2 + antialias kills the pixelated look from a Retina 1:1 canvas.
 */

import React, { useMemo, useRef } from "react";
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
  ChromaticAberration,
  HueSaturation,
  Noise,
  ToneMapping,
  Vignette,
} from "@react-three/postprocessing";
import {
  BlendFunction,
  KernelSize,
  ToneMappingMode,
} from "postprocessing";
import { Vector2 } from "three";

type VideoPlaneProps = {
  src: string;
  zoom: number;
  width: number;
  height: number;
  videoAspect: number;
  videoRef: React.RefObject<HTMLVideoElement | null>;
};

// "cover": one axis matches the container, the other overflows. Preserves aspect.
const coverSize = (w: number, h: number, aspect: number) => {
  const containerAspect = w / h;
  if (aspect > containerAspect) return { pw: h * aspect, ph: h };
  return { pw: w, ph: w / aspect };
};

const RenderingPlane: React.FC<
  Omit<VideoPlaneProps, "videoRef">
> = ({ src, zoom, width, height, videoAspect }) => {
  const texture = useOffthreadVideoTexture({ src });
  if (!texture) return null;
  const { pw, ph } = coverSize(width, height, videoAspect);
  return (
    <mesh scale={[zoom, zoom, 1]}>
      <planeGeometry args={[pw, ph]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
};

const PreviewPlane: React.FC<VideoPlaneProps> = ({
  zoom,
  width,
  height,
  videoAspect,
  videoRef,
}) => {
  const texture = useVideoTexture(videoRef);
  if (!texture) return null;
  const { pw, ph } = coverSize(width, height, videoAspect);
  return (
    <mesh scale={[zoom, zoom, 1]}>
      <planeGeometry args={[pw, ph]} />
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
        videoAspect={props.videoAspect}
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
  /** Native aspect of the source video (default 16:9). */
  videoAspect?: number;
};

export const CinematicWebcam: React.FC<Props> = ({
  src,
  width,
  height,
  zoom,
  videoAspect = 16 / 9,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const env = useRemotionEnvironment();
  const resolved = src.startsWith("http") ? src : staticFile(src);

  // ThreeCanvas demands integer pixels; the animated rect produces floats.
  const w = Math.max(2, Math.round(width));
  const h = Math.max(2, Math.round(height));

  // Punch intensity — 0 at rest (zoom=1.0), 1 at dramatic3 slam (zoom≈1.6).
  // PUNCH_EVENTS in scenes.ts range 1.08–1.18, dramatic3 reaches 1.6.
  const punch = Math.max(0, Math.min(1, (zoom - 1.0) / 0.6));

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
        width={w}
        height={h}
        orthographic
        camera={{ zoom: 1, position: [0, 0, 5] }}
        dpr={2}
        gl={{
          antialias: true,
          powerPreference: "high-performance",
          alpha: false,
        }}
        // The canvas is a texture, not interactive. Block pointer events so
        // R3F doesn't walk the scene graph on pointermove and hit a
        // circular ref in postprocessing's shader materials (parent/children
        // cycle), which surfaces as "Converting circular structure to JSON".
        style={{ pointerEvents: "none" }}
      >
        <VideoPlane
          src={resolved}
          zoom={zoom}
          width={w}
          height={h}
          videoAspect={videoAspect}
          videoRef={videoRef}
        />
        <GradeStack punch={punch} width={w} height={h} />
      </ThreeCanvas>
    </>
  );
};

// ── Punch-driven grade ───────────────────────────────────────────────────
// One number drives the whole pipeline. Rest = cinematic flat. Punch =
// everything intensifies in lockstep with the zoom.

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const GradeStack: React.FC<{
  punch: number;
  width: number;
  height: number;
}> = ({ punch, width, height }) => {
  // Broad bloom — overall halo around faces / highlights
  const broadBloomIntensity = lerp(0.55, 1.7, punch);
  const broadBloomThreshold = lerp(0.58, 0.46, punch);

  // Tight specular — pinprick light spots on skin / lens edges
  const specIntensity = lerp(0.4, 1.35, punch);

  // Colour
  const saturation = lerp(0.22, 0.42, punch);
  const brightness = lerp(-0.02, -0.09, punch);
  const contrast = lerp(0.2, 0.44, punch);

  // Vignette — the spotlight feel, deepens shadows on punch
  const vignetteDarkness = lerp(0.42, 0.74, punch);
  const vignetteOffset = lerp(0.32, 0.22, punch);

  // Chromatic aberration — sub-pixel fringe
  const caOffset = lerp(0.0004, 0.0024, punch);

  // Grain
  const grainOpacity = lerp(0.04, 0.07, punch);

  // width/height are passed so vignette / CA scale with the frame if needed.
  void width;
  void height;

  const caOffsetVec = useMemo(
    () => new Vector2(caOffset, caOffset),
    [caOffset],
  );

  return (
    <EffectComposer multisampling={4}>
      {/* 1. Colour lift — richer base */}
      <HueSaturation hue={0} saturation={saturation} />

      {/* 2. Contrast / shadow density */}
      <BrightnessContrast brightness={brightness} contrast={contrast} />

      {/* 3. Broad bloom — overall halo */}
      <Bloom
        luminanceThreshold={broadBloomThreshold}
        luminanceSmoothing={0.35}
        intensity={broadBloomIntensity}
        kernelSize={KernelSize.LARGE}
        mipmapBlur
      />

      {/* 4. Tight specular — only the brightest pixels, sharper kernel.
           This is where the "more light spots" reads from. */}
      <Bloom
        luminanceThreshold={0.78}
        luminanceSmoothing={0.12}
        intensity={specIntensity}
        kernelSize={KernelSize.SMALL}
        mipmapBlur
      />

      {/* 5. Chromatic aberration — sub-pixel fringe */}
      <ChromaticAberration
        offset={caOffsetVec}
        radialModulation={true}
        modulationOffset={0.35}
      />

      {/* 7. Vignette — the spotlight. Makes the face the brightest thing. */}
      <Vignette
        offset={vignetteOffset}
        darkness={vignetteDarkness}
        eskil={false}
        blendFunction={BlendFunction.NORMAL}
      />

      {/* 8. ACES filmic — Hollywood tone curve */}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />

      {/* 9. Subtle grain — screen blend, not overlay (no blocky look) */}
      <Noise
        opacity={grainOpacity}
        blendFunction={BlendFunction.SCREEN}
        premultiply={false}
      />
    </EffectComposer>
  );
};
