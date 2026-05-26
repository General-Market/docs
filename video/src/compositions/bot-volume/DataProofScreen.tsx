import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { ACCENT, ACCENT_SOFT, SANS, SANS_TEXT } from "../article-2/theme";
import { ProofArticle } from "./ProofArticle";
import type { ProofScreen } from "./screens";

const BG = "#05070c";

// Proof phrases underline after their scroll step settles.
const MARK_TIMES = [150, 214];

/**
 * One data→proof beat. Opens big on the number over a blurred, dimmed source
 * article; the number blurs and lifts away as the blur drops; then the article
 * is in focus and scrolls — in eased steps — to each proof as it underlines.
 */
export const DataProofScreen: React.FC<{ screen: ProofScreen }> = ({ screen }) => {
  const frame = useCurrentFrame();

  // hero number: in, hold, then blur + scale + lift away
  const heroIn = interpolate(frame, [6, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const heroOut = interpolate(frame, [92, 124], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const heroOp = Math.min(heroIn, heroOut);
  const heroBlur = interpolate(frame, [86, 124], [0, 30], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });
  const heroScale = interpolate(frame, [86, 124], [1, 1.14], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });
  const heroY = interpolate(frame, [86, 124], [0, -28], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });

  // article: blurred + dimmed under the number, then snaps into focus
  const articleBlur = interpolate(frame, [0, 88, 124], [30, 30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const scrimOp = interpolate(frame, [0, 88, 124], [0.85, 0.85, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const bgZoom = interpolate(frame, [0, 124], [1.05, 1.0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // eased stepped scroll: settle on proof #1, hold, snap down to proof #2, hold
  const scroll = interpolate(
    frame,
    [0, 150, 178, 218, 290],
    [70, 70, 70, 360, 360],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    },
  );

  // source citation appears once both proofs are underlined
  const sourceOp = interpolate(frame, [244, 262], [0, 1], {
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
          showChrome
        />
      </AbsoluteFill>

      {/* dim scrim under the hero number */}
      {scrimOp > 0.001 && <AbsoluteFill style={{ background: BG, opacity: scrimOp }} />}

      {/* hero number */}
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
          <div
            style={{
              fontFamily: SANS,
              fontWeight: 800,
              fontSize: 256,
              lineHeight: 1,
              letterSpacing: "-8px",
              color: "#fff",
              textShadow: `0 0 70px ${ACCENT_SOFT}`,
            }}
          >
            {screen.hero}
          </div>
          <div
            style={{
              fontFamily: SANS_TEXT,
              fontSize: 46,
              color: "rgba(255,255,255,0.76)",
              marginTop: 28,
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
