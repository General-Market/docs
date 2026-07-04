import React from "react";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { CameraMotionBlur } from "@remotion/motion-blur";
import {
  butterflyBrightPath,
  butterflyPath,
  featherPath,
  poweredByMorphoPath,
  robinhoodEarnPath,
  type PathAsset,
} from "./paths";

// Robinhood Earn × Morpho partnership sting — 1:1 replicate.
// Reference: 720×720 @ 30fps, 510 frames, has audio (audio omitted).
// SCOPE: the phone-mockup segment (frames 118–485) is rendered as ENVIRONMENT
// ONLY — background — per the scoping rule; the device and its screen are
// omitted. In-scope, fully rebuilt: intro assemble [0,117] + outro [486,509].
//
// Every keyframe table below is measured per-frame from the source:
// background-difference masks (minAreaRect center/dims/angle), logo-ink PCA
// tilt, connected-component logo centroids, edge-gradient blur widths, and
// interior transfer-function fits (seen-vs-background linear regression).
// Key measured facts this build encodes:
//  · one rotation curve drives cards, logos and capsule (-51.3° → 0);
//  · the merge is an anisotropic capsule squash 752×412@-18.4° → 452×294@0°;
//  · glass interiors are CLEAR (bg shows through exactly) + inner edge glow
//    (~40px falloff) + 2px rim — no white-wash fill, no outer drop shadow;
//  · fly-in cards additionally carry an opaque deep-blue directional fill
//    (light toward the facing edge — the source's refraction look);
//  · the butterfly's lower wings are tinted rgb(211,227,252), uppers white;
//  · the outro pill is REBORN small (scale .36 @f486.5) and grows while
//    rotating, splits at f495.6, and the cards retrace the intro poses
//    (f509 lands exactly on the f0 pose) with logos starting at ~0.78×.

export const FPS = 30;
export const DURATION = 510;
const W = 720;
const H = 720;

const CX = 358; // pill / orbit centre x
const ORBIT_CY = 355; // fly-in orbit centre y
const PW = 452; // settled pill width
const PH = 294; // settled pill height
const PILL_R = 46; // settled pill corner radius

const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

// ————— vector assets —————
const Vec: React.FC<{
  p: PathAsset;
  width: number;
  height: number;
  fill?: string;
  opacity?: number;
}> = ({ p, width, height, fill = "#fdfdfd", opacity = 1 }) => (
  <svg
    width={width}
    height={height}
    viewBox={`0 0 ${p.vw} ${p.vh}`}
    style={{ display: "block", opacity }}
  >
    <g transform={p.tf} fill={fill} stroke="none">
      <path d={p.d} />
    </g>
  </svg>
);

type LogoProps = { width: number; height: number; fill?: string; opacity?: number };
const FeatherLogo: React.FC<LogoProps> = (props) => <Vec p={featherPath} {...props} />;
// Two-tone butterfly: full ink in the measured lower-wing tint, pure-white
// upper wings overlaid (traced separately from the source at threshold R>243).
const ButterflyLogo: React.FC<LogoProps> = ({ width, height, opacity = 1 }) => (
  <svg
    width={width}
    height={height}
    viewBox={`0 0 ${butterflyPath.vw} ${butterflyPath.vh}`}
    style={{ display: "block", opacity }}
  >
    <g transform={butterflyPath.tf} fill="rgb(211,227,252)" stroke="none">
      <path d={butterflyPath.d} />
    </g>
    <g transform={butterflyBrightPath.tf} fill="#fdfdfd" stroke="none">
      <path d={butterflyBrightPath.d} />
    </g>
  </svg>
);
const RobinhoodEarnText: React.FC<LogoProps> = (props) => (
  <Vec p={robinhoodEarnPath} {...props} />
);
const PoweredByMorphoText: React.FC<LogoProps> = (props) => (
  <Vec p={poweredByMorphoPath} {...props} />
);

