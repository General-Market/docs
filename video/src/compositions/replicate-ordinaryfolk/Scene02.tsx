import React, { useEffect, useRef, useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { loadFont } from "@remotion/google-fonts/PlusJakartaSans";
import { useGsapTimeline, gsap } from "../../lib/useGsapTimeline";

const { fontFamily } = loadFont("normal", {
  weights: ["300", "400", "500", "700"],
  subsets: ["latin"],
});

/**
 * Scene 02 — "the next chapter" kinetic text + Bard disintegration
 *
 * GSAP rewrite: single paused timeline seeked per-frame via useGsapTimeline.
 * Bard fragment physics remain frame-driven (76 independent curved trajectories
 * with gravity — GSAP can't express that without 76 nested timelines).
 *
 * Flow (174 frames @ 30fps ≈ 5.8s):
 *   Phase A (0–50):   "And now it's time for" builds word by word
 *   Phase B (55–72):  "the next chapter" types in blue char-by-char
 *   Phase C (72–100): "the next chapter" holds, settles to dark
 *   Phase D (100–126): page-turn corner peel from top-right
 *   Phase E (121–137): "Today" with luminous purple-blue gradient
 *   Phase F (135–148): "Today, Bard" — Today white, Bard pink
 *   Phase G (148–166): "Today, Bard is becoming" + Bard disintegration
 *   Phase H (162–174): dissolve out — particles stream off
 */

const BG_LIGHT = "#EBEAF4";
const BG_DARK = "#0D0D10";
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

interface BardFragment {
  letter: string;
  letterIdx: number;
  fragIdx: number;
  offsetX: number;
  offsetY: number;
  angle: number;
  distance: number;
  curveStrength: number;
  rotationSpeed: number;
  width: number;
  height: number;
  delay: number;
  hueShift: number;
  saturation: number;
  lightness: number;
}

function generateBardFragments(): BardFragment[] {
  const letters = ["B", "a", "r", "d"];
  const fragments: BardFragment[] = [];

  letters.forEach((letter, letterIdx) => {
    const count = letter === "B" ? 36 : letter === "d" ? 32 : letter === "a" ? 28 : 24;
    for (let fragIdx = 0; fragIdx < count; fragIdx++) {
      const seed = letterIdx * 1000 + fragIdx;
      const r = (n: number) => seededRandom(seed + n * 137);
      const letterWidth = letter === "B" ? 30 : letter === "a" ? 26 : letter === "r" ? 18 : 26;
      const letterHeight = 44;
      // Ref frame_011: particles stream upward-left in tight cone [PI*0.6, PI*0.9]
      const coneMin = Math.PI * 0.6;
      const coneMax = Math.PI * 0.9;
      const baseAngle = coneMin + r(0) * (coneMax - coneMin);
      const angleSpread = 0;

      fragments.push({
        letter, letterIdx, fragIdx,
        offsetX: (r(1) - 0.5) * letterWidth,
        offsetY: (r(2) - 0.5) * letterHeight,
        angle: baseAngle + angleSpread,
        distance: 160 + r(3) * 450,
        curveStrength: (r(4) - 0.5) * 200,
        rotationSpeed: (r(5) - 0.5) * 12,
        width: (2 + r(6) * 10) * 0.4,
        height: (2 + r(7) * 12) * 0.4,
        delay: letterIdx * 1.0 + r(8) * 3,
        hueShift: r(9) < 0.5 ? (r(9) - 0.25) * 40 : 40 + r(9) * 60,
        saturation: 65 + r(10) * 30,
        lightness: 50 + r(11) * 25,
      });
    }
  });
  return fragments;
}

const FPS = 30;
const s = (f: number) => f / FPS;

const CHAPTER_TEXT = "the next chapter";
const TYPING_START = 62;

/** Frame-driven typing — renders characters one per frame */
const TypingText: React.FC<{ frame: number }> = ({ frame }) => {
  const elapsed = Math.max(0, frame - TYPING_START);
  const charsVisible = Math.min(CHAPTER_TEXT.length, Math.floor(elapsed * 1.6));
  const typingDone = charsVisible >= CHAPTER_TEXT.length;
  const cursorOpacity = !typingDone
    ? (Math.sin(frame * 0.5) > -0.3 ? 0.7 : 0)
    : Math.max(0, 0.7 - Math.max(0, frame - (TYPING_START + CHAPTER_TEXT.length)) / 5 * 0.7);

  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <span
        className="chapter-text"
        style={{
          fontSize: 42,
          fontWeight: 400,
          fontFamily,
          color: BLUE_TINT,
          letterSpacing: "-0.02em",
          lineHeight: 1.2,
        }}
      >
        {CHAPTER_TEXT.slice(0, charsVisible)}
      </span>
      {charsVisible > 0 && (
        <span
          style={{
            display: "inline-block",
            width: 2,
            height: 42 * 0.65,
            backgroundColor: BLUE_TINT,
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
  const { tl, containerRef, frame, fps } = useGsapTimeline();
  const fragments = useMemo(() => generateBardFragments(), []);
  const letterCenters = [-30, -6, 10, 30];
  const builtRef = useRef(false);

  // ── Build GSAP timeline once, then seek to current frame ──
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (builtRef.current) return;
    builtRef.current = true;

    const t = tl.current;
    t.clear();

    // Phase A: word-by-word "And now it's time for"
    const words = el.querySelectorAll<HTMLElement>(".word-reveal");
    const wordStarts = [0, 10, 22, 32, 42];
    words.forEach((word, i) => {
      t.fromTo(word,
        { opacity: 0, x: 14 },
        { opacity: 1, x: 0, duration: s(8), ease: "power3.out" },
        s(wordStarts[i])
      );
    });

    // "And" color handled in JSX via frame-driven interpolation (React rerenders override GSAP color tweens)

    // Phase A exit
    const phaseA = el.querySelector<HTMLElement>(".phase-a-row");
    if (phaseA) {
      t.to(phaseA, { opacity: 0, duration: s(6), ease: "none" }, s(50));
    }

    // Phase B: "the next chapter" row fade in
    const phaseB = el.querySelector<HTMLElement>(".phase-b-row");
    if (phaseB) {
      t.fromTo(phaseB, { opacity: 0 }, { opacity: 1, duration: s(4) }, s(58));
    }

    // Typing color transition: blue → dark. Ref frame_006 (f~75) shows fully dark.
    // Start earlier, shorter duration for snappier transition.
    const chapterText = el.querySelector<HTMLElement>(".chapter-text");
    if (chapterText) {
      t.to(chapterText, { color: TEXT_DARK, duration: s(5), ease: "power2.out" }, s(70));
    }

    // Phase B-C exit (chapter fades for page turn)
    if (phaseB) {
      t.to(phaseB, { opacity: 0, duration: s(6), ease: "none" }, s(100));
    }

    // Phase D: dark bg appears — behind the page, visible as page peels
    const darkBg = el.querySelector<HTMLElement>(".dark-bg");
    if (darkBg) {
      t.set(darkBg, { opacity: 1 }, s(100));
    }

    // Phase E: dark phase text container fades in — starts during page turn
    const darkPhase = el.querySelector<HTMLElement>(".dark-phase-text");
    if (darkPhase) {
      t.fromTo(darkPhase, { opacity: 0 }, { opacity: 1, duration: s(8) }, s(108));
    }

    // "Today" gradient — appears as page finishes turning
    const todayGrad = el.querySelector<HTMLElement>(".today-gradient");
    const todayGlow = el.querySelector<HTMLElement>(".today-glow");
    if (todayGrad) {
      t.fromTo(todayGrad, { opacity: 0, x: 14 }, { opacity: 1, x: 0, duration: s(8), ease: "power3.out" }, s(108));
      t.to(todayGrad, { opacity: 0, duration: s(3) }, s(135));
    }
    if (todayGlow) {
      t.fromTo(todayGlow, { opacity: 0 }, { opacity: 0.75, duration: s(8) }, s(108));
      t.to(todayGlow, { opacity: 0, duration: s(5) }, s(135));
    }

    // "Today," white version crossfade
    const todayWhite = el.querySelector<HTMLElement>(".today-white");
    if (todayWhite) {
      t.fromTo(todayWhite, { opacity: 0 }, { opacity: 1, duration: s(3) }, s(135));
    }

    // "Bard" pink text
    const bardText = el.querySelector<HTMLElement>(".bard-text");
    if (bardText) {
      t.fromTo(bardText, { opacity: 0, x: 8 }, { opacity: 1, x: 0, duration: s(8), ease: "power3.out" }, s(135));
    }

    // "is" and "becoming"
    const isWord = el.querySelector<HTMLElement>(".word-is");
    const becomingWord = el.querySelector<HTMLElement>(".word-becoming");
    if (isWord) {
      t.fromTo(isWord, { opacity: 0, x: 14 }, { opacity: 1, x: 0, duration: s(8), ease: "power3.out" }, s(139));
    }
    if (becomingWord) {
      t.fromTo(becomingWord, { opacity: 0, x: 14 }, { opacity: 1, x: 0, duration: s(8), ease: "power3.out" }, s(142));
    }

    // Phase G: Bard intact text vanishes
    const bardIntact = el.querySelector<HTMLElement>(".bard-intact");
    if (bardIntact) {
      t.to(bardIntact, { opacity: 0, duration: s(3) }, s(148));
    }

    // Fragments become visible
    const fragContainer = el.querySelector<HTMLElement>(".bard-fragments");
    if (fragContainer) {
      t.set(fragContainer, { opacity: 1 }, s(148));
    }

    // Phase H: dissolve out — later start, so fragments stay visible
    if (darkPhase) {
      t.to(darkPhase, { opacity: 0, duration: s(8) }, s(166));
    }

    // Seek immediately after build — Remotion stills only get one render cycle
    t.seek(frame / fps);
  }, []);

  // ── Bard fragment physics (frame-driven, deterministic) ──
  const BARD_DISINTEGRATE = 148;
  const fragmentElements = useMemo(() => {
    if (frame < BARD_DISINTEGRATE) return null;

    return fragments.map((frag, i) => {
      const fragStart = BARD_DISINTEGRATE + frag.delay;
      const fragDuration = 28;
      const rawProgress = Math.max(0, Math.min(1, (frame - fragStart) / fragDuration));
      if (rawProgress <= 0) return null;

      const eased = 1 - Math.pow(1 - rawProgress, 3);
      const travelX = Math.cos(frag.angle) * frag.distance * eased;
      const travelY = Math.sin(frag.angle) * frag.distance * eased;
      const arcPhase = Math.sin(rawProgress * Math.PI);
      const perpX = -Math.sin(frag.angle) * frag.curveStrength * arcPhase;
      const perpY = Math.cos(frag.angle) * frag.curveStrength * arcPhase;
      const gravityY = rawProgress * rawProgress * 20;

      const originX = letterCenters[frag.letterIdx] + frag.offsetX;
      const originY = frag.offsetY;
      const x = originX + travelX + perpX;
      const y = originY + travelY + perpY + gravityY;
      const rotation = frag.rotationSpeed * eased * 360;

      const fragOpacity = interpolate(rawProgress, [0, 0.05, 0.4, 0.75, 1], [0, 1, 1, 0.65, 0], C);
      const scale = interpolate(rawProgress, [0, 0.2, 1], [1.1, 1, 0.3], C);

      const palette = ["#6366f1","#7c3aed","#8b5cf6","#a78bfa","#c084fc"];
      const color = palette[Math.floor(seededRandom(i * 777) * palette.length)];

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
            boxShadow: `0 0 ${Math.max(frag.width, frag.height) * 3.5}px ${color}`,
            pointerEvents: "none",
          }}
        />
      );
    });
  }, [frame, fragments]);

  // ── Page turn geometry (frame-driven for clipPath) ──
  // Reference frame_008: page lifts from top-right corner. The fold line
  // sweeps diagonally from the top-right corner toward bottom-left.
  // At the midpoint (~frame 108), about 25% of the frame is dark (top-right triangle).
  // The white page surface tilts in 3D as it peels.
  const TURN_START = 100;
  const TURN_END = 122;
  const turnRaw = Math.max(0, Math.min(1, (frame - TURN_START) / (TURN_END - TURN_START)));
  const turnProgress = gsap.parseEase("power3.inOut")(turnRaw);

  // Corner peel: fold line is a diagonal that starts at the top-right corner
  // and sweeps toward bottom-left. Parameterized as two intercept points:
  //   - Where the fold line crosses the top edge (y=0): topX%
  //   - Where the fold line crosses the right edge (x=100): rightY%
  //
  // At progress 0: both intercepts at the corner (100%, 0%) — no dark visible
  // At progress 0.4 (ref frame_008 moment): topX ~ 55%, rightY ~ 45%
  // At progress 1: fold has swept fully past (topX=-5%, rightY=105%)
  //
  // Previous values (140 / 130) overshot wildly, creating dark leaks on
  // both sides. Now limited to 105% travel — just past the edge.
  const topX = 100 - turnProgress * 105;     // fold's X on top edge
  const rightY = turnProgress * 105;          // fold's Y on right edge

  // Clamp for polygon construction
  const cTopX = Math.max(0, Math.min(100, topX));
  const cRightY = Math.max(0, Math.min(100, rightY));

  // 3D tilt of the white page surface — subtle, grows with progress.
  // Reduced from 10/6 to prevent edges peeking through and creating dark leaks.
  const pageRotateZ = turnProgress * 5;
  const pageRotateX = turnProgress * 3;
  const pageOpacity = turnProgress > 0.88 ? Math.max(0, (1 - turnProgress) / 0.12) : 1;
  const foldAngle = turnProgress * 40;

  // Warm accent drift
  const accentRight = -100 + Math.sin(frame * 0.015) * 40;
  const accentBottom = -80 + Math.cos(frame * 0.012) * 30;
  const accentOpacity = frame >= TURN_START - 10
    ? Math.max(0, 1 - (frame - (TURN_START - 10)) / 10)
    : 1;

  return (
    <AbsoluteFill>
      <div ref={containerRef} style={{ width: "100%", height: "100%", position: "relative" }}>
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
              right: accentRight,
              bottom: accentBottom,
              width: 500,
              height: 400,
              borderRadius: "50%",
              background: "radial-gradient(ellipse, rgba(240,220,230,0.25) 0%, transparent 70%)",
              filter: "blur(60px)",
              opacity: accentOpacity,
              pointerEvents: "none",
            }}
          />
        )}

        {/* Dark background — hidden, revealed by page peel */}
        <AbsoluteFill
          className="dark-bg"
          style={{ backgroundColor: BG_DARK, opacity: 0 }}
        />

        {/* ════ PHASE A: "And now it's time for" ════ */}
        <div
          className="phase-a-row"
          style={{
            position: "absolute",
            left: 0, right: 0, top: "45%",
            transform: "translateY(-50%)",
            display: "flex",
            justifyContent: "center",
            alignItems: "baseline",
          }}
        >
          {["And", "now", "it\u2019s", "time", "for"].map((word, i) => {
            // "And" starts gray and transitions to dark as "now" appears (frame 10–16)
            const wordColor = i === 0
              ? (frame < 10 ? TEXT_GRAY : frame < 16
                ? `rgb(${Math.round(interpolate(frame, [10, 16], [168, 29], C))}, ${Math.round(interpolate(frame, [10, 16], [168, 29], C))}, ${Math.round(interpolate(frame, [10, 16], [176, 31], C))})`
                : TEXT_DARK)
              : TEXT_DARK;
            return (
              <span
                key={word}
                className="word-reveal"
                style={{
                  display: "inline-block",
                  fontSize: 42,
                  fontWeight: 400,
                  fontFamily,
                  color: wordColor,
                  marginRight: 11,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.2,
                  opacity: 0,
                }}
              >
                {word}
              </span>
            );
          })}
        </div>

        {/* ════ PHASE B-C: "the next chapter" ════ */}
        <div
          className="phase-b-row"
          style={{
            position: "absolute",
            left: 0, right: 0, top: "45%",
            transform: "translateY(-50%)",
            display: "flex",
            justifyContent: "center",
            alignItems: "baseline",
            opacity: 0,
          }}
        >
          <TypingText frame={frame} />
        </div>

        {/* ════ PAGE TURN ════ */}
        {frame >= TURN_START - 2 && frame <= TURN_END + 6 && (
          <>
            {/* White page — clips to the un-peeled region (below/left of fold line) */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                perspective: 1400,
                perspectiveOrigin: "25% 75%",
                zIndex: 1,
              }}
            >
              <AbsoluteFill
                style={{
                  backgroundColor: "#F5F5F8",
                  opacity: pageOpacity,
                  clipPath: turnProgress < 0.01
                    ? "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)"
                    : cRightY >= 100
                      // Fold line has passed below the right edge — clip is a triangle
                      ? `polygon(0% 0%, ${cTopX}% 0%, 0% ${Math.min(100, (100 * (100 - cTopX)) / (100 - cTopX + 0.01))}%)`
                      : cTopX <= 0
                        // Fold line has passed left of top edge — shrinking bottom-left triangle
                        ? `polygon(0% 0%, 0% ${100 - cRightY}%, 0% 100%)`
                        // Normal: quadrilateral — fold intersects top edge and right edge
                        : `polygon(0% 0%, ${cTopX}% 0%, 100% ${cRightY}%, 100% 100%, 0% 100%)`,
                  transform: `rotateZ(${pageRotateZ}deg) rotateX(${pageRotateX}deg)`,
                  transformOrigin: "left center",
                }}
              >
                {/* Text ON the turning page */}
                <div
                  style={{
                    position: "absolute",
                    left: 0, right: 0, top: "45%",
                    transform: "translateY(-50%)",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "baseline",
                    opacity: turnProgress < 0.5 ? 1 : Math.max(0, 1 - (turnProgress - 0.5) / 0.3),
                  }}
                >
                  <span
                    style={{
                      fontSize: 42,
                      fontWeight: 400,
                      fontFamily,
                      color: TEXT_DARK,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    the next chapter
                  </span>
                </div>
              </AbsoluteFill>
            </div>

            {/* Fold shadow — along the diagonal fold line */}
            {turnProgress > 0.06 && turnProgress < 0.92 && (() => {
              const sw = 5;
              const shadowOpacity = interpolate(turnProgress, [0.06, 0.2, 0.6, 0.92], [0, 0.36, 0.2, 0], C);
              // Shadow band runs parallel to fold line: from (topX, 0) to (100, rightY)
              const foldDeg = Math.atan2(cRightY, 100 - cTopX) * (180 / Math.PI);

              return (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    clipPath: `polygon(
                      ${cTopX - sw}% 0%, ${cTopX + sw}% 0%,
                      ${100 + sw}% ${cRightY}%, ${100 - sw}% ${cRightY}%
                    )`,
                    background: `linear-gradient(
                      ${foldDeg + 90}deg,
                      transparent 10%,
                      rgba(0,0,0,${shadowOpacity}) 45%,
                      rgba(0,0,0,${shadowOpacity * 0.3}) 55%,
                      transparent 90%
                    )`,
                    pointerEvents: "none",
                    zIndex: 4,
                  }}
                />
              );
            })()}

            {/* Peeled flap — paper underside along fold line */}
            {turnProgress > 0.06 && turnProgress < 0.85 && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
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
                    clipPath: `polygon(
                      ${cTopX}% 0%, ${Math.min(cTopX + 12, 100)}% 0%,
                      100% ${cRightY}%, 100% ${Math.min(cRightY + 12, 100)}%
                    )`,
                    opacity: interpolate(turnProgress, [0.06, 0.15, 0.5, 0.85], [0, 0.3, 0.18, 0], C),
                    background: `linear-gradient(
                      135deg,
                      rgba(220,218,235,0.45) 0%,
                      rgba(240,238,250,0.25) 60%,
                      rgba(200,198,220,0.1) 100%
                    )`,
                  }}
                />
              </div>
            )}
          </>
        )}

        {/* ════ DARK PHASE ════ */}


        {/* Dark phase text — "Today" gradient → "Today, Bard is becoming" */}
        <div
          className="dark-phase-text"
          style={{
            position: "absolute",
            left: 0, right: 0, top: "45%",
            transform: "translateY(-50%)",
            display: "flex",
            justifyContent: "center",
            alignItems: "baseline",
            opacity: 0,
          }}
        >
          {/* "Today" gradient version */}
          <span
            className="today-gradient"
            style={{
              position: "relative",
              display: "inline-block",
              marginRight: 11,
              opacity: 0,
            }}
          >
            <span
              className="today-glow"
              style={{
                position: "absolute",
                left: 0, top: 0,
                fontSize: 58,
                fontWeight: 400,
                fontFamily,
                color: GRADIENT_PURPLE,
                opacity: 0,
                letterSpacing: "-0.02em",
                lineHeight: 1.2,
                filter: "blur(28px)",
                pointerEvents: "none",
              }}
            >
              Today
            </span>
            <span
              style={{
                fontSize: 58,
                fontWeight: 400,
                fontFamily,
                background: `linear-gradient(135deg, ${GRADIENT_PURPLE}, ${GRADIENT_BLUE})`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                letterSpacing: "-0.02em",
                lineHeight: 1.2,
              }}
            >
              Today
            </span>
          </span>

          {/* "Today, Bard is becoming" — white version, crossfades over gradient */}
          <div
            className="today-white"
            style={{
              position: "absolute",
              left: 0, right: 0, top: 0, bottom: 0,
              display: "flex",
              justifyContent: "center",
              alignItems: "baseline",
              opacity: 0,
            }}
          >
            <span
              style={{
                fontSize: 44,
                fontWeight: 400,
                fontFamily,
                color: "#ffffff",
                marginRight: 11,
                letterSpacing: "-0.02em",
                lineHeight: 1.2,
              }}
            >
              Today,
            </span>

            <span
              className="bard-text"
              style={{
                position: "relative",
                display: "inline-block",
                marginRight: 11,
                opacity: 0,
              }}
            >
              <span
                className="bard-intact"
                style={{
                  fontSize: 44,
                  fontWeight: 500,
                  fontFamily,
                  color: PINK,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.2,
                }}
              >
                Bard
              </span>
              <span className="bard-fragments" style={{ opacity: 0 }}>
                {fragmentElements}
              </span>
            </span>

            <span
              className="word-is"
              style={{
                fontSize: 44,
                fontWeight: 400,
                fontFamily,
                color: "#ffffff",
                marginRight: 11,
                letterSpacing: "-0.02em",
                lineHeight: 1.2,
                opacity: 0,
              }}
            >
              is
            </span>
            <span
              className="word-becoming"
              style={{
                fontSize: 44,
                fontWeight: 400,
                fontFamily,
                color: "#ffffff",
                letterSpacing: "-0.02em",
                lineHeight: 1.2,
                opacity: 0,
              }}
            >
              becoming
            </span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const scene02Meta = {
  id: "OFScene02",
  component: Scene02,
  width: 1280,
  height: 720,
  fps: 30,
  durationInFrames: 174,
};
