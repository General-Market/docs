import React, { useMemo } from "react";
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
 * Scene 02 — "the next chapter" kinetic text + Bard disintegration
 *
 * Flow (174 frames @ 29fps):
 *   Phase A (0–50):   "And now it's time for" builds word by word
 *   Phase B (55–72):  "the next chapter" types in blue char-by-char
 *   Phase C (72–100): "the next chapter" holds, dark text
 *   Phase D (100–126): page-turn corner peel from BOTTOM-RIGHT
 *   Phase E (121–137): "Today" with luminous purple-blue gradient
 *   Phase F (137–150): "Today, Bard" — Today white, Bard pink
 *   Phase G (148–166): "Today, Bard is becoming" + Bard disintegration
 *   Phase H (162–174): dissolve out — particles stream off
 */

const BG_LIGHT = "#EBEAF4";
const BG_DARK = "#1A1A2E";
const TEXT_DARK = "#1d1d1f";
const TEXT_GRAY = "#a8a8b0";
const BLUE_TINT = "#5B6FD6";
const PINK = "#D4607E";
const GRADIENT_PURPLE = "#B08CE8";
const GRADIENT_BLUE = "#7DADE6";

const C = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

// ── Seeded pseudo-random for deterministic fragments ──
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

// ── Fragment data for "Bard" disintegration ──
interface BardFragment {
  letter: string;
  letterIdx: number;
  fragIdx: number;
  // Offset from letter center (where the fragment "lives" within the letter)
  offsetX: number;
  offsetY: number;
  // Explosion vector
  angle: number;
  distance: number; // max travel distance
  curveStrength: number; // perpendicular curve offset
  rotationSpeed: number; // degrees per frame
  // Visual
  width: number;
  height: number;
  delay: number; // frames before this fragment starts moving
  // Color — slight hue variation around pink
  hueShift: number;
  saturation: number;
  lightness: number;
}

function generateBardFragments(): BardFragment[] {
  const letters = ["B", "a", "r", "d"];
  const fragments: BardFragment[] = [];

  letters.forEach((letter, letterIdx) => {
    // Denser fragment count — the word must visually dissolve
    const count = letter === "B" ? 22 : letter === "d" ? 20 : letter === "a" ? 18 : 16;

    for (let fragIdx = 0; fragIdx < count; fragIdx++) {
      const seed = letterIdx * 1000 + fragIdx;
      const r = (n: number) => seededRandom(seed + n * 137);

      // Letter bounding boxes at 44px font
      const letterWidth = letter === "B" ? 30 : letter === "a" ? 26 : letter === "r" ? 18 : 26;
      const letterHeight = 44;

      // Direction: strongly upward-right, like embers rising from a fire
      // Reference shows particles streaming up and to the right
      const baseAngle = -Math.PI * 0.55 + (letterIdx - 1.5) * 0.15; // ~-100deg, slight outward spread
      const angleSpread = r(0) * Math.PI * 0.5 - Math.PI * 0.25; // narrower cone

      fragments.push({
        letter,
        letterIdx,
        fragIdx,
        offsetX: (r(1) - 0.5) * letterWidth,
        offsetY: (r(2) - 0.5) * letterHeight,
        angle: baseAngle + angleSpread,
        distance: 120 + r(3) * 350, // longer travel
        curveStrength: (r(4) - 0.5) * 150, // stronger arcs
        rotationSpeed: (r(5) - 0.5) * 12,
        width: 1.5 + r(6) * 8, // wider size range: tiny shards to bigger chunks
        height: 1.5 + r(7) * 10,
        delay: letterIdx * 1.2 + r(8) * 4, // tighter stagger, edges first
        // Color: mix of pink, purple, and blue — Gemini gradient
        hueShift: r(9) < 0.5
          ? (r(9) - 0.25) * 40    // pink-coral range (330-360)
          : 40 + r(9) * 60,        // purple-blue range (270-310)
        saturation: 65 + r(10) * 30,
        lightness: 50 + r(11) * 25,
      });
    }
  });

  return fragments;
}

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

  const settleProgress = interpolate(frame, [settleFrame, settleFrame + 8], [0, 1], C);

  const typingDone = charsVisible >= text.length;
  const cursorOpacity = !typingDone
    ? (Math.sin(frame * 0.5) > -0.3 ? 0.7 : 0)
    : interpolate(frame, [startFrame + text.length / charsPerFrame, startFrame + text.length / charsPerFrame + 5], [0.7, 0], C);

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

