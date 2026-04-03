// Source: https://tympanus.net/Tutorials/GlowingTextMarqueeAnimation/
// GitHub: https://github.com/ulviskaploom/codrops-darkroom
// Pure CSS effect by Kaploom Creative House for Codrops — ported to Remotion.
//
// The trick: SVG clipPath spells "DARKROOM" twice (tiles at 50%).
// The clipped layer scrolls left; the inner color layer scrolls right.
// Two radial gradient orbs (orange-red + violet-blue) shine through the letterforms.
// The counter-scroll creates the illusion of light sweeping through stationary text.

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";

// ── Clip-path data ──────────────────────────────────────────────────────────
// Extracted from the original SVG — "DARKROOM" x2 in objectBoundingBox coords.
const CLIP_PATH_D =
  "M0.012,0.86 V0.861 H0.012 H0.027 C0.036,0.861,0.042,0.786,0.042,0.693 V0.311 C0.042,0.219,0.036,0.144,0.027,0.144 H0.012 H0.012 V0.145 V0.86 M0.13,0.524 H0.13 V0.525 V0.583 V0.584 L0.13,0.584 L0.167,0.992 H0.15 L0.13,0.77 L0.13,0.769 V0.771 V0.992 H0.118 V0.013 L0.139,0.013 C0.152,0.013,0.162,0.127,0.162,0.268 C0.162,0.409,0.152,0.524,0.139,0.524 H0.13 M0.13,0.144 H0.13 V0.145 V0.392 V0.393 H0.13 L0.139,0.393 C0.145,0.393,0.15,0.337,0.15,0.268 C0.15,0.199,0.145,0.144,0.139,0.144 L0.13,0.144 M0.213,0.013 H0.228 L0.198,0.502 L0.198,0.502 L0.198,0.503 L0.228,0.992 H0.213 L0.188,0.568 L0.188,0.568 H0.188 H0.183 H0.183 V0.569 V0.992 L0.171,0.992 V0.013 L0.183,0.013 V0.436 V0.437 H0.183 H0.188 H0.188 L0.188,0.437 L0.213,0.013 M0.07,0.807 H0.07 L0.07,0.808 L0.067,0.992 H0.055 L0.072,0.013 H0.097 L0.114,0.992 H0.102 L0.099,0.808 L0.099,0.807 H0.099 H0.07 M0.072,0.675 L0.072,0.676 H0.072 H0.096 H0.097 L0.096,0.675 L0.087,0.144 L0.087,0.144 H0.087 H0.082 H0.082 L0.082,0.144 L0.072,0.675 M0.054,0.693 C0.054,0.858,0.042,0.992,0.027,0.992 H0 V0.013 H0.027 C0.042,0.013,0.054,0.147,0.054,0.311 V0.693 M0.512,0.86 V0.861 H0.512 H0.527 C0.536,0.861,0.542,0.786,0.542,0.693 V0.311 C0.542,0.219,0.536,0.144,0.527,0.144 H0.512 H0.512 V0.145 V0.86 M0.63,0.524 H0.63 V0.525 V0.583 V0.584 L0.63,0.584 L0.667,0.992 H0.65 L0.63,0.77 L0.63,0.769 V0.771 V0.992 H0.618 V0.013 L0.639,0.013 C0.652,0.013,0.662,0.127,0.662,0.268 C0.662,0.409,0.652,0.524,0.639,0.524 H0.63 M0.63,0.144 H0.63 V0.145 V0.392 V0.393 H0.63 L0.639,0.393 C0.645,0.393,0.65,0.337,0.65,0.268 C0.65,0.199,0.645,0.144,0.639,0.144 L0.63,0.144 M0.713,0.013 H0.728 L0.698,0.502 L0.698,0.502 L0.698,0.503 L0.728,0.992 H0.713 L0.688,0.568 L0.688,0.568 H0.688 H0.683 H0.683 V0.569 V0.992 L0.671,0.992 V0.013 L0.683,0.013 V0.436 V0.437 H0.683 H0.688 H0.688 L0.688,0.437 L0.713,0.013 M0.57,0.807 H0.57 L0.57,0.808 L0.567,0.992 H0.555 L0.572,0.013 H0.597 L0.614,0.992 H0.602 L0.599,0.808 L0.599,0.807 H0.599 H0.57 M0.572,0.675 L0.572,0.676 H0.573 H0.596 H0.597 L0.597,0.675 L0.587,0.144 L0.587,0.144 H0.587 H0.582 H0.582 L0.582,0.144 L0.572,0.675 M0.554,0.693 C0.554,0.858,0.542,0.992,0.527,0.992 H0.5 V0.013 H0.527 C0.542,0.013,0.554,0.147,0.554,0.311 V0.693 M0.243,0.524 H0.243 V0.525 V0.583 V0.584 L0.243,0.584 L0.28,0.992 H0.263 L0.243,0.77 L0.243,0.769 V0.771 V0.992 H0.231 V0.013 L0.252,0.013 C0.265,0.013,0.275,0.127,0.275,0.268 C0.275,0.409,0.265,0.524,0.252,0.524 H0.243 M0.243,0.144 H0.243 V0.145 V0.392 V0.393 H0.243 L0.252,0.393 C0.258,0.393,0.263,0.337,0.263,0.268 C0.263,0.199,0.258,0.144,0.252,0.144 L0.243,0.144 M0.455,0.013 H0.478 V0.992 H0.466 V0.145 V0.144 H0.466 H0.465 H0.465 L0.465,0.145 L0.45,0.992 H0.428 L0.414,0.145 L0.414,0.144 H0.414 H0.413 H0.413 V0.145 V0.992 H0.401 V0.013 H0.424 L0.438,0.86 L0.438,0.861 H0.438 H0.44 H0.44 L0.44,0.86 L0.455,0.013 M0.383,0.701 V0.305 C0.383,0.211,0.376,0.134,0.367,0.134 C0.359,0.134,0.352,0.211,0.352,0.305 V0.701 C0.352,0.795,0.359,0.872,0.367,0.872 C0.376,0.872,0.383,0.795,0.383,0.701 M0.34,0.305 C0.34,0.138,0.352,0.003,0.367,0.003 C0.383,0.003,0.395,0.138,0.395,0.305 V0.701 C0.395,0.868,0.383,1,0.367,1 C0.352,1,0.34,0.868,0.34,0.701 V0.305 M0.323,0.701 V0.305 C0.323,0.211,0.316,0.134,0.307,0.134 C0.299,0.134,0.292,0.211,0.292,0.305 V0.701 C0.292,0.795,0.299,0.872,0.307,0.872 C0.316,0.872,0.323,0.795,0.323,0.701 M0.28,0.305 C0.28,0.138,0.292,0.003,0.307,0.003 C0.322,0.003,0.335,0.138,0.335,0.305 V0.701 C0.335,0.868,0.322,1,0.307,1 C0.292,1,0.28,0.868,0.28,0.701 V0.305 M0.743,0.524 H0.743 V0.525 V0.583 V0.584 L0.743,0.584 L0.78,0.992 H0.763 L0.743,0.77 L0.743,0.769 V0.771 V0.992 H0.731 V0.013 L0.752,0.013 C0.765,0.013,0.775,0.127,0.775,0.268 C0.775,0.409,0.765,0.524,0.752,0.524 H0.743 M0.743,0.144 H0.743 V0.145 V0.392 V0.393 H0.743 L0.752,0.393 C0.758,0.393,0.763,0.337,0.763,0.268 C0.763,0.199,0.758,0.144,0.752,0.144 L0.743,0.144 M0.955,0.013 H0.978 V0.992 H0.966 V0.145 V0.144 H0.966 H0.965 H0.965 L0.965,0.145 L0.95,0.992 H0.928 L0.914,0.145 L0.914,0.144 H0.914 H0.913 H0.913 V0.145 V0.992 H0.901 V0.013 H0.924 L0.938,0.86 L0.938,0.861 H0.938 H0.94 H0.94 L0.94,0.86 L0.955,0.013 M0.883,0.701 V0.305 C0.883,0.211,0.876,0.134,0.867,0.134 C0.859,0.134,0.852,0.211,0.852,0.305 V0.701 C0.852,0.795,0.859,0.872,0.867,0.872 C0.876,0.872,0.883,0.795,0.883,0.701 M0.84,0.305 C0.84,0.138,0.852,0.003,0.867,0.003 C0.883,0.003,0.895,0.138,0.895,0.305 V0.701 C0.895,0.868,0.883,1,0.867,1 C0.852,1,0.84,0.868,0.84,0.701 V0.305 M0.823,0.701 V0.305 C0.823,0.211,0.816,0.134,0.807,0.134 C0.799,0.134,0.792,0.211,0.792,0.305 V0.701 C0.792,0.795,0.799,0.872,0.807,0.872 C0.816,0.872,0.823,0.795,0.823,0.701 M0.78,0.305 C0.78,0.138,0.792,0.003,0.807,0.003 C0.822,0.003,0.835,0.138,0.835,0.305 V0.701 C0.835,0.868,0.822,1,0.807,1 C0.792,1,0.78,0.868,0.78,0.701 V0.305 M1,1 L1,1 H1 V1";

