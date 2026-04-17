/**
 * CinematicWebcam — video-textured plane inside <ThreeCanvas>, lit by
 * additive emissive sprites that Bloom flares into real light spots.
 *
 * The grade adds light; it does not crush shadow. Four soft radial
 * additive glows live in front of the video plane — a warm key, a cool
 * rim, a warm fill, a cool accent. Each breathes. They feed Bloom, so
 * what you see on screen are flared highlights, not hard blobs.
 *
 * Pipeline:
 *   video plane → light sprites (additive) → Bloom →
 *   HueSaturation → BrightnessContrast (gentle) → Vignette (soft) →
 *   ToneMapping (ACES) → Noise
 *
 * Punch intensity = (zoom − 1) / 0.6 clamped. On a punch the lights
 * brighten and drift toward the centre, Bloom intensifies, contrast
 * and saturation lift a touch. No chromatic aberration — it was the
 * source of the red fringing on shadow edges.
 *
 * DPR=2 + antialias kill the 1:1 Retina blockiness.
 */

import React, { useMemo, useRef } from "react";
import {
  Video,
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
import {
  EffectComposer,
  Bloom,
  BrightnessContrast,
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
import { AdditiveBlending, Color } from "three";

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
        <LightRig width={w} height={h} punch={punch} />
        <GradeStack punch={punch} />
      </ThreeCanvas>
    </>
  );
};

// ── Light rig ────────────────────────────────────────────────────────────
// Four soft radial additive sprites in front of the video plane. These
// feed the Bloom pass — what you see on screen is the Bloom halo, not
// the sprite itself (the sprites read as very faint on their own).
//
// Each light breathes on a low-frequency sine, phase-offset so they
// ripple. Punch drives intensity AND pulls them slightly toward centre,
// matching the zoom-in feel.

type LightDef = {
  color: string;
  // Position in [-1, 1] normalised screen coords; sign: +x right, +y up
  xN: number;
  yN: number;
  size: number; // relative to min(width, height)
  baseIntensity: number;
  breathHz: number;
  phase: number;
};

const LIGHTS: LightDef[] = [
  // Warm key — upper-left, large soft wash
  {
    color: "#ffb968",
    xN: -0.55,
    yN: 0.35,
    size: 1.1,
    baseIntensity: 0.72,
    breathHz: 0.18,
    phase: 0,
  },
  // Cool rim — upper-right, tighter
  {
    color: "#6fbcff",
    xN: 0.55,
    yN: 0.5,
    size: 0.75,
    baseIntensity: 0.55,
    breathHz: 0.24,
    phase: 1.6,
  },
  // Warm fill — lower-left, very soft
  {
    color: "#ff8c5c",
    xN: -0.4,
    yN: -0.55,
    size: 0.9,
    baseIntensity: 0.35,
    breathHz: 0.14,
    phase: 3.1,
  },
  // Cool accent — centre-right, small bright pinprick
  {
    color: "#a8e6ff",
    xN: 0.2,
    yN: -0.2,
    size: 0.35,
    baseIntensity: 0.6,
    breathHz: 0.32,
    phase: 2.2,
  },
];

const LightRig: React.FC<{
  width: number;
  height: number;
  punch: number;
}> = ({ width, height, punch }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const base = Math.min(width, height);

  return (
    <group position={[0, 0, 0.1]}>
      {LIGHTS.map((l, i) => {
        // Breathing — ±20% around baseIntensity
        const breath =
          1 + 0.2 * Math.sin(2 * Math.PI * l.breathHz * t + l.phase);
        // Punch lifts intensity by up to +80% and slightly shrinks size
        const intensity = l.baseIntensity * breath * (1 + 0.8 * punch);
        const size = base * l.size * (1 - 0.08 * punch);
        // Punch pulls lights toward centre by up to 15%
        const pullToCentre = 1 - 0.15 * punch;
        const x = (l.xN * width * 0.45) * pullToCentre;
        const y = (l.yN * height * 0.45) * pullToCentre;
        return (
          <SoftLight
            key={i}
            x={x}
            y={y}
            size={size}
            color={l.color}
            intensity={intensity}
          />
        );
      })}
    </group>
  );
};