// ————— background —————
// Radial profile measured on the clean frame f489 centre→corner (radius 509):
// deep saturated blue centre, lighter toward corners. Constant across the
// whole video (no hue drift — corners read 115-116,176-178,238-240 at f42,
// f80, f200, f350, f470 alike).
const BG_GRADIENT =
  "radial-gradient(circle at 50% 50%," +
  " rgb(39,113,248) 0%, rgb(47,120,248) 19%, rgb(56,126,248) 38%," +
  " rgb(64,132,249) 47%, rgb(72,139,248) 57%, rgb(82,148,246) 66%," +
  " rgb(93,157,244) 75%, rgb(105,166,242) 85%, rgb(117,179,239) 100%)";

// The grid lives inside a 634×634 square PANEL (edges at x/y 42.5–676.5):
// measured hairline at the panel edge (+6-8 grey), a subtle blue-tint
// interior (α≈0.04 of rgb(0,80,246)), grid pitch 33.35px phase-locked to
// global x=9.2+33.35k, line amplitude ≈ +7 grey (α≈0.07 white). No grid
// outside the panel.
const Background: React.FC = () => (
  <AbsoluteFill style={{ background: BG_GRADIENT }}>
    <div
      style={{
        position: "absolute",
        left: 42.5,
        top: 42.5,
        width: 634,
        height: 634,
        boxSizing: "border-box",
        background: "rgba(0,80,246,0.04)",
        border: "1.5px solid rgba(255,255,255,0.045)",
        overflow: "hidden",
      }}
    >
      <AbsoluteFill
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.07) 0 1px, transparent 1px 33.35px)," +
            "repeating-linear-gradient(90deg, rgba(255,255,255,0.07) 0 1px, transparent 1px 33.35px)",
          backgroundPosition: "0 -1.3px, -1.3px 0",
        }}
      />
    </div>
    {/* high-frequency noise to dither out 8-bit radial-gradient banding */}
    <AbsoluteFill
      style={{
        opacity: 0.05,
        mixBlendMode: "overlay",
        backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(
          "<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>",
        )}")`,
      }}
    />
  </AbsoluteFill>
);

// ————— glass material —————
// Measured on the settled pill (f42): interior IS the background (transfer
// fit slope ≈ 1, offset ≈ 0); a white inner glow hugs the border (α≈0.46 at
// the rim, ~40px falloff + a faint wide tail) and a ~2px rim at α≈0.5.
// No outer drop shadow (bg-diff boundary sits exactly on the border).
const GLASS_GLOW =
  "inset 0 0 44px rgba(255,255,255,0.75), inset 0 0 110px rgba(255,255,255,0.12)";
const GLASS_BORDER = "2px solid rgba(255,255,255,0.52)";

// Fly-in card interior: opaque deep blue, slightly lighter toward the FACING
// edge (plane-fit residual dR = -0.33·along − 54 against clean bg).
const cardFill = (flip: boolean) =>
  `linear-gradient(${flip ? 270 : 90}deg, rgb(54,124,249) 0%, rgb(37,111,247) 50%, rgb(30,104,244) 100%)`;

// ————— measured motion tables —————
const IFR = Array.from({ length: 43 }, (_, i) => i); // f0..f42

// One rotation curve: separation-axis angle = card tilt = logo tilt.
// (butterfly-logo centroid angle f0-19; capsule minAreaRect angle f20-42 —
// the two independent measurements agree to <0.3°.)
const AXIS = [
  -51.3, -51.05, -50.77, -50.43, -50.09, -49.71, -49.28, -48.86, -48.35,
  -47.87, -47.3, -46.7, -45.96, -45.13, -44.17, -42.93, -41.16, -38.33,
  -34.07, -26.17, -18.35, -14.15, -11.45, -9.55, -8.05, -6.9, -5.7, -4.7,
  -4.0, -3.5, -2.7, -2.3, -1.7, -1.3, -1.1, -0.8, -0.4, -0.2, -0.1, -0.05,
  0, 0, 0,
];
const axisAt = (vf: number) => interpolate(vf, IFR, AXIS, clamp);

