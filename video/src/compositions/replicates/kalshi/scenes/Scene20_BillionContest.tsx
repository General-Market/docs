import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import {
  fontFamily,
  baseText,
  greenText,
  GREEN,
  LightBg,
} from "../shared";

// ---------------------------------------------------------------------------
// Disclaimer copy — pulled from the original Kalshi end card
// ---------------------------------------------------------------------------

const DISCLAIMER_INLINE =
  "SIG Parametrics, LLC, a member of the Susquehanna International Group of Companies,\nis financially backing this promotion.";

const DISCLAIMER_BLOCK = [
  "SIG Parametrics, LLC, a member of the Susquehanna International Group of Companies, is financially backing this promotion. Eligibility requirements",
  "apply. Participants must be 18 years of age or older. Contest not available outside the United States, in New York, or in Florida. Prize winners are",
  "responsible for applicable taxes. Contest is not endorsed by, or associated with the NCAA or Warren Buffett. Other terms, conditions, and restrictions",
  "apply. NO PURCHASE NECESSARY TO ENTER OR WIN. OFFICIAL RULES APPLY. See kalshi.com/billion-dollar-bracket for more information.",
].join(" ");

// ---------------------------------------------------------------------------
// BracketBackground — faint green tournament bracket lines
// ---------------------------------------------------------------------------

const BracketBackground: React.FC<{ opacity?: number }> = ({
  opacity = 0.15,
}) => {
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];

  // Round 1: 8 slots on the left
  const slots = 8;
  const startX = 120;
  const gap = 100;
  const rowH = 1080 / (slots + 1);

  for (let i = 0; i < slots; i++) {
    const y = rowH * (i + 1);
    lines.push({ x1: startX, y1: y, x2: startX + gap, y2: y });
    if (i % 2 === 0 && i + 1 < slots) {
      const yNext = rowH * (i + 2);
      lines.push({ x1: startX + gap, y1: y, x2: startX + gap, y2: yNext });
      const midY = (y + yNext) / 2;
      lines.push({
        x1: startX + gap,
        y1: midY,
        x2: startX + gap * 2,
        y2: midY,
      });
    }
  }

  // Round 2: 4 slots
  const slots2 = 4;
  const startX2 = startX + gap * 2;
  const rowH2 = 1080 / (slots2 + 1);

  for (let i = 0; i < slots2; i++) {
    const y = rowH2 * (i + 1);
    lines.push({ x1: startX2, y1: y, x2: startX2 + gap, y2: y });
    if (i % 2 === 0 && i + 1 < slots2) {
      const yNext = rowH2 * (i + 2);
      lines.push({
        x1: startX2 + gap,
        y1: y,
        x2: startX2 + gap,
        y2: yNext,
      });
      const midY = (y + yNext) / 2;
      lines.push({
        x1: startX2 + gap,
        y1: midY,
        x2: startX2 + gap * 2,
        y2: midY,
      });
    }
  }

  // Mirror to right side
  const mirrored = lines.map((l) => ({
    x1: 1920 - l.x1,
    y1: l.y1,
    x2: 1920 - l.x2,
    y2: l.y2,
  }));

  return (
    <svg
      width={1920}
      height={1080}
      style={{ position: "absolute", top: 0, left: 0 }}
    >
      {[...lines, ...mirrored].map((l, i) => (
        <line
          key={i}
          x1={l.x1}
          y1={l.y1}
          x2={l.x2}
          y2={l.y2}
          stroke={GREEN}
          strokeWidth={2}
          opacity={opacity}
        />
      ))}
    </svg>
  );
};

// ---------------------------------------------------------------------------
// HalftoneDots — quarter-circle cluster anchored to bottom-right corner
// ---------------------------------------------------------------------------

const HalftoneDots: React.FC<{ opacity?: number }> = ({ opacity = 1 }) => {
  const dots: { cx: number; cy: number; r: number; o: number }[] = [];
  const centerX = 1920;
  const centerY = 1080;
  const maxRadius = 220;
  const spacing = 24;

  for (let x = centerX - maxRadius; x <= centerX; x += spacing) {
    for (let y = centerY - maxRadius; y <= centerY; y += spacing) {
      const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
      if (dist > maxRadius) continue;
      const t = 1 - dist / maxRadius;
      const r = 2.5 + t * 5;
      const o = t * 0.75;
      dots.push({ cx: x, cy: y, r, o });
    }
  }

  return (
    <svg
      width={1920}
      height={1080}
      style={{ position: "absolute", top: 0, left: 0, opacity }}
    >
      {dots.map((d, i) => (
        <circle
          key={i}
          cx={d.cx}
          cy={d.cy}
          r={d.r}
          fill={GREEN}
          opacity={d.o}
        />
      ))}
    </svg>
  );
};

