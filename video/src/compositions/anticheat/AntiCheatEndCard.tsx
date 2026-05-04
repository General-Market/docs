import React from "react";
import { AbsoluteFill } from "remotion";
import { font, monoFont } from "../../common/fonts";
import { FPS, H, W, colors, toFrames } from "./theme";
import {
  useGsapProxy,
  HERO_SPRING,
  ELEMENT_SPRING,
  SOFT_OUT,
} from "../replicates/rainbows-pitch/gsapUtils";

const SCENE_SECONDS = 10;

const EYEBROW = ["Anti-Cheat", "·", "Trading"] as const;
const SUBLINE_LEAD = ["Trading", "is", "easy", "with", "an"] as const;
const TERTIARY = ["Available", "only", "via", "trading", "bots"] as const;

export const AntiCheatEndCard: React.FC = () => {
  const proxyKeys: Record<string, Record<string, number>> = {
    wordmark: {
      opacity: 0,
      y: 28,
      scale: 0.7,
      letterSpacing: -0.02,
    },
    underline: { v: 0 },
    antiCheat: {
      opacity: 0,
      y: 18,
      scale: 0.7,
      letterSpacing: -0.02,
    },
    period: { opacity: 0 },
  };
  EYEBROW.forEach((_, i) => {
    proxyKeys[`eb_${i}`] = { opacity: 0, y: 10 };
  });
  SUBLINE_LEAD.forEach((_, i) => {
    proxyKeys[`sl_${i}`] = { opacity: 0, y: 14 };
  });
  TERTIARY.forEach((_, i) => {
    proxyKeys[`t_${i}`] = { opacity: 0, y: 10 };
  });

  const s = useGsapProxy((tl, p) => {
    // Eyebrow
    EYEBROW.forEach((_, i) => {
      tl.to(
        p[`eb_${i}`]!,
        { opacity: 1, y: 0, duration: 0.16, ease: "power2.out" },
        i * 0.1,
      );
    });

    // Wordmark — hero spring + letter-spacing kick
    tl.to(
      p.wordmark,
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.7,
        ease: HERO_SPRING,
      },
      0.5,
    );
    tl.to(
      p.wordmark,
      { letterSpacing: -0.06, duration: 0.4, ease: SOFT_OUT },
      0.5,
    );
    tl.to(
      p.wordmark,
      { letterSpacing: -0.045, duration: 0.4, ease: SOFT_OUT },
      0.9,
    );

    // Underline draws after the wordmark settles
    tl.to(
      p.underline,
      { v: 1, duration: 1.0, ease: SOFT_OUT },
      1.6,
    );

    // Subline — "Trading is easy with an" → "Anti-Cheat" hero
    SUBLINE_LEAD.forEach((_, i) => {
      tl.to(
        p[`sl_${i}`]!,
        { opacity: 1, y: 0, duration: 0.16, ease: ELEMENT_SPRING },
        4.0 + i * 0.11,
      );
    });
    tl.to(
      p.antiCheat,
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.55,
        ease: HERO_SPRING,
      },
      4.6,
    );
    tl.to(
      p.antiCheat,
      { letterSpacing: -0.04, duration: 0.4, ease: SOFT_OUT },
      4.6,
    );
    tl.to(
      p.antiCheat,
      { letterSpacing: -0.025, duration: 0.4, ease: SOFT_OUT },
      5.0,
    );
    tl.to(p.period, { opacity: 1, duration: 0.2 }, 5.1);

    // Tertiary
    TERTIARY.forEach((_, i) => {
      tl.to(
        p[`t_${i}`]!,
        { opacity: 1, y: 0, duration: 0.16, ease: "power2.out" },
        7.0 + i * 0.1,
      );
    });
  }, proxyKeys);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.bg,
        fontFamily: font,
        justifyContent: "center",
        alignItems: "center",
        padding: "0 96px",
      }}
    >
      <div
        style={{
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* Eyebrow */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "0 16px",
            fontFamily: monoFont,
            fontSize: 26,
            fontWeight: 500,
            letterSpacing: "0.32em",
            textTransform: "uppercase",
            color: colors.dim,
            marginBottom: 28,
          }}
        >
          {EYEBROW.map((word, i) => {
            const proxy = s[`eb_${i}`]!;
            return (
              <span
                key={word + i}
                style={{
                  display: "inline-block",
                  opacity: proxy.opacity,
                  transform: `translateY(${proxy.y}px)`,
                }}
              >
                {word}
              </span>
            );
          })}
        </div>

        {/* Wordmark */}
        <div
          style={{
            fontFamily: font,
            fontSize: 220,
            fontWeight: 800,
            color: colors.fg,
            lineHeight: 0.95,
            opacity: s.wordmark.opacity,
            transform: `translateY(${s.wordmark.y}px) scale(${s.wordmark.scale})`,
            letterSpacing: `${s.wordmark.letterSpacing}em`,
            textShadow: "0 4px 28px rgba(0,0,0,0.65)",
          }}
        >
          General
        </div>

        {/* Underline */}
        <div
          style={{
            position: "relative",
            width: 720,
            height: 2,
            marginTop: 28,
            marginBottom: 36,
            background: colors.rule,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              bottom: 0,
              width: `${s.underline.v * 100}%`,
              background:
                "linear-gradient(90deg, rgba(245,245,245,0) 0%, #f5f5f5 50%, rgba(245,245,245,0) 100%)",
            }}
          />
        </div>

        {/* Subline */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "baseline",
            flexWrap: "wrap",
            gap: "0 14px",
            fontFamily: font,
            fontSize: 56,
            fontWeight: 600,
            letterSpacing: "-0.02em",
            color: colors.fg,
          }}
        >
          {SUBLINE_LEAD.map((word, i) => {
            const proxy = s[`sl_${i}`]!;
            return (
              <span
                key={word + i}
                style={{
                  display: "inline-block",
                  opacity: proxy.opacity,
                  transform: `translateY(${proxy.y}px)`,
                }}
              >
                {word}
              </span>
            );
          })}
          <span
            style={{
              display: "inline-block",
              color: colors.fg,
              opacity: s.antiCheat.opacity,
              transform: `translateY(${s.antiCheat.y}px) scale(${s.antiCheat.scale})`,
              letterSpacing: `${s.antiCheat.letterSpacing}em`,
              fontWeight: 800,
            }}
          >
            Anti-Cheat
          </span>
          <span
            style={{
              color: colors.fg,
              opacity: 0.45 * s.period.opacity,
            }}
          >
            .
          </span>
        </div>

        {/* Tertiary */}
        <div
          style={{
            marginTop: 28,
            display: "flex",
            justifyContent: "center",
            gap: "0 14px",
            fontFamily: monoFont,
            fontSize: 22,
            fontWeight: 500,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: colors.dim,
          }}
        >
          {TERTIARY.map((word, i) => {
            const proxy = s[`t_${i}`]!;
            return (
              <span
                key={word + i}
                style={{
                  display: "inline-block",
                  opacity: proxy.opacity,
                  transform: `translateY(${proxy.y}px)`,
                }}
              >
                {word}
              </span>
            );
          })}
        </div>
      </div>

      <AbsoluteFill
        style={{
          pointerEvents: "none",
          background:
            "radial-gradient(circle at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

void ELEMENT_SPRING;

export const antiCheatEndCardMeta = {
  id: "AntiCheatEndCard",
  component: AntiCheatEndCard,
  durationInFrames: toFrames(SCENE_SECONDS),
  fps: FPS,
  width: W,
  height: H,
};
