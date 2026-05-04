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

const SCENE_SECONDS = 12;

// Headline split — eyebrow + main words.
const EYEBROW = ["The", "rigged", "stack"] as const;
const HEADLINE = ["If", "you", "don’t", "have"] as const;

// Cards — label words split, plus a "value" the counter rolls to.
type Card = {
  n: string;
  glyph: string;
  labelWords: string[];
  // Optional counter — shown next to the label as $XM
  counter?: { to: number; prefix: string; suffix: string };
  sub: string;
};

const CARDS: Card[] = [
  {
    n: "01",
    glyph: "✦",
    labelWords: ["A", "tip", "from", "a", "politician."],
    sub: "Material non-public information.",
  },
  {
    n: "02",
    glyph: "◢",
    labelWords: ["of", "latency", "infra."],
    counter: { to: 100, prefix: "$", suffix: "M" },
    sub: "Co-located, sub-microsecond.",
  },
  {
    n: "03",
    glyph: "◇",
    labelWords: ["for", "exchange", "data."],
    counter: { to: 30, prefix: "$", suffix: "M" },
    sub: "Direct feeds. Unfair by design.",
  },
];

// Final stamp — words for the "70%" hero line.
const STAMP_LEAD = ["You’re", "leaving"] as const;
const STAMP_TAIL = ["on", "the", "table."] as const;

