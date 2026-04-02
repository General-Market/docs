// Source: https://tympanus.net/Tutorials/GlowingTextMarqueeAnimation/
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";

/**
 * Reproduction of the Darkroom "Glowing Text Marquee" by Kaploom for Codrops.
 *
 * The trick: an SVG clip-path spells the text twice (seamless loop).
 * The clipped layer scrolls left; the inner color layer scrolls right.
 * Two radial gradient orbs (orange + violet) shine through the text letterforms.
 * The counter-scroll creates the illusion of light sweeping through stationary text.
 */

// ── Clip-path data ──────────────────────────────────────────────────────────
// Extracted from the original SVG — "DARKROOM" spelled twice in objectBoundingBox
// coordinates so the path tiles seamlessly at the 50% mark.
const CLIP_PATH_D =
  "M0.012,0.86 V0.861 H0.012 H0.027 C0.036,0.861,0.042,0.786,0.042,0.693 V0.311 C0.042,0.219,0.036,0.144,0.027,0.144 H0.012 H0.012 V0.145 V0.86 M0.13,0.524 H0.13 V0.525 V0.583 V0.584 L0.13,0.584 L0.167,0.992 H0.15 L0.13,0.77 L0.13,0.769 V0.771 V0.992 H0.118 V0.013 L0.139,0.013 C0.152,0.013,0.162,0.127,0.162,0.268 C0.162,0.409,0.152,0.524,0.139,0.524 H0.13 M0.13,0.144 H0.13 V0.145 V0.392 V0.393 H0.13 L0.139,0.393 C0.145,0.393,0.15,0.337,0.15,0.268 C0.15,0.199,0.145,0.144,0.139,0.144 L0.13,0.144 M0.213,0.013 H0.228 L0.198,0.502 L0.198,0.502 L0.198,0.503 L0.228,0.992 H0.213 L0.188,0.568 L0.188,0.568 H0.188 H0.183 H0.183 V0.569 V0.992 L0.171,0.992 V0.013 L0.183,0.013 V0.436 V0.437 H0.183 H0.188 H0.188 L0.188,0.437 L0.213,0.013 M0.07,0.807 H0.07 L0.07,0.808 L0.067,0.992 H0.055 L0.072,0.013 H0.097 L0.114,0.992 H0.102 L0.099,0.808 L0.099,0.807 H0.099 H0.07 M0.072,0.675 L0.072,0.676 H0.072 H0.096 H0.097 L0.096,0.675 L0.087,0.144 L0.087,0.144 H0.087 H0.082 H0.082 L0.082,0.144 L0.072,0.675 M0.054,0.693 C0.054,0.858,0.042,0.992,0.027,0.992 H0 V0.013 H0.027 C0.042,0.013,0.054,0.147,0.054,0.311 V0.693 M0.512,0.86 V0.861 H0.512 H0.527 C0.536,0.861,0.542,0.786,0.542,0.693 V0.311 C0.542,0.219,0.536,0.144,0.527,0.144 H0.512 H0.512 V0.145 V0.86 M0.63,0.524 H0.63 V0.525 V0.583 V0.584 L0.63,0.584 L0.667,0.992 H0.65 L0.63,0.77 L0.63,0.769 V0.771 V0.992 H0.618 V0.013 L0.639,0.013 C0.652,0.013,0.662,0.127,0.662,0.268 C0.662,0.409,0.652,0.524,0.639,0.524 H0.63 M0.63,0.144 H0.63 V0.145 V0.392 V0.393 H0.63 L0.639,0.393 C0.645,0.393,0.65,0.337,0.65,0.268 C0.65,0.199,0.645,0.144,0.639,0.144 L0.63,0.144 M0.713,0.013 H0.728 L0.698,0.502 L0.698,0.502 L0.698,0.503 L0.728,0.992 H0.713 L0.688,0.568 L0.688,0.568 H0.688 H0.683 H0.683 V0.569 V0.992 L0.671,0.992 V0.013 L0.683,0.013 V0.436 V0.437 H0.683 H0.688 H0.688 L0.688,0.437 L0.713,0.013 M0.57,0.807 H0.57 L0.57,0.808 L0.567,0.992 H0.555 L0.572,0.013 H0.597 L0.614,0.992 H0.602 L0.599,0.808 L0.599,0.807 H0.599 H0.57 M0.572,0.675 L0.572,0.676 H0.573 H0.596 H0.597 L0.597,0.675 L0.587,0.144 L0.587,0.144 H0.587 H0.582 H0.582 L0.582,0.144 L0.572,0.675 M0.554,0.693 C0.554,0.858,0.542,0.992,0.527,0.992 H0.5 V0.013 H0.527 C0.542,0.013,0.554,0.147,0.554,0.311 V0.693 M0.243,0.524 H0.243 V0.525 V0.583 V0.584 L0.243,0.584 L0.28,0.992 H0.263 L0.243,0.77 L0.243,0.769 V0.771 V0.992 H0.231 V0.013 L0.252,0.013 C0.265,0.013,0.275,0.127,0.275,0.268 C0.275,0.409,0.265,0.524,0.252,0.524 H0.243 M0.243,0.144 H0.243 V0.145 V0.392 V0.393 H0.243 L0.252,0.393 C0.258,0.393,0.263,0.337,0.263,0.268 C0.263,0.199,0.258,0.144,0.252,0.144 L0.243,0.144 M0.455,0.013 H0.478 V0.992 H0.466 V0.145 V0.144 H0.466 H0.465 H0.465 L0.465,0.145 L0.45,0.992 H0.428 L0.414,0.145 L0.414,0.144 H0.414 H0.413 H0.413 V0.145 V0.992 H0.401 V0.013 H0.424 L0.438,0.86 L0.438,0.861 H0.438 H0.44 H0.44 L0.44,0.86 L0.455,0.013 M0.383,0.701 V0.305 C0.383,0.211,0.376,0.134,0.367,0.134 C0.359,0.134,0.352,0.211,0.352,0.305 V0.701 C0.352,0.795,0.359,0.872,0.367,0.872 C0.376,0.872,0.383,0.795,0.383,0.701 M0.34,0.305 C0.34,0.138,0.352,0.003,0.367,0.003 C0.383,0.003,0.395,0.138,0.395,0.305 V0.701 C0.395,0.868,0.383,1,0.367,1 C0.352,1,0.34,0.868,0.34,0.701 V0.305 M0.323,0.701 V0.305 C0.323,0.211,0.316,0.134,0.307,0.134 C0.299,0.134,0.292,0.211,0.292,0.305 V0.701 C0.292,0.795,0.299,0.872,0.307,0.872 C0.316,0.872,0.323,0.795,0.323,0.701 M0.28,0.305 C0.28,0.138,0.292,0.003,0.307,0.003 C0.322,0.003,0.335,0.138,0.335,0.305 V0.701 C0.335,0.868,0.322,1,0.307,1 C0.292,1,0.28,0.868,0.28,0.701 V0.305 M0.743,0.524 H0.743 V0.525 V0.583 V0.584 L0.743,0.584 L0.78,0.992 H0.763 L0.743,0.77 L0.743,0.769 V0.771 V0.992 H0.731 V0.013 L0.752,0.013 C0.765,0.013,0.775,0.127,0.775,0.268 C0.775,0.409,0.765,0.524,0.752,0.524 H0.743 M0.743,0.144 H0.743 V0.145 V0.392 V0.393 H0.743 L0.752,0.393 C0.758,0.393,0.763,0.337,0.763,0.268 C0.763,0.199,0.758,0.144,0.752,0.144 L0.743,0.144 M0.955,0.013 H0.978 V0.992 H0.966 V0.145 V0.144 H0.966 H0.965 H0.965 L0.965,0.145 L0.95,0.992 H0.928 L0.914,0.145 L0.914,0.144 H0.914 H0.913 H0.913 V0.145 V0.992 H0.901 V0.013 H0.924 L0.938,0.86 L0.938,0.861 H0.438 H0.94 H0.94 L0.94,0.86 L0.955,0.013 M0.883,0.701 V0.305 C0.883,0.211,0.876,0.134,0.867,0.134 C0.859,0.134,0.852,0.211,0.852,0.305 V0.701 C0.852,0.795,0.859,0.872,0.867,0.872 C0.876,0.872,0.883,0.795,0.883,0.701 M0.84,0.305 C0.84,0.138,0.852,0.003,0.867,0.003 C0.883,0.003,0.895,0.138,0.895,0.305 V0.701 C0.895,0.868,0.883,1,0.867,1 C0.852,1,0.84,0.868,0.84,0.701 V0.305 M0.823,0.701 V0.305 C0.823,0.211,0.816,0.134,0.807,0.134 C0.799,0.134,0.792,0.211,0.792,0.305 V0.701 C0.792,0.795,0.799,0.872,0.807,0.872 C0.816,0.872,0.823,0.795,0.823,0.701 M0.78,0.305 C0.78,0.138,0.792,0.003,0.807,0.003 C0.822,0.003,0.835,0.138,0.835,0.305 V0.701 C0.835,0.868,0.822,1,0.807,1 C0.792,1,0.78,0.868,0.78,0.701 V0.305 M1,1 L1,1 H1 V1";

