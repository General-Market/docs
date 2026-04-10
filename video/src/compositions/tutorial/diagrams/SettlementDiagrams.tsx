import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { COLOR, TYPE } from "../designTokens";
import { FPS } from "../theme";
import { DiagramCard } from "../components/DiagramCard";

const sec = (s: number) => Math.round(s * FPS);
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);

const CYCLE_IN = sec(10.56);
const CYCLE_OUT = sec(23.96);

/**
 * Settlement diagram — Wise style. Dense info card.
 * Hero number + comparison row + 3-step flow + feature pills.
 */
const SettlementCard: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = CYCLE_OUT - CYCLE_IN;

  // Staggered row entrance
  const row = (delay: number) => {
    const p = interpolate(frame - sec(delay), [0, sec(0.5)], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: EASE_OUT,
    });
    return {
      opacity: p,
      transform: `translateY(${interpolate(p, [0, 1], [16, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px)`,
    };
  };

  // Progress bar fill
  const progress = interpolate(frame, [sec(0.8), sec(8)], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE_OUT,
  });

  // Exit fade
  const exitOpacity = interpolate(frame, [duration - 15, duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <DiagramCard>
      <div style={{ opacity: exitOpacity }}>
        {/* Row 1: Hero number */}
        <div style={{ ...row(0), marginBottom: 40 }}>
          <div style={{ ...TYPE.label, color: COLOR.gray, marginBottom: 12 }}>
            SETTLEMENT TIME
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
            <span style={{ ...TYPE.displayHero, color: COLOR.wiseGreen }}>10</span>
            <span style={{ ...TYPE.subHeading, color: COLOR.nearBlack }}>minutes</span>
          </div>
        </div>

        {/* Row 2: Comparison — 3 columns */}
        <div style={{ ...row(0.3), display: "flex", gap: 0, marginBottom: 40 }}>
          {[
            { label: "GENERAL MARKET", value: "10 minutes", detail: "Automatic oracle settlement", color: COLOR.wiseGreen },
            { label: "TRADITIONAL", value: "7+ days", detail: "Manual disputes, voter resolution", color: COLOR.danger },
            { label: "ADVANTAGE", value: "1,000x", detail: "Faster to settlement", color: COLOR.wiseGreen },
          ].map((col, i) => (
            <React.Fragment key={col.label}>
              {i > 0 && <div style={{ width: 1, background: COLOR.border, margin: "0 32px" }} />}
              <div style={{ flex: 1 }}>
                <div style={{ ...TYPE.label, marginBottom: 8 }}>{col.label}</div>
                <div style={{ ...TYPE.cardTitle, color: col.color }}>{col.value}</div>
                <div style={{ ...TYPE.caption, marginTop: 6 }}>{col.detail}</div>
              </div>
            </React.Fragment>
          ))}
        </div>

        {/* Row 3: How it works — progress bar + 3 steps */}
        <div style={{ ...row(0.6), marginBottom: 40 }}>
          <div style={{ ...TYPE.label, marginBottom: 20 }}>HOW IT WORKS</div>

          {/* Progress bar */}
          <div style={{ height: 8, background: COLOR.lightSurface, borderRadius: 4, marginBottom: 28, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress}%`, background: COLOR.wiseGreen, borderRadius: 4 }} />
          </div>

          {/* 3 Steps */}
          <div style={{ display: "flex", gap: 40 }}>
            {[
              { step: "01", title: "Betting Window", detail: "All traders submit sealed bets", time: "10 min" },
              { step: "02", title: "Oracle Consensus", detail: "3 independent oracles verify", time: "30 sec" },
              { step: "03", title: "Settlement", detail: "PNL distributed instantly", time: "Instant" },
            ].map((s, i) => (
              <div key={s.step} style={{ flex: 1, opacity: progress > (i * 35) ? 1 : 0.25 }}>
                <div style={{ ...TYPE.bodySemibold, color: progress > (i * 35) ? COLOR.wiseGreen : COLOR.gray, marginBottom: 6 }}>
                  {s.step}
                </div>
                <div style={{ ...TYPE.cardTitle, marginBottom: 4 }}>{s.title}</div>
                <div style={{ ...TYPE.caption }}>{s.detail}</div>
                <div style={{ ...TYPE.bodySemibold, color: COLOR.wiseGreen, marginTop: 10 }}>{s.time}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Row 4: Feature pills */}
        <div style={{ ...row(0.9), display: "flex", gap: 16, flexWrap: "wrap" }}>
          {["$0 fees", "$0 spread", "$0 slippage", "No disputes", "Instant withdrawal"].map((f) => (
            <div
              key={f}
              style={{
                background: COLOR.lightMint,
                color: COLOR.darkGreen,
                borderRadius: 9999,
                padding: "10px 28px",
                ...TYPE.bodySemibold,
              }}
            >
              {f}
            </div>
          ))}
        </div>
      </div>
    </DiagramCard>
  );
};

export const SettlementDiagrams: React.FC = () => {
  return (
    <AbsoluteFill>
      <Sequence from={CYCLE_IN} durationInFrames={CYCLE_OUT - CYCLE_IN}>
        <SettlementCard />
        <Audio src={staticFile("sfx/scroll-tick.mp3")} volume={0.4} />
      </Sequence>
    </AbsoluteFill>
  );
};
