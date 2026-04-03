// Source: wasm.md scene #12 — Neon toggle switch
//
// Neumorphic toggle with cyan neon glow. The conic-gradient border arc sweeps
// open on check, the knob slides left/right, and a drop-shadow blooms cyan.
// Inspired by https://codepen.io/jkantner/pen/MWzqMrp

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  Easing,
} from "remotion";

// ── Timing ──────────────────────────────────────────────────────────────────

const TOGGLE_CYCLE = 120; // frames per half-cycle (2s at 60fps)
const TRANSITION_FRAMES = 30; // 0.5s transition duration

// ── Colors (from original CSS) ──────────────────────────────────────────────

const BG = "#545153";
const TRACK_BG = "#444143";
const KNOB_BG = "#545153";
const CYAN = "#0ff";

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Compute a smooth 0→1→0→1... toggle progress with eased transitions. */
function getToggleProgress(frame: number): number {
  const cycleFrame = frame % (TOGGLE_CYCLE * 2);
  if (cycleFrame < TOGGLE_CYCLE) {
    // OFF → ON
    const t = Math.min((cycleFrame) / TRANSITION_FRAMES, 1);
    return Easing.inOut(Easing.cubic)(t);
  }
  // ON → OFF
  const t = Math.min((cycleFrame - TOGGLE_CYCLE) / TRANSITION_FRAMES, 1);
  return 1 - Easing.inOut(Easing.cubic)(t);
}

// ── Main Composition ────────────────────────────────────────────────────────

export const NeonSwitch: React.FC = () => {
  const frame = useCurrentFrame();
  const p = getToggleProgress(frame);

  // Scale everything from the original 3rem base (48px) to look substantial
  // on 1920x1080. We use a 6x multiplier → track is ~288px wide.
  const EM = 48;
  const trackW = 3 * EM; // 144px at 1x, but we scale the container
  const trackH = trackW / 2;
  const knobSize = trackH * 0.8;
  const borderWidth = 0.1 * EM;
  const scale = 2.5; // visual scale for 1080p

  // Knob position: 25% → 75% of track width
  const knobLeft = interpolate(p, [0, 1], [trackW * 0.25, trackW * 0.75]);

  // Neon glow color opacity: 0 when off, 1 when on
  const glowOpacity = p;

  // Conic-gradient arc angle: 1deg off → 180deg on
  const arcAngle = interpolate(p, [0, 1], [1, 180]);

  // Drop-shadow intensity
  const dropShadowBlur = interpolate(p, [0, 1], [0, 0.2 * EM]);

  // Outer ring glow (box-shadow outer spread changes)
  const outerSpread = interpolate(p, [0, 1], [0.11 * EM, 0.05 * EM]);
  const outerBlur = interpolate(p, [0, 1], [0, 0.1 * EM]);

  // Knob inner glow — shifts from right-side glow (off) to left-side glow (on)
  const knobGlowX = interpolate(p, [0, 1], [0.05, -0.05]) * EM;
  const knobGlowSpread = interpolate(p, [0, 1], [-0.065, -0.035]) * EM;

  return (
    <AbsoluteFill
      style={{
        background: `
          radial-gradient(at 100% 0, rgba(255,255,255,0.13), transparent 50%),
          radial-gradient(at 0% 100%, rgba(0,0,0,0.13), transparent 50%),
          ${BG}
        `,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Scaled container */}
      <div
        style={{
          transform: `scale(${scale})`,
          position: "relative",
          width: trackW,
          height: trackH,
        }}
      >
        {/* Track */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 9999,
            background: `linear-gradient(to bottom right, rgba(0,0,0,0.07), transparent), ${TRACK_BG}`,
            boxShadow: [
              `inset 0 0 ${0.25 * EM}px ${-0.25 * EM}px rgba(0,0,0,0.53)`,
              `inset ${0.05 * EM}px ${0.05 * EM}px ${0.2 * EM}px rgba(0,8,17,0.07)`,
              `inset ${-0.05 * EM}px ${-0.05 * EM}px ${0.15 * EM}px ${0.05 * EM}px rgba(204,204,204,0.07)`,
              `0 0 ${outerBlur}px ${outerSpread}px ${BG}`,
            ].join(", "),
            filter: `drop-shadow(0 0 ${dropShadowBlur}px rgba(0,255,255,${glowOpacity}))`,
          }}
        />

        {/* Conic-gradient neon border arc */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: trackW + 0.25 * EM,
            height: trackH + 0.25 * EM,
            border: `${borderWidth}px solid ${CYAN}`,
            borderRadius: 9999,
            WebkitMaskImage: `conic-gradient(from ${270 - arcAngle}deg, #000 ${2 * arcAngle}deg, transparent 0)`,
            maskImage: `conic-gradient(from ${270 - arcAngle}deg, #000 ${2 * arcAngle}deg, transparent 0)`,
            pointerEvents: "none",
          }}
        />

        {/* Knob */}
        <div
          style={{
            position: "absolute",
            width: knobSize,
            height: knobSize,
            top: "50%",
            left: knobLeft,
            transform: "translate(-50%, -50%)",
            borderRadius: "50%",
            background: KNOB_BG,
            boxShadow: [
              `inset ${-0.05 * EM}px ${-0.05 * EM}px ${0.1 * EM}px rgba(0,0,0,0.53)`,
              `inset ${0.05 * EM}px ${0.05 * EM}px ${0.1 * EM}px rgba(255,255,255,0.13)`,
              `inset ${knobGlowX}px 0 ${0.1 * EM}px ${knobGlowSpread}px rgba(0,255,255,${glowOpacity})`,
              `${0.1 * EM}px ${0.1 * EM}px ${0.15 * EM}px rgba(0,0,0,0.8)`,
            ].join(", "),
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
