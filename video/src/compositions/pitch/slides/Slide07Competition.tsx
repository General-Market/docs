import React from "react";
import { SlideFrame } from "../SlideFrame";
import { COLOR, FONT, SLIDE_COUNT } from "../tokens";

type Dot = {
  name: string;
  markets: string;
  x: number;
  y: number;
  color: string;
  r?: number;
  labelOffset?: { dx?: number; dy?: number; anchor?: "start" | "middle" | "end" };
};

const COMPETITORS: Dot[] = [
  { name: "Drift BET", markets: "~80", x: 220, y: 700, color: "#9D6FFF", r: 12 },
  { name: "Hyperliquid", markets: "~10 perps", x: 290, y: 720, color: "#97FCE4", r: 12 },
  { name: "Limitless", markets: "~200", x: 410, y: 700, color: "#00B8A6", r: 14 },
  { name: "Kalshi", markets: "~250", x: 470, y: 690, color: "#00D26A", r: 16 },
  { name: "XO Market", markets: "~500", x: 600, y: 705, color: "#E94B40", r: 14 },
  {
    name: "Manifold",
    markets: "play-money",
    x: 700,
    y: 720,
    color: "#4337C9",
    r: 12,
    labelOffset: { dy: 38 },
  },
  { name: "Polymarket", markets: "~2,000", x: 900, y: 690, color: "#1652F0", r: 20 },
];

const GM = { x: 1380, y: 140, r: 26 };

export const Slide07Competition: React.FC = () => {
  return (
    <SlideFrame eyebrow="Competition" pageNumber={8} pageTotal={SLIDE_COUNT}>
      <div
        style={{
          width: 1500,
          height: 720,
          fontFamily: FONT.sans,
        }}
      >
        <svg
          viewBox="0 0 1500 820"
          width="100%"
          height="100%"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Quadrant guidelines */}
          <line
            x1="160"
            y1="430"
            x2="1480"
            y2="430"
            stroke={COLOR.line}
            strokeWidth={1.5}
            strokeDasharray="4 8"
          />
          <line
            x1="820"
            y1="80"
            x2="820"
            y2="780"
            stroke={COLOR.line}
            strokeWidth={1.5}
            strokeDasharray="4 8"
          />

          {/* Axes */}
          <line x1="160" y1="780" x2="1480" y2="780" stroke={COLOR.ink} strokeWidth={2} />
          <line x1="160" y1="80" x2="160" y2="780" stroke={COLOR.ink} strokeWidth={2} />

          {/* X-axis tick labels — log scale of markets supported */}
          {[
            { x: 220, label: "100" },
            { x: 430, label: "1k" },
            { x: 640, label: "10k" },
            { x: 850, label: "100k" },
            { x: 1060, label: "1M" },
            { x: 1270, label: "10M+" },
          ].map((t) => (
            <g key={t.label}>
              <line
                x1={t.x}
                y1={780}
                x2={t.x}
                y2={788}
                stroke={COLOR.ink}
                strokeWidth={1.5}
              />
              <text
                x={t.x}
                y={812}
                textAnchor="middle"
                fontSize={16}
                fill={COLOR.muted}
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {t.label}
              </text>
            </g>
          ))}

          {/* Y-axis tick labels — insider resistance */}
          {[
            { y: 720, label: "low" },
            { y: 430, label: "mid" },
            { y: 140, label: "high" },
          ].map((t) => (
            <g key={t.label}>
              <line
                x1={152}
                y1={t.y}
                x2={160}
                y2={t.y}
                stroke={COLOR.ink}
                strokeWidth={1.5}
              />
              <text
                x={144}
                y={t.y + 5}
                textAnchor="end"
                fontSize={16}
                fill={COLOR.muted}
              >
                {t.label}
              </text>
            </g>
          ))}

          {/* Axis titles */}
          <text
            x="820"
            y="855"
            textAnchor="middle"
            fontSize={18}
            letterSpacing="0.18em"
            fill={COLOR.muted}
            fontWeight={500}
          >
            MARKETS SUPPORTED (LOG SCALE) →
          </text>
          <text
            x="80"
            y="430"
            textAnchor="middle"
            transform="rotate(-90 80 430)"
            fontSize={18}
            letterSpacing="0.18em"
            fill={COLOR.muted}
            fontWeight={500}
          >
            ↑ INSIDER RESISTANCE
          </text>

          {/* Competitor dots */}
          {COMPETITORS.map((c) => {
            const r = c.r ?? 12;
            const dx = c.labelOffset?.dx ?? 0;
            const dy = c.labelOffset?.dy ?? r + 22;
            const anchor = c.labelOffset?.anchor ?? "middle";
            return (
              <g key={c.name}>
                <circle cx={c.x} cy={c.y} r={r} fill={c.color} />
                <text
                  x={c.x + dx}
                  y={c.y + dy}
                  textAnchor={anchor}
                  fontSize={18}
                  fill={COLOR.ink}
                  fontWeight={500}
                >
                  {c.name}
                </text>
                <text
                  x={c.x + dx}
                  y={c.y + dy + 18}
                  textAnchor={anchor}
                  fontSize={13}
                  fill={COLOR.muted}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {c.markets}
                </text>
              </g>
            );
          })}

          {/* GM dot — highlighted */}
          <g>
            <circle
              cx={GM.x}
              cy={GM.y}
              r={GM.r + 8}
              fill="none"
              stroke={COLOR.ink}
              strokeWidth={1}
              strokeDasharray="3 4"
              opacity={0.4}
            />
            <circle cx={GM.x} cy={GM.y} r={GM.r} fill={COLOR.ink} />
            <text
              x={GM.x}
              y={GM.y - GM.r - 38}
              textAnchor="middle"
              fontFamily={FONT.serif}
              fontSize={26}
              fontWeight={500}
              fill={COLOR.ink}
            >
              General Market
            </text>
            <text
              x={GM.x}
              y={GM.y - GM.r - 16}
              textAnchor="middle"
              fontSize={14}
              fill={COLOR.muted}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              1,000+ per batch · sealed reveal
            </text>
          </g>

          {/* Source caption */}
          <text x="160" y={870} fontSize={12} fill={COLOR.muted}>
            Sources: Polymarket, Kalshi, Drift, Limitless public market counts · accessed May 2026.
          </text>
        </svg>
      </div>
    </SlideFrame>
  );
};
