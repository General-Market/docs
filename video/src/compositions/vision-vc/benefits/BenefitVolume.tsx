/**
 * BenefitVolume — The double punch. Bigger, slower, heavier.
 *
 * Phase 1 (f0-20):  "Your edge: 54%" — HUGE green number
 * Phase 2 (f20-50): 10 big squares, result: -$340 (bold red)
 * Phase 3 (f50-88): Year calendar, 22 red weeks. "Your edge is real. Your volume isn't."
 * Phase 4 (f88-120): Same calendar, all green. "+$12,400/week."
 * Phase 5 (f120-130): Fade
 */
import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { COLOR, FONT } from "../tokens";
import { DecoGrid } from "../overlays/DecoGrid";
import { Eyebrow } from "../overlays/Eyebrow";

interface BenefitVolumeProps {
  durationInFrames: number;
}

// 10 trades: 4 wins, 6 losses
const WEEK_TRADES: boolean[] = [true, false, true, false, false, true, false, false, true, false];

// 52 weeks at 10 trades/day with 54% edge: ~30 green, ~22 red
const YEAR_10: boolean[] = [
  true, false, true, true, false, true, false, true, true, false,
  true, true, false, true, false, false, true, true, false, true,
  false, true, true, false, true, false, true, true, false, true,
  true, false, false, true, true, false, true, false, true, true,
  false, true, true, false, true, true, false, true, false, true,
  true, false,
];

const YEAR_1M: boolean[] = Array(52).fill(true);

const SQ_SMALL = 38;  // calendar square
const SQ_BIG = 56;    // trade result square

const Square: React.FC<{ win: boolean; size: number; opacity: number }> = ({ win, size, opacity }) => (
  <div style={{
    width: size, height: size,
    borderRadius: size > 40 ? 6 : 4,
    backgroundColor: win ? COLOR.up : COLOR.down,
    opacity: opacity * (win ? 0.9 : 0.8),
  }} />
);

