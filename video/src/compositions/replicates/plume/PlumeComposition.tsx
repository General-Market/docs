import React from "react";
import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { CameraMotionBlur } from "@remotion/motion-blur";
import { FalconXLogoVec, HeadlineVec, PlumeLogoVec } from "./PlumeVectors";

// Plume × FalconX partnership sting — 1:1 replicate.
// Reference: 1920×1080 @ 25fps, 215 frames, no audio.
// All keyframe arrays below are measured per-frame from the source video
// (HSV component tracking + brightness-profile grid detection).

export const FPS = 25;
export const DURATION = 215;
const W = 1920;
const H = 1080;
const CX = W / 2;
const CY = H / 2;

// World geometry (world scale 1 = settled hold at frame 100)
const CELL = 588.5; // vertical grid pitch (x spacing)
const H_CELL = 585; // horizontal grid pitch (y spacing) — source grid is slightly anisotropic
const CARD = 540; // card side
const RED_CENTER = { x: 666, y: 540 };
const BLUE_CENTER = { x: 1258, y: 540 };
const CORNER_R = 18;

const RED_GRAD = "linear-gradient(90deg, #ae2002 0%, #d02602 55%, #ea2b03 100%)";
const BLUE_GRAD = "linear-gradient(90deg, #111a48 0%, #0f173d 55%, #0c1335 100%)";

const clampOpts = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

// ————— measured curves —————

// Grid tilt, degrees (frames 3→26, ease measured from line positions)
const worldRotAt = (f: number) =>
  interpolate(
    f,
    [3, 6, 9, 12, 15, 18, 21, 26],
    [-7.69, -6.28, -4.57, -2.86, -1.43, -0.86, -0.29, 0],
    clampOpts,
  );

// Slow world zoom through the hold: 0.952 → 1.0074 (decelerating)
const driftAt = (f: number) =>
  interpolate(f, [23, 139], [0.952, 1.0074], {
    ...clampOpts,
    easing: Easing.out(Easing.quad),
  });

// Exit zoom multiplier (frames 139→153, measured from card widths / grid spacing)
const EXIT_F = [139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153];
const EXIT_Z = [1, 0.98, 0.923, 0.838, 0.746, 0.662, 0.588, 0.533, 0.487, 0.456, 0.434, 0.4155, 0.405, 0.397, 0.3938];
const exitZoomAt = (f: number) => interpolate(f, EXIT_F, EXIT_Z, clampOpts);

// Card entrance scale, birth-relative (measured widths / 540 / worldScale)
const PLUME_SCALE_F = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 17, 19, 21];
const PLUME_SCALE_V = [0.015, 0.021, 0.037, 0.144, 0.21, 0.288, 0.399, 0.529, 0.673, 0.84, 1.004, 1.019, 1.019, 1.017, 1.009, 1.005, 1.0, 1.0];
const FX_SCALE_F = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 18];
const FX_SCALE_V = [0.013, 0.031, 0.058, 0.093, 0.132, 0.218, 0.3, 0.401, 0.526, 0.678, 0.842, 0.998, 1.006, 1.004, 1.0, 1.0];

// Vertical convergence offsets (px at world scale, birth-relative)
const PLUME_DY_F = [0, 3, 5, 7, 9, 11, 13, 15, 17, 19, 22];
const PLUME_DY_V = [37.5, 30, 25.6, 19, 14, 9.7, 6.4, 3.8, 2.1, 1.0, 0];
const FX_DY_F = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18];
const FX_DY_V = [-28.8, -22.7, -16.9, -11.9, -8.1, -5, -2.8, -1.3, -0.5, 0];

// Border-radius morph circle→square, birth-relative (% of card side)
const PLUME_R_F = [9, 11, 13, 15, 17];
const PLUME_R_V = [50, 30, 12, 5, CORNER_R / CARD * 100];
const FX_R_F = [11, 13, 15, 17];
const FX_R_V = [50, 25, 8, CORNER_R / CARD * 100];

// Logo's own spring (screen-space, leads the card, no overshoot), birth-relative.
// Early on the logo is ~3× oversized relative to the card and gets clipped by the
// circle mask (source shows only "CO" of FALCONX at rel 5).
const LOGO_OWN_F = [1, 3, 5, 7, 9];
const LOGO_OWN_V = [0.15, 0.55, 0.85, 0.96, 1];

// Headline rise (translateY px from final position, absolute frames)
const HEAD_F = [153, 154, 155, 156, 157, 158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 168, 170, 172];
const HEAD_Y = [52, 48, 43, 37, 32, 27, 23, 19, 15, 12, 9, 7, 5, 4, 2, 1, 0.5, 0];

