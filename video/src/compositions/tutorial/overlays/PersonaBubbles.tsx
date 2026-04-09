import React from "react";
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  Audio,
} from "remotion";
import { font, monoFont } from "../../../common/fonts";
import { FPS, BRAND_GREEN } from "../theme";

// ---------------------------------------------------------------------------
// Timing helpers
// ---------------------------------------------------------------------------

const sec = (s: number) => Math.round(s * FPS);

// ---------------------------------------------------------------------------
// Persona definitions
// ---------------------------------------------------------------------------

interface Persona {
  id: string;
  name: string;
  role: string;
  avatar: string; // path in public/personas/
  side: "left" | "right";
}

const BEGINNER: Persona = {
  id: "beginner",
  name: "Alex",
  role: "Retail Trader",
  avatar: "personas/beginner.svg",
  side: "left",
};

const FUND_MANAGER: Persona = {
  id: "fund-manager",
  name: "Victoria",
  role: "Fund Manager",
  avatar: "personas/fund-manager.svg",
  side: "right",
};

const COPY_TRADER: Persona = {
  id: "copy-trader",
  name: "Copy Trader",
  role: "The Problem",
  avatar: "personas/copy-trader.svg",
  side: "right",
};

const BOT: Persona = {
  id: "bot",
  name: "GM Bot",
  role: "Your Strategy",
  avatar: "personas/bot.svg",
  side: "right",
};

// ---------------------------------------------------------------------------
// Bubble appearances — each has a persona, text, and timestamp
// ---------------------------------------------------------------------------

interface BubbleAppearance {
  persona: Persona;
  text: string;
  /** Secondary smaller text (proof data) */
  proof?: string;
  /** Start time in seconds */
  startSec: number;
  /** Hold duration in seconds */
  holdSec: number;
  /** Optional: show a red X over the persona */
  blocked?: boolean;
}

const APPEARANCES: BubbleAppearance[] = [
  // ACT 1: Hook — audience identification
  {
    persona: BEGINNER,
    text: "Wait, I trade EVERYTHING at once?",
    proof: "2.55M concurrent Twitch viewers as data source",
    startSec: 36.4,
    holdSec: 5,
  },
  {
    persona: FUND_MANAGER,
    text: "Show me the settlement speed.",
    proof: "$5.7T in hedge fund AUM — none of us had zero-fee settlement",
    startSec: 37.8,
    holdSec: 5,
  },

  // ACT 2: Bot trigger
  {
    persona: BOT,
    text: "Building your strategy...",
    proof: "Connecting to 500,000 markets via GM API",
    startSec: 46.0,
    holdSec: 4,
  },

  // FAQ 1: Liquidity
  {
    persona: BEGINNER,
    text: "5,000 streamers in ONE bet?",
    proof: "7.06M Twitch channels went live in 2026",
    startSec: 60.0,
    holdSec: 5,
  },
  {
    persona: FUND_MANAGER,
    text: "Mandatory fill. Guaranteed liquidity.",
    proof: "vs Polymarket: ~500 markets, pick-your-own",
    startSec: 68.0,
    holdSec: 5,
  },

  // FAQ 2: Settlement
  {
    persona: BEGINNER,
    text: "No fees? Literally zero?",
    proof: "Polymarket charges 2-5%. GM: $0 spread, $0 fees",
    startSec: 128.0,
    holdSec: 5,
  },
  {
    persona: FUND_MANAGER,
    text: "10-minute settlement. Finally.",
    proof: "Traditional disputes: 7+ days. GM: 10 min via 3-node BLS",
    startSec: 95.0,
    holdSec: 5,
  },
  {
    persona: BEGINNER,
    text: "$1 max loss against a whale? I'm in.",
    proof: "Proportional matching: you never lose more than your counterparty",
    startSec: 155.0,
    holdSec: 5,
  },

  // FAQ 3: Privacy
  {
    persona: COPY_TRADER,
    text: "I can see your whole strategy...",
    proof: "HFT captures 50-60% of US equity volume via order book visibility",
    startSec: 166.5,
    holdSec: 3.5,
    blocked: true,
  },
  {
    persona: FUND_MANAGER,
    text: "Sealed bets. Nobody copies me.",
    proof: "Bets encrypted until settlement — no front-running, no MEV",
    startSec: 171.0,
    holdSec: 5,
  },

  // FAQ 4: Moat
  {
    persona: BEGINNER,
    text: "But I don't know all these markets...",
    proof: "That's the point: small edge × 5000 markets > big edge × 1",
    startSec: 200.0,
    holdSec: 5,
  },
  {
    persona: FUND_MANAGER,
    text: "New instrument. No incumbents. First mover.",
    proof: "1920s: charts. 1970s: Black-Scholes. 2026: this.",
    startSec: 228.0,
    holdSec: 5,
  },

  // FAQ 5: Sources
  {
    persona: BEGINNER,
    text: "I only want Twitch. Can I just do that?",
    proof: "One batch per source. Pick your branch.",
    startSec: 253.0,
    holdSec: 4,
  },

  // Closing: Bot ready
  {
    persona: BOT,
    text: "STRATEGY READY. 47 trades executed.",
    proof: "Built in under 5 minutes. Running on 5,000 Twitch streamers.",
    startSec: 272.0,
    holdSec: 5,
  },
  {
    persona: FUND_MANAGER,
    text: "Polymarket does $44B/year with 500 markets.\nWhat happens with 1 billion?",
    proof: "generalmarket.io",
    startSec: 278.0,
    holdSec: 4.5,
  },
];

