import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  Easing,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/PlusJakartaSans";

const { fontFamily } = loadFont("normal", {
  weights: ["300", "400", "500", "700"],
  subsets: ["latin"],
});

/**
 * Scene 02 — "the next chapter" kinetic text
 *
 * Flow (174 frames @ 29fps):
 *   Phase A (0–50):   "And now it's time for" builds word by word
 *   Phase B (55–72):  "the next chapter" types in blue char-by-char
 *   Phase C (72–100): "the next chapter" holds, dark text
 *   Phase D (100–126): page-turn 3D rotation from LEFT edge
 *   Phase E (121–137): "Today" with luminous purple-blue gradient
 *   Phase F (137–150): "Today, Bard" — Today white, Bard pink
 *   Phase G (148–166): "Today, Bard is becoming" + sparkles
 *   Phase H (162–174): dissolve out
 */

const BG_LIGHT = "#EBEAF4";
const BG_DARK = "#101011";
const TEXT_DARK = "#1d1d1f";
const TEXT_GRAY = "#a8a8b0";
const BLUE_TINT = "#5B6FD6";
const PINK = "#D4607E";
const GRADIENT_PURPLE = "#B08CE8";
const GRADIENT_BLUE = "#7DADE6";

const C = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

// ── Word reveal with fade + horizontal slide ──
const WordReveal: React.FC<{
  children: string;
  start: number;
  exit?: number;
  color?: string;
  size?: number;
  weight?: number;
  glow?: string;
  gradientColors?: string[];
}> = ({
  children,
  start,
  exit,
  color = TEXT_DARK,
  size = 46,
  weight = 300,
  glow,
  gradientColors,
}) => {
  const frame = useCurrentFrame();
  const dur = 8;
  const fadeIn = interpolate(frame, [start, start + dur], [0, 1], C);
  const slideX = interpolate(frame, [start, start + dur], [14, 0], {
    ...C,
    easing: Easing.out(Easing.cubic),
  });
  const fadeOut = exit !== undefined
    ? interpolate(frame, [exit, exit + 6], [1, 0], C)
    : 1;

  const isGradient = gradientColors && gradientColors.length >= 2;

  const style: React.CSSProperties = {
    display: "inline-block",
    fontSize: size,
    fontWeight: weight,
    fontFamily,
    color: isGradient ? "transparent" : color,
    opacity: fadeIn * fadeOut,
    transform: `translateX(${slideX}px)`,
    marginRight: 11,
    letterSpacing: "-0.02em",
    lineHeight: 1.2,
    ...(isGradient
      ? {
          background: `linear-gradient(135deg, ${gradientColors.join(", ")})`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }
      : {}),
    ...(glow ? { textShadow: glow } : {}),
  };

  return <span style={style}>{children}</span>;
};

// ── Centered text row ──
const TextRow: React.FC<{
  children: React.ReactNode;
  opacity?: number;
  y?: string;
}> = ({ children, opacity = 1, y = "50%" }) => (
  <div
    style={{
      position: "absolute",
      left: 0,
      right: 0,
      top: y,
      transform: "translateY(-50%)",
      display: "flex",
      justifyContent: "center",
      alignItems: "baseline",
      opacity,
    }}
  >
    {children}
  </div>
);

// ── Character-by-character typing reveal ──
const TypingReveal: React.FC<{
  text: string;
  startFrame: number;
  charsPerFrame: number;
  color: string;
  settleColor: string;
  settleFrame: number;
  size?: number;
  weight?: number;
  opacity?: number;
}> = ({
  text,
  startFrame,
  charsPerFrame,
  color,
  settleColor,
  settleFrame,
  size = 46,
  weight = 300,
  opacity = 1,
}) => {
  const frame = useCurrentFrame();
  const elapsed = Math.max(0, frame - startFrame);
  const charsVisible = Math.min(text.length, Math.floor(elapsed * charsPerFrame));

  // Smooth transition from typing color to settled color
  const settleProgress = interpolate(frame, [settleFrame, settleFrame + 8], [0, 1], C);

  // Cursor blink
  const typingDone = charsVisible >= text.length;
  const cursorOpacity = !typingDone
    ? (Math.sin(frame * 0.5) > -0.3 ? 0.7 : 0)
    : interpolate(frame, [startFrame + text.length / charsPerFrame, startFrame + text.length / charsPerFrame + 5], [0.7, 0], C);

  // Blend color
  const displayColor = settleProgress < 0.01 ? color : settleProgress > 0.99 ? settleColor : color;

  return (
    <span style={{ position: "relative", display: "inline-block", opacity }}>
      <span
        style={{
          fontSize: size,
          fontWeight: weight,
          fontFamily,
          color: displayColor,
          letterSpacing: "-0.02em",
          lineHeight: 1.2,
          transition: "color 0.3s",
        }}
      >
        {text.slice(0, charsVisible)}
      </span>
      {/* Cursor */}
      {charsVisible > 0 && (
        <span
          style={{
            display: "inline-block",
            width: 2,
            height: size * 0.65,
            backgroundColor: displayColor,
            opacity: cursorOpacity,
            marginLeft: 1,
            verticalAlign: "baseline",
            transform: "translateY(2px)",
          }}
        />
      )}
    </span>
  );
};