type CardSpec = {
  center: { x: number; y: number };
  birth: number;
  scaleF: number[];
  scaleV: number[];
  dyF: number[];
  dyV: number[];
  rF: number[];
  rV: number[];
  gradient: string;
  Logo: React.FC<{ width: number; height: number }>;
  logoW: number; // traced asset width at world scale 1
  logoH: number;
};

const PLUME_CARD: CardSpec = {
  center: RED_CENTER,
  birth: 3,
  scaleF: PLUME_SCALE_F,
  scaleV: PLUME_SCALE_V,
  dyF: PLUME_DY_F,
  dyV: PLUME_DY_V,
  rF: PLUME_R_F,
  rV: PLUME_R_V,
  gradient: RED_GRAD,
  Logo: PlumeLogoVec,
  logoW: 462,
  logoH: 122,
};

const FX_CARD: CardSpec = {
  center: BLUE_CENTER,
  birth: 7,
  scaleF: FX_SCALE_F,
  scaleV: FX_SCALE_V,
  dyF: FX_DY_F,
  dyV: FX_DY_V,
  rF: FX_R_F,
  rV: FX_R_V,
  gradient: BLUE_GRAD,
  Logo: FalconXLogoVec,
  logoW: 461,
  logoH: 69,
};

const Card: React.FC<{ spec: CardSpec; frame: number; flash: boolean }> = ({
  spec,
  frame,
  flash,
}) => {
  const rel = frame - spec.birth;
  if (!flash && rel < 0) return null;

  const scale = flash ? 1 : interpolate(rel, spec.scaleF, spec.scaleV, clampOpts);
  const dy = flash ? 0 : interpolate(rel, spec.dyF, spec.dyV, clampOpts);
  const radiusPct = flash
    ? (CORNER_R / CARD) * 100
    : interpolate(rel, spec.rF, spec.rV, clampOpts);
  const logoOwn = flash ? 1 : interpolate(rel, LOGO_OWN_F, LOGO_OWN_V, clampOpts);
  // Logo runs its own spring; counter the card scale so it leads, then rides.
  const logoRel = logoOwn / Math.max(scale, 0.001);

  return (
    <div
      style={{
        position: "absolute",
        left: spec.center.x - CARD / 2,
        top: spec.center.y - CARD / 2,
        width: CARD,
        height: CARD,
        transform: `translateY(${dy}px) scale(${scale})`,
        borderRadius: `${radiusPct}%`,
        background: spec.gradient,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 10px 36px rgba(0,0,0,0.35)",
      }}
    >
      <spec.Logo width={spec.logoW * logoRel} height={spec.logoH * logoRel} />
    </div>
  );
};

// Grid lines in world space, wide enough to stay covered after the ×0.394 zoom-out.
// Vertical lines pass through screen center; horizontal lines are half-cell offset.
const GridLines: React.FC<{ color: string; thickness?: number }> = ({
  color,
  thickness = 2,
}) => {
  const lines: React.ReactNode[] = [];
  for (let k = -4; k <= 4; k++) {
    lines.push(
      <div
        key={`v${k}`}
        style={{
          position: "absolute",
          left: CX + k * CELL - thickness / 2,
          top: -H * 1.5,
          width: thickness,
          height: H * 4,
          background: color,
        }}
      />,
    );
  }
  for (let k = -3; k <= 2; k++) {
    lines.push(
      <div
        key={`h${k}`}
        style={{
          position: "absolute",
          top: CY + 1.5 + (k + 0.5) * H_CELL - thickness / 2,
          left: -W * 1.5,
          height: thickness,
          width: W * 4,
          background: color,
        }}
      />,
    );
  }
  return <>{lines}</>;
};

