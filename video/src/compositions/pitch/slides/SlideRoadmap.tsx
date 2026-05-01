import React from "react";
import { SlideFrame } from "../SlideFrame";
import { COLOR, FONT, SLIDE_COUNT } from "../tokens";

type Milestone = {
  when: string;
  title: string;
  body: string;
  filled?: boolean;
};

const MILESTONES: Milestone[] = [
  {
    when: "Today",
    title: "Testnet live",
    body: "Architecture shipped. Public dogfooding.",
    filled: true,
  },
  {
    when: "M+2",
    title: "Audit kickoff",
    body: "Trail of Bits / Sherlock contest. Bug bounty active.",
  },
  {
    when: "M+4",
    title: "Mainnet shadow",
    body: "Market makers wired. Final integration testing.",
  },
  {
    when: "M+6",
    title: "Mainnet launch",
    body: "First 1,000 batched markets. Token-gated v1.",
  },
  {
    when: "M+12",
    title: "100k markets",
    body: "Agent SDK published. Distribution playbook live.",
  },
];

export const SlideRoadmap: React.FC = () => {
  const cols = MILESTONES.length;
  const lineY = 200;
  const totalW = 1500;
  const stepW = totalW / (cols - 1);

  return (
    <SlideFrame eyebrow="Roadmap" pageNumber={12} pageTotal={SLIDE_COUNT}>
      <p
        style={{
          fontFamily: FONT.serif,
          fontSize: 56,
          fontWeight: 400,
          color: COLOR.ink,
          lineHeight: 1.1,
          letterSpacing: "-0.02em",
          margin: 0,
          marginBottom: 64,
          maxWidth: 1500,
        }}
      >
        Six months to mainnet. Twelve to scale.
      </p>

      <div style={{ position: "relative", width: totalW, height: 540 }}>
        <svg width={totalW} height="540" style={{ position: "absolute", inset: 0 }}>
          <line
            x1={0}
            y1={lineY}
            x2={totalW}
            y2={lineY}
            stroke={COLOR.ink}
            strokeWidth={1.5}
          />
          {MILESTONES.map((m, i) => {
            const x = i * stepW;
            return (
              <g key={m.when}>
                <circle
                  cx={x}
                  cy={lineY}
                  r={m.filled ? 14 : 10}
                  fill={m.filled ? COLOR.ink : COLOR.bg}
                  stroke={COLOR.ink}
                  strokeWidth={2}
                />
              </g>
            );
          })}
        </svg>

        {MILESTONES.map((m, i) => {
          const x = i * stepW;
          const isLast = i === MILESTONES.length - 1;
          const xOffset = isLast ? -260 : -10;
          return (
            <div
              key={m.when}
              style={{
                position: "absolute",
                top: 0,
                left: x + xOffset,
                width: 260,
              }}
            >
              <div
                style={{
                  fontFamily: FONT.sans,
                  fontSize: 14,
                  color: COLOR.muted,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  fontWeight: 500,
                  marginBottom: 8,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {m.when}
              </div>
              <div
                style={{
                  fontFamily: FONT.serif,
                  fontSize: 26,
                  fontWeight: 500,
                  color: COLOR.ink,
                  marginBottom: 8,
                  letterSpacing: "-0.01em",
                  height: 70,
                }}
              >
                {m.title}
              </div>
            </div>
          );
        })}

        {MILESTONES.map((m, i) => {
          const x = i * stepW;
          const isLast = i === MILESTONES.length - 1;
          const xOffset = isLast ? -260 : -10;
          return (
            <div
              key={`body-${m.when}`}
              style={{
                position: "absolute",
                top: lineY + 32,
                left: x + xOffset,
                width: 260,
                fontFamily: FONT.sans,
                fontSize: 16,
                color: COLOR.ink,
                lineHeight: 1.45,
              }}
            >
              {m.body}
            </div>
          );
        })}
      </div>
    </SlideFrame>
  );
};