// ── Constants ───────────────────────────────────────────────────────────────

const LOOP_DURATION_S = 10; // one full marquee cycle
const RAIL_WIDTH_VW = 232; // original uses 232vw on desktop
const INTRO_DURATION_FRAMES = 90; // 3 seconds for the gradient orbs to float in

// Original gradient images are radial blobs:
// - "core" = warm orange/red (#ff4500 → transparent)
// - "pro"  = vivid violet/blue (#5500ff → transparent)

export const GlowingMarquee: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const time = frame / fps;

  // Marquee scroll progress: 0 → 1 over LOOP_DURATION_S, seamlessly looping
  const scrollProgress = (time / LOOP_DURATION_S) % 1;

  // The clip layer translates left by 0 → 50% (showing the second copy of the text
  // right as the first scrolls off), then resets — giving a seamless infinite marquee.
  const clipTranslateX = -scrollProgress * 50; // percent
  // The inner color layer counter-scrolls right at the same rate
  const colorTranslateX = scrollProgress * 50; // percent

  // Intro animation: gradient orbs float up from below
  const introProgress = interpolate(frame, [0, INTRO_DURATION_FRAMES], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Gentle floating motion for the orbs (sinusoidal, like the original float-core/float-pro)
  const floatCore = Math.sin((time / 4) * Math.PI * 2) * 2.5; // ±2.5% vertical
  const floatPro = Math.sin((time / 3) * Math.PI * 2 + Math.PI) * 2; // ±2% vertical, phase-shifted

  // Core orb position: translate(-7vw, -2.3vw) in original — roughly (-7%, -4.6%) of viewport
  const coreX = -7; // vw
  const coreYFinal = -2.3; // vw
  const coreYStart = 100; // starts off screen below
  const coreY = interpolate(introProgress, [0, 1], [coreYStart, coreYFinal]) + floatCore;

  // Pro orb position: translate(7vw, 5vw)
  const proX = 7;
  const proYFinal = 5;
  const proYStart = 105;
  const proY = interpolate(introProgress, [0, 1], [proYStart, proYFinal]) + floatPro;

  // Rail container width: 232vw equivalent scaled to our composition
  const railPixelWidth = (RAIL_WIDTH_VW / 100) * width;

  // Gradient orb size (52vw in original)
  const orbSize = (52 / 100) * width;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000", overflow: "hidden" }}>
      {/* Inline SVG defining the clip-path */}
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          <clipPath id="glowingMarqueeClip" clipPathUnits="objectBoundingBox">
            <path d={CLIP_PATH_D} />
          </clipPath>
        </defs>
      </svg>

      {/* Rail: the scrolling marquee container */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          width: "100%",
          overflow: "hidden",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: railPixelWidth,
            height: height * 0.45,
          }}
        >
          {/* Sizing spacer (invisible — establishes the aspect ratio) */}
          <svg
            width="5482"
            height="500"
            viewBox="0 0 5482 500"
            fill="none"
            style={{
              position: "relative",
              opacity: 0,
              height: "auto",
              width: railPixelWidth,
            }}
          />

          {/* Clipped layer: scrolls left, reveals text outlines */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              width: "100%",
              height: "100%",
              clipPath: 'url(#glowingMarqueeClip)',
              WebkitClipPath: 'url(#glowingMarqueeClip)',
              transform: `translateX(${clipTranslateX}%)`,
            }}
          >
            {/* Color layer: counter-scrolls right so gradients appear to sweep through */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                backgroundColor: "#0c0c0e",
                transform: `translateX(${colorTranslateX}%)`,
              }}
            >
              {/* Gradient orbs container */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: width,
                  height: "100%",
                  position: "relative",
                }}
              >
                {/* Core gradient orb — warm orange/red */}
                <div
                  style={{
                    position: "absolute",
                    width: orbSize,
                    height: orbSize,
                    borderRadius: "50%",
                    background:
                      "radial-gradient(circle, #ff6b00 0%, #ff4500 35%, #e8350088 60%, transparent 80%)",
                    transform: `translate(${(coreX / 100) * width}px, ${(coreY / 100) * width}px)`,
                    filter: "blur(20px)",
                  }}
                />
                {/* Pro gradient orb — vivid violet/blue */}
                <div
                  style={{
                    position: "absolute",
                    width: orbSize,
                    height: orbSize,
                    borderRadius: "50%",
                    background:
                      "radial-gradient(circle, #7b2fff 0%, #5500ff 35%, #4400cc88 60%, transparent 80%)",
                    transform: `translate(${(proX / 100) * width}px, ${(proY / 100) * width}px)`,
                    filter: "blur(20px)",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating product boxes (the two orbs visible outside the text) */}
      <GradientOrb
        color="orange"
        x={coreX}
        y={coreY}
        size={orbSize * 0.55}
        width={width}
        height={height}
        blur={30}
      />
      <GradientOrb
        color="violet"
        x={proX}
        y={proY}
        size={orbSize * 0.45}
        width={width}
        height={height}
        blur={25}
      />
    </AbsoluteFill>
  );
};

// Standalone floating gradient orb behind the text
const GradientOrb: React.FC<{
  color: "orange" | "violet";
  x: number;
  y: number;
  size: number;
  width: number;
  height: number;
  blur: number;
}> = ({ color, x, y, size, width, height, blur }) => {
  const grad =
    color === "orange"
      ? "radial-gradient(circle, #ff6b0066 0%, #ff450044 40%, transparent 70%)"
      : "radial-gradient(circle, #7b2fff66 0%, #5500ff44 40%, transparent 70%)";

  return (
    <div
      style={{
        position: "absolute",
        left: width / 2 + (x / 100) * width - size / 2,
        top: height / 2 + (y / 100) * width - size / 2,
        width: size,
        height: size,
        borderRadius: "50%",
        background: grad,
        filter: `blur(${blur}px)`,
        pointerEvents: "none",
      }}
    />
  );
};