const SoftLight: React.FC<{
  x: number;
  y: number;
  size: number;
  color: string;
  intensity: number;
}> = ({ x, y, size, color, intensity }) => {
  // A circular radial-gradient mesh via an inline shader. Additive blend
  // means the video underneath stays visible; this only adds brightness.
  const uniforms = useMemo(
    () => ({
      uColor: { value: new Color(color) },
      uIntensity: { value: intensity },
    }),
    // Re-create uniforms when color changes; intensity is mutated per frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [color],
  );
  // Mutate intensity uniform each render (cheaper than re-creating material)
  uniforms.uIntensity.value = intensity;

  return (
    <mesh position={[x, y, 0]}>
      <planeGeometry args={[size, size]} />
      <shaderMaterial
        transparent
        depthWrite={false}
        depthTest={false}
        blending={AdditiveBlending}
        uniforms={uniforms}
        vertexShader={SOFT_LIGHT_VERT}
        fragmentShader={SOFT_LIGHT_FRAG}
      />
    </mesh>
  );
};

const SOFT_LIGHT_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Smooth radial falloff with a soft core + long tail. Gamma 2.2 shaping
// keeps the centre bright without a hard edge.
const SOFT_LIGHT_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  varying vec2 vUv;
  void main() {
    vec2 c = vUv - 0.5;
    float d = length(c) * 2.0;
    float soft = 1.0 - smoothstep(0.0, 1.0, d);
    float core = pow(soft, 2.4);
    float halo = pow(soft, 0.9) * 0.35;
    float a = (core + halo) * uIntensity;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

// ── Grade ────────────────────────────────────────────────────────────────
// Light-first grade. Shadows are NOT crushed — they're allowed to breathe
// while the lights carry the drama. Punch nudges saturation / contrast /
// bloom / vignette, never hard enough to mask the face.

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const GradeStack: React.FC<{ punch: number }> = ({ punch }) => {
  // Bloom — single broad pass. The lights are the story; Bloom flares them.
  const bloomIntensity = lerp(0.85, 1.6, punch);
  const bloomThreshold = lerp(0.42, 0.32, punch);

  // Gentle saturation — cinematic warmth, not cartoonish
  const saturation = lerp(0.12, 0.28, punch);

  // Very light S-curve. Brightness stays slightly positive so the shadow
  // side of the face never clamps to black.
  const brightness = lerp(0.02, 0.0, punch);
  const contrast = lerp(0.1, 0.22, punch);

  // Vignette — soft, never closes harder than 0.5
  const vignetteDarkness = lerp(0.22, 0.5, punch);
  const vignetteOffset = lerp(0.42, 0.3, punch);

  // Grain
  const grainOpacity = lerp(0.035, 0.06, punch);

  return (
    <EffectComposer multisampling={4}>
      {/* 1. Broad bloom — picks up both the video highlights AND the
           additive light sprites. This is where the "light spots" read. */}
      <Bloom
        luminanceThreshold={bloomThreshold}
        luminanceSmoothing={0.4}
        intensity={bloomIntensity}
        kernelSize={KernelSize.VERY_LARGE}
        mipmapBlur
      />

      {/* 2. Saturation lift */}
      <HueSaturation hue={0} saturation={saturation} />

      {/* 3. Gentle brightness/contrast */}
      <BrightnessContrast brightness={brightness} contrast={contrast} />

      {/* 4. Soft vignette */}
      <Vignette
        offset={vignetteOffset}
        darkness={vignetteDarkness}
        eskil={false}
        blendFunction={BlendFunction.NORMAL}
      />

      {/* 5. ACES filmic */}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />

      {/* 6. Subtle grain */}
      <Noise
        opacity={grainOpacity}
        blendFunction={BlendFunction.SCREEN}
        premultiply={false}
      />
    </EffectComposer>
  );
};