// Card-centre distance from (358,355): logo-centroid distance − 11 (the
// logos ride ~11px outward of card centre). Near-constant f0-8 (the unit
// only ROTATES first), then collapses.
const CARD_DIST_F = IFR.slice(0, 20);
const CARD_DIST = [
  373.3, 373.6, 373.7, 373.8, 373.9, 373.9, 373.7, 373.2, 371.5, 368.6,
  365.9, 363.0, 359.8, 356.2, 351.9, 344.8, 333.2, 314.9, 285.5, 228,
];
const cardDistAt = (vf: number) => interpolate(vf, CARD_DIST_F, CARD_DIST, clamp);

// Logo ink scale during fly-in (feather ink pixel counts, blur-corrected).
const logoScaleAt = (vf: number) =>
  interpolate(vf, [0, 13, 14, 15, 16, 17, 18, 19], [1.96, 1.94, 1.92, 1.9, 1.85, 1.79, 1.71, 1.5], clamp);

// Merged capsule f20-42 (bg-diff minAreaRect): anisotropic squash.
const CAP_F = IFR.slice(20);
const CAP_W = [
  752, 681, 622, 589, 567, 547, 533, 520, 510, 500, 492, 486, 480, 475,
  470, 466, 463, 459, 458, 457, 456, 454, 452,
];
const CAP_H = [
  412, 384, 368, 359, 350, 340, 336, 331, 328, 320, 318, 315, 312, 309,
  306, 305, 302, 302, 301, 299, 298, 296, 294,
];
const capWAt = (vf: number) => interpolate(vf, CAP_F, CAP_W, clamp);
const capHAt = (vf: number) => interpolate(vf, CAP_F, CAP_H, clamp);
// Logos inside the capsule: proportional placement (fraction of half-width)
// + their own settle scale.
const bRatioAt = (vf: number) =>
  interpolate(vf, [20, 22, 24, 28, 34, 42], [0.497, 0.489, 0.48, 0.474, 0.47, 0.469], clamp);
const fRatioAt = (vf: number) =>
  interpolate(vf, [20, 22, 24, 30, 42], [0.481, 0.471, 0.459, 0.445, 0.434], clamp);
const capLogoScaleAt = (vf: number) =>
  interpolate(vf, [20, 21, 22, 23, 24, 26, 28], [1.2, 1.13, 1.085, 1.055, 1.03, 1.01, 1.0], clamp);

// Pill centre-y and uniform scale through settle + badge rise (settles as a
// 115×75 badge at (358,111) by f72 — measured, much later/slower than a
// naive ease).
const PILL_CY_F = [20, 30, 38, 40, 42, 44, 46, 48, 50, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 66, 68, 70, 72];
const PILL_CY = [361, 360, 359, 356, 353, 349, 343, 334, 322, 305, 293, 275, 225, 187, 167, 156, 147, 140, 135, 131, 128, 125, 118, 114, 112, 111];
const pillCyAt = (f: number) => interpolate(f, PILL_CY_F, PILL_CY, clamp);
const PILL_S_F = [42, 44, 46, 48, 50, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 66, 68, 70, 72];
const PILL_S = [1, 0.99, 0.976, 0.963, 0.945, 0.9, 0.865, 0.812, 0.71, 0.555, 0.515, 0.465, 0.4, 0.365, 0.343, 0.325, 0.31, 0.29, 0.273, 0.259, 0.2555, 0.2544];
const pillScaleAt = (f: number) => interpolate(f, PILL_S_F, PILL_S, clamp);

// Badge exit: slides UP accelerating while fading (bbox top 62→40 f110-116,
// npix collapse f114-118).
const badgeExitYAt = (f: number) =>
  interpolate(f, [109, 110, 111, 112, 113, 114, 115, 116, 117, 118], [0, -2, -6, -11, -17, -24, -33, -45, -60, -80], clamp);
const badgeExitOpacityAt = (f: number) =>
  interpolate(f, [113, 114, 115, 116, 117, 118], [1, 0.8, 0.55, 0.3, 0.1, 0], clamp);

