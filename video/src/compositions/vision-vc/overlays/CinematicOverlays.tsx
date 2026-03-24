/**
 * CinematicOverlays — post-processing layers for that 35mm feeling.
 *
 * Film grain, vignette, chromatic aberration, scan lines,
 * letterbox bars, film gate weave, light leaks.
 * All pure CSS. No canvas, no WebGL, no dignity.
 *
 * The grain animates per-frame by shifting a pseudo-random CSS gradient.
 * The aberration is a cheat — colored edge tints instead of true
 * channel separation — but at 1px and 2% opacity, no one will know
 * the difference. Certainly not VCs.
 *
 * Gate weave shifts the overlay ±0.15px per frame. Analog instability
 * for people who have never touched film but want to feel like they have.
 */
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

interface CinematicOverlayProps {
  /** Film grain noise layer. Default true. */
  grain?: boolean;
  /** Dark vignette around edges. Default true. */
  vignette?: boolean;
  /** Subtle chromatic aberration on edges. Default false. */
  aberration?: boolean;
  /** Horizontal scan lines. Default false. */
  scanLines?: boolean;
  /** Cinematic 2.35:1 letterbox bars. Default false. */
  letterbox?: boolean;
  /** Warm light leak in top-right corner. Default false. */
  lightLeak?: boolean;
  /** Global intensity multiplier, 0-1. Default 0.5. */
  intensity?: number;
}

/**
 * Attempt at a deterministic-ish hash for grain displacement.
 * Not cryptographic. Not even good. But it moves.
 */
const pseudoRandom = (seed: number): number => {
  const x = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

const FilmGrain: React.FC<{ intensity: number }> = ({ intensity }) => {
  const frame = useCurrentFrame();

  // Shift the gradient origin each frame for animated noise
  const offsetX = pseudoRandom(frame) * 200;
  const offsetY = pseudoRandom(frame + 1000) * 200;
  const offsetX2 = pseudoRandom(frame + 2000) * 300;
  const offsetY2 = pseudoRandom(frame + 3000) * 300;

  // Layer multiple gradients at different scales for organic texture
  const grainGradient = [
    `repeating-conic-gradient(from ${frame * 7}deg at ${offsetX}% ${offsetY}%, rgba(255,255,255,0.03) 0%, transparent 0.5%, transparent 1%)`,
    `repeating-conic-gradient(from ${frame * 13}deg at ${offsetX2}% ${offsetY2}%, rgba(0,0,0,0.04) 0%, transparent 0.3%, transparent 0.8%)`,
    `repeating-linear-gradient(${frame * 3}deg, transparent 0px, rgba(255,255,255,0.015) 1px, transparent 2px)`,
  ].join(", ");

  const opacity = 0.02 + intensity * 0.02; // 2-4% depending on intensity

  return (
    <AbsoluteFill
      style={{
        background: grainGradient,
        opacity,
        mixBlendMode: "overlay",
        pointerEvents: "none",
        zIndex: 1000,
      }}
    />
  );
};

const Vignette: React.FC<{ intensity: number }> = ({ intensity }) => {
  const edgeOpacity = 0.1 + intensity * 0.15; // 0.10-0.25

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,${edgeOpacity}) 100%)`,
        pointerEvents: "none",
        zIndex: 1001,
      }}
    />
  );
};

const ChromaticAberration: React.FC<{ intensity: number }> = ({
  intensity,
}) => {
  const edgeOpacity = 0.01 + intensity * 0.01; // 1-2%
  const spread = Math.round(1 + intensity * 2); // 1-3px

  return (
    <>
      {/* Red tint — left edge */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(to right, rgba(255,0,0,${edgeOpacity}) 0%, transparent ${spread * 2}%)`,
          pointerEvents: "none",
          zIndex: 1002,
        }}
      />
      {/* Cyan tint — right edge */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(to left, rgba(0,255,255,${edgeOpacity}) 0%, transparent ${spread * 2}%)`,
          pointerEvents: "none",
          zIndex: 1002,
        }}
      />
      {/* Slight blue-magenta on top edge */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(to bottom, rgba(120,0,255,${edgeOpacity * 0.5}) 0%, transparent ${spread}%)`,
          pointerEvents: "none",
          zIndex: 1002,
        }}
      />
    </>
  );
};

const ScanLines: React.FC<{ intensity: number }> = ({ intensity }) => {
  const lineOpacity = 0.05 + intensity * 0.1; // 5-15%

  return (
    <AbsoluteFill
      style={{
        background: `repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, rgba(0,0,0,${lineOpacity}) 2px, rgba(0,0,0,${lineOpacity}) 3px)`,
        pointerEvents: "none",
        zIndex: 1003,
      }}
    />
  );
};

const Letterbox: React.FC = () => {
  const barStyle: React.CSSProperties = {
    position: "absolute",
    left: 0,
    right: 0,
    height: 24,
    background: "#000",
    pointerEvents: "none",
    zIndex: 1005,
  };

  return (
    <>
      <div style={{ ...barStyle, top: 0 }} />
      <div style={{ ...barStyle, bottom: 0 }} />
    </>
  );
};

const LightLeak: React.FC<{ intensity: number }> = ({ intensity }) => {
  const frame = useCurrentFrame();

  // Slow drift: the leak wanders gently over time
  const driftX = 80 + Math.sin(frame * 0.008) * 5; // 75-85%
  const driftY = 15 + Math.cos(frame * 0.006) * 4; // 11-19%
  const leakOpacity = 0.03 + intensity * 0.02; // 3-5%

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at ${driftX}% ${driftY}%, rgba(255,180,80,${leakOpacity}), transparent 50%)`,
        pointerEvents: "none",
        zIndex: 1004,
      }}
    />
  );
};

/**
 * Film gate weave — the whole overlay container shifts ±0.15px
 * horizontally every few frames. Simulates mechanical instability
 * in the film gate. The kind of imperfection that makes digital
 * footage feel like it was once physical.
 */
const useGateWeave = (frame: number): number => {
  // Change direction every 2-3 frames (use pseudoRandom to vary interval)
  const weavePhase = Math.floor(frame / 2.5);
  return (pseudoRandom(weavePhase) - 0.5) * 0.3; // ±0.15px
};

export const CinematicOverlays: React.FC<CinematicOverlayProps> = ({
  grain = true,
  vignette = true,
  aberration = false,
  scanLines = false,
  letterbox = false,
  lightLeak = false,
  intensity = 0.5,
}) => {
  const frame = useCurrentFrame();
  const clampedIntensity = Math.max(0, Math.min(1, intensity));
  const weaveX = useGateWeave(frame);

  return (
    <AbsoluteFill
      style={{
        transform: `translateX(${weaveX}px)`,
        pointerEvents: "none",
      }}
    >
      {grain && <FilmGrain intensity={clampedIntensity} />}
      {vignette && <Vignette intensity={clampedIntensity} />}
      {aberration && <ChromaticAberration intensity={clampedIntensity} />}
      {scanLines && <ScanLines intensity={clampedIntensity} />}
      {lightLeak && <LightLeak intensity={clampedIntensity} />}
      {letterbox && <Letterbox />}
    </AbsoluteFill>
  );
};