// ── Original constants from CSS ─────────────────────────────────────────────
// clip-anim / color-anim: 20s linear infinite
const MARQUEE_CYCLE_S = 20;
// rail_sizing: 232vw on desktop
const RAIL_WIDTH_VW = 232;
// rail_gradient: 52vw x 52vw
const ORB_SIZE_VW = 52;
// intro-core: 3s cubic-bezier(.04,1.15,0.4,.99) 0.5s forwards
const INTRO_CORE_DELAY_S = 0.5;
const INTRO_CORE_DURATION_S = 3;
// intro-pro: 2.75s cubic-bezier(.04,1.15,0.4,.99) 0.75s forwards
const INTRO_PRO_DELAY_S = 0.75;
const INTRO_PRO_DURATION_S = 2.75;
// float-core: 4s ease-in-out alternate infinite
const FLOAT_CORE_PERIOD_S = 4;
// float-pro: 3s ease-in-out alternate infinite
const FLOAT_PRO_PERIOD_S = 3;

// Gradient orb colors sampled from the original PNGs:
// gradient-core.png: radial blob centered ~#f33c0b, fading through #f4490e to transparent
// gradient-pro.png: radial blob centered ~#682efa, fading through #743af3 to transparent
const GRADIENT_CORE =
  "radial-gradient(circle, #f33c0bff 0%, #f4490edd 25%, #f7641c88 50%, #f7641c22 75%, transparent 100%)";
