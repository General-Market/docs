/**
 * SettlementsBarChart — Animated vertical bars, AI benchmark style
 *
 * Vision bar grows. "Nx more settlements" counter rides on top (1→48x).
 * Counter stays visible — no fling. 144 value label hidden.
 * Title is a subtitle, not a header.
 *
 * 144 / 3 (crypto perps, nearest competitor) = 48x.
 */
import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  spring,
  Easing,
} from "remotion";
import { COLOR, FONT } from "./tokens";

const FPS = 30;

// ── Data ──────────────────────────────────────────────────────────────

interface Bar {
  name: string;
  value: number;
  label: string;
  hero?: boolean;
}

const BARS: Bar[] = [
  { name: "Vision", value: 144, label: "144", hero: true },
  { name: "Crypto Perps", value: 3, label: "3" },
  { name: "Futures", value: 1, label: "1" },
  { name: "Options", value: 1, label: "1" },
  { name: "Prediction\nMarkets", value: 0.14, label: "~1/wk" },
];

// Multiplier: 144 / 3 (nearest competitor) = 48x
const MULTIPLIER = 48;

// ── Layout ────────────────────────────────────────────────────────────

const HERO_COLOR = "#00C853";
const MUTED_COLOR = "#A0A0A0";

const BAR_W = 130;
const BAR_GAP = 50;
const BLOCK_W = BARS.length * BAR_W + (BARS.length - 1) * BAR_GAP;
const BLOCK_LEFT = (1920 - BLOCK_W) / 2;

const BASELINE = 880;
const CEILING = 180;
const CHART_H = BASELINE - CEILING;
const MAX_VAL = 150;

const GRID_LINES = [0, 50, 100, 150];

function barHeight(value: number): number {
  return Math.max(6, (value / MAX_VAL) * CHART_H);
}

function gridY(value: number): number {
  return BASELINE - (value / MAX_VAL) * CHART_H;
}

// ── Timing ────────────────────────────────────────────────────────────

const STATIC_END = 15;
const GROW_START = 20;
const GROW_END = 55;

// ── Component ─────────────────────────────────────────────────────────

export const SettlementsBarChart: React.FC = () => {
  const frame = useCurrentFrame();

  const staticOp = interpolate(frame, [0, STATIC_END], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  const growRaw = interpolate(frame, [GROW_START, GROW_END], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
    easing: Easing.bezier(0.25, 0.1, 0.25, 1),
  });

  const settleSpring = spring({
    frame: Math.max(0, frame - GROW_END),
    fps: FPS,
    config: { damping: 12, stiffness: 200, mass: 0.3 },
  });
  const overshoot = frame > GROW_END
    ? interpolate(settleSpring, [0, 1], [1.06, 1])
    : 1;
  const heroGrow = growRaw * overshoot;

  // Counter: 1 → MULTIPLIER as bar grows
  const counter = Math.max(1, Math.round(
    interpolate(growRaw, [0, 1], [1, MULTIPLIER], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp",
    })
  ));

  // Counter position: rides on top of bar
  const heroH = barHeight(144);
  const heroBarTop = BASELINE - heroH * heroGrow;
  const counterVisible = frame >= GROW_START;

  return (
    <AbsoluteFill style={{ backgroundColor: COLOR.page }}>
      {/* ── Subtitle-style title (lower, smaller) ─────── */}
      <div style={{
        position: "absolute", bottom: 30, left: 0, right: 0,
        textAlign: "center", fontFamily: FONT.sans, fontSize: 24,
        fontWeight: 500, color: COLOR.textSecondary, opacity: staticOp,
        letterSpacing: "-0.01em",
      }}>
        Settlements per Day — Average Across All Markets
      </div>

      {/* ── Grid lines ─────────────────────────────────── */}
      <svg style={{
        position: "absolute", top: 0, left: 0,
        width: 1920, height: 1080, pointerEvents: "none",
        opacity: staticOp,
      }}>
        {GRID_LINES.map((v) => {
          const y = gridY(v);
          return (
            <g key={`grid-${v}`}>
              <line x1={BLOCK_LEFT - 20} y1={y}
                x2={BLOCK_LEFT + BLOCK_W + 20} y2={y}
                stroke={COLOR.textMuted} strokeWidth={1}
                opacity={v === 0 ? 0.2 : 0.08} />
              {v > 0 && (
                <text x={BLOCK_LEFT - 30} y={y + 5} textAnchor="end"
                  fontFamily="Geist, Inter, sans-serif" fontSize={18}
                  fill={COLOR.textMuted}>
                  {v}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* ── Bars ───────────────────────────────────────── */}
      {BARS.map((bar, i) => {
        const x = BLOCK_LEFT + i * (BAR_W + BAR_GAP);
        const isHero = !!bar.hero;
        const color = isHero ? HERO_COLOR : MUTED_COLOR;
        const h = isHero ? barHeight(bar.value) * heroGrow : barHeight(bar.value);
        const y = BASELINE - h;
        const op = isHero ? 1 : staticOp * 0.5;

        // Non-hero value labels only
        const valueLabelOp = isHero ? 0 : staticOp;

        return (
          <React.Fragment key={bar.name}>
            {/* Bar */}
            <div style={{
              position: "absolute", left: x, top: y,
              width: BAR_W, height: Math.max(0, h),
              backgroundColor: color, borderRadius: "6px 6px 0 0",
              opacity: op,
            }} />

            {/* Value label — non-hero only (hero shows counter instead) */}
            {!isHero && (
              <div style={{
                position: "absolute", left: x, top: y - 32,
                width: BAR_W, textAlign: "center",
                fontFamily: FONT.sans, fontSize: 22, fontWeight: 500,
                color: COLOR.textMuted, opacity: valueLabelOp,
              }}>
                {bar.label}
              </div>
            )}

            {/* Category label */}
            <div style={{
              position: "absolute", left: x, top: BASELINE + 16,
              width: BAR_W, textAlign: "center",
              fontFamily: FONT.sans, fontSize: 20,
              fontWeight: isHero ? 600 : 500,
              color: isHero ? COLOR.textPrimary : COLOR.textSecondary,
              lineHeight: 1.25, whiteSpace: "pre-line",
              opacity: staticOp,
            }}>
              {bar.name}
            </div>
          </React.Fragment>
        );
      })}

      {/* ── "Nx more settlements" — BIG, rides bar top, stays ── */}
      {counterVisible && (
        <div style={{
          position: "absolute",
          left: BLOCK_LEFT,
          width: BAR_W,
          top: heroBarTop - 120,
          textAlign: "center",
        }}>
          <div style={{
            fontFamily: FONT.sans,
            fontSize: 96,
            fontWeight: 800,
            color: HERO_COLOR,
            letterSpacing: "-0.04em",
            lineHeight: 1,
          }}>
            {counter}x
          </div>
          <div style={{
            fontFamily: FONT.sans,
            fontSize: 24,
            fontWeight: 600,
            color: HERO_COLOR,
            marginTop: 4,
            whiteSpace: "nowrap",
          }}>
            more settlements
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