// The animated stage: grid + glow + cards. Lives under one world transform.
const World: React.FC<{ frameOffset: number }> = ({ frameOffset }) => {
  const f = useCurrentFrame() + frameOffset;
  const flash = f < 3;

  const rot = flash ? 0 : worldRotAt(f);
  const scale = flash ? 0.974 : driftAt(f) * exitZoomAt(f);

  // Colored glow rides the cards in, dies with the exit zoom
  const glowIn = flash
    ? 1
    : interpolate(f, [8, 40], [0, 1], { ...clampOpts, easing: Easing.out(Easing.quad) });
  const glowOut = interpolate(f, [140, 148], [1, 0], clampOpts);
  const glow = glowIn * glowOut;

  // Whole grid fades away under the headline
  const gridFade = interpolate(f, [152, 180], [1, 0], clampOpts);

  // Cards dissolve at the end of the zoom (measured brightness decay)
  const cardFade = interpolate(f, [145, 147, 149, 151], [1, 0.8, 0.55, 0], clampOpts);

  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${scale}) rotate(${rot}deg)`,
          transformOrigin: `${CX}px ${CY}px`,
          opacity: gridFade,
        }}
      >
        {/* base grid */}
        <GridLines color="rgba(235,235,240,0.09)" />
        {/* red glow around the Plume card */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: glow,
            filter: "blur(1.5px)",
            WebkitMaskImage: `radial-gradient(750px at ${RED_CENTER.x}px ${RED_CENTER.y}px, rgba(0,0,0,1), transparent 80%)`,
            maskImage: `radial-gradient(750px at ${RED_CENTER.x}px ${RED_CENTER.y}px, rgba(0,0,0,1), transparent 80%)`,
          }}
        >
          <GridLines color="#e04818" thickness={3} />
        </div>
        {/* blue glow around the FalconX card */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: glow * 0.9,
            filter: "blur(1.5px)",
            WebkitMaskImage: `radial-gradient(700px at ${BLUE_CENTER.x}px ${BLUE_CENTER.y}px, rgba(0,0,0,1), transparent 80%)`,
            maskImage: `radial-gradient(700px at ${BLUE_CENTER.x}px ${BLUE_CENTER.y}px, rgba(0,0,0,1), transparent 80%)`,
          }}
        >
          <GridLines color="#4053b8" thickness={3} />
        </div>
        {/* center grid line carries a warm glow along nearly its full height */}
        <div
          style={{
            position: "absolute",
            left: CX - 1.5,
            top: 0,
            width: 3,
            height: H,
            opacity: glow,
            background:
              "linear-gradient(180deg, rgba(210,75,80,0) 0%, rgba(210,75,80,0.4) 8%, rgba(210,75,80,0.8) 24%, rgba(224,85,88,1) 50%, rgba(210,75,80,0.8) 76%, rgba(210,75,80,0.4) 93%, rgba(210,75,80,0) 100%)",
            filter: "blur(1px)",
          }}
        />
        {/* soft bloom in the seam between the cards */}
        <div
          style={{
            position: "absolute",
            left: 936,
            top: 250,
            width: 52,
            height: 580,
            opacity: glow,
            background:
              "radial-gradient(26px 320px at 50% 50%, rgba(210,80,75,0.5), transparent 70%)",
            filter: "blur(5px)",
          }}
        />
        <div style={{ position: "absolute", inset: 0, opacity: cardFade }}>
          <Card spec={PLUME_CARD} frame={f} flash={flash} />
          <Card spec={FX_CARD} frame={f} flash={flash} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Headline: React.FC = () => {
  const f = useCurrentFrame();
  if (f < 151) return null;
  const rise = interpolate(f, HEAD_F, HEAD_Y, clampOpts);
  const opacity = interpolate(f, [152, 155], [0, 1], clampOpts);
  const blur = interpolate(f, [153, 159], [3, 0], clampOpts);
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 400,
        width: W,
        height: 178, // clip edge at y=578 — the text rises through it
        overflow: "hidden",
        opacity,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 558,
          top: 112,
          width: 804,
          height: 56,
          transform: `translateY(${rise}px)`,
          filter: `blur(${blur}px)`,
        }}
      >
        <HeadlineVec width={804} height={56} />
      </div>
    </div>
  );
};

export const PlumeComposition: React.FC = () => {
  const frame = useCurrentFrame();
  // Extra center light while the cards own the stage
  const centerLight = interpolate(frame, [140, 154], [1, 0], clampOpts);

  return (
    <AbsoluteFill style={{ backgroundColor: "#080808" }}>
      <AbsoluteFill
        style={{
          background: "radial-gradient(1200px at 50% 50%, #111113 0%, #080808 75%)",
        }}
      />
      <AbsoluteFill
        style={{
          opacity: centerLight,
          background:
            "radial-gradient(560px at 50% 50%, rgba(255,255,255,0.06), transparent 70%)",
        }}
      />
      {/* Static phase — no motion blur */}
      <Sequence from={0} durationInFrames={130} layout="none">
        <World frameOffset={0} />
      </Sequence>
      {/* Exit zoom — real multi-sample motion blur */}
      <Sequence from={130} layout="none">
        <CameraMotionBlur samples={10} shutterAngle={330}>
          <World frameOffset={130} />
        </CameraMotionBlur>
      </Sequence>
      <Headline />
    </AbsoluteFill>
  );
};

export const plumeReplicateMeta = {
  id: "Plume-Replicate",
  component: PlumeComposition,
  width: W,
  height: H,
  fps: FPS,
  durationInFrames: DURATION,
};
