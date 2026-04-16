/**
 * WabiScene3D — single continuous Three.js scene.
 *
 * Contains:
 *   • Soft environment backdrop (canvas color + subtle gradient)
 *   • In-scene text (Meet Wabi) refracted through the orb during lens moments
 *   • Hero Liquid Glass orb (morphs across acts)
 *   • Bubble swarm (Act V onward)
 *   • Environment / Lightformer rig (drives the specular sheen)
 */

import React, { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import {
  Environment,
  Lightformer,
} from "@react-three/drei";
import {
  EffectComposer,
  Bloom,
  ToneMapping,
} from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import { interpolate } from "remotion";
import { LiquidGlassOrb } from "./LiquidGlassOrb";
import { BubbleSwarm } from "./BubbleSwarm";
import { ACTS, FONT_STACK } from "../theme";

/** Camera stays static — we move the content, not the camera. */
const StaticCamera: React.FC = () => {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);
  }, [camera]);
  return null;
};

/** The backdrop plane that sits behind everything — gives the glass something to refract. */
const Backdrop: React.FC = () => {
  return (
    <mesh position={[0, 0, -1.5]}>
      <planeGeometry args={[8, 14]} />
      <meshBasicMaterial color="#F2F2F2" />
    </mesh>
  );
};

/**
 * Create a Three.js texture containing rendered text.
 * Uses an HTML canvas so native browser font rendering (including Switzer via
 * @font-face) is available — no troika, no TTF-only limitation.
 */
function createTextTexture(
  lines: { text: string; size: number; weight: number }[]
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  const width = 1600;
  const height = 1200;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, width, height);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#1A1A1A";

  // Stack lines vertically, centered.
  const totalLines = lines.length;
  const spacing = 180;
  const startY = height / 2 - ((totalLines - 1) * spacing) / 2;

  lines.forEach((line, i) => {
    ctx.font = `${line.weight} ${line.size}px ${FONT_STACK}`;
    ctx.fillText(line.text, width / 2, startY + i * spacing);
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

/**
 * In-scene text refracted through the orb during Acts III & VII.
 * Rendered as a canvas texture on a plane behind the orb — the transmission
 * material distorts it naturally.
 */
const RefractedText: React.FC<{ frame: number }> = ({ frame }) => {
  const act3Fade = (() => {
    const start = ACTS.III.start - 4;
    const end = ACTS.III.end + 4;
    if (frame < start || frame > end) return 0;
    if (frame < ACTS.III.start) return (frame - start) / 4;
    if (frame > ACTS.III.end) return Math.max(0, 1 - (frame - ACTS.III.end) / 4);
    return 1;
  })();

  const act7Fade = (() => {
    const start = ACTS.VII.start - 6;
    const end = ACTS.VII.end + 6;
    if (frame < start || frame > end) return 0;
    if (frame < ACTS.VII.start) return (frame - start) / 6;
    if (frame > ACTS.VII.end) return Math.max(0, 1 - (frame - ACTS.VII.end) / 6);
    return 1;
  })();

  const textureA = useMemo(
    () =>
      createTextTexture([{ text: "Meet Wabi.", size: 240, weight: 900 }]),
    []
  );
  const textureB = useMemo(
    () =>
      createTextTexture([
        { text: "Meet Wabi.", size: 200, weight: 900 },
        { text: "The first personal", size: 150, weight: 800 },
        { text: "software platform.", size: 150, weight: 800 },
      ]),
    []
  );

  const showA = act3Fade > 0;
  const showB = act7Fade > 0;
  if (!showA && !showB) return null;

  return (
    <>
      {showA && (
        <mesh position={[0, 0.15, -0.2]}>
          <planeGeometry args={[3.2, 2.4]} />
          <meshBasicMaterial
            map={textureA}
            transparent
            opacity={act3Fade}
            toneMapped={false}
          />
        </mesh>
      )}
      {showB && (
        <mesh position={[0, -0.1, -0.2]}>
          <planeGeometry args={[3.2, 2.4]} />
          <meshBasicMaterial
            map={textureB}
            transparent
            opacity={act7Fade}
            toneMapped={false}
          />
        </mesh>
      )}
    </>
  );
};

/** Lighting rig — the specular sheen on the orb comes from here. */
const LightingRig: React.FC = () => {
  return (
    <>
      <ambientLight intensity={0.4} color="#ffffff" />
      <directionalLight
        position={[3, 5, 4]}
        intensity={1.8}
        color="#ffffff"
      />
      <directionalLight
        position={[-4, 2, 3]}
        intensity={0.8}
        color="#B8D4FF"
      />

      <Environment
        frames={1}
        resolution={128}
        background={false}
        environmentIntensity={0.9}
      >
        <color attach="background" args={["#ffffff"]} />

        {/* Broad overhead — primary specular */}
        <Lightformer
          form="rect"
          intensity={3.0}
          color="#ffffff"
          scale={[12, 4, 1]}
          position={[0, 4, -3]}
        />
        {/* Upper left — warm tint for rim */}
        <Lightformer
          form="rect"
          intensity={1.8}
          color="#FFE8D4"
          scale={[4, 3, 1]}
          position={[-4, 3, -2]}
        />
        {/* Upper right — cool tint for rim */}
        <Lightformer
          form="rect"
          intensity={1.8}
          color="#D4E4FF"
          scale={[4, 3, 1]}
          position={[4, 3, -2]}
        />
        {/* Lower fill */}
        <Lightformer
          form="rect"
          intensity={0.9}
          color="#F0F0F5"
          scale={[8, 2, 1]}
          position={[0, -3, -3]}
        />
      </Environment>
    </>
  );
};

/** Final post-processing — a gentle bloom for the emissive core and AGX tone. */
const PostFX: React.FC = () => {
  return (
    <EffectComposer multisampling={0}>
      <Bloom
        luminanceThreshold={0.75}
        luminanceSmoothing={0.4}
        intensity={0.45}
        mipmapBlur
      />
      <ToneMapping mode={ToneMappingMode.AGX} />
    </EffectComposer>
  );
};

export const WabiScene3D: React.FC<{ frame: number }> = ({ frame }) => {
  // Subtle camera breathing — keeps the scene alive during the static moments.
  const breathe = interpolate(
    Math.sin(frame * 0.02),
    [-1, 1],
    [0.98, 1.02]
  );

  return (
    <>
      <StaticCamera />
      <fog attach="fog" args={["#F2F2F2", 6, 12]} />
      <Backdrop />
      <LightingRig />
      <RefractedText frame={frame} />
      <group scale={breathe}>
        <LiquidGlassOrb frame={frame} />
        <BubbleSwarm frame={frame} />
      </group>
      <PostFX />
    </>
  );
};

// Suppress unused import warning — THREE is imported for future shader work.
void THREE;