// ————— the merged pill / capsule —————
const Capsule: React.FC<{
  cx: number;
  cy: number;
  w: number;
  h: number;
  rot: number;
  scale?: number;
  opacity?: number;
  logoS?: number; // logo ink scale (1 = settled)
  bDist?: number; // butterfly centre distance (local +x)
  fDist?: number; // feather centre distance (local −x)
  tipGlow?: number; // fresh-merge residual glow at the capsule ends (f20-25)
}> = ({ cx, cy, w, h, rot, scale = 1, opacity = 1, logoS = 1, bDist, fDist, tipGlow = 0 }) => {
  if (opacity <= 0) return null;
  const hs = h / PH;
  const bd = bDist ?? 106;
  const fd = fDist ?? 98;
  const r = PILL_R * hs;
  const divH = 153 * hs;
  const fw = 130 * logoS;
  const fh = 140 * logoS;
  const bw = 128 * logoS;
  const bh = 117 * logoS;
  return (
    <div
      style={{
        position: "absolute",
        left: cx,
        top: cy,
        transform: `rotate(${rot}deg) scale(${scale})`,
        opacity,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: -w / 2,
          top: -h / 2,
          width: w,
          height: h,
          borderRadius: r,
          border: GLASS_BORDER,
          boxShadow: GLASS_GLOW,
          overflow: "hidden",
        }}
      >
        {tipGlow > 0 && (
          <>
            <div
              style={{
                position: "absolute",
                left: -w * 0.1,
                top: 0,
                width: w * 0.3,
                height: h,
                background:
                  "radial-gradient(ellipse 50% 50% at 30% 50%, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 70%)",
                opacity: tipGlow,
              }}
            />
            <div
              style={{
                position: "absolute",
                right: -w * 0.1,
                top: 0,
                width: w * 0.3,
                height: h,
                background:
                  "radial-gradient(ellipse 50% 50% at 70% 50%, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 70%)",
                opacity: tipGlow,
              }}
            />
          </>
        )}
      </div>
      {/* divider — measured rgb(233,242,255) core ⇒ white at α≈0.9 */}
      <div
        style={{
          position: "absolute",
          left: -1.9,
          top: -divH / 2,
          width: 3,
          height: divH,
          background: "rgba(255,255,255,0.9)",
          borderRadius: 1.5,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: -fd - fw / 2,
          top: -6.5 * hs - fh / 2,
          width: fw,
          height: fh,
        }}
      >
        <FeatherLogo width={fw} height={fh} />
      </div>
      <div
        style={{
          position: "absolute",
          left: bd - bw / 2,
          top: -1.5 * hs - bh / 2,
          width: bw,
          height: bh,
        }}
      >
        <ButterflyLogo width={bw} height={bh} />
      </div>
    </div>
  );
};