export const Scene02: React.FC = () => {
  const frame = useCurrentFrame();

  // ═══ Timing constants ═══
  const TURN_START = 102;
  const TURN_END = 126;
  const DARK_TEXT_START = TURN_END - 5; // 121

  // ═══ Background ═══
  // Dark bg appears earlier and faster — by mid-turn it should be almost fully dark
  const darkOverlay = interpolate(frame, [TURN_START, TURN_START + 14], [0, 1], C);

  // ═══ Light phase text ═══
  // "And now it's time for" exits quickly
  const lightExit = 50;
  const lightOpacity = interpolate(frame, [lightExit, lightExit + 6], [1, 0], C);

  // "the next chapter" — typing reveal
  const TYPING_START = 62;
  const TYPING_SETTLE = 72; // blue → dark faster
  const chapterOut = interpolate(frame, [TURN_START, TURN_START + 8], [1, 0], C);
  const chapterIn = interpolate(frame, [TYPING_START, TYPING_START + 4], [0, 1], C);

  // ═══ Page turn — pivots from LEFT edge ═══
  const turnProgress = interpolate(frame, [TURN_START, TURN_END], [0, 1], {
    ...C,
    easing: Easing.inOut(Easing.cubic),
  });
  const pageRotateY = interpolate(turnProgress, [0, 1], [0, 90]);
  const pageOpacity = interpolate(turnProgress, [0, 0.6, 0.85], [1, 0.8, 0], C);

  // ═══ Dark phase ═══
  const todayFadeIn = interpolate(frame, [DARK_TEXT_START, DARK_TEXT_START + 10], [0, 1], C);
  // "Today" shows with gradient first, then transitions to white + "Bard" appears
  const todayGradientPhase = interpolate(frame, [DARK_TEXT_START, DARK_TEXT_START + 14, DARK_TEXT_START + 16], [1, 1, 0], C);

  // Exit
  const exitStart = 162;
  const exitFade = interpolate(frame, [exitStart, 174], [1, 0], C);

  // ═══ Sparkle particles near "Bard" (dark phase) ═══
  const bardStart = DARK_TEXT_START + 14; // 135
  const sparkleBaseOpacity = interpolate(
    frame,
    [bardStart, bardStart + 8, exitStart, 174],
    [0, 1, 1, 0],
    C
  );

  // Sparkles — bright dots floating upward from around "Bard"
  // Position relative to center of frame since text is centered
  const sparkles = Array.from({ length: 32 }, (_, i) => {
    const seed = i * 137.508;
    // Center the sparkles around "Bard" text position (~570-620 on 1280px canvas)
    const cx = 570 + Math.sin(seed) * 90 + (i % 7) * 8;
    const baseY = 320 + Math.cos(seed * 0.7) * 30; // varied vertical origins
    const delayOffset = (i % 6) * 0.8; // stagger start
    const drift = Math.max(0, (frame - bardStart - 1 - delayOffset) * (0.7 + (i % 5) * 0.35));
    const finalY = baseY - drift;
    const xWobble = Math.sin((frame + i * 17) * 0.12) * 18 + Math.cos(seed * 0.3) * drift * 0.15;
    const sz = 2.5 + (i % 4) * 1.2;
    const hue = 270 + (i * 15) % 80; // purple-pink-blue range
    const individualOpacity = sparkleBaseOpacity * (0.5 + (i % 4) * 0.15);
    const driftFade = interpolate(drift, [0, 40, 120], [0, 1, 0], C);

    return (
      <div
        key={i}
        style={{
          position: "absolute",
          left: cx + xWobble,
          top: finalY,
          width: sz,
          height: sz,
          borderRadius: "50%",
          backgroundColor: `hsla(${hue}, 85%, 78%, ${individualOpacity * driftFade})`,
          boxShadow: `0 0 ${sz * 3}px hsla(${hue}, 85%, 78%, ${individualOpacity * driftFade * 0.6})`,
          pointerEvents: "none",
        }}
      />
    );
  });

  // ═══ Background glow (dark phase) ═══
  const glowOpacity = interpolate(
    frame,
    [DARK_TEXT_START, DARK_TEXT_START + 12, exitStart, 174],
    [0, 0.3, 0.3, 0],
    C
  );

  return (
    <AbsoluteFill>
      {/* Light background with subtle animated radial gradients */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 50% 50%, #f5f3fa 0%, ${BG_LIGHT} 70%, #e4e1ee 100%)`,
        }}
      />
      {/* Subtle warm accent — drifts slowly */}
      {frame < TURN_START + 10 && (
        <div
          style={{
            position: "absolute",
            right: -100 + Math.sin(frame * 0.015) * 40,
            bottom: -80 + Math.cos(frame * 0.012) * 30,
            width: 500,
            height: 400,
            borderRadius: "50%",
            background: "radial-gradient(ellipse, rgba(240,220,230,0.25) 0%, transparent 70%)",
            filter: "blur(60px)",
            opacity: interpolate(frame, [TURN_START - 10, TURN_START], [1, 0], C),
            pointerEvents: "none",
          }}
        />
      )}

      {/* Dark overlay — builds during page turn */}
      <AbsoluteFill style={{ backgroundColor: BG_DARK, opacity: darkOverlay }} />

      {/* ════ LIGHT PHASE ════ */}

      {/* Phase A: "And now it's time for" */}
      {frame < 65 && (
        <TextRow opacity={lightOpacity}>
          <WordReveal start={0} color={TEXT_GRAY} size={42} weight={300}>
            And
          </WordReveal>
          <WordReveal start={10} size={42} weight={400}>
            now
          </WordReveal>
          <WordReveal start={22} size={42} weight={300}>{`it\u2019s`}</WordReveal>
          <WordReveal start={32} size={42} weight={300}>
            time
          </WordReveal>
          <WordReveal start={42} size={42} weight={300}>
            for
          </WordReveal>
        </TextRow>
      )}

      {/* Phase B-C: "the next chapter" — types in blue, settles dark */}
      {frame >= TYPING_START && frame < TURN_START + 8 && (
        <TextRow opacity={chapterIn * chapterOut}>
          <TypingReveal
            text="the next chapter"
            startFrame={TYPING_START}
            charsPerFrame={1.0}
            color={BLUE_TINT}
            settleColor={TEXT_DARK}
            settleFrame={TYPING_SETTLE}
            size={42}
            weight={300}
          />
        </TextRow>
      )}

      {/* Page turn: white sheet rotating from LEFT edge */}
      {frame >= TURN_START && frame <= TURN_END + 2 && (
        <AbsoluteFill
          style={{
            backgroundColor: "#ffffff",
            opacity: pageOpacity,
            transform: `perspective(1200px) rotateY(${pageRotateY}deg)`,
            transformOrigin: "left center",
            boxShadow: turnProgress < 0.8
              ? `${turnProgress * 40}px 0 60px rgba(0,0,0,${turnProgress * 0.3})`
              : "none",
          }}
        >
          <TextRow opacity={interpolate(turnProgress, [0, 0.35], [1, 0], C)}>
            <span
              style={{
                fontSize: 42,
                fontWeight: 300,
                fontFamily,
                color: TEXT_DARK,
                letterSpacing: "-0.02em",
              }}
            >
              the next chapter
            </span>
          </TextRow>
        </AbsoluteFill>
      )}

      {/* ════ DARK PHASE ════ */}

      {/* Background glow halo */}
      {frame >= DARK_TEXT_START && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: 360,
            height: 120,
            borderRadius: "50%",
            background: `radial-gradient(ellipse, rgba(160,170,230,${glowOpacity * 0.6}) 0%, rgba(140,130,210,${glowOpacity * 0.3}) 45%, transparent 75%)`,
            filter: "blur(32px)",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Sparkles */}
      {frame >= bardStart && sparkles}

      {/* Dark phase text */}
      {frame >= DARK_TEXT_START && (
        <TextRow opacity={todayFadeIn * exitFade} y="50%">
          {/* "Today" — gradient initially, then white */}
          {todayGradientPhase > 0.01 ? (
            <span style={{ position: "relative", display: "inline-block", marginRight: 11 }}>
              {/* Glow layer behind — actual colored text for the shadow */}
              <span
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  fontSize: 46,
                  fontWeight: 400,
                  fontFamily,
                  color: GRADIENT_PURPLE,
                  opacity: interpolate(frame, [DARK_TEXT_START, DARK_TEXT_START + 8], [0, 0.5], C),
                  letterSpacing: "-0.02em",
                  lineHeight: 1.2,
                  filter: "blur(14px)",
                  pointerEvents: "none",
                }}
              >
                Today
              </span>
              {/* Gradient text on top */}
              <WordReveal
                start={DARK_TEXT_START}
                size={46}
                weight={400}
                gradientColors={[GRADIENT_PURPLE, GRADIENT_BLUE]}
              >
                Today
              </WordReveal>
            </span>
          ) : (
            <>
              <WordReveal
                start={DARK_TEXT_START}
                size={44}
                weight={300}
                color="#ffffff"
              >
                Today,
              </WordReveal>
              <WordReveal
                start={bardStart}
                size={44}
                weight={500}
                color={PINK}
              >
                Bard
              </WordReveal>
              <WordReveal
                start={DARK_TEXT_START + 18}
                size={44}
                weight={300}
                color="#ffffff"
              >
                is
              </WordReveal>
              <WordReveal
                start={DARK_TEXT_START + 21}
                size={44}
                weight={300}
                color="#ffffff"
              >
                becoming
              </WordReveal>
            </>
          )}
        </TextRow>
      )}
    </AbsoluteFill>
  );
};

export const scene02Meta = {
  id: "OFScene02",
  component: Scene02,
  width: 1280,
  height: 720,
  fps: 29,
  durationInFrames: 174,
};
