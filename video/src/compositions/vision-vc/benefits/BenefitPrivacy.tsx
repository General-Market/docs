/**
 * BenefitPrivacy — Your edge decays as copiers multiply.
 *
 * Two big numbers, inversely correlated:
 *   "Your alpha: 54%"  (green, large)
 *   "Copiers: 0"       (muted, below)
 *
 * As copier count ticks up (0 → 2,400), alpha ticks down (54% → 0.1%).
 * Color shifts green → yellow → red. The viewer WATCHES their edge drain.
 *
 * Then: dim → "Your strategy stays yours."
 *
 * No money. No P&L. Just the edge disappearing.
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

interface BenefitPrivacyProps {
  durationInFrames: number;
}

// Interpolate a hex color between two colors
function lerpColor(a: string, b: string, t: number): string {
  const parse = (hex: string) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const ca = parse(a);
  const cb = parse(b);
  const r = Math.round(ca[0] + (cb[0] - ca[0]) * t);
  const g = Math.round(ca[1] + (cb[1] - ca[1]) * t);
  const bl = Math.round(ca[2] + (cb[2] - ca[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

export const BenefitPrivacy: React.FC<BenefitPrivacyProps> = ({
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ═══ Staggered spring entrances ═══
  const titleSpring = spring({ frame, fps, config: { damping: 12 }, delay: 0 });
  const chartSpring = spring({ frame, fps, config: { damping: 12 }, delay: 5 });
  const annotationSpring = spring({ frame, fps, config: { damping: 12 }, delay: 10 });

  const titleEntrY = interpolate(titleSpring, [0, 1], [25, 0]);
  const titleEntrOp = interpolate(titleSpring, [0, 0.5], [0, 1], { extrapolateRight: "clamp" });
  const chartEntrY = interpolate(chartSpring, [0, 1], [25, 0]);
  const chartEntrOp = interpolate(chartSpring, [0, 0.5], [0, 1], { extrapolateRight: "clamp" });
  const annotEntrY = interpolate(annotationSpring, [0, 1], [25, 0]);
  const annotEntrOp = interpolate(annotationSpring, [0, 0.5], [0, 1], { extrapolateRight: "clamp" });

  const fadeOut = interpolate(
    frame, [durationInFrames - 10, durationInFrames], [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // ═══ PHASE 1: Static display — "Your alpha: 54%" ═══
  const introOp = interpolate(frame, [3, 12], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // ═══ PHASE 2: Copiers arrive, alpha decays ═══
  // Question that plants the seed
  const questionOp = interpolate(frame, [14, 20], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const questionDim = interpolate(frame, [24, 30], [1, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  const decayStart = 22;
  const decayEnd = 60;

  const decayProgress = interpolate(frame, [decayStart, decayEnd], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // Copier count: 0 → 2,400 (accelerating)
  const copierCount = Math.round(
    interpolate(
      Math.pow(decayProgress, 1.5), // accelerating curve
      [0, 1],
      [0, 2400]
    )
  );

  // Alpha: 54% → 0.1% (decelerating — last bit drains slowly)
  const alpha = interpolate(
    Math.pow(decayProgress, 0.7), // front-loaded decay
    [0, 1],
    [54, 0.1]
  );

  // Color: green → yellow → red (inputRange must be increasing, so invert)
  const colorProgress = interpolate(alpha, [0.1, 5, 25, 54], [1, 0.7, 0.3, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const alphaColor = colorProgress < 0.5
    ? lerpColor("#16a34a", "#d97706", colorProgress * 2) // green → amber
    : lerpColor("#d97706", "#dc2626", (colorProgress - 0.5) * 2); // amber → red

  // "Copiers found you" label
  const copierLabelOp = interpolate(frame, [decayStart - 2, decayStart + 5], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // ═══ PHASE 3: Freeze + devastating label ═══
  const freezeOp = interpolate(frame, [decayEnd + 3, decayEnd + 12], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // ═══ PHASE 4: Dim + new message ═══
  const gaugesDim = interpolate(frame, [decayEnd + 20, decayEnd + 26], [1, 0.12], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const msgOp = interpolate(frame, [decayEnd + 24, decayEnd + 34], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const msgY = interpolate(frame, [decayEnd + 24, decayEnd + 36], [10, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  const displayAlpha = alpha >= 10 ? alpha.toFixed(0) : alpha.toFixed(1);

  return (
    <AbsoluteFill style={{ backgroundColor: COLOR.page, opacity: fadeOut }}>

      {/* Decorative SVG grid — candlestick pattern */}
      <DecoGrid variant="candlestick" opacity={0.25} />

      {/* Eyebrow label */}
      <div style={{
        position: "absolute", top: 40, left: 60,
        opacity: introOp * titleEntrOp,
        transform: `translateY(${titleEntrY}px)`,
      }}>
        <Eyebrow color={COLOR.brand} text="03 — Privacy" />
      </div>

      {/* Fix 8: Question before decay */}
      {questionOp > 0 && questionDim > 0 && (
        <div style={{
          position: "absolute", top: "28%", left: "50%",
          transform: `translateX(-50%) translateY(${annotEntrY}px)`, textAlign: "center",
          opacity: questionOp * questionDim * annotEntrOp,
        }}>
          <div style={{
            fontFamily: FONT.sans, fontSize: 22, fontWeight: 500,
            color: COLOR.textMuted,
          }}>What happens when 2,400 people copy your trades?</div>
        </div>
      )}

      {/* Main gauges */}
      <div style={{
        position: "absolute", top: "44%", left: "50%",
        transform: `translate(-50%, -50%) translateY(${chartEntrY}px)`, textAlign: "center",
        opacity: introOp * gaugesDim * chartEntrOp,
      }}>
        {/* "Your alpha" label */}
        <div style={{
          fontFamily: FONT.sans, fontSize: 16, fontWeight: 600,
          color: COLOR.textMuted, letterSpacing: "0.08em", textTransform: "uppercase",
          marginBottom: 10,
        }}>
          Your alpha
        </div>

        {/* The big number — HUGE, fills the screen */}
        <div style={{
          fontFamily: FONT.mono, fontSize: 180, fontWeight: 700,
          color: alphaColor, letterSpacing: "-0.04em",
          lineHeight: 1, fontVariantNumeric: "tabular-nums",
        }}>
          {displayAlpha}%
        </div>

        {/* Copier counter */}
        <div style={{
          marginTop: 30,
          opacity: copierLabelOp,
        }}>
          <div style={{
            fontFamily: FONT.sans, fontSize: 13, fontWeight: 600,
            color: COLOR.textDim, letterSpacing: "0.06em", textTransform: "uppercase",
            marginBottom: 6,
          }}>
            Copiers tracking your trades
          </div>
          <div style={{
            fontFamily: FONT.mono, fontSize: 48, fontWeight: 700,
            color: copierCount > 500 ? COLOR.down : COLOR.textSecondary,
            fontVariantNumeric: "tabular-nums",
          }}>
            {copierCount.toLocaleString()}
          </div>
        </div>

        {/* Devastating label after decay completes */}
        {freezeOp > 0 && (
          <div style={{
            marginTop: 28, opacity: freezeOp,
          }}>
            <div style={{
              fontFamily: FONT.sans, fontSize: 22, fontWeight: 700,
              color: COLOR.down, letterSpacing: "-0.01em",
            }}>
              Your edge is gone. They all trade like you now.
            </div>
          </div>
        )}
      </div>

      {/* Final message */}
      <div style={{
        position: "absolute", bottom: 90, left: "50%",
        transform: `translateX(-50%) translateY(${msgY}px)`,
        textAlign: "center", opacity: msgOp,
      }}>
        <div style={{
          fontFamily: FONT.sans, fontSize: 48, fontWeight: 900,
          color: COLOR.textPrimary, letterSpacing: "-0.03em",
        }}>
          Your strategy stays yours.
        </div>
        <div style={{
          fontFamily: FONT.sans, fontSize: 16, fontWeight: 500,
          color: COLOR.textMuted, marginTop: 12,
          display: "flex", justifyContent: "center", gap: 28,
        }}>
          {["Encrypted positions", "No copy trading", "No front-running"].map((f, i) => (
            <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: COLOR.brand }} />
              {f}
            </span>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