// ————— the two fly-in / fly-out cards —————
const FlyCards: React.FC<{
  vf: number;
  opacity?: number;
  logoMul?: number; // outro logos start ~0.78× their intro-equivalent
}> = ({ vf, opacity = 1, logoMul = 1 }) => {
  if (opacity <= 0) return null;
  const axis = axisAt(vf);
  const dist = cardDistAt(vf);
  const ls = logoScaleAt(vf) * logoMul;
  const rad = (axis * Math.PI) / 180;
  const ux = Math.cos(rad);
  const uy = Math.sin(rad);
  const size = 452;
  const unit = (
    sign: number,
    Logo: React.FC<LogoProps>,
    lw: number,
    lh: number,
  ) => {
    const gx = CX + sign * ux * dist;
    const gy = ORBIT_CY + sign * uy * dist;
    // Logo-in-card offsets (card-local, scaled by logo scale): the butterfly
    // sits ~11.5px outward on the axis; the feather rides further out AND
    // ~9px/unit up-left of the mirror point (measured at f8, f19, f505).
    const lox = sign > 0 ? 11.5 : -5 * ls;
    const loy = sign > 0 ? 0 : -9 * ls;
    const lx = gx + lox * ux - loy * uy;
    const ly = gy + lox * uy + loy * ux;
    // Facing-edge light band — uniform along the edge (measured 25px inside:
    // α≈0.30 across the whole edge). The inset glass glow already supplies
    // ~0.13 near the edge, so this band adds only the measured difference,
    // reaching ~140px into the card. A narrow spill sits beyond the edge.
    return (
      <React.Fragment>
        <div
          style={{
            position: "absolute",
            left: gx,
            top: gy,
            transform: `rotate(${axis}deg)`,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: -size / 2,
              top: -size / 2,
              width: size,
              height: size,
              borderRadius: size * 0.14,
              background: cardFill(sign < 0),
              border: GLASS_BORDER,
              boxShadow: GLASS_GLOW,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: sign > 0 ? 0 : size - 140,
                top: 0,
                width: 140,
                height: size,
                background: `linear-gradient(${sign > 0 ? 90 : 270}deg, rgba(255,255,255,0.19) 0%, rgba(255,255,255,0.15) 30%, rgba(255,255,255,0.07) 60%, rgba(255,255,255,0) 100%)`,
              }}
            />
          </div>
          <div
            style={{
              position: "absolute",
              left: sign > 0 ? -size / 2 - 64 : size / 2,
              top: -190,
              width: 64,
              height: 380,
              background: `linear-gradient(${sign > 0 ? 270 : 90}deg, rgba(255,255,255,0.34), rgba(255,255,255,0))`,
            }}
          />
        </div>
        <div
          style={{
            position: "absolute",
            left: lx,
            top: ly,
            transform: `translate(-50%, -50%) rotate(${axis}deg)`,
          }}
        >
          <Logo width={lw * ls} height={lh * ls} />
        </div>
      </React.Fragment>
    );
  };
  return (
    <div style={{ opacity }}>
      {/* feather = −axis side (bottom-left) ; butterfly = +axis side (top-right) */}
      {unit(-1, FeatherLogo, 130, 140)}
      {unit(1, ButterflyLogo, 128, 117)}
    </div>
  );
};

// ————— text —————
// Both lines ENTER sliding up ~18px while fading (title f60-71, subtitle lags
// ~3 frames) and EXIT sliding up accelerating while fading (title f112-118,
// subtitle f113-119). Settled ink boxes: title (176,314)-(539,348), subtitle
// (128,376)-(588,420). All measured per-frame on thresholded ink.
const TextBlock: React.FC<{ frame: number }> = ({ frame }) => {
  const f = frame;
  const titleOp =
    interpolate(f, [60, 61, 62, 63, 65, 67, 70], [0, 0.1, 0.45, 0.75, 0.85, 0.93, 1], clamp) *
    interpolate(f, [113, 114, 116, 117, 118], [1, 0.9, 0.7, 0.15, 0], clamp);
  const titleY =
    interpolate(f, [60, 61, 62, 63, 64, 65, 66, 67, 70], [20, 18, 14, 10, 8, 6, 4, 2, 0], clamp) +
    interpolate(f, [112, 113, 114, 115, 116, 117, 118], [0, -2, -4, -6, -10, -18, -30], clamp);
  const subOp =
    interpolate(f, [63, 64, 65, 66, 67, 69, 71], [0, 0.22, 0.6, 0.84, 0.9, 0.97, 1], clamp) *
    interpolate(f, [115, 116, 117, 118, 119], [1, 0.95, 0.9, 0.5, 0], clamp);
  const subY =
    interpolate(f, [63, 64, 65, 66, 67, 68, 70, 72, 75], [17, 15, 12, 9, 7, 5, 3, 1, 0], clamp) +
    interpolate(f, [113, 114, 115, 116, 117, 118, 119], [0, -1, -3, -6, -10, -16, -26], clamp);
  const blur = interpolate(f, [60, 72], [2.5, 0], clamp);
  if (titleOp <= 0 && subOp <= 0) return null;
  return (
    <div style={{ filter: blur > 0.05 ? `blur(${blur}px)` : undefined }}>
      {titleOp > 0 && (
        <div
          style={{
            position: "absolute",
            left: 173,
            top: 310 + titleY,
            width: 370,
            height: 41,
            opacity: titleOp,
          }}
        >
          <RobinhoodEarnText width={370} height={41} fill="#dffd7a" />
        </div>
      )}
      {subOp > 0 && (
        <div
          style={{
            position: "absolute",
            left: 125,
            top: 374 + subY,
            width: 466,
            height: 49,
            opacity: subOp,
          }}
        >
          <PoweredByMorphoText width={466} height={49} fill="#fbfdff" opacity={0.97} />
        </div>
      )}
    </div>
  );
};

