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

const SCENE_SECONDS = 8;
const SECOND_LINE_AT_SEC = 4; // matches the original 4s second-line trigger
const GREEN = "#3ddc84";

const FIRST = ["Trade", "all", "the", "same", "assets"] as const;
const SECOND_LEAD = ["but"] as const;
const TAIL = [
  "Same",
  "markets",
  "·",
  "same",
  "speed",
  "·",
  "cheaters",
  "removed",
] as const;

export const AntiCheatReassure: React.FC = () => {
  const proxyKeys: Record<string, Record<string, number>> = {
    firstLift: { y: 0 },
    shield: { opacity: 0, scale: 0.85 },
    secondDots: { opacity: 0, y: 18 },
    shielded: { opacity: 0, y: 18, scale: 0.7, letterSpacing: -0.02 },
  };
  FIRST.forEach((_, i) => {
    proxyKeys[`f_${i}`] = { opacity: 0, y: 18 };
  });
  SECOND_LEAD.forEach((_, i) => {
    proxyKeys[`sl_${i}`] = { opacity: 0, y: 18 };
  });
  TAIL.forEach((_, i) => {
    proxyKeys[`t_${i}`] = { opacity: 0, y: 10 };
  });

  const s = useGsapProxy((tl, p) => {
    // First line — word stagger
    FIRST.forEach((_, i) => {
      tl.to(
        p[`f_${i}`]!,
        { opacity: 1, y: 0, duration: 0.18, ease: ELEMENT_SPRING },
        0.05 + i * 0.12,
      );
    });

    // First line drifts up as the second arrives
    tl.to(
      p.firstLift,
      { y: -64, duration: 0.7, ease: SOFT_OUT },
      SECOND_LINE_AT_SEC - 0.3,
    );

    // Shield reveals with the second line
    tl.to(
      p.shield,
      { opacity: 0.06, scale: 1, duration: 0.9, ease: SOFT_OUT },
      SECOND_LINE_AT_SEC - 0.05,
    );

    // ". . ." dots
    tl.to(
      p.secondDots,
      { opacity: 1, y: 0, duration: 0.22, ease: SOFT_OUT },
      SECOND_LINE_AT_SEC + 0.05,
    );

    // "but" word
    SECOND_LEAD.forEach((_, i) => {
      tl.to(
        p[`sl_${i}`]!,
        { opacity: 1, y: 0, duration: 0.18, ease: ELEMENT_SPRING },
        SECOND_LINE_AT_SEC + 0.25 + i * 0.12,
      );
    });

    // "shielded" — hero word
    tl.to(
      p.shielded,
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.5,
        ease: HERO_SPRING,
      },
      SECOND_LINE_AT_SEC + 0.45,
    );
    tl.to(
      p.shielded,
      { letterSpacing: -0.04, duration: 0.4, ease: SOFT_OUT },
      SECOND_LINE_AT_SEC + 0.45,
    );
    tl.to(
      p.shielded,
      { letterSpacing: -0.025, duration: 0.4, ease: SOFT_OUT },
      SECOND_LINE_AT_SEC + 0.85,
    );

    // Tail — word cascade
    TAIL.forEach((_, i) => {
      tl.to(
        p[`t_${i}`]!,
        { opacity: 1, y: 0, duration: 0.16, ease: "power2.out" },
        SECOND_LINE_AT_SEC + 0.9 + i * 0.08,
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
        overflow: "hidden",
      }}
    >
      {/* Faint shield in the back */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: s.shield.opacity,
          transform: `scale(${s.shield.scale})`,
        }}
      >
        <ShieldGlyph />
      </div>

      <div
        style={{
          textAlign: "center",
          position: "relative",
        }}
      >
        {/* First line — word stagger */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            flexWrap: "wrap",
            gap: "0 24px",
            fontFamily: font,
            fontSize: 124,
            fontWeight: 800,
            letterSpacing: "-0.04em",
            color: colors.fg,
            lineHeight: 0.95,
            textShadow: "0 4px 28px rgba(0,0,0,0.65)",
            transform: `translateY(${s.firstLift.y}px)`,
          }}
        >
          {FIRST.map((word, i) => {
            const proxy = s[`f_${i}`]!;
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
              color: colors.fg,
              opacity: 0.45 * (s[`f_${FIRST.length - 1}`]!.opacity),
            }}
          >
            .
          </span>
        </div>

        {/* Second line — ". . . but shielded." */}
        <div
          style={{
            marginTop: 36,
            display: "flex",
            justifyContent: "center",
            alignItems: "baseline",
            flexWrap: "wrap",
            gap: "0 18px",
            fontFamily: font,
            fontSize: 96,
            fontWeight: 700,
            letterSpacing: "-0.025em",
            color: colors.fg,
          }}
        >
          <span
            style={{
              display: "inline-block",
              color: colors.dim,
              opacity: s.secondDots.opacity * 0.7,
              transform: `translateY(${s.secondDots.y}px)`,
            }}
          >
            .&nbsp;.&nbsp;.
          </span>
          {SECOND_LEAD.map((word, i) => {
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
              color: GREEN,
              opacity: s.shielded.opacity,
              transform: `translateY(${s.shielded.y}px) scale(${s.shielded.scale})`,
              letterSpacing: `${s.shielded.letterSpacing}em`,
            }}
          >
            shielded
          </span>
          <span
            style={{
              color: colors.fg,
              opacity: 0.45 * s.shielded.opacity,
            }}
          >
            .
          </span>
        </div>

        {/* Tail — same markets · same speed · cheaters removed */}
        <div
          style={{
            marginTop: 40,
            display: "flex",
            justifyContent: "center",
            flexWrap: "wrap",
            gap: "0 14px",
            fontFamily: monoFont,
            fontSize: 24,
            fontWeight: 500,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: colors.dim,
          }}
        >
          {TAIL.map((word, i) => {
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

const ShieldGlyph: React.FC = () => {
  return (
    <svg
      width={900}
      height={1000}
      viewBox="0 0 100 110"
      preserveAspectRatio="xMidYMid meet"
    >
      <path
        d="M50 4 L92 18 L92 56 C92 82 72 99 50 106 C28 99 8 82 8 56 L8 18 Z"
        fill="none"
        stroke="#3ddc84"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <path
        d="M30 56 L46 72 L72 40"
        fill="none"
        stroke="#3ddc84"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export const antiCheatReassureMeta = {
  id: "AntiCheatReassure",
  component: AntiCheatReassure,
  durationInFrames: toFrames(SCENE_SECONDS),
  fps: FPS,
  width: W,
  height: H,
};
