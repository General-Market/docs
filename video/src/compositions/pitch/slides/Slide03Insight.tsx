import React from "react";
import { SlideFrame } from "../SlideFrame";
import { COLOR, FONT, SLIDE_COUNT } from "../tokens";

const COLUMNS: Array<{ title: string; visual: React.ReactNode; body: string }> = [
  {
    title: "Edge collapses 1000×",
    visual: <MoatVisual />,
    body:
      "Insiders dominate one pair. Not a thousand. Trades batched across 1,000 markets — insider edge falls from 100% to 0.1%.",
  },
  {
    title: "Sealed reveal",
    visual: <SealedVisual />,
    body:
      "Trades revealed only after settlement. No order flow to lean on. No front-runners to trail.",
  },
  {
    title: "AI made it retail",
    visual: <FanoutVisual />,
    body:
      "Routing 1,000 assets at once was a quant problem. The frameworks shipped. It is now an npm install.",
  },
];

function MoatVisual() {
  return (
    <svg viewBox="0 0 380 220" width="380" height="220">
      <circle cx="80" cy="110" r="60" fill={COLOR.ink} />
      <text
        x="80"
        y="200"
        textAnchor="middle"
        fontSize="14"
        fill={COLOR.muted}
        fontFamily={FONT.sans}
      >
        1 pair · 100% moat
      </text>
      <g transform="translate(200, 50)">
        {Array.from({ length: 32 }).map((_, row) =>
          Array.from({ length: 32 }).map((_, col) => (
            <circle
              key={`${row}-${col}`}
              cx={col * 4 + 2}
              cy={row * 4 + 2}
              r={1.4}
              fill={COLOR.ink}
            />
          )),
        )}
      </g>
      <text
        x="264"
        y="200"
        textAnchor="middle"
        fontSize="14"
        fill={COLOR.muted}
        fontFamily={FONT.sans}
      >
        1,024 pairs · 0.1% moat
      </text>
    </svg>
  );
}

function SealedVisual() {
  return (
    <svg viewBox="0 0 380 220" width="380" height="220">
      <g transform="translate(40, 60)">
        <rect width="120" height="84" fill="none" stroke={COLOR.ink} strokeWidth="2" />
        <polyline
          points="0,0 60,42 120,0"
          fill="none"
          stroke={COLOR.ink}
          strokeWidth="2"
        />
        <rect x="20" y="100" width="80" height="3" fill={COLOR.ink} />
        <rect x="20" y="110" width="60" height="3" fill={COLOR.ink} />
        <text
          x="60"
          y="175"
          textAnchor="middle"
          fontSize="14"
          fill={COLOR.muted}
          fontFamily={FONT.sans}
        >
          Pre-settlement
        </text>
      </g>
      <text
        x="190"
        y="115"
        textAnchor="middle"
        fontSize="32"
        fill={COLOR.muted}
        fontFamily={FONT.serif}
      >
        →
      </text>
      <g transform="translate(220, 60)">
        <rect width="120" height="84" fill="none" stroke={COLOR.ink} strokeWidth="2" />
        <polyline
          points="0,0 60,-30 120,0"
          fill="none"
          stroke={COLOR.ink}
          strokeWidth="2"
        />
        <circle cx="30" cy="42" r="6" fill={COLOR.ink} />
        <circle cx="60" cy="42" r="6" fill={COLOR.ink} />
        <circle cx="90" cy="42" r="6" fill={COLOR.ink} />
        <text
          x="60"
          y="175"
          textAnchor="middle"
          fontSize="14"
          fill={COLOR.muted}
          fontFamily={FONT.sans}
        >
          Post-settlement
        </text>
      </g>
    </svg>
  );
}

function FanoutVisual() {
  const cx = 60;
  const cy = 110;
  const lines = Array.from({ length: 28 }).map((_, i) => {
    const angle = -Math.PI / 2.2 + (i / 27) * Math.PI * 1.1;
    return {
      x2: cx + Math.cos(angle) * 220,
      y2: cy + Math.sin(angle) * 90,
    };
  });
  return (
    <svg viewBox="0 0 380 220" width="380" height="220">
      {lines.map((l, i) => (
        <line
          key={i}
          x1={cx}
          y1={cy}
          x2={l.x2}
          y2={l.y2}
          stroke={COLOR.ink}
          strokeWidth={0.8}
          opacity={0.55}
        />
      ))}
      {lines.map((l, i) => (
        <circle key={`d-${i}`} cx={l.x2} cy={l.y2} r={3} fill={COLOR.ink} />
      ))}
      <circle cx={cx} cy={cy} r={14} fill={COLOR.ink} />
      <text
        x={cx}
        y={195}
        textAnchor="middle"
        fontSize="14"
        fill={COLOR.muted}
        fontFamily={FONT.sans}
      >
        1 retail · 1,000 routed
      </text>
    </svg>
  );
}

export const Slide03Insight: React.FC = () => {
  return (
    <SlideFrame eyebrow="Insight" pageNumber={3} pageTotal={SLIDE_COUNT}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 64,
          width: "100%",
        }}
      >
        {COLUMNS.map((c) => (
          <div key={c.title}>
            <div style={{ marginBottom: 32 }}>{c.visual}</div>
            <div
              style={{
                fontFamily: FONT.serif,
                fontSize: 28,
                fontWeight: 500,
                color: COLOR.ink,
                marginBottom: 16,
                letterSpacing: "-0.01em",
              }}
            >
              {c.title}
            </div>
            <div
              style={{
                fontFamily: FONT.sans,
                fontSize: 22,
                fontWeight: 400,
                color: COLOR.ink,
                lineHeight: 1.45,
              }}
            >
              {c.body}
            </div>
          </div>
        ))}
      </div>
    </SlideFrame>
  );
};
