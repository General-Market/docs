import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { font, monoFont } from "../../../common/fonts";
import { EASE } from "../../../common/easing";
import { FPS, BRAND_GREEN, PANEL } from "../theme";
import { Counter } from "../../general-market/components/Counter";

const sec = (s: number) => Math.round(s * FPS);

// All times are LOCAL seconds (0 = 247.44s video time).
// Each sub-component lives inside its own <Sequence>, so useCurrentFrame()
// already returns sequence-local frames starting at 0.
const Q_CARD_IN = sec(0);
const Q_CARD_OUT = sec(6.5);

const BADGES_IN = sec(6.5);
const BADGES_OUT = sec(12.6);
const BADGE_STAGGER = sec(0.5);

const REQUEST_IN = sec(12.7);
const REQUEST_OUT = sec(16.7);

const COUNTER_IN = sec(17.4);
const COUNTER_OUT = sec(23.5);
const COUNTER_DURATION = sec(5);

const BOT_IN = sec(23.5);
const BOT_OUT = sec(29.4);
const BOT_FLASH_FRAME = sec(25.5); // flips to "READY" ~2s in

const END_IN = sec(29.4);
const END_OUT = sec(35.4);
const FADE_BLACK_FRAMES = 60; // last 2s

// ---------------------------------------------------------------------------
// Q Card — "Do I need to bet on every market?"
// ---------------------------------------------------------------------------

const QCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const duration = Q_CARD_OUT - Q_CARD_IN;

  const slideX = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 120, mass: 0.8 },
  });

  const x = interpolate(slideX, [0, 1], [-400, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const enterOpacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const exitOpacity = interpolate(frame, [duration - 12, duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "flex-start",
        paddingBottom: 180,
        paddingLeft: 100,
        opacity: Math.min(enterOpacity, exitOpacity),
        transform: `translateX(${x}px)`,
      }}
    >
      <div style={{ ...PANEL, padding: "32px 56px", maxWidth: 900 }}>
        <div
          style={{
            fontFamily: font,
            fontSize: 42,
            fontWeight: 700,
            color: "#fafafa",
            lineHeight: 1.3,
          }}
        >
          Do I need to bet on{" "}
          <span style={{ color: BRAND_GREEN }}>every market</span>?
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Source badges — Train, Twitch, Steam, Pump.fun
// ---------------------------------------------------------------------------

interface BadgeSpec {
  label: string;
  borderColor: string;
  emoji: string;
}

const SOURCES: BadgeSpec[] = [
  { label: "Train", borderColor: "#e53935", emoji: "\u{1F682}" },
  { label: "Twitch", borderColor: "#9146FF", emoji: "\u{1F4FA}" },
  { label: "Steam", borderColor: "#1B9FFF", emoji: "\u{1F3AE}" },
  { label: "Pump.fun", borderColor: "#FF8C00", emoji: "\u{1F680}" },
];

const SourceBadges: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const duration = BADGES_OUT - BADGES_IN;

  const exitOpacity = interpolate(frame, [duration - 15, duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity: exitOpacity,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 32,
        }}
      >
        <div style={{ display: "flex", gap: 24 }}>
          {SOURCES.map((src, i) => {
            const badgeFrame = frame - i * BADGE_STAGGER;

            const scale = spring({
              frame: Math.max(badgeFrame, 0),
              fps,
              config: { damping: 12, stiffness: 180, mass: 0.5 },
            });

            const opacity = interpolate(badgeFrame, [0, 6], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });

            const glow = interpolate(badgeFrame, [0, 15], [0, 0.6], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });

            return (
              <div
                key={src.label}
                style={{
                  background: "rgba(10, 10, 10, 0.9)",
                  border: `2px solid ${src.borderColor}`,
                  borderRadius: 999,
                  padding: "14px 32px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  opacity,
                  transform: `scale(${scale})`,
                  boxShadow: `0 0 ${20 * glow}px ${src.borderColor}40`,
                }}
              >
                <span style={{ fontSize: 28 }}>{src.emoji}</span>
                <span
                  style={{
                    fontFamily: font,
                    fontSize: 26,
                    fontWeight: 600,
                    color: "#fafafa",
                  }}
                >
                  {src.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Subtitle fades in after badges settle */}
        <div
          style={{
            fontFamily: font,
            fontSize: 22,
            fontWeight: 400,
            color: "rgba(255, 255, 255, 0.6)",
            letterSpacing: 1,
            opacity: interpolate(frame, [sec(2), sec(3)], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          One batch per source. Trade only what you choose.
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Request a batch — insert card
// ---------------------------------------------------------------------------

const RequestCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const duration = REQUEST_OUT - REQUEST_IN;

  const shimmer = spring({
    frame,
    fps,
    config: { damping: 16, stiffness: 100, mass: 0.9 },
  });

  const enterOpacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const exitOpacity = interpolate(frame, [duration - 12, duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const y = interpolate(shimmer, [0, 1], [30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity: Math.min(enterOpacity, exitOpacity),
        transform: `translateY(${y}px)`,
      }}
    >
      <div
        style={{
          ...PANEL,
          padding: "36px 64px",
          borderLeft: `4px solid ${BRAND_GREEN}`,
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 36,
            fontWeight: 600,
            color: "#fafafa",
            lineHeight: 1.4,
            textAlign: "center",
          }}
        >
          Need a specific batch?{" "}
          <span style={{ color: BRAND_GREEN }}>Ask.</span>
          <br />
          <span
            style={{
              fontSize: 24,
              fontWeight: 400,
              color: "rgba(255,255,255,0.55)",
            }}
          >
            We build it.
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// 1 Billion counter
// ---------------------------------------------------------------------------

const BillionCounter: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = COUNTER_OUT - COUNTER_IN;

  const enterOpacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const exitOpacity = interpolate(frame, [duration - 15, duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity: Math.min(enterOpacity, exitOpacity),
      }}
    >
      <div style={{ ...PANEL, padding: "60px 100px", borderRadius: 20 }}>
        <Counter
          target={1_000_000_000}
          durationFrames={COUNTER_DURATION}
          startFrame={0}
          label="parallel markets"
          fontSize={120}
          color={BRAND_GREEN}
        />
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Bot ready — terminal indicator
// ---------------------------------------------------------------------------

const BotReady: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const duration = BOT_OUT - BOT_IN;
  const flashAt = BOT_FLASH_FRAME - BOT_IN;

  const isReady = frame >= flashAt;

  const enterScale = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 140, mass: 0.6 },
  });

  const enterOpacity = interpolate(frame, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const exitOpacity = interpolate(frame, [duration - 12, duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Blink the amber dot while building
  const blink =
    !isReady && frame > 0 ? 0.5 + 0.5 * Math.sin(frame * 0.4) : 1;

  // Green flash on transition
  const readyFlash = isReady
    ? spring({
        frame: frame - flashAt,
        fps,
        config: { damping: 10, stiffness: 200, mass: 0.4 },
      })
    : 0;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-start",
        alignItems: "flex-end",
        paddingTop: 100,
        paddingRight: 80,
        opacity: Math.min(enterOpacity, exitOpacity),
      }}
    >
      <div
        style={{
          background: "rgba(10, 10, 10, 0.92)",
          borderRadius: 10,
          border: `1px solid ${isReady ? BRAND_GREEN : "rgba(255,255,255,0.15)"}`,
          padding: "16px 28px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          transform: `scale(${enterScale})`,
          boxShadow: isReady
            ? `0 0 ${24 * readyFlash}px ${BRAND_GREEN}50`
            : "none",
        }}
      >
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: isReady ? BRAND_GREEN : "#f59e0b",
            opacity: isReady ? 1 : blink,
          }}
        />
        <span
          style={{
            fontFamily: monoFont,
            fontSize: 20,
            fontWeight: 500,
            color: isReady ? BRAND_GREEN : "rgba(255,255,255,0.7)",
          }}
        >
          {isReady ? "STRATEGY READY \u2713" : "Building..."}
        </span>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// End card — logo, URL, promise checklist, fade to black
// ---------------------------------------------------------------------------

const PROMISES = ["Liquidity", "Capital Lock", "Risk Management"] as const;

const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const duration = END_OUT - END_IN;

  // Dark overlay fading in
  const overlayOpacity = interpolate(frame, [0, 20], [0, 0.92], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.smooth,
  });

  // Logo entrance
  const logoScale = spring({
    frame: Math.max(frame - 6, 0),
    fps,
    config: { damping: 16, stiffness: 120, mass: 0.7 },
  });

  const logoOpacity = interpolate(frame, [6, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // URL entrance
  const urlOpacity = interpolate(frame, [20, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });

  // Checklist entrance
  const checklistOpacity = interpolate(frame, [30, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });

  // Final fade to absolute black
  const fadeToBlack = interpolate(
    frame,
    [duration - FADE_BLACK_FRAMES, duration],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{ background: `rgba(10, 10, 10, ${overlayOpacity})` }}
      />

      <AbsoluteFill
        style={{ justifyContent: "center", alignItems: "center" }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 28,
          }}
        >
          {/* Logo */}
          <div
            style={{
              fontFamily: font,
              fontSize: 80,
              fontWeight: 900,
              color: "#fafafa",
              letterSpacing: -2,
              opacity: logoOpacity,
              transform: `scale(${logoScale})`,
              textAlign: "center",
            }}
          >
            General <span style={{ color: BRAND_GREEN }}>Market</span>
          </div>

          {/* URL */}
          <div
            style={{
              fontFamily: monoFont,
              fontSize: 24,
              fontWeight: 400,
              color: "rgba(255,255,255,0.5)",
              letterSpacing: 2,
              opacity: urlOpacity,
            }}
          >
            generalmarket.io
          </div>

          {/* Promise checklist */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              marginTop: 20,
              opacity: checklistOpacity,
            }}
          >
            {PROMISES.map((label, i) => {
              const itemDelay = i * sec(0.2);
              const itemOpacity = interpolate(
                frame - 30 - itemDelay,
                [0, 8],
                [0, 1],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
              );

              return (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    opacity: itemOpacity,
                  }}
                >
                  <span
                    style={{
                      fontFamily: monoFont,
                      fontSize: 20,
                      fontWeight: 700,
                      color: BRAND_GREEN,
                    }}
                  >
                    [&#x2713;]
                  </span>
                  <span
                    style={{
                      fontFamily: monoFont,
                      fontSize: 20,
                      fontWeight: 400,
                      color: "rgba(255,255,255,0.7)",
                    }}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </AbsoluteFill>

      {/* Final black */}
      <AbsoluteFill
        style={{ background: "#000000", opacity: fadeToBlack }}
      />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Main composition
// ---------------------------------------------------------------------------

export const SourcesClosing: React.FC = () => {
  return (
    <AbsoluteFill>
      {/* Q card: 0s – 6.5s */}
      <Sequence from={Q_CARD_IN} durationInFrames={Q_CARD_OUT - Q_CARD_IN}>
        <QCard />
        <Audio src={staticFile("sfx/whoosh-scene-grid.mp3")} volume={0.65} />
      </Sequence>

      {/* Source badges: 6.5s – 12.6s */}
      <Sequence from={BADGES_IN} durationInFrames={BADGES_OUT - BADGES_IN}>
        <SourceBadges />
        <Audio
          src={staticFile("sfx/text-pop-rapid-sequence.mp3")}
          volume={0.5}
        />
      </Sequence>

      {/* Request a batch: 12.7s – 16.7s */}
      <Sequence from={REQUEST_IN} durationInFrames={REQUEST_OUT - REQUEST_IN}>
        <RequestCard />
        <Audio src={staticFile("sfx/dramatic-reveal.mp3")} volume={0.55} />
      </Sequence>

      {/* 1 Billion counter: 17.4s – 23.5s */}
      <Sequence from={COUNTER_IN} durationInFrames={COUNTER_OUT - COUNTER_IN}>
        <BillionCounter />
        <Audio src={staticFile("sfx/metric-count-up.mp3")} volume={0.6} />
      </Sequence>

      {/* Bot ready: 23.5s – 29.4s */}
      <Sequence from={BOT_IN} durationInFrames={BOT_OUT - BOT_IN}>
        <BotReady />
        <Sequence from={BOT_FLASH_FRAME - BOT_IN}>
          <Audio
            src={staticFile("sfx/code-compile-success.mp3")}
            volume={0.7}
          />
        </Sequence>
      </Sequence>

      {/* End card: 29.4s – 35.4s */}
      <Sequence from={END_IN} durationInFrames={END_OUT - END_IN}>
        <EndCard />
        <Sequence from={sec(0.2)}>
          <Audio
            src={staticFile("sfx/stinger-logo-reveal.mp3")}
            volume={0.75}
          />
        </Sequence>
      </Sequence>
    </AbsoluteFill>
  );
};