// ---------------------------------------------------------------------------
// Speech Bubble component
// ---------------------------------------------------------------------------

const SpeechBubble: React.FC<{
  appearance: BubbleAppearance;
}> = ({ appearance }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { persona, text, proof, holdSec, blocked } = appearance;

  const totalFrames = sec(holdSec);

  // Enter spring
  const enterSpring = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 160, mass: 0.7 },
    durationInFrames: 20,
  });

  // Exit fade (last 15 frames)
  const exitStart = totalFrames - 15;
  const exitOpacity = interpolate(frame, [exitStart, totalFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const opacity = Math.min(enterSpring, exitOpacity);
  const scale = interpolate(enterSpring, [0, 1], [0.85, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  if (opacity < 0.01) return null;

  const isLeft = persona.side === "left";
  const avatarSize = 100;
  const bubbleMaxWidth = 420;

  // Blocked animation (red X)
  const blockedScale = blocked
    ? spring({
        frame: Math.max(frame - sec(2.5), 0),
        fps,
        config: { damping: 8, stiffness: 200, mass: 0.5 },
        durationInFrames: 15,
      })
    : 0;

  return (
    <div
      style={{
        position: "absolute",
        [isLeft ? "left" : "right"]: 40,
        top: "50%",
        transform: `translateY(-50%) scale(${scale})`,
        opacity,
        display: "flex",
        flexDirection: isLeft ? "row" : "row-reverse",
        alignItems: "flex-end",
        gap: 12,
        pointerEvents: "none",
      }}
    >
      {/* Avatar */}
      <div style={{ position: "relative", width: avatarSize, height: avatarSize, flexShrink: 0 }}>
        <Img
          src={staticFile(persona.avatar)}
          style={{
            width: avatarSize,
            height: avatarSize,
            borderRadius: "50%",
            border: `3px solid ${blocked ? "#DC2626" : BRAND_GREEN}`,
            background: "#1a1a2e",
          }}
        />
        {/* Blocked X overlay */}
        {blocked && blockedScale > 0.01 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `scale(${blockedScale})`,
            }}
          >
            <svg width={avatarSize} height={avatarSize} viewBox="0 0 100 100">
              <line x1="20" y1="20" x2="80" y2="80" stroke="#DC2626" strokeWidth="8" strokeLinecap="round" />
              <line x1="80" y1="20" x2="20" y2="80" stroke="#DC2626" strokeWidth="8" strokeLinecap="round" />
            </svg>
          </div>
        )}
        {/* Name badge */}
        <div
          style={{
            position: "absolute",
            bottom: -8,
            left: "50%",
            transform: "translateX(-50%)",
            background: blocked ? "#DC2626" : BRAND_GREEN,
            color: "#fff",
            fontFamily: font,
            fontSize: 9,
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: 10,
            whiteSpace: "nowrap",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          {persona.role}
        </div>
      </div>

      {/* Bubble */}
      <div
        style={{
          maxWidth: bubbleMaxWidth,
          background: "#fff",
          borderRadius: 16,
          padding: "14px 18px",
          position: "relative",
          boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
        }}
      >
        {/* Tail */}
        <div
          style={{
            position: "absolute",
            bottom: 16,
            [isLeft ? "left" : "right"]: -8,
            width: 0,
            height: 0,
            borderTop: "8px solid transparent",
            borderBottom: "8px solid transparent",
            [isLeft ? "borderRight" : "borderLeft"]: "10px solid #fff",
          }}
        />
        {/* Text */}
        <div
          style={{
            fontFamily: font,
            fontSize: 16,
            fontWeight: 600,
            color: "#1a1a1a",
            lineHeight: 1.35,
            whiteSpace: "pre-line",
          }}
        >
          {text}
        </div>
        {/* Proof data */}
        {proof && (
          <div
            style={{
              fontFamily: monoFont,
              fontSize: 11,
              fontWeight: 500,
              color: "#666",
              marginTop: 6,
              lineHeight: 1.3,
              borderTop: "1px solid #e0e0e0",
              paddingTop: 6,
            }}
          >
            {proof}
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main overlay — full duration, self-managing visibility
// ---------------------------------------------------------------------------

export const PersonaBubbles: React.FC = () => {
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {APPEARANCES.map((app, i) => (
        <Sequence
          key={`${app.persona.id}-${i}`}
          from={sec(app.startSec)}
          durationInFrames={sec(app.holdSec)}
        >
          <SpeechBubble appearance={app} />
        </Sequence>
      ))}

      {/* SFX on first beginner + fund manager appearance */}
      <Sequence from={sec(36.4)} durationInFrames={3}>
        <Audio src={staticFile("sfx/scroll-tick.mp3")} volume={0.25} />
      </Sequence>
      <Sequence from={sec(37.8)} durationInFrames={3}>
        <Audio src={staticFile("sfx/scroll-tick.mp3")} volume={0.25} />
      </Sequence>
      {/* Copy trader gets a dramatic sound */}
      <Sequence from={sec(166.5)} durationInFrames={3}>
        <Audio src={staticFile("sfx/dramatic-reveal.mp3")} volume={0.3} />
      </Sequence>
      {/* Bot ready */}
      <Sequence from={sec(272.0)} durationInFrames={3}>
        <Audio src={staticFile("sfx/code-compile-success.mp3")} volume={0.3} />
      </Sequence>
    </AbsoluteFill>
  );
};
