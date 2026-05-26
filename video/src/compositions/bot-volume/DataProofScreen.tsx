import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { ACCENT, SANS_TEXT, articleZoom } from "../article-2/theme";
import { ProofArticle } from "./ProofArticle";
import { HeroPie } from "./HeroPie";
import { HeroWaffle } from "./HeroWaffle";
import { SCREEN_DUR, type Hero, type ProofScreen } from "./screens";

const HeroChart: React.FC<{ hero: Hero }> = ({ hero }) =>
  hero.kind === "pie" ? (
    <HeroPie pct={hero.pct} blueLabel={hero.blueLabel} greyLabel={hero.greyLabel} />
  ) : (
    <HeroWaffle filled={hero.filled} total={hero.total} />
  );

const BG = "#05070c";

// Proof phrases underline after their scroll step settles.
const MARK_TIMES = [92, 140];

/**
 * One data→proof beat. Opens big on the number over a blurred, dimmed source
 * article; the number blurs and lifts away as the blur drops; then the article
 * is in focus and scrolls — in eased steps — to each proof as it underlines.
 */
export const DataProofScreen: React.FC<{ screen: ProofScreen }> = ({ screen }) => {
  const frame = useCurrentFrame();

  // hero number: opens already in motion (frame 0 is mid-fade, scaling down),
  // holds, then blurs + scales + lifts away.
  const heroIn = interpolate(frame, [0, 14], [0.4, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const heroEntryScale = interpolate(frame, [0, 18], [1.08, 1.0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const heroOut = interpolate(frame, [56, 80], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const heroOp = Math.min(heroIn, heroOut);
  const heroBlur = interpolate(frame, [54, 80], [0, 30], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });
  const heroExitScale = interpolate(frame, [54, 80], [1, 1.14], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });
  const heroScale = heroEntryScale * heroExitScale;
  const heroY = interpolate(frame, [54, 80], [0, -28], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });

  // article: blurred + dimmed under the number, then snaps into focus
  const articleBlur = interpolate(frame, [0, 54, 80], [30, 30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const scrimOp = interpolate(frame, [0, 54, 80], [0.85, 0.85, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const bgZoom = articleZoom(frame, SCREEN_DUR);

  // eased stepped scroll: settle on proof #1, hold, snap down to proof #2, hold
  const scroll = interpolate(
    frame,
    [0, 100, 112, 138, 195],
    [70, 70, 70, 360, 360],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    },
  );

  // source citation appears once both proofs are underlined
  const sourceOp = interpolate(frame, [150, 166], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      <AbsoluteFill style={{ transform: `scale(${bgZoom})`, transformOrigin: "center" }}>
        <ProofArticle
          brand={screen.brand}
          title={screen.title}
          author={screen.author}
          date={screen.date}
          paragraphs={screen.paragraphs}
          scroll={scroll}
          fullBlurPx={articleBlur}
          markTimes={MARK_TIMES}
          bottomBlur
        />
      </AbsoluteFill>

      {/* dim scrim under the hero chart */}
      {scrimOp > 0.001 && <AbsoluteFill style={{ background: BG, opacity: scrimOp }} />}

      {/* hero chart */}
      {heroOp > 0.001 && (
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            opacity: heroOp,
            filter: heroBlur > 0.1 ? `blur(${heroBlur}px)` : undefined,
            transform: `translateY(${heroY}px) scale(${heroScale})`,
          }}
        >
          <HeroChart hero={screen.hero} />
          <div
            style={{
              fontFamily: SANS_TEXT,
              fontSize: 44,
              color: "rgba(255,255,255,0.76)",
              marginTop: 44,
              maxWidth: 1240,
              textAlign: "center",
              letterSpacing: "-0.4px",
              lineHeight: 1.25,
            }}
          >
            {screen.heroSub}
          </div>
        </AbsoluteFill>
      )}

      {/* source citation chip during the proof phase */}
      {sourceOp > 0.001 && (
        <div
          style={{
            position: "absolute",
            left: 48,
            bottom: 64,
            opacity: sourceOp,
            borderLeft: `4px solid ${ACCENT}`,
            fontFamily: SANS_TEXT,
            fontSize: 26,
            color: "rgba(20,24,29,0.82)",
            background: "rgba(255,255,255,0.78)",
            borderRadius: 4,
            padding: "10px 18px",
            zIndex: 40,
          }}
        >
          {screen.source}
        </div>
      )}
    </AbsoluteFill>
  );
};