// ————— outro tables —————
// The pill is reborn SMALL at centre (~scale .36, fading in f486.5-490),
// grows while rotating, stretches into a capsule f494-495.6, then the cards
// retrace the intro poses: f509 lands exactly on the f0 pose.
// Scale re-measured per frame via the top-rim position against clean bg
// (the earlier bg-diff widths were unions with the faint f489 ghost).
const outroPillScaleAt = (f: number) =>
  interpolate(
    f,
    [486.8, 487, 488, 489, 490, 491, 492, 493, 494],
    [0.28, 0.299, 0.333, 0.367, 0.408, 0.463, 0.531, 0.626, 0.748],
    clamp,
  );
const outroPillRotAt = (f: number) =>
  interpolate(
    f,
    [486.5, 487, 488, 489, 490, 491, 492, 493, 494],
    [-2.8, -3.0, -3.4, -3.8, -5.2, -6.5, -8.2, -10.4, -13.8],
    clamp,
  );
const outroPillCyAt = (f: number) =>
  interpolate(f, [494, 495.6], [350, 347], clamp);
// Outro card virtual-frame map (fit on measured axis angle + distance).
const outroVfAt = (f: number) =>
  interpolate(
    f,
    [495.6, 496, 497, 498, 499, 500, 501, 502, 503, 504, 505, 506, 507, 508, 509],
    [19.0, 18.7, 17.5, 16.0, 14.5, 13.0, 11.2, 9.8, 8.5, 5.8, 4.2, 3.0, 2.0, 1.0, 0.0],
    clamp,
  );
const outroLogoMulAt = (f: number) =>
  interpolate(f, [495.6, 497, 499, 501, 503, 505], [0.78, 0.8, 0.89, 0.94, 0.98, 1.0], clamp);

// ————— the animated stage (function of absolute frame) —————
const Stage: React.FC<{ frameOffset: number }> = ({ frameOffset }) => {
  const f = useCurrentFrame() + frameOffset;

  if (f < 486) {
    // INTRO: fly-in cards → capsule squash → badge rise → text.
    const showCards = f < 19.5;
    const showPill = f >= 19.5 && f <= 118;
    return (
      <AbsoluteFill>
        <Background />
        {showCards && <FlyCards vf={f} />}
        {showPill && (
          <Capsule
            cx={CX}
            cy={pillCyAt(f) + badgeExitYAt(f)}
            w={capWAt(f)}
            h={capHAt(f)}
            rot={axisAt(f)}
            scale={pillScaleAt(f)}
            opacity={badgeExitOpacityAt(f)}
            logoS={capLogoScaleAt(f)}
            bDist={bRatioAt(f) * capWAt(f) * 0.5}
            fDist={fRatioAt(f) * capWAt(f) * 0.5}
            tipGlow={interpolate(f, [20, 25], [0.3, 0], clamp)}
          />
        )}
        <TextBlock frame={f} />
      </AbsoluteFill>
    );
  }

  // OUTRO
  const pillPhase = f < 494;
  const stretchPhase = f >= 494 && f < 495.6;
  const cardPhase = f >= 495.6;
  // rim-intensity ramp measured f487-491 (rim R 110→144)
  const pillOp = interpolate(f, [486.6, 487, 488, 490, 491], [0.3, 0.65, 0.8, 0.9, 1], clamp);
  return (
    <AbsoluteFill>
      <Background />
      {pillPhase && (
        <Capsule
          cx={CX}
          cy={outroPillCyAt(f)}
          w={PW}
          h={PH}
          rot={outroPillRotAt(f)}
          scale={outroPillScaleAt(f)}
          opacity={pillOp}
          logoS={0.9}
          bDist={106 * 1.2}
          fDist={98 * 1.2}
        />
      )}
      {stretchPhase && (
        <Capsule
          cx={CX}
          cy={outroPillCyAt(f)}
          w={interpolate(f, [494, 495, 495.6], [338, 514, 600], clamp)}
          h={interpolate(f, [494, 495, 495.6], [220, 272, 292], clamp)}
          rot={interpolate(f, [494, 495, 495.6], [-13.8, -19.9, -25.5], clamp)}
          logoS={interpolate(f, [494, 495, 495.6], [0.673, 0.82, 1.08], clamp)}
          bDist={interpolate(f, [494, 495, 495.6], [100.6, 145, 239], clamp)}
          fDist={interpolate(f, [494, 495, 495.6], [93, 134, 221], clamp)}
        />
      )}
      {cardPhase && <FlyCards vf={outroVfAt(f)} logoMul={outroLogoMulAt(f)} />}
    </AbsoluteFill>
  );
};