// ── "Bard" disintegrating text with per-letter fragments ──
const BardDisintegration: React.FC<{
  disintegrateStart: number;
  bardAppearStart: number;
  opacity: number;
}> = ({ disintegrateStart, bardAppearStart, opacity }) => {
  const frame = useCurrentFrame();
  const fragments = useMemo(() => generateBardFragments(), []);

  // Per-letter x offsets (B, a, r, d) — measured at 44px Plus Jakarta Sans weight 500
  const letterCenters = [-30, -6, 10, 30];

  // Intact text: vanishes FAST once disintegration starts (3 frames)
  const textOpacity = interpolate(
    frame,
    [disintegrateStart, disintegrateStart + 3],
    [1, 0],
    C
  );

  // Appear animation
  const appearProgress = interpolate(
    frame,
    [bardAppearStart, bardAppearStart + 8],
    [0, 1],
    C
  );

  return (
    <span
      style={{
        position: "relative",
        display: "inline-block",
        marginRight: 11,
        opacity: opacity * appearProgress,
      }}
    >
      {/* Intact "Bard" text — snaps away as fragments erupt */}
      <span
        style={{
          fontSize: 44,
          fontWeight: 500,
          fontFamily,
          color: PINK,
          letterSpacing: "-0.02em",
          lineHeight: 1.2,
          opacity: textOpacity,
        }}
      >
        Bard
      </span>

      {/* Fragment particles — rectangular shards from each letterform */}
      {frame >= disintegrateStart && fragments.map((frag, i) => {
        // Each fragment has its own timeline based on delay
        const fragStart = disintegrateStart + frag.delay;
        const fragDuration = 22; // frames of travel
        const fragProgress = interpolate(
          frame,
          [fragStart, fragStart + fragDuration],
          [0, 1],
          C
        );

        if (fragProgress <= 0) return null;

        // Deceleration: explosive start, asymptotic settle
        const eased = 1 - Math.pow(1 - fragProgress, 3);

        // Primary trajectory along angle
        const travelX = Math.cos(frag.angle) * frag.distance * eased;
        const travelY = Math.sin(frag.angle) * frag.distance * eased;

        // Arc curve — peaks at midpoint, creates organic curved paths
        const arcPhase = Math.sin(fragProgress * Math.PI); // 0->1->0
        const perpX = -Math.sin(frag.angle) * frag.curveStrength * arcPhase;
        const perpY = Math.cos(frag.angle) * frag.curveStrength * arcPhase;

        // Gravity: slight downward drift in late travel (embers cooling)
        const gravityY = fragProgress * fragProgress * 20;

        // Origin: letter center + offset within the letter's bounding box
        const originX = letterCenters[frag.letterIdx] + frag.offsetX;
        const originY = frag.offsetY;

        const x = originX + travelX + perpX;
        const y = originY + travelY + perpY + gravityY;
        const rotation = frag.rotationSpeed * eased * 360;

        // Opacity: instant appearance, long visible tail, fade at end
        const fragOpacity = interpolate(
          fragProgress,
          [0, 0.05, 0.5, 0.85, 1],
          [0, 1, 0.9, 0.5, 0],
          C
        );

        // Scale: starts full, shrinks as it recedes
        const scale = interpolate(fragProgress, [0, 0.2, 1], [1.1, 1, 0.3], C);

        // Color: map hueShift to actual hue
        // Fragments <0.5 hueShift → pink/coral (335-355)
        // Fragments >=0.5 hueShift → purple/blue (260-300)
        const hue = frag.hueShift < 20
          ? 340 + frag.hueShift     // pink range
          : 260 + frag.hueShift;    // purple-blue range
        const color = `hsl(${hue % 360}, ${frag.saturation}%, ${frag.lightness}%)`;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: frag.width,
              height: frag.height,
              borderRadius: Math.min(frag.width, frag.height) > 4 ? 1 : 0,
              backgroundColor: color,
              opacity: fragOpacity,
              transform: `translate(${x}px, ${y}px) rotate(${rotation}deg) scale(${scale})`,
              boxShadow: `0 0 ${Math.max(frag.width, frag.height) * 2.5}px ${color}`,
              pointerEvents: "none",
            }}
          />
        );
      })}
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
  const darkOverlay = interpolate(frame, [TURN_START, TURN_START + 14], [0, 1], C);

  // ═══ Light phase text ═══
  const lightExit = 50;
  const lightOpacity = interpolate(frame, [lightExit, lightExit + 6], [1, 0], C);

  // "the next chapter"
  const TYPING_START = 62;
  const TYPING_SETTLE = 72;
  const chapterOut = interpolate(frame, [TURN_START, TURN_START + 8], [1, 0], C);
  const chapterIn = interpolate(frame, [TYPING_START, TYPING_START + 4], [0, 1], C);

  // ═══ Page turn — corner peel from BOTTOM-RIGHT ═══
  //
  // Reference frame_008 shows: dark revealed in TOP-RIGHT, white page in
  // BOTTOM-LEFT. The fold line intersects:
  //   - TOP edge at (foldTX%, 0%) — starts at 100% (top-right corner)
  //   - RIGHT edge at (100%, foldRY%) — starts at 0% (top-right corner)
  //
  // As progress increases, foldTX sweeps left and foldRY sweeps down,
  // enlarging the dark triangle in the top-right.
  const turnProgress = interpolate(frame, [TURN_START, TURN_END], [0, 1], {
    ...C,
    easing: Easing.inOut(Easing.cubic),
  });

  // Fold line: starts at top-right corner (100%, 0%), sweeps toward bottom-left.
  // At ~25% progress (~f108) the fold should already show a decent triangle.
  // foldTX: where fold meets top edge (100 → -50)
  // foldRY: where fold meets right edge (0 → 150)
  const foldTX = interpolate(turnProgress, [0, 1], [100, -50], C);
  const foldRY = interpolate(turnProgress, [0, 1], [0, 150], C);

  // 3D fold angle of the lifted flap
  const foldAngle = interpolate(turnProgress, [0, 1], [0, 80]);
  const pageOpacity = interpolate(turnProgress, [0, 0.85, 1], [1, 0.9, 0], C);

  // ═══ Dark phase ═══
  const todayFadeIn = interpolate(frame, [DARK_TEXT_START, DARK_TEXT_START + 10], [0, 1], C);
  const todayGradientPhase = interpolate(frame, [DARK_TEXT_START, DARK_TEXT_START + 14, DARK_TEXT_START + 16], [1, 1, 0], C);

  // "Bard" timing
  const BARD_APPEAR = DARK_TEXT_START + 14; // 135
  const BARD_DISINTEGRATE = BARD_APPEAR + 10; // 145 — short hold then shatter

  // Exit
  const exitStart = 162;
  const exitFade = interpolate(frame, [exitStart, 174], [1, 0], C);

  // ═══ Background glow (dark phase) ═══
  const glowOpacity = interpolate(
    frame,
    [DARK_TEXT_START, DARK_TEXT_START + 12, exitStart, 174],
    [0, 0.3, 0.3, 0],
    C
  );

  return (
    <AbsoluteFill>
      {/* Light background */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 50% 50%, #f5f3fa 0%, ${BG_LIGHT} 70%, #e4e1ee 100%)`,
        }}
      />
      {/* Warm accent drift */}
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

      {/* Dark overlay */}
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

      {/* Phase B-C: "the next chapter" */}
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

      {/* Page turn — corner peel: dark reveals from TOP-RIGHT */}
      {frame >= TURN_START && frame <= TURN_END + 2 && (() => {
        // Fold line: from (foldTX%, 0%) on top edge to (100%, foldRY%) on right edge.
        // foldTX starts at 100% and moves left; foldRY starts at 0% and moves down.
        // The revealed dark triangle is ABOVE/RIGHT of this line.
        const tx = Math.max(-5, Math.min(105, foldTX));
        const ry = Math.max(-5, Math.min(105, foldRY));

        // White page: everything BELOW/LEFT of the fold line
        // polygon: top-left, fold-on-top-edge, fold-on-right-edge, bottom-right, bottom-left
        const whiteClip = tx <= 100 && ry <= 100
          ? `polygon(0% 0%, ${tx}% 0%, 100% ${ry}%, 100% 100%, 0% 100%)`
          : `polygon(0% 0%, 0% 0%, 0% 0%)`; // fully peeled

        // Dark triangle: ABOVE/RIGHT of fold line (top-right corner)
        const darkTriClip = `polygon(${tx}% 0%, 100% 0%, 100% ${ry}%)`;

        // Fold line angle (direction from top-edge point to right-edge point)
        const dx = 100 - tx;
        const dy = ry - 0;
        const foldLineAngle = Math.atan2(dy, dx) * (180 / Math.PI);

        // Subtle 3D tilt for the white page (bottom-left comes forward)
        const pageTiltX = interpolate(turnProgress, [0, 0.6], [0, 8], C); // rotateX: top recedes
        const pageTiltY = interpolate(turnProgress, [0, 0.6], [0, -6], C); // rotateY: right recedes

        return (
          <>
            {/* White page — clipped to un-peeled region, with 3D perspective tilt */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                perspective: 1400,
                perspectiveOrigin: "30% 70%", // bottom-left is the "anchor"
                zIndex: 1,
              }}
            >
              <AbsoluteFill
                style={{
                  backgroundColor: "#ffffff",
                  opacity: pageOpacity,
                  clipPath: whiteClip,
                  transform: `rotateX(${pageTiltX}deg) rotateY(${pageTiltY}deg)`,
                  transformOrigin: "0% 100%", // anchor at bottom-left
                }}
              >
                <TextRow opacity={interpolate(turnProgress, [0, 0.4], [1, 0], C)}>
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
            </div>

            {/* Fold shadow — narrow band along the fold edge only */}
            {turnProgress > 0.04 && (() => {
              // Create a clip path that's a thin strip along the fold line
              // Expand the dark triangle clip slightly to include the shadow zone
              const shadowExpand = 5; // % expansion
              const stx = Math.max(-10, tx - shadowExpand);
              const sry = Math.min(115, ry + shadowExpand);
              const shadowClip = `polygon(${stx}% 0%, 100% 0%, 100% ${sry}%, ${tx}% 0%)`.replace(
                `${tx}% 0%)`,
                `${Math.max(-10, tx - shadowExpand * 2)}% ${shadowExpand}%)`
              );

              return (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: `linear-gradient(
                      ${foldLineAngle + 90}deg,
                      transparent 44%,
                      rgba(0,0,0,${interpolate(turnProgress, [0, 0.12, 0.5, 1], [0, 0.12, 0.06, 0], C)}) 49%,
                      rgba(0,0,0,${interpolate(turnProgress, [0, 0.12, 0.5, 1], [0, 0.05, 0.02, 0], C)}) 51%,
                      transparent 56%
                    )`,
                    pointerEvents: "none",
                    zIndex: 4,
                  }}
                />
              );
            })()}

            {/* Peeled flap: paper underside — subtle, just a hint of the fold */}
            {turnProgress > 0.04 && turnProgress < 0.85 && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  perspective: 1200,
                  zIndex: 3,
                  pointerEvents: "none",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    width: "100%",
                    height: "100%",
                    clipPath: darkTriClip,
                    transformOrigin: `${(tx + 100) / 2}% ${ry / 2}%`,
                    transform: `rotate3d(${dy}, ${-dx}, 0, ${foldAngle * 0.5}deg)`,
                    opacity: interpolate(turnProgress, [0.04, 0.12, 0.6, 0.85], [0, 0.35, 0.2, 0], C),
                    background: `linear-gradient(
                      ${foldLineAngle + 180}deg,
                      rgba(210,208,225,0.6) 0%,
                      rgba(235,233,245,0.35) 60%,
                      rgba(190,188,210,0.15) 100%
                    )`,
                  }}
                />
              </div>
            )}
          </>
        );
      })()}

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

      {/* Dark phase text */}
      {frame >= DARK_TEXT_START && (
        <TextRow opacity={todayFadeIn * exitFade} y="50%">
          {/* "Today" — gradient initially, then white */}
          {todayGradientPhase > 0.01 ? (
            <span style={{ position: "relative", display: "inline-block", marginRight: 11 }}>
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
              <BardDisintegration
                bardAppearStart={BARD_APPEAR}
                disintegrateStart={BARD_DISINTEGRATE}
                opacity={1}
              />
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