export const BenefitVolume: React.FC<BenefitVolumeProps> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ═══ Staggered spring entrances ═══
  const titleSpring = spring({ frame, fps, config: { damping: 12 }, delay: 0 });
  const gridSpring = spring({ frame, fps, config: { damping: 12 }, delay: 6 });
  const numbersSpring = spring({ frame, fps, config: { damping: 12 }, delay: 12 });

  const titleEntrY = interpolate(titleSpring, [0, 1], [25, 0]);
  const titleEntrOp = interpolate(titleSpring, [0, 0.5], [0, 1], { extrapolateRight: "clamp" });
  const gridEntrY = interpolate(gridSpring, [0, 1], [25, 0]);
  const gridEntrOp = interpolate(gridSpring, [0, 0.5], [0, 1], { extrapolateRight: "clamp" });
  const numbersEntrY = interpolate(numbersSpring, [0, 1], [25, 0]);
  const numbersEntrOp = interpolate(numbersSpring, [0, 0.5], [0, 1], { extrapolateRight: "clamp" });

  const fadeOut = interpolate(frame, [durationInFrames - 10, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // ═══ PHASE 1: "54%" ═══
  const p1Active = frame < 22;
  const p1Op = interpolate(frame, [3, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const p1Dim = interpolate(frame, [18, 22], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // ═══ PHASE 2: 10 trades ═══
  const p2Start = 20;
  const p2Active = frame >= p2Start && frame < 52;
  const p2Label = interpolate(frame, [p2Start, p2Start + 5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const tradeOps = WEEK_TRADES.map((_, i) => {
    const a = p2Start + 4 + i * 2;
    return interpolate(frame, [a, a + 3], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  });
  const p2Result = interpolate(frame, [p2Start + 26, p2Start + 32], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const p2Dim = interpolate(frame, [48, 52], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // ═══ PHASE 3: Year calendar ═══
  const p3Start = 50;
  const p3Active = frame >= p3Start && frame < 90;
  const p3Label = interpolate(frame, [p3Start, p3Start + 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const calOps = YEAR_10.map((_, i) => {
    const a = p3Start + 5 + i * 0.4;
    return interpolate(frame, [a, a + 3], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  });
  const p3Devastate = interpolate(frame, [p3Start + 28, p3Start + 36], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const p3Dim = interpolate(frame, [86, 90], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // ═══ PHASE 4: All green ═══
  const p4Start = 88;
  const p4Active = frame >= p4Start;
  const p4Label = interpolate(frame, [p4Start, p4Start + 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const reliefOps = YEAR_1M.map((_, i) => {
    const a = p4Start + 4 + i * 0.2;
    return interpolate(frame, [a, a + 2], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  });
  const p4Result = interpolate(frame, [p4Start + 18, p4Start + 26], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const redWeeks = YEAR_10.filter(w => !w).length;

  return (
    <AbsoluteFill style={{ backgroundColor: COLOR.page, opacity: fadeOut }}>

      {/* Decorative SVG grid — ascending bars */}
      <DecoGrid variant="bars" opacity={0.3} />

      {/* Eyebrow label */}
      <div style={{
        position: "absolute", top: 40, left: 60,
        opacity: interpolate(frame, [3, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) * titleEntrOp,
        transform: `translateY(${titleEntrY}px)`,
      }}>
        <Eyebrow color={COLOR.brand} text="02 — Volume" />
      </div>

      {/* PHASE 1: "54%" */}
      {p1Active && (
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)", textAlign: "center",
          opacity: p1Op * p1Dim,
        }}>
          <div style={{
            fontFamily: FONT.sans, fontSize: 18, fontWeight: 600,
            color: COLOR.textMuted, letterSpacing: "0.1em", textTransform: "uppercase",
            marginBottom: 16,
            opacity: gridEntrOp,
            transform: `translateY(${gridEntrY}px)`,
          }}>You have a 54% edge.</div>
          <div style={{
            fontFamily: FONT.mono, fontSize: 160, fontWeight: 700,
            color: COLOR.brand, letterSpacing: "-0.04em",
            opacity: gridEntrOp,
            transform: `translateY(${gridEntrY}px)`,
          }}>54%</div>
          <div style={{
            fontFamily: FONT.sans, fontSize: 26, fontWeight: 600,
            color: COLOR.textSecondary, marginTop: 12,
            opacity: numbersEntrOp,
            transform: `translateY(${numbersEntrY}px)`,
          }}>So why are you losing?</div>
        </div>
      )}

      {/* PHASE 2: 10 trades */}
      {p2Active && (
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)", textAlign: "center",
          opacity: p2Dim,
        }}>
          <div style={{
            fontFamily: FONT.sans, fontSize: 16, fontWeight: 600,
            color: COLOR.textMuted, letterSpacing: "0.08em", textTransform: "uppercase",
            marginBottom: 20, opacity: p2Label,
          }}>This week — 10 trades</div>

          {/* 2 rows of 5 — bigger squares */}
          <div style={{
            display: "grid", gridTemplateColumns: `repeat(5, ${SQ_BIG}px)`,
            gap: 14, justifyContent: "center", marginBottom: 28,
          }}>
            {WEEK_TRADES.map((win, i) => (
              <Square key={i} win={win} size={SQ_BIG} opacity={tradeOps[i]} />
            ))}
          </div>

          <div style={{ opacity: p2Result }}>
            <div style={{
              fontFamily: FONT.mono, fontSize: 52, fontWeight: 700,
              color: COLOR.down,
            }}>-$340</div>
            <div style={{
              fontFamily: FONT.sans, fontSize: 18, fontWeight: 500,
              color: COLOR.textSecondary, marginTop: 8,
            }}>4 wins, 6 losses — you lost despite a 54% edge</div>
          </div>
        </div>
      )}

      {/* PHASE 3: Year calendar */}
      {p3Active && (
        <div style={{
          position: "absolute", top: "46%", left: "50%",
          transform: "translate(-50%, -50%)", textAlign: "center",
          opacity: p3Dim,
        }}>
          <div style={{
            fontFamily: FONT.sans, fontSize: 16, fontWeight: 600,
            color: COLOR.textMuted, letterSpacing: "0.08em", textTransform: "uppercase",
            marginBottom: 8, opacity: p3Label,
          }}>Your year — 52 weeks at 10 trades/day</div>
          <div style={{
            fontFamily: FONT.sans, fontSize: 13, fontWeight: 500,
            color: COLOR.textDim, marginBottom: 20, opacity: p3Label,
          }}>Same 54% edge. Each square = one week.</div>

          <div style={{
            display: "grid", gridTemplateColumns: `repeat(13, ${SQ_SMALL}px)`,
            gap: 6, justifyContent: "center", marginBottom: 28,
          }}>
            {YEAR_10.map((win, i) => (
              <Square key={i} win={win} size={SQ_SMALL} opacity={calOps[i]} />
            ))}
          </div>

          <div style={{ opacity: p3Devastate }}>
            <div style={{
              fontFamily: FONT.mono, fontSize: 24, fontWeight: 700,
              color: COLOR.down, marginBottom: 12,
            }}>{redWeeks} red weeks out of 52</div>
            <div style={{
              fontFamily: FONT.sans, fontSize: 36, fontWeight: 800,
              color: COLOR.textPrimary, letterSpacing: "-0.02em", lineHeight: 1.3,
            }}>
              Your edge is real.<br />
              <span style={{ color: COLOR.down }}>Your volume isn't.</span>
            </div>
          </div>
        </div>
      )}

      {/* PHASE 4: All green — relief */}
      {p4Active && (
        <div style={{
          position: "absolute", top: "46%", left: "50%",
          transform: "translate(-50%, -50%)", textAlign: "center",
        }}>
          <div style={{
            fontFamily: FONT.sans, fontSize: 16, fontWeight: 600,
            color: COLOR.brand, letterSpacing: "0.08em", textTransform: "uppercase",
            marginBottom: 8, opacity: p4Label,
          }}>Same year — same edge — 1,000,000 trades/day</div>
          <div style={{
            fontFamily: FONT.sans, fontSize: 13, fontWeight: 500,
            color: COLOR.textDim, marginBottom: 20, opacity: p4Label,
          }}>Each square = one week.</div>

          <div style={{
            display: "grid", gridTemplateColumns: `repeat(13, ${SQ_SMALL}px)`,
            gap: 6, justifyContent: "center", marginBottom: 28,
          }}>
            {YEAR_1M.map((win, i) => (
              <Square key={i} win={win} size={SQ_SMALL} opacity={reliefOps[i]} />
            ))}
          </div>

          <div style={{ opacity: p4Result }}>
            <div style={{
              fontFamily: FONT.mono, fontSize: 48, fontWeight: 700,
              color: COLOR.brand,
            }}>+$12,400 / week</div>
            <div style={{
              fontFamily: FONT.sans, fontSize: 18, fontWeight: 500,
              color: COLOR.textMuted, marginTop: 8,
            }}>From -$340/week to +$12,400. Same edge. More volume.</div>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
