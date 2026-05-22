// Source: a Hitchcock "Psycho" title sequence — three horizontal slabs of the
// word "PSYCHO" slide together, the middle slab quivers, then the title slabs
// peel away as a 50-bar audio visualizer slams up from the top and down from
// the bottom. The original uses animejs createTimeline + an audio file. We
// drive the same beats with useCurrentFrame.

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from "remotion";

const BG = "black";
const GREEN = "hsl(123, 70%, 45%)";

// Heights for the bar columns (relative to the half-height of the screen).
// Pulled from the source's .bars > .bar:nth-of-type(n) {height: X%} rules.
const BAR_HEIGHTS_TOP = [
  0.04, 0.09, 0.12, 0.06, 0.05, 0.11, 0.19, 0.21, 0.17, 0.14, 0.30,
  0.35, 0.33, 0.35, 0.30, 0.14, 0.17, 0.21, 0.19, 0.11, 0.05, 0.06,
  0.10, 0.09, 0.04,
];
const BAR_HEIGHTS_BOT = [
  0.11, 0.12, 0.19, 0.13, 0.07, 0.07, 0.17, 0.20, 0.20, 0.16, 0.27,
  0.35, 0.30, 0.40, 0.30, 0.23, 0.20, 0.18, 0.14, 0.07, 0.10, 0.13,
  0.13, 0.16, 0.09,
];

const ease = Easing.bezier(0.4, 0, 0.2, 1);

// Renders one of the three horizontal slab text-rows. The middle slab uses a
// stronger clipping (it sits in front and shakes).
const TitleSlab: React.FC<{
  variant: "top" | "middle" | "bottom";
  xPct: number; // 0..1 horizontal offset
}> = ({ variant, xPct }) => {
  const offset = (xPct - 0.5) * 200;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        textAlign: "center",
        fontFamily: '"Anton", "Bebas Neue", "Arial Narrow", sans-serif',
        fontWeight: 800,
        color: "white",
        fontSize: 280,
        letterSpacing: 12,
        lineHeight: 0.85,
        transform: `translateX(${offset}px)`,
        clipPath:
          variant === "top"
            ? "polygon(0 0, 100% 0, 100% 38%, 0 38%)"
            : variant === "middle"
            ? "polygon(0 38%, 100% 38%, 100% 62%, 0 62%)"
            : "polygon(0 62%, 100% 62%, 100% 100%, 0 100%)",
      }}
    >
      PSYCHO
    </div>
  );
};

export const PsychoTitle: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = frame / durationInFrames; // 0..1

  // Phase timings (as fractions of the full scene)
  const PHASE_QUIVER_IN = 0.05;
  const PHASE_QUIVER_OUT = 0.45;
  const PHASE_SLAB_AWAY = 0.5;
  const PHASE_BARS = 0.55;

  // Quiver of the middle slab
  let middleX = 0.5;
  if (t > PHASE_QUIVER_IN && t < PHASE_QUIVER_OUT) {
    const q = (t - PHASE_QUIVER_IN) / (PHASE_QUIVER_OUT - PHASE_QUIVER_IN);
    // Lateral oscillation — picks up amplitude as it goes
    middleX = 0.5 + Math.sin(q * Math.PI * 14) * (0.05 + q * 0.07);
  }

  // Slab fly-away (top up, bottom down)
  const slabAway = Math.max(0, Math.min(1, (t - PHASE_SLAB_AWAY) / 0.06));
  const slabAwayEased = ease(slabAway);

  // Bars scale up from bottom of each row.
  // After PHASE_BARS, scale from 0 → BAR_HEIGHTS_X[i] * full height (the bars
  // grow via scaleY of a 100%-tall element).
  const barsProgress = Math.max(0, Math.min(1, (t - PHASE_BARS) / 0.3));

  // Bars beat — once they've come up, modulate the heights with a sine wave
  // per column to fake an audio waveform.
  const beat = (i: number) => {
    if (barsProgress < 0.98) return 1;
    const phase = i * 0.31 + frame * 0.12;
    return 0.85 + 0.25 * Math.sin(phase) * Math.sin(phase * 0.31);
  };

  // Bar palette — solid green is canonical; introduce one rare red bar to
  // honor the source's :nth-of-type "different colored bar" intent
  const barColor = (i: number) => {
    return i === 12 ? "hsl(0, 80%, 50%)" : GREEN;
  };

  return (
    <AbsoluteFill style={{ background: BG, overflow: "hidden" }}>
      {/* Title slabs — visible until they peel away */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 1 - slabAwayEased,
          transform: `translateY(${slabAwayEased * 0}px)`,
          display: "grid",
          alignContent: "center",
        }}
      >
        <div
          style={{
            position: "relative",
            height: 250,
            transform: `translateY(${-slabAwayEased * 540}px)`,
          }}
        >
          <TitleSlab variant="top" xPct={0.5} />
        </div>
        <div
          style={{
            position: "relative",
            height: 0,
          }}
        >
          <TitleSlab variant="middle" xPct={middleX} />
        </div>
        <div
          style={{
            position: "relative",
            height: 250,
            transform: `translateY(${slabAwayEased * 540}px)`,
          }}
        >
          <TitleSlab variant="bottom" xPct={0.5} />
        </div>
      </div>

      {/* Upper bars — flipped (rotate 180°) so they grow downward from top */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "50%",
          display: "flex",
          justifyContent: "space-evenly",
          transform: "rotate(180deg)",
          paddingTop: 4,
        }}
      >
        {BAR_HEIGHTS_TOP.map((h, i) => {
          const scale = barsProgress * h * beat(i);
          return (
            <div
              key={i}
              style={{
                width: "2%",
                height: "100%",
                background: barColor(i),
                transform: `scaleY(${scale})`,
                transformOrigin: "center top",
              }}
            />
          );
        })}
      </div>

      {/* Lower bars */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "50%",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        {BAR_HEIGHTS_BOT.map((h, i) => {
          const scale = barsProgress * h * beat(i + 25);
          return (
            <div
              key={i}
              style={{
                width: "2%",
                height: "100%",
                background: barColor(i + 25),
                transform: `scaleY(${scale})`,
                transformOrigin: "center top",
              }}
            />
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