const GRADIENT_PRO =
  "radial-gradient(circle, #682efaff 0%, #6a27f9dd 25%, #743af388 50%, #763ff622 75%, transparent 100%)";

// Approximate the original cubic-bezier(.04,1.15,0.4,.99) as an overshoot ease-out.
// Remotion's Easing doesn't support arbitrary cubic-bezier, so we use a spring-like
// overshoot curve that behaves similarly (fast initial, overshoots, settles).
function introBezier(t: number): number {
  // cubic-bezier(.04,1.15,0.4,.99) — heavy overshoot, settles near 1
  // Approximate with a shaped power curve that overshoots slightly
  if (t >= 1) return 1;
  const s = 1.0 - t;
  const base = 1.0 - s * s * s;
  const overshoot = Math.sin(t * Math.PI) * 0.08;
  return Math.min(base + overshoot, 1.05);
}

// float-core/float-pro use ease-in-out alternate, so a triangle wave with sine easing
function floatAlternate(timeS: number, periodS: number): number {
  // alternate: 0→1→0→1... with ease-in-out
  const phase = (timeS / periodS) % 2;
  const linear = phase <= 1 ? phase : 2 - phase;
  // ease-in-out approximation
  return 0.5 - 0.5 * Math.cos(linear * Math.PI);
}

