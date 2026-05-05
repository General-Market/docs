import React from "react";
import { FPS, H, W, colors, toFrames, pitchSans, pitchSansLight } from "./theme";
import { PitchFrame } from "./PitchFrame";
import {
  SlideBg,
  OrangeHeroBlock,
  DatePill,
  HeroGlow,
  useReveal,
} from "./SlideKit";

const SCENE_SECONDS = 5.0;
const HERO_AT = toFrames(0.15);
const SUBLINE_AT = toFrames(1.6);
const PILL_AT = toFrames(2.2);
const TERTIARY_AT = toFrames(3.0);

export const AntiCheatPitchEndCard: React.FC = () => {
  const subline = useReveal(SUBLINE_AT);
  const tertiary = useReveal(TERTIARY_AT);

  return (
    <SlideBg>
      <HeroGlow tint={colors.accent} />

      <OrangeHeroBlock
        showFrom={HERO_AT}
        top="18%"
        left="5%"
        width="62%"
        height="58%"
        fontSize={172}
      >
        General
        <br />
        Market
      </OrangeHeroBlock>

      {/* Right column — sub-statements stacked like a cap-table strip */}
      <div
        style={{
          position: "absolute",
          top: "22%",
          right: 96,
          width: "30%",
          display: "flex",
          flexDirection: "column",
          gap: 28,
        }}
      >
        <div
          style={{
            opacity: subline.opacity,
            transform: `translateY(${subline.y}px)`,
            fontFamily: pitchSans,
            fontWeight: 700,
            fontSize: 22,
            letterSpacing: "0.32em",
            textTransform: "uppercase",
            color: colors.accent,
          }}
        >
          The first anti-cheat in trading
        </div>

        <div
          style={{
            opacity: subline.opacity,
            transform: `translateY(${subline.y}px)`,
            fontFamily: pitchSans,
            fontWeight: 800,
            fontSize: 64,
            letterSpacing: "-0.025em",
            lineHeight: 0.98,
            color: colors.fg,
          }}
        >
          Same markets,
          <br />
          no cheaters.
        </div>

        <div
          style={{
            opacity: tertiary.opacity,
            transform: `translateY(${tertiary.y}px)`,
            fontFamily: pitchSansLight,
            fontWeight: 400,
            fontSize: 28,
            color: colors.dim,
            lineHeight: 1.4,
            marginTop: 12,
          }}
        >
          Sealed bets. Parimutuel pricing.
          <br />
          Outcomes proved on-chain.
        </div>
      </div>

      <DatePill label="generalmarket.io" showFrom={PILL_AT} />

      <PitchFrame chapter={6} total={6} eyebrow="GENERAL" />
    </SlideBg>
  );
};

export const antiCheatPitchEndCardMeta = {
  id: "AntiCheatPitchEndCard",
  component: AntiCheatPitchEndCard,
  durationInFrames: toFrames(SCENE_SECONDS),
  fps: FPS,
  width: W,
  height: H,
};
