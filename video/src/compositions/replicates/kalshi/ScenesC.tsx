import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import {
  fontFamily,
  baseText,
  greenText,
  GREEN,
  LightBg,
  Center,
  easeOutExpo,
  easeOutQuart,
  progress,
  wordReveal,
  sceneFade,
  srand,
} from "./shared";

// ---------------------------------------------------------------------------
// Branded layout — shared across scenes 20-25
// ---------------------------------------------------------------------------

const SIG_BACKING =
  "SIG Parametrics, LLC, a member of the Susquehanna International Group of Companies, " +
  "is financially backing this promotion.";

const DISCLAIMER_FULL =
  "SIG Parametrics, LLC, a member of the Susquehanna International Group of Companies, " +
  "is financially backing this promotion. Eligibility requirements apply. Participants must " +
  "be 18 years of age or older. Contest not available outside the United States, in New York, " +
  "or in Florida. Prize winners are responsible for applicable taxes. Contest is not endorsed " +
  "by or associated with the NCAA or Warren Buffett. Other terms, conditions, and restrictions " +
  "apply. NO PURCHASE NECESSARY TO ENTER OR WIN. OFFICIAL RULES APPLY. See " +
  "kalshi.com/billion-dollar-bracket for more information.";

// Tournament bracket background — matches the rectangular bracket shapes from the original
const BracketBackground: React.FC<{ opacity?: number }> = ({
  opacity = 0.15,
}) => {
  // Generate bracket shapes on left side — 8 starting slots converging to 1
  const buildBracketSide = (baseX: number, flip: boolean) => {
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    // Round 1: 8 horizontal stubs
    const round1Y = [80, 200, 340, 460, 600, 720, 860, 980];
    const stubW = 80;
    const gapX = 100;
    for (let i = 0; i < 8; i++) {
      const x = flip ? 1920 - baseX - stubW : baseX;
      lines.push({ x1: x, y1: round1Y[i], x2: x + stubW, y2: round1Y[i] });
    }
    // Round 1 connectors: pair up
    for (let i = 0; i < 8; i += 2) {
      const x = flip ? 1920 - baseX - stubW : baseX + stubW;
      lines.push({ x1: x, y1: round1Y[i], x2: x, y2: round1Y[i + 1] });
      const midY = (round1Y[i] + round1Y[i + 1]) / 2;
      lines.push({ x1: x, y1: midY, x2: x + (flip ? -gapX : gapX), y2: midY });
    }
    // Round 2: 4 lines
    const round2Y = [
      (round1Y[0] + round1Y[1]) / 2,
      (round1Y[2] + round1Y[3]) / 2,
      (round1Y[4] + round1Y[5]) / 2,
      (round1Y[6] + round1Y[7]) / 2,
    ];
    const x2 = flip
      ? 1920 - baseX - stubW - gapX
      : baseX + stubW + gapX;
    for (let i = 0; i < 4; i += 2) {
      lines.push({ x1: x2, y1: round2Y[i], x2: x2, y2: round2Y[i + 1] });
      const midY = (round2Y[i] + round2Y[i + 1]) / 2;
      lines.push({
        x1: x2,
        y1: midY,
        x2: x2 + (flip ? -gapX : gapX),
        y2: midY,
      });
    }
    // Round 3: 2 lines
    const round3Y = [
      (round2Y[0] + round2Y[1]) / 2,
      (round2Y[2] + round2Y[3]) / 2,
    ];
    const x3 = flip
      ? 1920 - baseX - stubW - gapX * 2
      : baseX + stubW + gapX * 2;
    lines.push({ x1: x3, y1: round3Y[0], x2: x3, y2: round3Y[1] });
    const finalMidY = (round3Y[0] + round3Y[1]) / 2;
    lines.push({
      x1: x3,
      y1: finalMidY,
      x2: x3 + (flip ? -gapX : gapX),
      y2: finalMidY,
    });

    return lines;
  };

  const leftLines = buildBracketSide(40, false);
  const rightLines = buildBracketSide(40, true);

  return (
    <svg
      width={1920}
      height={1080}
      style={{ position: "absolute", top: 0, left: 0 }}
    >
      {[...leftLines, ...rightLines].map((l, i) => (
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

// Halftone dots — semicircle at bottom-center as in original
const HalftoneDots: React.FC<{ opacity?: number }> = ({ opacity = 1 }) => {
  const dots: { cx: number; cy: number; r: number; o: number }[] = [];
  const centerX = 960;
  const centerY = 1080;
  const maxRadius = 300;
  const spacing = 20;

  for (let x = centerX - maxRadius; x <= centerX + maxRadius; x += spacing) {
    for (let y = centerY - maxRadius; y <= centerY; y += spacing) {
      const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
      if (dist > maxRadius) continue;
      const t = 1 - dist / maxRadius;
      const r = 2 + t * 5;
      const o = t * 0.6;
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

const BrandedLayout: React.FC<{
  children: React.ReactNode;
  showKalshiTop?: boolean;
  bracketOpacity?: number;
  showSigBacking?: boolean;
}> = ({ children, showKalshiTop = true, bracketOpacity, showSigBacking }) => {
  const frame = useCurrentFrame();
  const bracketFade = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <>
      <LightBg />
      <BracketBackground opacity={(bracketOpacity ?? 0.15) * bracketFade} />
      {showKalshiTop && (
        <div
          style={{
            position: "absolute",
            top: 40,
            width: "100%",
            textAlign: "center",
          }}
        >
          <span
            style={{
              ...greenText,
              fontSize: 56,
              fontWeight: 900,
              fontStyle: "italic",
            }}
          >
            Kalshi
          </span>
        </div>
      )}
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
      {showSigBacking && (
        <div
          style={{
            position: "absolute",
            bottom: 160,
            width: "100%",
            textAlign: "center",
            padding: "0 200px",
          }}
        >
          <div
            style={{
              fontFamily,
              fontSize: 16,
              color: "#555",
              lineHeight: 1.5,
            }}
          >
            {SIG_BACKING}
          </div>
        </div>
      )}
      <div
        style={{
          position: "absolute",
          bottom: 20,
          width: "100%",
          textAlign: "center",
          padding: "0 100px",
        }}
      >
        <div
          style={{
            fontFamily,
            fontSize: 11,
            color: "#999",
            lineHeight: 1.6,
          }}
        >
          {DISCLAIMER_FULL}
        </div>
      </div>
      <HalftoneDots opacity={bracketFade * 0.8} />
    </>
  );
};

// ---------------------------------------------------------------------------
// Scene 17 — Chalkboard
// ---------------------------------------------------------------------------

// Dense array of equations/formulas for a convincing chalkboard
const EQUATIONS = [
  // Top row
  { text: "f(x)dx", x: 120, y: 60, size: 20, rot: -2 },
  { text: "\u222Bf(x)dx = F(x)+C", x: 700, y: 40, size: 16, rot: 1 },
  { text: "P = N\u00B7O", x: 1050, y: 30, size: 14, rot: -1 },
  { text: "(a+b\u00B2\u00D7c>0)", x: 1500, y: 50, size: 14, rot: 2 },
  { text: "M\u00B2=6\u00B7x", x: 50, y: 30, size: 14, rot: -3 },

  // Upper area
  { text: "\u222B", x: 30, y: 120, size: 32, rot: -1 },
  { text: "ke\u2124 V\u0416R", x: 180, y: 110, size: 18, rot: 0 },
  { text: "x=f(x,a)\u00B7d\u03C3", x: 600, y: 90, size: 14, rot: -2 },
  { text: "f(y)da = F(x)+C", x: 1200, y: 80, size: 16, rot: 1 },
  { text: "(\u222Bf(x\u00B7dx) = f(y), d|f(y) dx = \u03B1(f(y))", x: 1250, y: 120, size: 12, rot: 0 },
  { text: "F'(y)dx = F(y) + C", x: 1250, y: 160, size: 12, rot: 0 },
  { text: "\u03C9.EL", x: 1050, y: 100, size: 14, rot: 3 },

  // Orbital diagram area (upper left)
  { text: "\u2295", x: 250, y: 180, size: 40, rot: 0 },
  { text: "d\u03C1/d\u03C4=\u03B1\u00B7\u03C1+\u03B2\u00B7K", x: 100, y: 200, size: 12, rot: -1 },
  { text: "F(t) = dF/dt", x: 80, y: 240, size: 14, rot: -2 },

  // Chemical formulas
  { text: "CaO+2HCl\u2192CaCl+H\u2082O", x: 60, y: 340, size: 16, rot: -1 },
  { text: "P\u2080+6HCl\u21922FeCl\u2083+3H\u2082", x: 80, y: 380, size: 14, rot: 0 },
  { text: "Na\u2082CO\u2083+2HCl\u21922NaCl\u2212\u2192CO\u2082+H", x: 80, y: 680, size: 14, rot: -1 },
  { text: "C\u2082H\u2085OH", x: 160, y: 720, size: 14, rot: 0 },
  { text: "CH\u2083\u2212CH=C\u2212CH\u2083\u2212CH\u2082+4H", x: 100, y: 760, size: 12, rot: 1 },

  // Middle area — more math
  { text: "\u03A3", x: 1400, y: 200, size: 28, rot: 3 },
  { text: "lim x\u2192\u221E", x: 800, y: 250, size: 16, rot: -1 },
  { text: "C(n,k)", x: 1100, y: 200, size: 18, rot: 2 },
  { text: "n!", x: 650, y: 180, size: 20, rot: 1 },
  { text: "dy/dx", x: 1500, y: 240, size: 16, rot: -2 },
  { text: "e^{i\u03C0}+1=0", x: 400, y: 350, size: 14, rot: -2 },
  { text: "\u222B\u222B", x: 850, y: 400, size: 22, rot: 4 },
  { text: "P(A|B)", x: 1300, y: 340, size: 16, rot: -1 },
  { text: "\u03B1\u00B2+\u03B2\u00B2", x: 200, y: 500, size: 16, rot: -3 },
  { text: "log\u2082(n)", x: 1650, y: 300, size: 14, rot: 2 },
  { text: "\u2200x\u2208\u211D", x: 550, y: 450, size: 16, rot: -1 },
  { text: "\u2202/\u2202x", x: 900, y: 150, size: 18, rot: -2 },
  { text: "\u03C0", x: 250, y: 460, size: 22, rot: 1 },
  { text: "\u221A", x: 1600, y: 400, size: 20, rot: -3 },
  { text: "\u0394", x: 500, y: 550, size: 18, rot: 2 },

  // Lower area
  { text: "KC + m\u00B3 + Cx = F\u2082", x: 500, y: 420, size: 14, rot: -1 },
  { text: "T = I\u2080 + T\u2081...", x: 700, y: 520, size: 14, rot: 0 },
  { text: "I = I\u2080\u00B7e^{-\u03BCx}", x: 750, y: 560, size: 12, rot: -1 },
  { text: "V.M. O<|mn|, k \u2265 0(1)", x: 1150, y: 500, size: 12, rot: 0 },
  { text: "T\u03C0 \u2265 \u03A3 P\u1D62 + \u03A3 T\u1D62", x: 1100, y: 260, size: 12, rot: 1 },
  { text: "f\u2099(y)\u2243 \u03B1\u0305. (-1+2\u03B2) \u03B3", x: 1300, y: 520, size: 12, rot: -1 },
  { text: "V\u03B1CO\u2083+2HCl = 2V\u03B1Cl+C\u03B1+1/n", x: 100, y: 620, size: 12, rot: 0 },
  { text: "x\u00D7x\u22650, X\u00B7k\u2265\u2208\u22650", x: 400, y: 700, size: 12, rot: 1 },
  { text: "F\u2082\u2192", x: 200, y: 580, size: 16, rot: -2 },
  { text: "\u222Bf(x)dx\u2212F(x)+C\u03B1\u03C4", x: 1100, y: 600, size: 12, rot: 0 },
  { text: "v > 0 \u2283 \u03B4(r) > 0, V.M. O<|mn|, k > (1)", x: 700, y: 620, size: 10, rot: 0 },

  // Lower middle
  { text: "\u25B3", x: 1050, y: 700, size: 36, rot: 0 },
  { text: "(\u222B) f(y) \u00B7 d\u03C3", x: 900, y: 680, size: 12, rot: -1 },
  { text: "P(x) \u2243 \u03A3 (-1+\u03B2)/n!", x: 1400, y: 650, size: 12, rot: 1 },

  // Bottom area
  { text: "-iCP\u2082", x: 120, y: 830, size: 14, rot: -2 },
  { text: "-(CH\u2082-CH = C-)", x: 200, y: 860, size: 12, rot: 0 },
  { text: "(4-CH\u2082-CH\u2082-C = CH\u2082+4C\u2082-CH\u2082-C)", x: 300, y: 900, size: 10, rot: 1 },
  { text: "x\u00D7x\u22650, X\u00B7k\u2265\u2208\u22650", x: 500, y: 820, size: 12, rot: -1 },
  { text: "\u03B4F\u2082\u2192", x: 350, y: 780, size: 14, rot: -2 },
  { text: "k\u2265\u2208=M\u00B2", x: 80, y: 780, size: 14, rot: 3 },
];

export const Scene17_Chalkboard: React.FC = () => {
  const frame = useCurrentFrame();
  const fade = sceneFade(frame, 300);

  // Phase 1: "The perfect" at frames 0-90 (seconds 0-3)
  const phase1 = progress(frame, 30, 40);
  // Phase 2: "The perfect bracket" at frames 90-150
  const phase2 = progress(frame, 100, 40);
  // Phase 3: Full sentence at frames 150+
  const phase3 = progress(frame, 170, 40);

  // Determine which text to show
  const showPhase3 = frame > 160;
  const showPhase2 = frame > 90 && !showPhase3;
  const showPhase1 = frame <= 90;

  return (
    <div style={{ position: "absolute", inset: 0, opacity: fade }}>
      {/* Dark chalkboard background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(135deg, #2a2f28 0%, #1a1f1a 30%, #1c211c 60%, #1a1f1a 100%)",
        }}
      />
      {/* Subtle chalk dust texture via noise overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at 40% 50%, rgba(60,65,58,0.3) 0%, transparent 70%)",
        }}
      />

      {/* Dense scattered equations */}
      {EQUATIONS.map((eq, i) => {
        const enterFrame = 2 + srand(i + 1) * 40;
        const eqProgress = progress(frame, enterFrame, 15);
        const opacity = eqProgress * (0.25 + srand(i + 100) * 0.35);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: eq.x,
              top: eq.y,
              fontSize: eq.size,
              fontFamily: "Georgia, serif",
              color: `rgba(210,210,200,${0.9})`,
              transform: `rotate(${eq.rot}deg)`,
              opacity,
              fontWeight: 300,
              letterSpacing: 0.5,
              whiteSpace: "nowrap",
            }}
          >
            {eq.text}
          </div>
        );
      })}

      {/* Left-edge silhouette (blurred person standing, facing the board) */}
      <div
        style={{
          position: "absolute",
          left: 60,
          top: 200,
          width: 120,
          height: 700,
          background:
            "linear-gradient(to right, rgba(10,12,10,0.5), rgba(10,12,10,0.0))",
          borderRadius: "20px 40px 20px 10px",
          filter: "blur(3px)",
        }}
      />
      {/* Head */}
      <div
        style={{
          position: "absolute",
          left: 90,
          top: 160,
          width: 70,
          height: 70,
          borderRadius: "50%",
          background: "rgba(10,12,10,0.4)",
          filter: "blur(4px)",
        }}
      />
      {/* Body/torso */}
      <div
        style={{
          position: "absolute",
          left: 80,
          top: 230,
          width: 90,
          height: 400,
          background:
            "linear-gradient(180deg, rgba(10,12,10,0.45) 0%, rgba(10,12,10,0.3) 100%)",
          borderRadius: "10px 10px 5px 5px",
          filter: "blur(3px)",
        }}
      />

      {/* Phase 1: "The perfect" — centered */}
      {showPhase1 && (
        <Center>
          <span
            style={{
              ...baseText,
              color: "#fff",
              fontSize: 72,
              fontWeight: 700,
              opacity: easeOutExpo(phase1),
              transform: `translateY(${(1 - easeOutExpo(phase1)) * 25}px)`,
            }}
          >
            The perfect
          </span>
        </Center>
      )}

      {/* Phase 2: "The perfect bracket" — centered, slightly lower */}
      {showPhase2 && (
        <Center style={{ top: "52%" }}>
          <span
            style={{
              ...baseText,
              color: "#fff",
              fontSize: 64,
              fontWeight: 700,
              opacity: easeOutExpo(phase2),
              transform: `translateY(${(1 - easeOutExpo(phase2)) * 20}px)`,
            }}
          >
            The perfect bracket
          </span>
        </Center>
      )}

      {/* Phase 3: Full sentence */}
      {showPhase3 && (
        <Center style={{ top: "48%" }}>
          <span
            style={{
              ...baseText,
              color: "#fff",
              fontSize: 52,
              fontWeight: 700,
              textAlign: "center",
              maxWidth: 1200,
              opacity: easeOutExpo(phase3),
              transform: `translateY(${(1 - easeOutExpo(phase3)) * 20}px)`,
              lineHeight: 1.2,
            }}
          >
            The perfect bracket is the holy grail of sports math
          </span>
        </Center>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Scene 18 — Buffett
// ---------------------------------------------------------------------------

export const Scene18_Buffett: React.FC = () => {
  const frame = useCurrentFrame();
  const fade = sceneFade(frame, 150);

  // Portrait draws in from frame 5-60
  const drawProgress = interpolate(frame, [5, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const drawEased = easeOutQuart(drawProgress);

  // "2014" appears early
  const yearOpacity = interpolate(frame, [5, 25], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // The portrait is large, filling the center-right area
  const portraitScale = 2.2;
  const headR = 100;
  const headCirc = Math.PI * 2 * headR;
  const glassR = 26;
  const glassCirc = Math.PI * 2 * glassR;

  return (
    <div style={{ position: "absolute", inset: 0, opacity: fade }}>
      <LightBg />

      {/* Large line-art portrait — positioned center-right like original */}
      <svg
        width={600}
        height={700}
        viewBox="0 0 300 350"
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-35%, -50%) scale(${portraitScale * drawEased})`,
          transformOrigin: "center center",
        }}
      >
        {/* Head — slightly oval */}
        <ellipse
          cx={150}
          cy={115}
          rx={95}
          ry={105}
          fill="none"
          stroke="#222"
          strokeWidth={1.5}
          strokeDasharray={headCirc}
          strokeDashoffset={headCirc * (1 - drawEased)}
        />
        {/* Hair lines — wispy on top */}
        {[
          "M 80 60 Q 100 20 150 15 Q 200 20 220 60",
          "M 90 50 Q 120 10 160 12 Q 210 15 225 55",
          "M 75 75 Q 85 40 120 25",
          "M 225 75 Q 215 40 185 28",
          "M 70 90 Q 60 60 80 45",
          "M 230 90 Q 240 60 220 48",
        ].map((d, i) => (
          <path
            key={`hair-${i}`}
            d={d}
            fill="none"
            stroke="#222"
            strokeWidth={1}
            strokeDasharray={200}
            strokeDashoffset={200 * (1 - drawEased)}
          />
        ))}
        {/* Left eyeglass */}
        <ellipse
          cx={118}
          cy={115}
          rx={glassR}
          ry={22}
          fill="none"
          stroke="#222"
          strokeWidth={1.8}
          strokeDasharray={glassCirc}
          strokeDashoffset={glassCirc * (1 - drawEased)}
        />
        {/* Right eyeglass */}
        <ellipse
          cx={182}
          cy={115}
          rx={glassR}
          ry={22}
          fill="none"
          stroke="#222"
          strokeWidth={1.8}
          strokeDasharray={glassCirc}
          strokeDashoffset={glassCirc * (1 - drawEased)}
        />
        {/* Bridge */}
        <line
          x1={144}
          y1={115}
          x2={156}
          y2={115}
          stroke="#222"
          strokeWidth={1.5}
          strokeDasharray={12}
          strokeDashoffset={12 * (1 - drawEased)}
        />
        {/* Temple arms */}
        <path
          d="M 92 115 L 60 108"
          fill="none"
          stroke="#222"
          strokeWidth={1.2}
          strokeDasharray={40}
          strokeDashoffset={40 * (1 - drawEased)}
        />
        <path
          d="M 208 115 L 238 108"
          fill="none"
          stroke="#222"
          strokeWidth={1.2}
          strokeDasharray={40}
          strokeDashoffset={40 * (1 - drawEased)}
        />
        {/* Eye lines / wrinkle marks */}
        {[
          "M 106 108 L 110 112",
          "M 130 108 L 126 112",
          "M 170 108 L 174 112",
          "M 194 108 L 190 112",
        ].map((d, i) => (
          <path
            key={`eye-${i}`}
            d={d}
            fill="none"
            stroke="#222"
            strokeWidth={0.8}
            strokeDasharray={10}
            strokeDashoffset={10 * (1 - drawEased)}
          />
        ))}
        {/* Nose */}
        <path
          d="M 148 125 Q 145 145 140 155 Q 145 158 150 158 Q 155 158 160 155"
          fill="none"
          stroke="#222"
          strokeWidth={1}
          strokeDasharray={60}
          strokeDashoffset={60 * (1 - drawEased)}
        />
        {/* Smile */}
        <path
          d="M 128 172 Q 140 182 150 183 Q 160 182 172 172"
          fill="none"
          stroke="#222"
          strokeWidth={1.2}
          strokeDasharray={60}
          strokeDashoffset={60 * (1 - drawEased)}
        />
        {/* Cheek wrinkles */}
        {[
          "M 100 150 Q 105 160 110 165",
          "M 200 150 Q 195 160 190 165",
          "M 98 165 Q 108 178 115 180",
          "M 202 165 Q 192 178 185 180",
        ].map((d, i) => (
          <path
            key={`cheek-${i}`}
            d={d}
            fill="none"
            stroke="#222"
            strokeWidth={0.8}
            strokeDasharray={40}
            strokeDashoffset={40 * (1 - drawEased)}
          />
        ))}
        {/* Ears */}
        <path
          d="M 58 105 Q 45 115 48 135 Q 52 148 60 145"
          fill="none"
          stroke="#222"
          strokeWidth={1}
          strokeDasharray={60}
          strokeDashoffset={60 * (1 - drawEased)}
        />
        <path
          d="M 242 105 Q 255 115 252 135 Q 248 148 240 145"
          fill="none"
          stroke="#222"
          strokeWidth={1}
          strokeDasharray={60}
          strokeDashoffset={60 * (1 - drawEased)}
        />
        {/* Neck */}
        <path
          d="M 125 215 L 120 240"
          fill="none"
          stroke="#222"
          strokeWidth={1}
          strokeDasharray={30}
          strokeDashoffset={30 * (1 - drawEased)}
        />
        <path
          d="M 175 215 L 180 240"
          fill="none"
          stroke="#222"
          strokeWidth={1}
          strokeDasharray={30}
          strokeDashoffset={30 * (1 - drawEased)}
        />
        {/* Shoulders / suit jacket */}
        <path
          d="M 120 240 Q 100 245 60 260 Q 30 275 20 300"
          fill="none"
          stroke="#222"
          strokeWidth={1.5}
          strokeDasharray={160}
          strokeDashoffset={160 * (1 - drawEased)}
        />
        <path
          d="M 180 240 Q 200 245 240 260 Q 270 275 280 300"
          fill="none"
          stroke="#222"
          strokeWidth={1.5}
          strokeDasharray={160}
          strokeDashoffset={160 * (1 - drawEased)}
        />
        {/* Collar / tie lines */}
        <path
          d="M 130 220 L 145 255 L 150 260 L 155 255 L 170 220"
          fill="none"
          stroke="#222"
          strokeWidth={1.2}
          strokeDasharray={100}
          strokeDashoffset={100 * (1 - drawEased)}
        />
        {/* Lapel lines */}
        <path
          d="M 125 240 Q 115 270 100 290"
          fill="none"
          stroke="#222"
          strokeWidth={1}
          strokeDasharray={80}
          strokeDashoffset={80 * (1 - drawEased)}
        />
        <path
          d="M 175 240 Q 185 270 200 290"
          fill="none"
          stroke="#222"
          strokeWidth={1}
          strokeDasharray={80}
          strokeDashoffset={80 * (1 - drawEased)}
        />
        {/* Forehead wrinkles */}
        {[
          "M 110 80 Q 150 75 190 80",
          "M 115 88 Q 150 84 185 88",
          "M 118 95 Q 150 92 182 95",
        ].map((d, i) => (
          <path
            key={`wrinkle-${i}`}
            d={d}
            fill="none"
            stroke="#222"
            strokeWidth={0.6}
            strokeDasharray={100}
            strokeDashoffset={100 * (1 - drawEased)}
          />
        ))}
      </svg>

      {/* "2014" — left side, vertically centered */}
      <div
        style={{
          position: "absolute",
          left: 140,
          top: "50%",
          transform: "translateY(-50%)",
          opacity: yearOpacity,
        }}
      >
        <span style={{ ...baseText, fontSize: 120, fontWeight: 900 }}>
          2014
        </span>
      </div>

      {/* "$One billion dollars" — right side, green, handwritten feel */}
      <div
        style={{
          position: "absolute",
          right: 120,
          top: "42%",
          transform: "translateY(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
        }}
      >
        <span
          style={{
            ...greenText,
            fontSize: 48,
            fontStyle: "italic",
            opacity: interpolate(frame, [60, 75], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            transform: `translateY(${interpolate(frame, [60, 75], [15, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px)`,
          }}
        >
          $
        </span>
        <span
          style={{
            ...greenText,
            fontSize: 52,
            fontStyle: "italic",
            opacity: interpolate(frame, [75, 95], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            transform: `translateY(${interpolate(frame, [75, 95], [15, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px)`,
          }}
        >
          One billion
        </span>
        <span
          style={{
            ...greenText,
            fontSize: 52,
            fontStyle: "italic",
            opacity: interpolate(frame, [90, 110], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            transform: `translateY(${interpolate(frame, [90, 110], [15, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px)`,
          }}
        >
          dollars
        </span>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Scene 19 — Quest Swoosh (3 phases: "Nobody did", swoosh + text, "Now it's your turn")
// ---------------------------------------------------------------------------

export const Scene19_QuestSwoosh: React.FC = () => {
  const frame = useCurrentFrame();
  const fade = sceneFade(frame, 120);

  // Phase 1: "Nobody did" with vertical green loop (frames 0-35)
  const phase1Active = frame < 35;
  const loopDraw = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const loopEased = easeOutExpo(loopDraw);
  const nobodyOpacity = interpolate(frame, [5, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Phase 2: "But the quest for perfection never ends" with wide swoosh (frames 35-85)
  const phase2Active = frame >= 35 && frame < 85;
  const swooshDraw = interpolate(frame, [35, 75], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const swooshEased = easeOutExpo(swooshDraw);
  const questText = "But the quest for perfection never ends";
  const questWords = questText.split(" ");
  const questStart = 40;
  const questPerWord = 4;

  // Phase 3: "Now it's your turn" with green edges (frames 85+)
  const phase3Active = frame >= 85;
  const turnOpacity = interpolate(frame, [88, 100], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const greenEdgeProgress = interpolate(frame, [85, 115], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const edgeEased = easeOutExpo(greenEdgeProgress);

  // Vertical loop path for "Nobody did"
  const loopPath = "M 560 120 Q 650 80 680 200 Q 710 500 620 700 Q 530 800 500 650 Q 470 500 520 300 Q 560 180 560 120";
  const loopLength = 1600;

  // Wide horizontal swoosh for quest
  const swooshPath1 = "M -100 200 Q 400 100 900 250 Q 1400 400 2020 150";
  const swooshPath2 = "M -100 900 Q 300 700 700 800 Q 1200 900 1600 700 Q 1900 600 2020 650";
  const swooshLen = 2400;

  return (
    <div style={{ position: "absolute", inset: 0, opacity: fade }}>
      <LightBg />

      {/* Phase 1: "Nobody did" + vertical loop */}
      {phase1Active && (
        <>
          <svg
            width={1920}
            height={1080}
            style={{ position: "absolute", top: 0, left: 0 }}
          >
            <path
              d={loopPath}
              fill="none"
              stroke={GREEN}
              strokeWidth={8}
              strokeLinecap="round"
              strokeDasharray={loopLength}
              strokeDashoffset={loopLength * (1 - loopEased)}
            />
          </svg>
          <Center>
            <span
              style={{
                ...baseText,
                fontSize: 56,
                opacity: nobodyOpacity,
              }}
            >
              Nobody did
            </span>
          </Center>
        </>
      )}

      {/* Phase 2: Wide swoosh + "But the quest for perfection never ends" */}
      {phase2Active && (
        <>
          <svg
            width={1920}
            height={1080}
            style={{ position: "absolute", top: 0, left: 0 }}
          >
            <path
              d={swooshPath1}
              fill="none"
              stroke={GREEN}
              strokeWidth={7}
              strokeLinecap="round"
              strokeDasharray={swooshLen}
              strokeDashoffset={swooshLen * (1 - swooshEased)}
            />
            <path
              d={swooshPath2}
              fill="none"
              stroke={GREEN}
              strokeWidth={7}
              strokeLinecap="round"
              strokeDasharray={swooshLen}
              strokeDashoffset={swooshLen * (1 - swooshEased * 0.85)}
            />
          </svg>
          <div
            style={{
              position: "absolute",
              left: 160,
              top: "45%",
              display: "flex",
              flexWrap: "wrap",
              gap: 14,
              maxWidth: 1000,
            }}
          >
            {questWords.map((w, i) => {
              const { opacity, y } = wordReveal(
                frame,
                questStart + i * questPerWord
              );
              return (
                <span
                  key={i}
                  style={{
                    ...baseText,
                    fontSize: 52,
                    fontWeight: 800,
                    opacity,
                    transform: `translateY(${y}px)`,
                  }}
                >
                  {w}
                </span>
              );
            })}
          </div>
        </>
      )}

      {/* Phase 3: "Now it's your turn" with green edge bars */}
      {phase3Active && (
        <>
          {/* Green edge reveals from sides */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: `${edgeEased * 15}%`,
              height: "100%",
              backgroundColor: GREEN,
            }}
          />
          <div
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              width: `${edgeEased * 15}%`,
              height: "100%",
              backgroundColor: GREEN,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: "100%",
              height: `${edgeEased * 8}%`,
              backgroundColor: GREEN,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 0,
              bottom: 0,
              width: "100%",
              height: `${edgeEased * 8}%`,
              backgroundColor: GREEN,
            }}
          />
          <Center>
            <span
              style={{
                ...baseText,
                fontSize: 56,
                fontWeight: 800,
                opacity: turnOpacity,
              }}
            >
              Now it's your turn
            </span>
          </Center>
        </>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Scene 20 — Billion Contest
// ---------------------------------------------------------------------------

export const Scene20_BillionContest: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const stagger = (delay: number) =>
    spring({ frame: frame - delay, fps, config: { damping: 13 } });

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <BrandedLayout showKalshiTop bracketOpacity={0.12} showSigBacking>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            transform: "translateY(-40px)",
          }}
        >
          <span
            style={{
              ...greenText,
              fontSize: 20,
              letterSpacing: 6,
              textTransform: "uppercase",
              fontWeight: 800,
              opacity: stagger(8),
              transform: `translateY(${(1 - stagger(8)) * 15}px)`,
            }}
          >
            Introducing:
          </span>
          <span
            style={{
              ...baseText,
              fontSize: 160,
              lineHeight: 1,
              fontWeight: 900,
              opacity: stagger(15),
              transform: `scale(${0.85 + stagger(15) * 0.15})`,
            }}
          >
            $1 BILLION
          </span>
          <span
            style={{
              ...greenText,
              fontSize: 32,
              letterSpacing: 4,
              fontWeight: 800,
              opacity: stagger(25),
              transform: `translateY(${(1 - stagger(25)) * 12}px)`,
            }}
          >
            PERFECT BRACKET CONTEST
          </span>
        </div>
      </BrandedLayout>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Scene 21 — Free Entry
// ---------------------------------------------------------------------------

export const Scene21_FreeEntry: React.FC = () => {
  const frame = useCurrentFrame();

  // Full text from original: "Free to enter with no deposit or trading requirement"
  const line1 = "Free to enter with";
  const line2 = "no deposit or trading requirement";

  const line1Opacity = interpolate(frame, [10, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const line1Y = interpolate(frame, [10, 30], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const line2Opacity = interpolate(frame, [35, 55], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const line2Y = interpolate(frame, [35, 55], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <BrandedLayout showKalshiTop>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            transform: "translateY(-30px)",
          }}
        >
          <span
            style={{
              ...baseText,
              fontSize: 48,
              fontWeight: 700,
              opacity: line1Opacity,
              transform: `translateY(${line1Y}px)`,
            }}
          >
            {line1}
          </span>
          <span
            style={{
              ...baseText,
              fontSize: 48,
              fontWeight: 700,
              opacity: line2Opacity,
              transform: `translateY(${line2Y}px)`,
            }}
          >
            {line2}
          </span>
        </div>
      </BrandedLayout>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Scene 22 — Odds Not In Your Favor
// ---------------------------------------------------------------------------

export const Scene22_OddsNotFavor: React.FC = () => {
  const frame = useCurrentFrame();

  const textOpacity = interpolate(frame, [10, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const textY = interpolate(frame, [10, 30], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <BrandedLayout showKalshiTop>
        <span
          style={{
            ...baseText,
            fontSize: 42,
            fontWeight: 700,
            fontStyle: "italic",
            opacity: textOpacity,
            transform: `translateY(${textY - 30}px)`,
            textAlign: "center",
            maxWidth: 900,
          }}
        >
          And we know the odds aren't in your favor
        </span>
      </BrandedLayout>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Scene 23 — One Million
// ---------------------------------------------------------------------------

export const Scene23_OneMillion: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const dollarDrop = spring({
    frame: frame - 8,
    fps,
    config: { damping: 12, stiffness: 80 },
  });
  const amountScale = spring({
    frame: frame - 20,
    fps,
    config: { damping: 14 },
  });
  const subtitleFade = interpolate(frame, [40, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <BrandedLayout showKalshiTop>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 0,
            transform: "translateY(-30px)",
          }}
        >
          {/* Small "$" above */}
          <span
            style={{
              ...baseText,
              fontSize: 80,
              lineHeight: 1,
              fontWeight: 900,
              opacity: dollarDrop,
              transform: `translateY(${(1 - dollarDrop) * -40}px)`,
            }}
          >
            $
          </span>
          {/* "$1 MILLION" massive */}
          <span
            style={{
              ...baseText,
              fontSize: 150,
              lineHeight: 1,
              fontWeight: 900,
              transform: `scale(${amountScale})`,
              opacity: amountScale,
            }}
          >
            $1 MILLION
          </span>
          {/* Subtitle in green */}
          <span
            style={{
              ...greenText,
              fontSize: 28,
              letterSpacing: 4,
              fontWeight: 800,
              opacity: subtitleFade,
              marginTop: 12,
            }}
          >
            TO THE TOP SCORING BRACKET
          </span>
        </div>
      </BrandedLayout>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Scene 24 — Unpredictable (2 phases: submit button, then predict text)
// ---------------------------------------------------------------------------

export const Scene24_Unpredictable: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phase 1: "submit your bracket" button (frames 0-80)
  const phase1Active = frame < 80;
  const buttonSpring = spring({
    frame: frame - 10,
    fps,
    config: { damping: 14 },
  });
  // Cursor appears and moves toward button
  const cursorOpacity = interpolate(frame, [30, 45], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cursorX = interpolate(frame, [30, 60], [600, 480], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cursorY = interpolate(frame, [30, 60], [650, 560], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Phase 2: "Predict the unpredictable" then adds second line (frames 80+)
  const phase2Active = frame >= 80;
  const predictOpacity = interpolate(frame, [82, 95], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const line2Opacity = interpolate(frame, [110, 130], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const line2Y = interpolate(frame, [110, 130], [15, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <BrandedLayout showKalshiTop>
        {phase1Active && (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                transform: `scale(${buttonSpring}) translateY(-30px)`,
                opacity: buttonSpring,
              }}
            >
              {/* Green rounded button */}
              <div
                style={{
                  backgroundColor: GREEN,
                  borderRadius: 40,
                  padding: "18px 40px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span
                  style={{
                    fontFamily,
                    fontSize: 36,
                    fontWeight: 700,
                    color: "#fff",
                  }}
                >
                  submit
                </span>
              </div>
              <span
                style={{
                  ...baseText,
                  fontSize: 48,
                  fontWeight: 800,
                }}
              >
                your bracket
              </span>
            </div>
            {/* Mouse cursor */}
            <svg
              width={30}
              height={38}
              style={{
                position: "absolute",
                left: cursorX,
                top: cursorY,
                opacity: cursorOpacity,
              }}
              viewBox="0 0 24 30"
            >
              <path
                d="M 2 2 L 2 24 L 8 18 L 14 28 L 18 26 L 12 16 L 20 14 Z"
                fill="#000"
                stroke="#fff"
                strokeWidth={1}
              />
            </svg>
          </>
        )}
        {phase2Active && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              transform: "translateY(-30px)",
            }}
          >
            <span
              style={{
                ...baseText,
                fontSize: 46,
                fontWeight: 800,
                opacity: predictOpacity,
              }}
            >
              Predict the unpredictable
            </span>
            <span
              style={{
                ...baseText,
                fontSize: 46,
                fontWeight: 800,
                opacity: line2Opacity,
                transform: `translateY(${line2Y}px)`,
              }}
            >
              and achieve the holy grail of statistics
            </span>
          </div>
        )}
      </BrandedLayout>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Scene 25 — Kalshi Logo
// ---------------------------------------------------------------------------

export const Scene25_KalshiLogo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoSpring = spring({
    frame: frame - 12,
    fps,
    config: { damping: 12, stiffness: 60 },
  });

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <BrandedLayout showKalshiTop={false} bracketOpacity={0.2}>
        <span
          style={{
            ...greenText,
            fontSize: 160,
            fontWeight: 900,
            transform: `scale(${logoSpring})`,
            opacity: logoSpring,
          }}
        >
          Kalshi
        </span>
      </BrandedLayout>
    </div>
  );
};