export const AntiCheatRigged: React.FC = () => {
  const proxyKeys: Record<string, Record<string, number>> = {
    fadeOut: { v: 1 },
    finalIn: { v: 0 },
    stampNum: { value: 0, scale: 0.7, opacity: 0, letterSpacing: -0.02 },
    stampPct: { opacity: 0 },
  };
  EYEBROW.forEach((_, i) => {
    proxyKeys[`eb_${i}`] = { opacity: 0, y: 10 };
  });
  HEADLINE.forEach((_, i) => {
    proxyKeys[`hl_${i}`] = { opacity: 0, y: 18 };
  });
  CARDS.forEach((c, ci) => {
    proxyKeys[`card_${ci}`] = { opacity: 0, y: 30, scale: 0.92 };
    proxyKeys[`cardN_${ci}`] = { opacity: 0, y: 8 };
    proxyKeys[`cardG_${ci}`] = { opacity: 0, scale: 0.7 };
    if (c.counter) {
      proxyKeys[`cardC_${ci}`] = { value: 0, opacity: 0, scale: 0.7 };
    }
    c.labelWords.forEach((_, wi) => {
      proxyKeys[`cl_${ci}_${wi}`] = { opacity: 0, y: 10 };
    });
    proxyKeys[`cardS_${ci}`] = { opacity: 0, y: 8 };
  });
  STAMP_LEAD.forEach((_, i) => {
    proxyKeys[`sl_${i}`] = { opacity: 0, y: 18 };
  });
  STAMP_TAIL.forEach((_, i) => {
    proxyKeys[`st_${i}`] = { opacity: 0, y: 18 };
  });

  const finalAt = 10; // seconds — matches the original timing

  const s = useGsapProxy((tl, p) => {
    // Eyebrow words — 0.0 → 0.3s
    EYEBROW.forEach((_, i) => {
      tl.to(
        p[`eb_${i}`]!,
        { opacity: 1, y: 0, duration: 0.16, ease: "power2.out" },
        0.05 + i * 0.1,
      );
    });

    // Headline words — 0.4 → 0.85s
    HEADLINE.forEach((_, i) => {
      tl.to(
        p[`hl_${i}`]!,
        { opacity: 1, y: 0, duration: 0.18, ease: ELEMENT_SPRING },
        0.4 + i * 0.12,
      );
    });

    // Cards — staggered 0.4s apart starting at 1.6s
    CARDS.forEach((card, ci) => {
      const cardAt = 1.6 + ci * 0.4;
      tl.to(
        p[`card_${ci}`]!,
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.45,
          ease: "back.out(1.4)",
        },
        cardAt,
      );
      // Number slot
      tl.to(
        p[`cardN_${ci}`]!,
        { opacity: 1, y: 0, duration: 0.18, ease: SOFT_OUT },
        cardAt + 0.1,
      );
      tl.to(
        p[`cardG_${ci}`]!,
        { opacity: 1, scale: 1, duration: 0.45, ease: "back.out(1.6)" },
        cardAt + 0.1,
      );

      // If the card has a counter, run it
      if (card.counter) {
        tl.to(
          p[`cardC_${ci}`]!,
          { opacity: 1, duration: 0.12 },
          cardAt + 0.25,
        );
        tl.to(
          p[`cardC_${ci}`]!,
          {
            value: card.counter.to,
            duration: 0.6,
            ease: SOFT_OUT,
            snap: { value: 1 },
          },
          cardAt + 0.25,
        );
        tl.to(
          p[`cardC_${ci}`]!,
          { scale: 1, duration: 0.5, ease: "back.out(1.6)" },
          cardAt + 0.25,
        );
      }

      // Label words type in word by word, 0.08s apart
      card.labelWords.forEach((_, wi) => {
        tl.to(
          p[`cl_${ci}_${wi}`]!,
          { opacity: 1, y: 0, duration: 0.14, ease: "power2.out" },
          cardAt + 0.35 + wi * 0.08,
        );
      });

      tl.to(
        p[`cardS_${ci}`]!,
        { opacity: 1, y: 0, duration: 0.18, ease: SOFT_OUT },
        cardAt + 0.7,
      );
    });

    // Headline + cards fade as the stamp arrives
    tl.to(p.fadeOut, { v: 0, duration: 0.4, ease: "power2.in" }, finalAt - 0.3);
    tl.to(p.finalIn, { v: 1, duration: 0.4, ease: SOFT_OUT }, finalAt);

    // Stamp lead words — "You're leaving"
    STAMP_LEAD.forEach((_, i) => {
      tl.to(
        p[`sl_${i}`]!,
        { opacity: 1, y: 0, duration: 0.18, ease: ELEMENT_SPRING },
        finalAt + 0.15 + i * 0.11,
      );
    });

    // 70% counter
    tl.to(p.stampNum, { opacity: 1, duration: 0.12 }, finalAt + 0.45);
    tl.to(
      p.stampNum,
      { value: 70, duration: 0.6, ease: SOFT_OUT, snap: { value: 1 } },
      finalAt + 0.45,
    );
    tl.to(
      p.stampNum,
      { scale: 1, duration: 0.5, ease: "back.out(1.6)" },
      finalAt + 0.45,
    );
    tl.to(
      p.stampNum,
      { letterSpacing: -0.04, duration: 0.4, ease: SOFT_OUT },
      finalAt + 0.45,
    );
    tl.to(
      p.stampNum,
      { letterSpacing: -0.025, duration: 0.4, ease: SOFT_OUT },
      finalAt + 0.85,
    );
    tl.to(p.stampPct, { opacity: 1, duration: 0.15 }, finalAt + 1.0);

    // Tail words — "on the table"
    STAMP_TAIL.forEach((_, i) => {
      tl.to(
        p[`st_${i}`]!,
        { opacity: 1, y: 0, duration: 0.18, ease: ELEMENT_SPRING },
        finalAt + 1.15 + i * 0.1,
      );
    });
  }, proxyKeys);

  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg, fontFamily: font }}>
      <TradingBackdrop />

      {/* Headline */}
      <div
        style={{
          position: "absolute",
          top: "12%",
          left: 0,
          right: 0,
          textAlign: "center",
          padding: "0 96px",
          opacity: s.fadeOut.v,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 12,
            fontFamily: monoFont,
            fontSize: 28,
            fontWeight: 500,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: colors.dim,
            marginBottom: 16,
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
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            flexWrap: "wrap",
            gap: "0 28px",
            fontFamily: font,
            fontSize: 96,
            fontWeight: 800,
            letterSpacing: "-0.04em",
            color: colors.fg,
            lineHeight: 0.95,
            textShadow: "0 4px 28px rgba(0,0,0,0.65)",
          }}
        >
          {HEADLINE.map((word, i) => {
            const proxy = s[`hl_${i}`]!;
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

      {/* Three cards */}
      <div
        style={{
          position: "absolute",
          top: "42%",
          left: 0,
          right: 0,
          display: "flex",
          alignItems: "stretch",
          justifyContent: "center",
          gap: 36,
          padding: "0 96px",
          opacity: s.fadeOut.v,
        }}
      >
        {CARDS.map((card, ci) => {
          const cardP = s[`card_${ci}`]!;
          const numP = s[`cardN_${ci}`]!;
          const glyphP = s[`cardG_${ci}`]!;
          const subP = s[`cardS_${ci}`]!;
          const counterP = card.counter ? s[`cardC_${ci}`]! : null;

          return (
            <div
              key={card.n}
              style={{
                flex: 1,
                maxWidth: 480,
                padding: "36px 36px 40px",
                border: `1px solid ${colors.accent}`,
                borderRadius: 4,
                backgroundColor: "rgba(255,59,59,0.04)",
                opacity: cardP.opacity,
                transform: `translateY(${cardP.y}px) scale(${cardP.scale})`,
                boxShadow:
                  "0 0 0 1px rgba(255,59,59,0.06), 0 12px 36px rgba(0,0,0,0.55)",
                display: "flex",
                flexDirection: "column",
                gap: 18,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  fontFamily: monoFont,
                  color: colors.dim,
                  fontSize: 22,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    opacity: numP.opacity,
                    transform: `translateY(${numP.y}px)`,
                  }}
                >
                  {card.n}
                </span>
                <span
                  style={{
                    display: "inline-block",
                    color: colors.accent,
                    fontSize: 30,
                    opacity: glyphP.opacity,
                    transform: `scale(${glyphP.scale})`,
                  }}
                >
                  {card.glyph}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0 12px",
                  fontFamily: font,
                  fontSize: 42,
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  color: colors.fg,
                  lineHeight: 1.1,
                }}
              >
                {counterP && card.counter && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "baseline",
                      color: colors.fg,
                      opacity: counterP.opacity,
                      transform: `scale(${counterP.scale})`,
                      transformOrigin: "left center",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    <span>{card.counter.prefix}</span>
                    <span>{Math.round(counterP.value)}</span>
                    <span>{card.counter.suffix}</span>
                  </span>
                )}
                {card.labelWords.map((word, wi) => {
                  const proxy = s[`cl_${ci}_${wi}`]!;
                  return (
                    <span
                      key={word + wi}
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
              <div
                style={{
                  marginTop: "auto",
                  fontFamily: monoFont,
                  fontSize: 18,
                  letterSpacing: "0.04em",
                  color: colors.dim,
                  opacity: subP.opacity * 0.85,
                  transform: `translateY(${subP.y}px)`,
                }}
              >
                {card.sub}
              </div>
            </div>
          );
        })}
      </div>

      {/* Final stamp */}
      {s.finalIn.v > 0.001 && (
        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
            background: `rgba(10,10,10,${0.78 * s.finalIn.v})`,
            backdropFilter: `blur(${2 * s.finalIn.v}px)`,
            opacity: s.finalIn.v,
          }}
        >
          <div
            style={{
              fontFamily: font,
              fontSize: 124,
              fontWeight: 800,
              color: colors.accent,
              lineHeight: 1.05,
              textAlign: "center",
              padding: "0 96px",
              textShadow: "0 4px 32px rgba(255,59,59,0.25)",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              alignItems: "center",
            }}
          >
            {/* Lead — "You're leaving" + number + % */}
            <div
              style={{
                display: "flex",
                gap: "0 24px",
                alignItems: "baseline",
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              {STAMP_LEAD.map((word, i) => {
                const proxy = s[`sl_${i}`]!;
                return (
                  <span
                    key={word + i}
                    style={{
                      display: "inline-block",
                      opacity: proxy.opacity,
                      transform: `translateY(${proxy.y}px)`,
                      letterSpacing: "-0.04em",
                    }}
                  >
                    {word}
                  </span>
                );
              })}
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "baseline",
                  opacity: s.stampNum.opacity,
                  transform: `scale(${s.stampNum.scale})`,
                  fontVariantNumeric: "tabular-nums",
                  letterSpacing: `${s.stampNum.letterSpacing}em`,
                }}
              >
                {Math.round(s.stampNum.value)}
                <span
                  style={{
                    opacity: s.stampPct.opacity,
                    letterSpacing: "-0.04em",
                  }}
                >
                  %
                </span>
              </span>
            </div>
            <div
              style={{
                display: "flex",
                gap: "0 24px",
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              {STAMP_TAIL.map((word, i) => {
                const proxy = s[`st_${i}`]!;
                return (
                  <span
                    key={word + i}
                    style={{
                      display: "inline-block",
                      opacity: proxy.opacity,
                      transform: `translateY(${proxy.y}px)`,
                      letterSpacing: "-0.04em",
                    }}
                  >
                    {word}
                  </span>
                );
              })}
            </div>
          </div>
        </AbsoluteFill>
      )}

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

const TradingBackdrop: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(180deg, #0d0d10 0%, #050507 100%)",
      }}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height="100%"
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0, opacity: 0.45 }}
      >
        {Array.from({ length: 12 }).map((_, i) => (
          <line
            key={`h${i}`}
            x1={0}
            x2={W}
            y1={(i + 1) * (H / 13)}
            y2={(i + 1) * (H / 13)}
            stroke="#16161b"
            strokeWidth={1}
          />
        ))}
        {Array.from({ length: 18 }).map((_, i) => (
          <line
            key={`v${i}`}
            x1={(i + 1) * (W / 19)}
            x2={(i + 1) * (W / 19)}
            y1={0}
            y2={H}
            stroke="#13131a"
            strokeWidth={1}
          />
        ))}
      </svg>
    </AbsoluteFill>
  );
};

void HERO_SPRING;

export const antiCheatRiggedMeta = {
  id: "AntiCheatRigged",
  component: AntiCheatRigged,
  durationInFrames: toFrames(SCENE_SECONDS),
  fps: FPS,
  width: W,
  height: H,
};
