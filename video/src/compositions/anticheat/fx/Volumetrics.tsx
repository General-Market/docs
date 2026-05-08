import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";

// Volumetric light rays in pure 2D. No WebGL.
//
// Built from two layered repeating-conic-gradient ray fans, masked by a
// radial gradient (fade from focal point outward), each blurred. A core
// halo and a horizontal lens streak sit on top. Tinted via `color`.
//
// Triangular envelope around `peakFrame` with `attack` ramp-in and
// `decay` ramp-out. Outside that window the component renders nothing
// (returns null) so it costs nothing when offscreen.

export interface VolumetricsProps {
  peakFrame: number;
  attack?: number;
  decay?: number;
  cx?: string; // center x as CSS length, e.g. "50%"
  cy?: string;
  color?: string; // ray colour (use rgba so alpha is honest)
  coreColor?: string; // halo core
  intensity?: number; // 0..1, max amplitude
  rays?: number; // primary ray count
  rayWidth?: number; // ray angular width in degrees
  blur?: number; // blur in px applied to ray fan
  reach?: string; // mask falloff radius, e.g. "70%"
  streak?: boolean; // horizontal lens streak
}

export const Volumetrics: React.FC<VolumetricsProps> = ({
  peakFrame,
  attack = 10,
  decay = 22,
  cx = "50%",
  cy = "50%",
  color = "rgba(120, 168, 255, 0.85)",
  coreColor = "rgba(180, 210, 255, 1)",
  intensity = 1,
  rays = 18,
  rayWidth = 0.7,
  blur = 1.5,
  reach = "70%",
  streak = true,
}) => {
  const frame = useCurrentFrame();
  const delta = frame - peakFrame;
  if (delta < -attack || delta > decay) return null;

  const rampUp = interpolate(delta, [-attack, 0], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.25, 0.1, 0.3, 1),
  });
  const rampDown = interpolate(delta, [0, decay], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.4, 0, 0.6, 1),
  });
  const env = (delta <= 0 ? rampUp : rampDown) * intensity;
  if (env <= 0) return null;

  const step = 360 / rays;
  const fan = `repeating-conic-gradient(from 0deg at ${cx} ${cy}, ${color} 0deg ${rayWidth}deg, transparent ${rayWidth}deg ${step}deg)`;
  const fade = `radial-gradient(ellipse ${reach} ${reach} at ${cx} ${cy}, rgba(0,0,0,1) 0%, rgba(0,0,0,0.85) 18%, rgba(0,0,0,0.35) 50%, rgba(0,0,0,0) 88%)`;

  // Tiny rotation drift across the envelope so the rays breathe
  // rather than sit static.
  const drift = (delta + attack) * 0.06;

  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: env }}>
      <AbsoluteFill
        style={{
          backgroundImage: fan,
          WebkitMaskImage: fade,
          maskImage: fade,
          filter: `blur(${blur}px)`,
          transform: `rotate(${drift}deg)`,
          mixBlendMode: "screen",
        }}
      />
      {/* Core halo */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle 32% at ${cx} ${cy}, ${coreColor} 0%, ${color} 22%, rgba(0,0,0,0) 60%)`,
          filter: "blur(8px)",
          mixBlendMode: "screen",
          opacity: 0.85,
        }}
      />
      {/* Horizontal lens streak — Gainsight-style */}
      {streak ? (
        <AbsoluteFill
          style={{
            background: `linear-gradient(90deg, transparent 0%, ${color} 35%, ${coreColor} 50%, ${color} 65%, transparent 100%)`,
            WebkitMaskImage: `radial-gradient(ellipse 60% 6% at ${cx} ${cy}, black 0%, transparent 80%)`,
            maskImage: `radial-gradient(ellipse 60% 6% at ${cx} ${cy}, black 0%, transparent 80%)`,
            filter: "blur(3px)",
            mixBlendMode: "screen",
            opacity: 0.9,
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};
