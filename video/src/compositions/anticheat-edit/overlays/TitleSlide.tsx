import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { font, monoFont } from "../../../common/fonts";
import { colors } from "../../anticheat/theme";
import { VerticalDotGrid, DotGridVignette } from "../../anticheat/DotGrid";
import { IdleZoom, RevealChars } from "../../anticheat/vibe";

// Section title card in the AntiCheatFull language — but the type is
// Base blue, not near-black, and the dot field runs VERTICALLY: bright
// blue bands of points fall down the light field behind the words.
//
// One card per mechanism. The kicker counts it out of thirteen.

const ACCENT = colors.accent; // #0052FF

export type TitleSlideProps = {
  kicker?: string;
  title: string;
  /** Optional one-line undertitle in near-black. */
  sub?: string;
};

export const TitleSlide: React.FC<TitleSlideProps> = ({ kicker, title, sub }) => {
  const frame = useCurrentFrame();

  const kickerOp = interpolate(frame, [2, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ruleW = interpolate(frame, [8, 26], [0, 220], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const subOp = interpolate(frame, [18, 32], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg, fontFamily: font }}>
      <IdleZoom durationInFrames={9999} from={1.0} to={1.035}>
        {/* Vertical moving points — blue bands falling through the field */}
        <VerticalDotGrid intensity={0.95} speed={1.15} tone="accent" />

        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 140px",
            textAlign: "center",
          }}
        >
          {kicker ? (
            <div
              style={{
                fontFamily: monoFont,
                fontSize: 26,
                fontWeight: 600,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: ACCENT,
                opacity: kickerOp,
                marginBottom: 28,
              }}
            >
              {kicker}
            </div>
          ) : null}

          <div
            style={{
              fontFamily: font,
              fontSize: 130,
              fontWeight: 800,
              letterSpacing: "-0.022em",
              lineHeight: 0.98,
              color: ACCENT,
              maxWidth: 1500,
            }}
          >
            <RevealChars text={title} startFrame={4} stagger={1.2} duration={13} />
          </div>

          {/* Underline rule grows out from center */}
          <div
            style={{
              marginTop: 38,
              width: ruleW,
              height: 4,
              borderRadius: 2,
              background: ACCENT,
            }}
          />

          {sub ? (
            <div
              style={{
                fontFamily: monoFont,
                fontSize: 22,
                fontWeight: 500,
                letterSpacing: "0.03em",
                color: colors.fgSoft,
                marginTop: 32,
                opacity: subOp,
                maxWidth: 1100,
              }}
            >
              {sub}
            </div>
          ) : null}
        </AbsoluteFill>

        <DotGridVignette intensity={0.3} />
      </IdleZoom>
    </AbsoluteFill>
  );
};
