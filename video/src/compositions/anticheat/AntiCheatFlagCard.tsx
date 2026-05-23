import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { font, monoFont } from "../../common/fonts";
import { FPS, H, W, colors } from "./theme";
import { DotGrid, DotGridVignette, useGridIntensity } from "./DotGrid";
import { IdleZoom, RevealChars } from "./vibe";
import { THIRTEEN, bySlug, romanize, type Flag } from "./thirteen";

// Per-mechanism title card. Image #3's "L'AVIS DES INSTITUTIONS" structure
// translated to AntiCheatFull's palette: light field with a soft Base blue
// vignette behind the title, big display name, small group label, small
// "Therefore:" line. 3.5-second beat — enters, holds, eases.

const SCENE_SECONDS = 3.5;
const SCENE_FRAMES = Math.round(SCENE_SECONDS * FPS);

type Props = { flag: Flag };

const useEnter = (target: number, mass = 0.55) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({
    fps,
    frame: frame - target,
    config: { damping: 200, stiffness: 170, mass },
    durationInFrames: 16,
  });
};

const Chevron: React.FC<{ direction: "up" | "down"; scale?: number }> = ({
  direction,
  scale = 1,
}) => {
  const flip = direction === "down" ? "scaleY(1)" : "scaleY(-1)";
  return (
    <svg
      width={160 * scale}
      height={96 * scale}
      viewBox="0 0 160 96"
      style={{ transform: flip }}
      fill="none"
    >
      <path
        d="M0 76 L40 76 L80 16 L120 76 L160 76 L80 0 Z"
        fill={colors.accent}
        opacity={0.18}
      />
      <path
        d="M0 96 L40 96 L80 36 L120 96 L160 96 L80 20 Z"
        fill={colors.accent}
        opacity={0.32}
      />
    </svg>
  );
};

export const AntiCheatFlagCard: React.FC<Props> = ({ flag }) => {
  const frame = useCurrentFrame();
  const gridIntensity = useGridIntensity(8, SCENE_FRAMES - 14, 14);
  const numberT = useEnter(2, 0.4);
  const groupT = useEnter(8, 0.45);
  const biteT = useEnter(SCENE_FRAMES - 38, 0.5);
  const fixT = useEnter(SCENE_FRAMES - 26, 0.55);

  // Soft halo behind the title — pulses once over the scene.
  const halo = interpolate(
    frame,
    [0, 22, SCENE_FRAMES - 18, SCENE_FRAMES],
    [0, 1, 1, 0.6],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg, fontFamily: font }}>
      <DotGrid intensity={gridIntensity * 0.65} speed={0.4} />
      <DotGridVignette intensity={0.25} />

      {/* Top-left chevron decoration */}
      <div
        style={{
          position: "absolute",
          top: 110,
          left: 156,
          opacity: interpolate(frame, [4, 16], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <Chevron direction="up" scale={1.0} />
      </div>
      {/* Bottom-right chevron decoration (mirrored) */}
      <div
        style={{
          position: "absolute",
          bottom: 110,
          right: 156,
          opacity: interpolate(frame, [10, 22], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <Chevron direction="down" scale={1.0} />
      </div>

      <IdleZoom durationInFrames={SCENE_FRAMES} from={1.0} to={1.04}>
        {/* Soft halo behind the title */}
        <div
          style={{
            position: "absolute",
            top: H / 2 - 240,
            left: W / 2 - 540,
            width: 1080,
            height: 480,
            background: `radial-gradient(closest-side, ${colors.accentTint} 0%, rgba(0,82,255,0) 70%)`,
            opacity: halo,
            pointerEvents: "none",
          }}
        />

        {/* Roman counter — top-left */}
        <div
          style={{
            position: "absolute",
            top: 132,
            left: 156,
            opacity: numberT,
            transform: `translate3d(0, ${((1 - numberT) * 8).toFixed(2)}px, 0)`,
          }}
        >
          <div
            style={{
              fontFamily: monoFont,
              fontSize: 22,
              fontWeight: 500,
              color: colors.dim,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}
          >
            № {romanize(flag.rank)} / XIII
          </div>
        </div>

        {/* Group label — top-right */}
        <div
          style={{
            position: "absolute",
            top: 132,
            right: 156,
            opacity: groupT,
            transform: `translate3d(0, ${((1 - groupT) * 8).toFixed(2)}px, 0)`,
          }}
        >
          <div
            style={{
              fontFamily: monoFont,
              fontSize: 22,
              fontWeight: 500,
              color: colors.accent,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}
          >
            {flag.group}
          </div>
        </div>

        {/* Hero title — centered */}
        <div
          style={{
            position: "absolute",
            top: H / 2 - 130,
            left: 0,
            right: 0,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 132,
              fontWeight: 800,
              lineHeight: 1,
              color: colors.fg,
              letterSpacing: "-0.045em",
            }}
          >
            <RevealChars
              text={flag.display}
              startFrame={6}
              stagger={1.6}
              duration={14}
            />
          </div>
        </div>

        {/* Amortized bite — sits just under the title */}
        <div
          style={{
            position: "absolute",
            top: H / 2 + 30,
            left: 0,
            right: 0,
            textAlign: "center",
            opacity: biteT,
            transform: `translate3d(0, ${((1 - biteT) * 10).toFixed(2)}px, 0)`,
          }}
        >
          <span
            style={{
              fontFamily: monoFont,
              fontSize: 30,
              fontWeight: 500,
              color: colors.accent,
              letterSpacing: "-0.005em",
            }}
          >
            — {flag.bite} —
          </span>
        </div>

        {/* "Therefore:" line — bottom band */}
        <div
          style={{
            position: "absolute",
            bottom: 156,
            left: 0,
            right: 0,
            textAlign: "center",
            opacity: fixT,
            transform: `translate3d(0, ${((1 - fixT) * 12).toFixed(2)}px, 0)`,
          }}
        >
          <div
            style={{
              fontSize: 34,
              fontWeight: 500,
              color: colors.fgSoft,
              letterSpacing: "-0.022em",
              maxWidth: 1200,
              margin: "0 auto",
              lineHeight: 1.25,
            }}
          >
            <span style={{ color: colors.accent, fontWeight: 700 }}>Therefore:</span>{" "}
            {flag.fix}
          </div>
        </div>
      </IdleZoom>
    </AbsoluteFill>
  );
};

// Factory — one Composition meta per flag. Registered in Root.tsx so the
// cutting agent can drop any of the 13 into the timeline by id.
export const flagCardMetas = THIRTEEN.map((flag) => ({
  id: `AntiCheatFlag${String(flag.rank).padStart(2, "0")}_${flag.slug
    .replace(/-/g, "_")}`,
  component: () => <AntiCheatFlagCard flag={flag} />,
  durationInFrames: SCENE_FRAMES,
  fps: FPS,
  width: W,
  height: H,
  flag,
}));

export const antiCheatFlagCardSampleMeta = {
  id: "AntiCheatFlagCard",
  component: () => <AntiCheatFlagCard flag={bySlug("jito-mev")} />,
  durationInFrames: SCENE_FRAMES,
  fps: FPS,
  width: W,
  height: H,
};