export const MorphoComposition: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#2f76f8" }}>
      {/* Intro fuse + badge zip — mild real motion blur. Measured streaks:
          ~8-10px at 68px/frame ⇒ effective shutter ≈ 50-60°, far short of a
          cinematic 180°. */}
      <Sequence from={0} durationInFrames={17} layout="none">
        <CameraMotionBlur samples={8} shutterAngle={40}>
          <Stage frameOffset={0} />
        </CameraMotionBlur>
      </Sequence>
      {/* the fuse — fastest motion, heavier smear */}
      <Sequence from={17} durationInFrames={4} layout="none">
        <CameraMotionBlur samples={12} shutterAngle={120}>
          <Stage frameOffset={17} />
        </CameraMotionBlur>
      </Sequence>
      <Sequence from={21} durationInFrames={31} layout="none">
        <CameraMotionBlur samples={8} shutterAngle={40}>
          <Stage frameOffset={21} />
        </CameraMotionBlur>
      </Sequence>
      {/* badge zip — measured smear ≈14px at 60px/frame */}
      <Sequence from={52} durationInFrames={7} layout="none">
        <CameraMotionBlur samples={10} shutterAngle={100}>
          <Stage frameOffset={52} />
        </CameraMotionBlur>
      </Sequence>
      <Sequence from={59} durationInFrames={3} layout="none">
        <CameraMotionBlur samples={8} shutterAngle={40}>
          <Stage frameOffset={59} />
        </CameraMotionBlur>
      </Sequence>
      {/* Static middle — badge, text, phone-scene environment (device omitted) */}
      <Sequence from={62} durationInFrames={424} layout="none">
        <Stage frameOffset={62} />
      </Sequence>
      {/* Outro rebirth (slow) — light blur */}
      <Sequence from={486} durationInFrames={8} layout="none">
        <CameraMotionBlur samples={8} shutterAngle={50}>
          <Stage frameOffset={486} />
        </CameraMotionBlur>
      </Sequence>
      {/* The violent split — heavy measured smear (trail ≈ 54px at f497) */}
      <Sequence from={494} durationInFrames={4} layout="none">
        <CameraMotionBlur samples={14} shutterAngle={260}>
          <Stage frameOffset={494} />
        </CameraMotionBlur>
      </Sequence>
      <Sequence from={498} durationInFrames={2} layout="none">
        <CameraMotionBlur samples={10} shutterAngle={130}>
          <Stage frameOffset={498} />
        </CameraMotionBlur>
      </Sequence>
      <Sequence from={500} durationInFrames={3} layout="none">
        <CameraMotionBlur samples={10} shutterAngle={120}>
          <Stage frameOffset={500} />
        </CameraMotionBlur>
      </Sequence>
      {/* Cards settling back to the corner pose — light blur */}
      <Sequence from={503} layout="none">
        <CameraMotionBlur samples={8} shutterAngle={40}>
          <Stage frameOffset={503} />
        </CameraMotionBlur>
      </Sequence>
    </AbsoluteFill>
  );
};

export const morphoReplicateMeta = {
  id: "Morpho-Replicate",
  component: MorphoComposition,
  durationInFrames: DURATION,
  fps: FPS,
  width: W,
  height: H,
};
