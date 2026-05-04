import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { font, monoFont } from "../../common/fonts";
import { FPS, H, W, colors, toFrames } from "./theme";
import {
  useGsapProxy,
  HERO_SPRING,
  ELEMENT_SPRING,
  SOFT_OUT,
} from "../replicates/rainbows-pitch/gsapUtils";

const SCENE_SECONDS = 10;

// Phase split — first half is the stat, second half is the chips.
const PHASE_SWITCH_SEC = 5;

const EYEBROW = ["Cheaters", "→", "Profits"] as const;
const SUBLINE = [
  "0.01%",
  "of",
  "cheaters",
  "claim",
  "70%",
  "of",
  "all",
  "profits.",
] as const;
const CHIPS = ["Perps", "Options", "Predictions", "Launchpads"] as const;
const CHIPS_HEAD = ["Every", "market", "they", "touch"] as const;
const CHIPS_TAIL_A = ["Leaving", "you", "with"] as const;
const CHIPS_TAIL_B = "nearly none.";

// ─── Backdrop (untouched) ─────────────────────────────────────────────────────

const TradingBackdrop: React.FC = () => {
  const frame = useCurrentFrame();
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
        style={{ position: "absolute", inset: 0, opacity: 0.55 }}
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
        {Array.from({ length: 60 }).map((_, i) => {
          const seedA = pseudo(i * 1.31 + frame * 0.01);
          const seedB = pseudo(i * 0.77 + 9.1);
          const cx = (i / 60) * W + (i % 2 === 0 ? 6 : -3);
          const cy = H * 0.42 + Math.sin(i * 0.41 + frame * 0.012) * 90;
          const len = 60 + seedA * 110;
          const w = 12;
          const isUp = seedB > 0.5;
          const fill = isUp ? "#1c2a22" : "#2a1a1c";
          const stroke = isUp ? "#1f3a2a" : "#3a1f22";
          return (
            <g key={i} opacity={0.55}>
              <line
                x1={cx + w / 2}
                x2={cx + w / 2}
                y1={cy - len * 0.7}
                y2={cy + len * 0.7}
                stroke={stroke}
                strokeWidth={1.2}
              />
              <rect
                x={cx}
                y={cy - len / 2}
                width={w}
                height={len}
                fill={fill}
              />
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

// ─── Component ────────────────────────────────────────────────────────────────

export const AntiCheatStat: React.FC = () => {
  const proxyKeys: Record<string, Record<string, number>> = {
    phaseStat: { opacity: 1 },
    phaseChips: { opacity: 0 },
    leftNum: { value: 0, scale: 0.7, opacity: 0, letterSpacing: -0.02 },
    leftPct: { opacity: 0 },
    rightNum: { value: 0, scale: 0.7, opacity: 0, letterSpacing: -0.02 },
    rightPct: { opacity: 0 },
    leftSub: { opacity: 0, y: 10 },
    rightSub: { opacity: 0, y: 10 },
    arrow: { value: 0 },
    subline: { opacity: 1 },
    chipsHead: { opacity: 1 },
    chipsTail: { opacity: 1 },
    chipsTailHero: { letterSpacing: -0.02 },
  };
  EYEBROW.forEach((_, i) => {
    proxyKeys[`eb_${i}`] = { opacity: 0, y: 10 };
  });
  SUBLINE.forEach((_, i) => {
    proxyKeys[`sl_${i}`] = { opacity: 0, y: 10 };
  });
  CHIPS_HEAD.forEach((_, i) => {
    proxyKeys[`ch_${i}`] = { opacity: 0, y: 10 };
  });
  CHIPS_TAIL_A.forEach((_, i) => {
    proxyKeys[`ct_${i}`] = { opacity: 0, y: 10 };
  });
  proxyKeys.ctHero = { opacity: 0, y: 10 };
  CHIPS.forEach((_, i) => {
    proxyKeys[`chip_${i}`] = {
      opacity: 0,
      scale: 0.6,
      borderColor: 0,
    };
  });

  const s = useGsapProxy((tl, p) => {
    // ─── PHASE 1 — stat ─────────────────────────────────────────
    EYEBROW.forEach((_, i) => {
      tl.to(
        p[`eb_${i}`]!,
        { opacity: 1, y: 0, duration: 0.16, ease: "power2.out" },
        i * 0.11,
      );
    });

    // Left counter — 0.0 → 0.01 (snap 0.01)
    tl.to(p.leftNum, { opacity: 1, duration: 0.12 }, 0.5);
    tl.to(
      p.leftNum,
      {
        value: 0.01,
        duration: 0.6,
        ease: SOFT_OUT,
        snap: { value: 0.01 },
      },
      0.5,
    );
    tl.to(
      p.leftNum,
      { scale: 1, duration: 0.5, ease: "back.out(1.6)" },
      0.5,
    );
    tl.to(
      p.leftNum,
      { letterSpacing: -0.04, duration: 0.4, ease: SOFT_OUT },
      0.5,
    );
    tl.to(
      p.leftNum,
      { letterSpacing: -0.025, duration: 0.4, ease: SOFT_OUT },
      0.9,
    );
    tl.to(p.leftPct, { opacity: 1, duration: 0.15 }, 1.05);
    tl.to(
      p.leftSub,
      { opacity: 1, y: 0, duration: 0.22, ease: SOFT_OUT },
      1.2,
    );

    // Arrow draws from 0.7 → 1.7s
    tl.to(p.arrow, { value: 1, duration: 1.0, ease: SOFT_OUT }, 0.7);

    // Right counter — 0 → 70 (snap 1)
    tl.to(p.rightNum, { opacity: 1, duration: 0.12 }, 1.5);
    tl.to(
      p.rightNum,
      {
        value: 70,
        duration: 0.65,
        ease: SOFT_OUT,
        snap: { value: 1 },
      },
      1.5,
    );
    tl.to(
      p.rightNum,
      { scale: 1, duration: 0.5, ease: "back.out(1.6)" },
      1.5,
    );
    tl.to(
      p.rightNum,
      { letterSpacing: -0.04, duration: 0.4, ease: SOFT_OUT },
      1.5,
    );
    tl.to(
      p.rightNum,
      { letterSpacing: -0.025, duration: 0.4, ease: SOFT_OUT },
      1.9,
    );
    tl.to(p.rightPct, { opacity: 1, duration: 0.15 }, 2.1);
    tl.to(
      p.rightSub,
      { opacity: 1, y: 0, duration: 0.22, ease: SOFT_OUT },
      2.25,
    );

    // Subline cascades after the numbers land
    SUBLINE.forEach((_, i) => {
      tl.to(
        p[`sl_${i}`]!,
        { opacity: 1, y: 0, duration: 0.16, ease: "power2.out" },
        2.6 + i * 0.1,
      );
    });

    // ─── Phase crossfade ─────────────────────────────────────────
    tl.to(p.phaseStat, { opacity: 0, duration: 0.18, ease: "power2.in" }, PHASE_SWITCH_SEC - 0.1);
    tl.to(p.phaseChips, { opacity: 1, duration: 0.18, ease: "power2.out" }, PHASE_SWITCH_SEC);

    // ─── PHASE 2 — chips ─────────────────────────────────────────
    const P2 = PHASE_SWITCH_SEC + 0.05;
    CHIPS_HEAD.forEach((_, i) => {
      tl.to(
        p[`ch_${i}`]!,
        { opacity: 1, y: 0, duration: 0.16, ease: "power2.out" },
        P2 + i * 0.1,
      );
    });

    // Chip stamps — 0.10s apart, scale 0.6 → 1.0 with back.out(1.6)
    CHIPS.forEach((_, i) => {
      const at = P2 + 0.55 + i * 0.1;
      tl.to(
        p[`chip_${i}`]!,
        {
          opacity: 1,
          scale: 1,
          duration: 0.45,
          ease: "back.out(1.6)",
        },
        at,
      );
      // Border flash — accent (1) → dim (0) over the next 0.25s
      tl.fromTo(
        p[`chip_${i}`]!,
        { borderColor: 1 },
        { borderColor: 0, duration: 0.25, ease: SOFT_OUT },
        at + 0.45,
      );
    });

    // Tail line — "Leaving you with nearly none."
    const tailAt = P2 + 1.4;
    CHIPS_TAIL_A.forEach((_, i) => {
      tl.to(
        p[`ct_${i}`]!,
        { opacity: 1, y: 0, duration: 0.16, ease: "power2.out" },
        tailAt + i * 0.1,
      );
    });
    tl.to(
      p.ctHero,
      { opacity: 1, y: 0, duration: 0.5, ease: HERO_SPRING },
      tailAt + 0.4,
    );
    tl.fromTo(
      p.chipsTailHero,
      { letterSpacing: -0.04 },
      { letterSpacing: -0.025, duration: 0.4, ease: SOFT_OUT },
      tailAt + 0.45,
    );
  }, proxyKeys);

  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg, fontFamily: font }}>
      <TradingBackdrop />

      {/* ── Phase 1 — stat ── */}
      <AbsoluteFill style={{ opacity: s.phaseStat.opacity }}>
        {/* Eyebrow */}
        <div
          style={{
            position: "absolute",
            top: "18%",
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            gap: 14,
            fontFamily: monoFont,
            fontSize: 28,
            fontWeight: 500,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: colors.dim,
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

        {/* Big numbers row */}
        <div
          style={{
            position: "absolute",
            top: "32%",
            left: 0,
            right: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 72,
            padding: "0 96px",
          }}
        >
          {/* Left — 0.01% */}
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "center",
                opacity: s.leftNum.opacity,
                transform: `scale(${s.leftNum.scale})`,
              }}
            >
              <span
                style={{
                  fontFamily: font,
                  fontSize: 240,
                  fontWeight: 800,
                  color: colors.fg,
                  lineHeight: 0.95,
                  textShadow: "0 4px 28px rgba(0,0,0,0.65)",
                  fontVariantNumeric: "tabular-nums",
                  letterSpacing: `${s.leftNum.letterSpacing}em`,
                }}
              >
                {s.leftNum.value.toFixed(2)}
              </span>
              <span
                style={{
                  fontFamily: font,
                  fontSize: 240,
                  fontWeight: 800,
                  color: colors.fg,
                  letterSpacing: "-0.04em",
                  opacity: s.leftPct.opacity,
                }}
              >
                %
              </span>
            </div>
            <div
              style={{
                marginTop: 18,
                fontFamily: monoFont,
                fontSize: 24,
                fontWeight: 500,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: colors.dim,
                opacity: s.leftSub.opacity,
                transform: `translateY(${s.leftSub.y}px)`,
              }}
            >
              of traders
            </div>
          </div>

          <ArrowFlow t={s.arrow.value} />

          {/* Right — 70% */}
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "center",
                opacity: s.rightNum.opacity,
                transform: `scale(${s.rightNum.scale})`,
              }}
            >
              <span
                style={{
                  fontFamily: font,
                  fontSize: 240,
                  fontWeight: 800,
                  color: colors.accent,
                  lineHeight: 0.95,
                  textShadow: "0 4px 28px rgba(0,0,0,0.65)",
                  fontVariantNumeric: "tabular-nums",
                  letterSpacing: `${s.rightNum.letterSpacing}em`,
                }}
              >
                {Math.round(s.rightNum.value)}
              </span>
              <span
                style={{
                  fontFamily: font,
                  fontSize: 240,
                  fontWeight: 800,
                  color: colors.accent,
                  letterSpacing: "-0.04em",
                  opacity: s.rightPct.opacity,
                }}
              >
                %
              </span>
            </div>
            <div
              style={{
                marginTop: 18,
                fontFamily: monoFont,
                fontSize: 24,
                fontWeight: 500,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: colors.dim,
                opacity: s.rightSub.opacity,
                transform: `translateY(${s.rightSub.y}px)`,
              }}
            >
              of all profits
            </div>
          </div>
        </div>

        {/* Subline */}
        <div
          style={{
            position: "absolute",
            bottom: "20%",
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            flexWrap: "wrap",
            gap: "0 14px",
            fontFamily: font,
            fontSize: 44,
            fontWeight: 500,
            letterSpacing: "-0.01em",
            color: colors.fg,
            padding: "0 96px",
          }}
        >
          {SUBLINE.map((word, i) => {
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
        </div>
      </AbsoluteFill>

      {/* ── Phase 2 — chips ── */}
      <AbsoluteFill style={{ opacity: s.phaseChips.opacity }}>
        <div
          style={{
            position: "absolute",
            top: "30%",
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            gap: 14,
            fontFamily: monoFont,
            fontSize: 28,
            fontWeight: 500,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: colors.dim,
          }}
        >
          {CHIPS_HEAD.map((word, i) => {
            const proxy = s[`ch_${i}`]!;
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
            position: "absolute",
            top: "40%",
            left: 0,
            right: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 28,
            padding: "0 96px",
            flexWrap: "wrap",
          }}
        >
          {CHIPS.map((label, i) => {
            const proxy = s[`chip_${i}`]!;
            // Border flash from accent → dim
            const flash = proxy.borderColor;
            const borderColor = blendHex(colors.accent, colors.dim, 1 - flash);
            return (
              <div
                key={label}
                style={{
                  fontFamily: monoFont,
                  fontSize: 56,
                  fontWeight: 500,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: colors.fg,
                  padding: "22px 38px",
                  border: `1px solid ${borderColor}`,
                  borderRadius: 4,
                  backgroundColor: "rgba(255,59,59,0.04)",
                  boxShadow:
                    "0 0 0 1px rgba(255,59,59,0.08), 0 8px 32px rgba(0,0,0,0.45)",
                  opacity: proxy.opacity,
                  transform: `scale(${proxy.scale})`,
                }}
              >
                {label}
              </div>
            );
          })}
        </div>

        <div
          style={{
            position: "absolute",
            bottom: "20%",
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            flexWrap: "wrap",
            gap: "0 16px",
            padding: "0 96px",
            fontFamily: font,
            fontSize: 64,
            fontWeight: 700,
            letterSpacing: "-0.025em",
            color: colors.fg,
          }}
        >
          {CHIPS_TAIL_A.map((word, i) => {
            const proxy = s[`ct_${i}`]!;
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
              color: colors.accent,
              opacity: s.ctHero.opacity,
              transform: `translateY(${s.ctHero.y}px)`,
              letterSpacing: `${s.chipsTailHero.letterSpacing}em`,
            }}
          >
            {CHIPS_TAIL_B}
          </span>
        </div>
      </AbsoluteFill>

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

// ArrowFlow uses the proxy `t` (0..1) so the draw is timeline-driven.
const ArrowFlow: React.FC<{ t: number }> = ({ t }) => {
  const length = 220;
  const drawn = Math.max(0, Math.min(length, length * t));
  const headOpacity = t > 0.92 ? 1 : 0;
  return (
    <svg width={length + 40} height={120} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="arrow-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={colors.dim} stopOpacity={0.6} />
          <stop offset="100%" stopColor={colors.accent} stopOpacity={1} />
        </linearGradient>
      </defs>
      <line
        x1={0}
        y1={60}
        x2={drawn}
        y2={60}
        stroke="url(#arrow-grad)"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <g opacity={headOpacity}>
        <line
          x1={length - 14}
          y1={60 - 14}
          x2={length}
          y2={60}
          stroke={colors.accent}
          strokeWidth={3}
          strokeLinecap="round"
        />
        <line
          x1={length - 14}
          y1={60 + 14}
          x2={length}
          y2={60}
          stroke={colors.accent}
          strokeWidth={3}
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pseudo(seed: number): number {
  const v = (Math.sin(seed * 12.9898) * 43758.5453) % 1;
  return v < 0 ? v + 1 : v;
}

function blendHex(a: string, b: string, t: number): string {
  // t = 0 → all `a`, t = 1 → all `b`. Both must be #rrggbb.
  const ar = parseInt(a.slice(1, 3), 16);
  const ag = parseInt(a.slice(3, 5), 16);
  const ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16);
  const bg = parseInt(b.slice(3, 5), 16);
  const bb = parseInt(b.slice(5, 7), 16);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${bl.toString(16).padStart(2, "0")}`;
}

// ELEMENT_SPRING is exported by gsapUtils — keep the import even if unused.
void ELEMENT_SPRING;

export const antiCheatStatMeta = {
  id: "AntiCheatStat",
  component: AntiCheatStat,
  durationInFrames: toFrames(SCENE_SECONDS),
  fps: FPS,
  width: W,
  height: H,
};
