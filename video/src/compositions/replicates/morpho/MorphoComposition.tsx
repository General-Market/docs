import React from "react";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { CameraMotionBlur } from "@remotion/motion-blur";
import {
  butterflyPath,
  featherPath,
  poweredByMorphoPath,
  robinhoodEarnPath,
  type PathAsset,
} from "./paths";

// Renders a traced path asset scaled into width×height.
const Vec: React.FC<{
  p: PathAsset;
  width: number;
  height: number;
  fill?: string;
  opacity?: number;
}> = ({ p, width, height, fill = "#f7f8f8", opacity = 1 }) => (
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
const ButterflyLogo: React.FC<LogoProps> = (props) => <Vec p={butterflyPath} {...props} />;
const RobinhoodEarnText: React.FC<LogoProps> = (props) => (
  <Vec p={robinhoodEarnPath} {...props} />
);
const PoweredByMorphoText: React.FC<LogoProps> = (props) => (
  <Vec p={poweredByMorphoPath} {...props} />
);

// Robinhood Earn × Morpho partnership sting — 1:1 replicate.
// Reference: 720×720 @ 30fps, 510 frames, has audio (audio omitted).
// SCOPE: the phone-mockup segment (frames 111–488) is rendered as ENVIRONMENT
// ONLY — background + glow — per the scoping rule; the device and its screen
// are omitted. In-scope, fully rebuilt: intro assemble [0,110] + outro [489,509].
//
// All keyframe arrays are measured per-frame from the source (HSV component
// tracking + brightness-profile grid detection + edge-energy blur probing).

export const FPS = 30;
export const DURATION = 510;
const W = 720;
const H = 720;

// Pill (settled, merged badge) geometry — measured on frame 42.
const PILL_CX = 358;
const PILL_CY = 355;
const PILL_W = 452;
const PILL_H = 294;
const PILL_R = 46; // outer corner radius

// Badge (small top pill) = the settled pill scaled ~0.252, risen to (356,108).
const BADGE_SCALE = 0.252;
const BADGE_CY = 108;

const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

// ————— background —————
// Radial gradient: saturated-blue centre → lighter blue corners (measured).
const BG_GRADIENT =
  "radial-gradient(circle at 50% 50%, rgb(48,120,250) 0%, rgb(60,131,248) 30%, rgb(80,147,245) 56%, rgb(115,176,238) 100%)";

const Background: React.FC = () => (
  <AbsoluteFill style={{ background: BG_GRADIENT }}>
    {/* faint square grid, pitch ~33.3px (measured amplitude ~5 grey levels) */}
    <AbsoluteFill
      style={{
        backgroundImage:
          "repeating-linear-gradient(0deg, rgba(255,255,255,0.055) 0 1px, transparent 1px 33.3px)," +
          "repeating-linear-gradient(90deg, rgba(255,255,255,0.055) 0 1px, transparent 1px 33.3px)",
        backgroundPosition: "0 10px, 10px 0",
      }}
    />
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

// ————— glass surfaces —————
// Near-clear glass: deep-blue bg shows through the centre; a bright highlight
// sits in the top-left corner and a softer sheen in the bottom-right, with a
// bright rim (border + inset). Measured: pill-centre stays ~deep bg, top-left
// corner ~+40 lighter.
const GLASS_FILL =
  "linear-gradient(165deg, rgba(255,255,255,0.44) 0%, rgba(255,255,255,0.21) 34%, rgba(255,255,255,0.10) 70%, rgba(255,255,255,0.15) 100%)";
const GLASS_BORDER = "1.4px solid rgba(255,255,255,0.6)";
const GLASS_SHADOW =
  "0 8px 34px rgba(120,170,255,0.34), inset 0 1.5px 3px rgba(255,255,255,0.5), inset 0 -1px 3px rgba(255,255,255,0.18)";

// Native (source-pixel) placement inside the pill div (pill top-left = 0,0).
// Measured on frame 42: feather ink 195,278 ; butterfly 400,295 ; divider x357.
const F_L = 63, F_T = 70, F_W = 130, F_H = 140; // feather box
const B_L = 268, B_T = 87, B_W = 128, B_H = 117; // butterfly box
const DIV_L = 225, DIV_T = 69, DIV_H = 153; // divider

// The merged pill: feather | divider | butterfly, drawn at base size.
const Pill: React.FC = () => (
  <div
    style={{
      position: "absolute",
      left: -PILL_W / 2,
      top: -PILL_H / 2,
      width: PILL_W,
      height: PILL_H,
      borderRadius: PILL_R,
      background: GLASS_FILL,
      border: GLASS_BORDER,
      boxShadow: GLASS_SHADOW,
    }}
  >
    <div style={{ position: "absolute", left: F_L, top: F_T, width: F_W, height: F_H }}>
      <FeatherLogo width={F_W} height={F_H} />
    </div>
    <div
      style={{
        position: "absolute",
        left: DIV_L,
        top: DIV_T,
        width: 2,
        height: DIV_H,
        background: "rgba(255,255,255,0.5)",
        borderRadius: 1,
      }}
    />
    <div style={{ position: "absolute", left: B_L, top: B_T, width: B_W, height: B_H }}>
      <ButterflyLogo width={B_W} height={B_H} />
    </div>
  </div>
);

// The rounded-square glass tile of a fly-in card (logo drawn separately, so it
// can sit offset toward the card's outer corner — as measured in the source).
const GlassTile: React.FC<{ size: number }> = ({ size }) => (
  <div
    style={{
      position: "absolute",
      left: -size / 2,
      top: -size / 2,
      width: size,
      height: size,
      borderRadius: size * 0.14,
      background: GLASS_FILL,
      border: GLASS_BORDER,
      boxShadow: GLASS_SHADOW,
    }}
  />
);

// ————— measured assemble curves (intro virtual-frame domain vf ∈ [0,60]) —————
// vf=0 : two cards at the corners, axis −49°, half-separation 330px
// vf≈20: cards slam together, axis −19° → merged pill appears
// vf≈42: pill level, settled at centre
// vf 46→60: pill shrinks ×0.252 and rises to the top badge
// Position axis — the direction along which the two cards are separated.
// Measured (feather↔butterfly centre line): −52° at vf0 easing to 0 at merge.
const axisAngleAt = (vf: number) =>
  interpolate(
    vf,
    [0, 6, 12, 16, 18, 20, 21, 24, 27, 30, 36, 42],
    [-52, -50, -44, -38, -32, -22, -14.2, -8.1, -4.7, -2.8, -0.6, 0],
    clamp,
  );
// Card tilt — decoupled from and GENTLER than the position axis: the cards
// ride far more upright than the line they travel along. Measured: −40° at
// vf0 (card edge), −22° at vf12, −13° at vf18, straightening to 0 at merge.
const cardRotAt = (vf: number) =>
  interpolate(
    vf,
    [0, 6, 12, 18, 21, 30, 42],
    [-40, -33, -22, -13, -8, -3, 0],
    clamp,
  );
const halfSepAt = (vf: number) =>
  interpolate(
    vf,
    [0, 6, 9, 12, 15, 18, 20, 21],
    [366, 352, 300, 268, 248, 224, 165, 113],
    clamp,
  );
const flyCardSizeAt = (vf: number) =>
  interpolate(vf, [0, 9, 18, 21], [452, 450, 434, 258], clamp);
const flyLogoScaleAt = (vf: number) =>
  interpolate(vf, [0, 12, 21], [1.9, 1.7, 1.25], clamp);
// Logo sits offset from the glass-tile centre toward the OUTER corner (along
// the separation axis). Measured ~130px out at vf18 for a 434px tile; tapers
// to near-nothing as the two logos fold into the merged pill.
const logoOffAt = (vf: number) =>
  interpolate(vf, [0, 9, 18, 21], [150, 145, 130, 40], clamp);

// Pill scale + centre-Y across settle (21→42) and badge-rise (42→60).
const pillScaleAt = (vf: number) =>
  interpolate(
    vf,
    [21, 24, 27, 30, 36, 42, 46, 50, 54, 58, 60],
    [1.16, 1.09, 1.05, 1.02, 1.006, 1.0, 1.0, 0.78, 0.5, 0.3, BADGE_SCALE],
    clamp,
  );
const pillCenterYAt = (vf: number) =>
  interpolate(
    vf,
    [21, 42, 46, 50, 54, 58, 60],
    [PILL_CY, PILL_CY, PILL_CY, 302, 232, 140, BADGE_CY],
    clamp,
  );
const pillRotAt = (vf: number) =>
  interpolate(
    vf,
    [21, 24, 27, 30, 36, 42],
    [-14.2, -8.1, -4.7, -2.8, -0.6, 0],
    clamp,
  );

// Renders the two fly-in cards for a given virtual frame + a fade weight.
const FlyCards: React.FC<{ vf: number; opacity: number }> = ({
  vf,
  opacity,
}) => {
  if (opacity <= 0) return null;
  const angle = axisAngleAt(vf); // position axis (steeper)
  const cardRot = cardRotAt(vf); // card tilt (gentler)
  const sep = halfSepAt(vf);
  const size = flyCardSizeAt(vf);
  const ls = flyLogoScaleAt(vf);
  const logoOff = logoOffAt(vf);
  const rad = (angle * Math.PI) / 180;
  const ux = Math.cos(rad);
  const uy = Math.sin(rad);
  const unit = (
    sign: number,
    Logo: React.FC<{ width: number; height: number }>,
    lw: number,
    lh: number,
  ) => {
    // glass tile centred on the position axis; logo pushed further out.
    const gx = PILL_CX + sign * ux * sep;
    const gy = PILL_CY + sign * uy * sep;
    const lx = PILL_CX + sign * ux * (sep + logoOff);
    const ly = PILL_CY + sign * uy * (sep + logoOff);
    return (
      <React.Fragment>
        <div
          style={{
            position: "absolute",
            left: gx,
            top: gy,
            transform: `rotate(${cardRot}deg)`,
          }}
        >
          <GlassTile size={size} />
        </div>
        <div
          style={{
            position: "absolute",
            left: lx,
            top: ly,
            transform: `translate(-50%, -50%) rotate(${cardRot}deg)`,
          }}
        >
          {/* logo rides with the card frame (measured: logo tilt ≈ card tilt) */}
          <Logo width={lw * ls} height={lh * ls} />
        </div>
      </React.Fragment>
    );
  };
  return (
    <div style={{ opacity }}>
      {/* feather = local −x (screen bottom-left) ; butterfly = local +x (top-right) */}
      {unit(-1, FeatherLogo, 130, 140)}
      {unit(1, ButterflyLogo, 128, 117)}
    </div>
  );
};

// Renders the merged pill for a given virtual frame + fade weight.
const PillStage: React.FC<{ vf: number; opacity: number }> = ({
  vf,
  opacity,
}) => {
  if (opacity <= 0) return null;
  const scale = pillScaleAt(vf);
  const cy = pillCenterYAt(vf);
  const rot = pillRotAt(vf);
  return (
    <div
      style={{
        position: "absolute",
        left: PILL_CX,
        top: cy,
        transform: `rotate(${rot}deg) scale(${scale})`,
        opacity,
      }}
    >
      <Pill />
    </div>
  );
};

// ————— text —————
const TextBlock: React.FC<{ frame: number }> = ({ frame }) => {
  const opacity = interpolate(
    frame,
    [56, 72, 114, 121],
    [0, 1, 1, 0],
    clamp,
  );
  if (opacity <= 0) return null;
  const blur = interpolate(frame, [56, 68], [3, 0], clamp);
  return (
    <div style={{ opacity, filter: `blur(${blur}px)` }}>
      {/* line 1 "Robinhood Earn" — lime-gold, measured #dffd7a from source (bbox x173–543 y310) */}
      <div style={{ position: "absolute", left: 173, top: 310, width: 370, height: 41 }}>
        <RobinhoodEarnText width={370} height={41} fill="#dffd7a" opacity={0.96} />
      </div>
      {/* line 2 "Powered by Morpho" — lighter / more transparent */}
      <div style={{ position: "absolute", left: 125, top: 374, width: 466, height: 49 }}>
        <PoweredByMorphoText width={466} height={49} fill="#eaf1fb" opacity={0.62} />
      </div>
    </div>
  );
};

// ————— the animated stage (function of absolute frame) —————
const Stage: React.FC<{ frameOffset: number }> = ({ frameOffset }) => {
  const f = useCurrentFrame() + frameOffset;

  // INTRO assemble [0,60]: fly-in cards → merged pill → badge rise.
  const introFly = f <= 24;
  const introPill = f >= 18 && f <= 121;
  // hand fly-cards → pill over frames 18→20: at f18 the source still shows two
  // tiles with a hairline seam, at f20 it is a single solid pill. A short 2-frame
  // hand-off (one blended frame at f19, smeared by the motion blur) keeps the
  // pill from washing out — a long crossfade ghosts the two pale layers.
  const flyFade = interpolate(f, [18, 20], [1, 0], clamp);
  const pillFadeIn = interpolate(f, [18, 20], [0, 1], clamp);
  const badgeFadeOut = interpolate(f, [113, 121], [1, 0], clamp);

  // OUTRO [489,509] = retimed reverse of the intro assemble.
  const inOutro = f >= 488;
  // virtual intro-frame for the outro pill (42=settled … 19=splitting)
  const outroPillVf = interpolate(f, [490, 496], [42, 19], clamp);
  const outroPillOpacity =
    interpolate(f, [488, 492], [0, 1], clamp) *
    interpolate(f, [496, 498], [1, 0], clamp);
  // virtual intro-frame for the outro fly-out cards (19=just split … 0=corners).
  // Front-loaded: cards separate FAST right after the split (measured: by f504
  // they are near-max apart at a −40° tilt), matching the reverse of the
  // front-loaded intro close.
  const outroCardsVf = interpolate(
    f,
    [496, 499, 502, 505, 509],
    [19, 9, 4, 1.5, 0],
    clamp,
  );
  const outroCardsOpacity = interpolate(f, [496, 498], [0, 1], clamp);

  return (
    <AbsoluteFill>
      <Background />
      {/* INTRO */}
      {!inOutro && introFly && <FlyCards vf={f} opacity={flyFade} />}
      {!inOutro && introPill && (
        <PillStage
          vf={f}
          opacity={(f < 20 ? pillFadeIn : 1) * badgeFadeOut}
        />
      )}
      {!inOutro && <TextBlock frame={f} />}
      {/* OUTRO (reverse) */}
      {inOutro && (
        <>
          <PillStage vf={outroPillVf} opacity={outroPillOpacity} />
          <FlyCards vf={outroCardsVf} opacity={outroCardsOpacity} />
        </>
      )}
    </AbsoluteFill>
  );
};

export const MorphoComposition: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#2f76f8" }}>
      {/* Intro motion — real motion blur through the fast fuse (matches the
          smear the source itself carries; samples raised for a smoother kernel) */}
      <Sequence from={0} durationInFrames={46} layout="none">
        <CameraMotionBlur samples={8} shutterAngle={180}>
          <Stage frameOffset={0} />
        </CameraMotionBlur>
      </Sequence>
      {/* Static middle — badge, text, phone-scene environment (device omitted) */}
      <Sequence from={46} durationInFrames={443} layout="none">
        <Stage frameOffset={46} />
      </Sequence>
      {/* Outro fly-apart — real motion blur (matches the intro fuse) */}
      <Sequence from={489} layout="none">
        <CameraMotionBlur samples={8} shutterAngle={180}>
          <Stage frameOffset={489} />
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
