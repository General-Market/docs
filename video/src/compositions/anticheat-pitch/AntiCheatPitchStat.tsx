import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { FPS, H, W, colors, toFrames, pitchSans, pitchSansLight } from "./theme";
import { PitchFrame } from "./PitchFrame";
import { SlideBg, SlideTitle, HeroGlow, useReveal } from "./SlideKit";

const SCENE_SECONDS = 7.5;
const TITLE_AT = toFrames(0.2);
const LEFT_AT = toFrames(1.0);
const RIGHT_AT = toFrames(2.0);
const STAMP_AT = toFrames(5.6);
const COUNT_DURATION = toFrames(1.6);

export const AntiCheatPitchStat: React.FC = () => {
  const frame = useCurrentFrame();
  const t = Math.min(1, Math.max(0, (frame - LEFT_AT) / COUNT_DURATION));
  const eased = 1 - Math.pow(1 - t, 3);
  const left = (0.04 * eased).toFixed(2);
  const right = Math.round(70 * eased);

  const stampOpacity = interpolate(
    frame,
    [STAMP_AT - toFrames(0.2), STAMP_AT],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <SlideBg>
      <HeroGlow tint={colors.accent} />

      <SlideTitle showFrom={TITLE_AT} size={84}>
        The size of the rig.
      </SlideTitle>

      <div
        style={{
          position: "absolute",
          top: "34%",
          left: 96,
          right: 96,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 28,
        }}
      >
        <BlackStatCard
          big={`${left}%`}
          caption="Of insider trading cases lead to investigations"
          accent={false}
          at={LEFT_AT}
        />
        <BlackStatCard
          big={`${right}%`}
          caption="Of pro-traders trade on insider information"
          accent
          at={RIGHT_AT}
        />
      </div>

      <Stamp opacity={stampOpacity} />

      <PitchFrame chapter={2} total={6} eyebrow="THE SCALE" />
    </SlideBg>
  );
};

const BlackStatCard: React.FC<{
  big: string;
  caption: string;
  accent: boolean;
  at: number;
}> = ({ big, caption, accent, at }) => {
  const r = useReveal(at);
  return (
    <div
      style={{
        position: "relative",
        opacity: r.opacity,
        transform: `translateY(${r.y}px) scale(${r.scale})`,
        background: accent
          ? `linear-gradient(180deg, #FFB733 0%, ${colors.accent} 60%, #E58F00 100%)`
          : `linear-gradient(180deg, #1A1B1D 0%, ${colors.panel} 100%)`,
        border: accent ? "none" : `1px solid ${colors.rule}`,
        padding: "56px 48px",
        minHeight: 460,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div
        style={{
          width: 48,
          height: 8,
          background: accent ? colors.bg : colors.accent,
        }}
      />
      <div
        style={{
          fontFamily: pitchSans,
          fontWeight: 800,
          fontSize: 248,
          letterSpacing: "-0.05em",
          lineHeight: 0.92,
          color: accent ? colors.bg : colors.fg,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {big}
      </div>
      <div
        style={{
          fontFamily: pitchSansLight,
          fontWeight: 400,
          fontSize: 32,
          letterSpacing: "0",
          lineHeight: 1.3,
          color: accent ? "rgba(13,14,15,0.78)" : colors.dim,
          maxWidth: "92%",
        }}
      >
        {caption}
      </div>
    </div>
  );
};

const Stamp: React.FC<{ opacity: number }> = ({ opacity }) => (
  <div
    style={{
      position: "absolute",
      bottom: "16%",
      left: 96,
      right: 96,
      textAlign: "center",
      opacity,
      fontFamily: pitchSans,
      fontWeight: 800,
      fontSize: 64,
      letterSpacing: "-0.02em",
      color: colors.fg,
    }}
  >
    A 1-in-1000 chance of being caught,
    <br />
    against a 70-in-100 chance of cheating.
  </div>
);

export const antiCheatPitchStatMeta = {
  id: "AntiCheatPitchStat",
  component: AntiCheatPitchStat,
  durationInFrames: toFrames(SCENE_SECONDS),
  fps: FPS,
  width: W,
  height: H,
};