export const GlowingMarquee: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const timeS = frame / fps;

  // ── Marquee scroll ────────────────────────────────────────────────────────
  // clip-anim: translateX(0%) → translateX(-50%) over 20s linear infinite
  // color-anim: translateX(0%) → translateX(50%) over 20s linear infinite
  const scrollProgress = (timeS / MARQUEE_CYCLE_S) % 1;
  const clipTranslateXPct = -scrollProgress * 50;
  const colorTranslateXPct = scrollProgress * 50;

  // ── Intro animations ──────────────────────────────────────────────────────
  // Core orb: starts at translate(-7vw, calc(-2.3vw + 100vh)), ends at translate(-7vw, -2.3vw)
  // So it rises from 100vh below its final position.
  const coreIntroT = interpolate(
    timeS,
    [INTRO_CORE_DELAY_S, INTRO_CORE_DELAY_S + INTRO_CORE_DURATION_S],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const coreIntroEased = introBezier(coreIntroT);

  // Pro orb: starts at translate(7vw, calc(5vw + 100vh)), ends at translate(7vw, 5vw)
  const proIntroT = interpolate(
    timeS,
    [INTRO_PRO_DELAY_S, INTRO_PRO_DELAY_S + INTRO_PRO_DURATION_S],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const proIntroEased = introBezier(proIntroT);

  // ── Float animations (only after intro) ───────────────────────────────────
  // float-core: translateY(0%) → translateY(5%) — alternate, 4s
  const floatCoreProgress = floatAlternate(timeS, FLOAT_CORE_PERIOD_S);
  const floatCoreYPct = floatCoreProgress * 5; // 0% to 5%

  // float-pro: translateY(4%) → translateY(0%) — alternate, 3s
  const floatProProgress = floatAlternate(timeS, FLOAT_PRO_PERIOD_S);
  const floatProYPct = 4 - floatProProgress * 4; // 4% to 0%

  // ── Pixel conversions ─────────────────────────────────────────────────────
  const vw = width / 100;
  const railWidthPx = RAIL_WIDTH_VW * vw;
  const orbSizePx = ORB_SIZE_VW * vw;

  // Core orb final position: translate(-7vw, -2.3vw) relative to center of gradients container
  // Start position adds 100vh (= height) to Y
  const coreXPx = -7 * vw;
  const coreYFinalPx = -2.3 * vw;
  const coreYStartPx = coreYFinalPx + height;
  const coreYPx =
    coreYStartPx + (coreYFinalPx - coreYStartPx) * coreIntroEased;

  // Pro orb final position: translate(7vw, 5vw)
  const proXPx = 7 * vw;
  const proYFinalPx = 5 * vw;
  const proYStartPx = proYFinalPx + height;
  const proYPx = proYStartPx + (proYFinalPx - proYStartPx) * proIntroEased;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000", overflow: "hidden" }}>
      {/* SVG defining the clip-path — exact copy from original */}
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          <clipPath id="contentTitle" clipPathUnits="objectBoundingBox">
            <path d={CLIP_PATH_D} />
          </clipPath>
        </defs>
      </svg>

      {/* .content — full viewport, centered */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          overflow: "hidden",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {/* .rail — absolute, full area, flex start */}
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
          {/* .rail_container */}
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* .rail_sizing — invisible spacer establishing dimensions */}
            <svg
              width="5482"
              height="500"
              viewBox="0 0 5482 500"
              fill="none"
              style={{
                position: "relative",
                opacity: 0,
                height: "auto",
                width: railWidthPx,
              }}
            />

            {/* .rail_clip — the clipped scrolling layer */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                width: "100%",
                height: "100%",
                clipPath: 'url(#contentTitle)',
                WebkitClipPath: 'url(#contentTitle)',
                transform: `translateX(${clipTranslateXPct}%)`,
              }}
            >
              {/* .rail_color — counter-scrolls, holds the dark bg + gradient orbs */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  height: "100%",
                  width: "100%",
                  backgroundColor: "#0c0c0e",
                  transform: `translateX(${colorTranslateXPct}%)`,
                }}
              >
                {/* .rail_gradients — centered viewport-width container for the orbs */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backfaceVisibility: "hidden",
                    width: width,
                    height: "100%",
                    position: "relative",
                  }}
                >
                  {/* .rail_gradient.-core */}
                  <div
                    style={{
                      position: "absolute",
                      width: orbSizePx,
                      height: orbSizePx,
                      minWidth: orbSizePx,
                      minHeight: orbSizePx,
                      borderRadius: "50%",
                      background: GRADIENT_CORE,
                      transform: `translate(${coreXPx}px, ${coreYPx}px) translateY(${floatCoreYPct}%)`,
                    }}
                  />
                  {/* .rail_gradient.-pro */}
                  <div
                    style={{
                      position: "absolute",
                      width: orbSizePx,
                      height: orbSizePx,
                      minWidth: orbSizePx,
                      minHeight: orbSizePx,
                      borderRadius: "50%",
                      background: GRADIENT_PRO,
                      transform: `translate(${proXPx}px, ${proYPx}px) translateY(${floatProYPct}%)`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* .boxes — the gradient orbs visible OUTSIDE the text (behind/around it) */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            overflow: "hidden",
            pointerEvents: "none",
          }}
        >
          {/* .box.-core — core product box (gradient glow only, no product image) */}
          <div
            style={{
              position: "absolute",
              transform: `translate(${coreXPx}px, ${coreYPx}px)`,
            }}
          >
            <div
              style={{
                position: "relative",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                transform: `translateY(${floatCoreYPct}%)`,
              }}
            >
              {/* .box_gradient — 180% size, 0.4 opacity */}
              <div
                style={{
                  position: "absolute",
                  width: 26 * vw * 1.8,
                  height: 26 * vw * 1.8,
                  borderRadius: "50%",
                  background: GRADIENT_CORE,
                  opacity: 0.4,
                  transform: `translateX(${-2 * vw}px)`,
                }}
              />
            </div>
          </div>

          {/* .box.-pro */}
          <div
            style={{
              position: "absolute",
              transform: `translate(${proXPx}px, ${proYPx}px)`,
            }}
          >
            <div
              style={{
                position: "relative",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                transform: `translateY(${floatProYPct}%)`,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  width: 22 * vw * 1.8,
                  height: 22 * vw * 1.8,
                  borderRadius: "50%",
                  background: GRADIENT_PRO,
                  opacity: 0.4,
                  transform: `translate(${2 * vw}px, ${2 * vw}px)`,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