// ---------------------------------------------------------------------------
// BrandedLayout — reusable shell for end-card scenes (20-25)
//
// Provides: light bg, bracket lines, Kalshi header, disclaimer footer,
// halftone dot decoration. Children sit in the centered content area.
// ---------------------------------------------------------------------------

export const BrandedLayout: React.FC<{
  children: React.ReactNode;
  showKalshiTop?: boolean;
  bracketOpacity?: number;
  showInlineDisclaimer?: boolean;
  showBlockDisclaimer?: boolean;
}> = ({
  children,
  showKalshiTop = true,
  bracketOpacity,
  showInlineDisclaimer = false,
  showBlockDisclaimer = true,
}) => {
  const frame = useCurrentFrame();

  const bracketFade = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <>
      <LightBg />
      <BracketBackground opacity={(bracketOpacity ?? 0.12) * bracketFade} />

      {/* Top: Kalshi wordmark */}
      {showKalshiTop && (
        <div
          style={{
            position: "absolute",
            top: 55,
            width: "100%",
            textAlign: "center",
          }}
        >
          <span
            style={{
              ...greenText,
              fontSize: 55,
              fontStyle: "italic",
            }}
          >
            Kalshi
          </span>
        </div>
      )}

      {/* Center content slot */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {children}
      </div>

      {/* Inline disclaimer — sits just below center content */}
      {showInlineDisclaimer && (
        <div
          style={{
            position: "absolute",
            bottom: 260,
            width: "100%",
            textAlign: "center",
          }}
        >
          <span
            style={{
              fontFamily,
              fontSize: 16,
              fontWeight: 400,
              color: "#555",
              lineHeight: 1.6,
              whiteSpace: "pre-line",
            }}
          >
            {DISCLAIMER_INLINE}
          </span>
        </div>
      )}

      {/* Block disclaimer — bottom legal text */}
      {showBlockDisclaimer && (
        <div
          style={{
            position: "absolute",
            bottom: 38,
            left: 100,
            right: 340,
          }}
        >
          <p
            style={{
              fontFamily,
              fontSize: 11,
              fontWeight: 400,
              color: "#999",
              lineHeight: 1.45,
              margin: 0,
              borderTop: "1px solid rgba(0,0,0,0.08)",
              paddingTop: 10,
            }}
          >
            {DISCLAIMER_BLOCK}
          </p>
        </div>
      )}

      {/* Halftone dots — bottom-right */}
      <HalftoneDots opacity={bracketFade * 0.85} />
    </>
  );
};

// ---------------------------------------------------------------------------
// Scene 20 — $1 Billion Perfect Bracket Contest
// Duration: 150 frames (5s at 30fps), 1920x1080
// ---------------------------------------------------------------------------

export const Scene20_BillionContest: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const stagger = (delay: number) =>
    spring({ frame: frame - delay, fps, config: { damping: 13 } });

  // "$1 BILLION" lands with a slight overshoot
  const billionSpring = spring({
    frame: frame - 18,
    fps,
    config: { damping: 11, stiffness: 100, mass: 0.9 },
  });

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <BrandedLayout
        showKalshiTop
        bracketOpacity={0.12}
        showInlineDisclaimer
        showBlockDisclaimer
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
            transform: "translateY(-30px)",
          }}
        >
          {/* INTRODUCING: */}
          <span
            style={{
              ...greenText,
              fontSize: 18,
              letterSpacing: 6,
              textTransform: "uppercase",
              fontWeight: 700,
              opacity: stagger(10),
              transform: `translateY(${(1 - stagger(10)) * 15}px)`,
            }}
          >
            Introducing:
          </span>

          {/* $1 BILLION */}
          <span
            style={{
              ...baseText,
              fontSize: 155,
              lineHeight: 1,
              letterSpacing: -2,
              opacity: billionSpring,
              transform: `scale(${0.75 + billionSpring * 0.25})`,
            }}
          >
            $1 BILLION
          </span>

          {/* PERFECT BRACKET CONTEST */}
          <span
            style={{
              ...greenText,
              fontSize: 28,
              letterSpacing: 5,
              fontWeight: 700,
              opacity: stagger(30),
              transform: `translateY(${(1 - stagger(30)) * 12}px)`,
            }}
          >
            PERFECT BRACKET CONTEST
          </span>
        </div>
      </BrandedLayout>
    </div>
  );
};
