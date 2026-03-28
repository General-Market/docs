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
    const count = letter === "B" ? 22 : letter === "d" ? 20 : letter === "a" ? 18 : 16;
    for (let fragIdx = 0; fragIdx < count; fragIdx++) {
      const seed = letterIdx * 1000 + fragIdx;
      const r = (n: number) => seededRandom(seed + n * 137);
      const letterWidth = letter === "B" ? 30 : letter === "a" ? 26 : letter === "r" ? 18 : 26;
      const letterHeight = 44;
      const baseAngle = -Math.PI * 0.55 + (letterIdx - 1.5) * 0.15;
      const angleSpread = r(0) * Math.PI * 0.5 - Math.PI * 0.25;

      fragments.push({
        letter, letterIdx, fragIdx,
        offsetX: (r(1) - 0.5) * letterWidth,
        offsetY: (r(2) - 0.5) * letterHeight,
        angle: baseAngle + angleSpread,
        distance: 120 + r(3) * 350,
        curveStrength: (r(4) - 0.5) * 150,
        rotationSpeed: (r(5) - 0.5) * 12,
        width: 1.5 + r(6) * 8,
        height: 1.5 + r(7) * 10,
        delay: letterIdx * 1.2 + r(8) * 4,
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

    // Typing: reveal chars via clipPath on .chapter-text
    const chapterText = el.querySelector<HTMLElement>(".chapter-text");
    if (chapterText) {
      const totalChars = 16; // "the next chapter"
      for (let c = 0; c <= totalChars; c++) {
        t.set(chapterText, {
          clipPath: `inset(0 ${((totalChars - c) / totalChars) * 100}% 0 0)`,
        }, s(62 + c));
      }
      // Color settle: blue → dark
      t.to(chapterText, { color: TEXT_DARK, duration: s(8), ease: "none" }, s(72));
    }

    // Cursor
    const cursor = el.querySelector<HTMLElement>(".chapter-cursor");
    if (cursor) {
      t.set(cursor, { opacity: 0.7 }, s(62));
      t.to(cursor, { opacity: 0, duration: s(5) }, s(78));
    }

    // Phase B-C exit (chapter fades for page turn)
    if (phaseB) {
      t.to(phaseB, { opacity: 0, duration: s(8), ease: "none" }, s(102));
    }

    // Phase D: dark bg appears
    const darkBg = el.querySelector<HTMLElement>(".dark-bg");
    if (darkBg) {
      t.set(darkBg, { opacity: 1 }, s(100));
    }

    // Phase E: dark phase text container fades in
    const darkPhase = el.querySelector<HTMLElement>(".dark-phase-text");
    if (darkPhase) {
      t.fromTo(darkPhase, { opacity: 0 }, { opacity: 1, duration: s(10) }, s(121));
    }

    // "Today" gradient
    const todayGrad = el.querySelector<HTMLElement>(".today-gradient");
    const todayGlow = el.querySelector<HTMLElement>(".today-glow");
    if (todayGrad) {
      t.fromTo(todayGrad, { opacity: 0, x: 14 }, { opacity: 1, x: 0, duration: s(8), ease: "power3.out" }, s(121));
      t.to(todayGrad, { opacity: 0, duration: s(3) }, s(135));
    }
    if (todayGlow) {
      t.fromTo(todayGlow, { opacity: 0 }, { opacity: 0.5, duration: s(8) }, s(121));
      t.to(todayGlow, { opacity: 0, duration: s(5) }, s(135));
    }

    // "Today," white version crossfade
    const todayWhite = el.querySelector<HTMLElement>(".today-white");
    if (todayWhite) {
      t.set(todayWhite, { opacity: 0 });
      t.to(todayWhite, { opacity: 1, duration: s(3) }, s(135));
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

    // Phase H: dissolve out
    if (darkPhase) {
      t.to(darkPhase, { opacity: 0, duration: s(12) }, s(162));
    }

    // Background glow
    const bgGlow = el.querySelector<HTMLElement>(".bg-glow");
    if (bgGlow) {
      t.fromTo(bgGlow, { opacity: 0 }, { opacity: 1, duration: s(12) }, s(121));
      t.to(bgGlow, { opacity: 0, duration: s(12) }, s(162));
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
      const fragDuration = 22;
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

      const fragOpacity = interpolate(rawProgress, [0, 0.05, 0.5, 0.85, 1], [0, 1, 0.9, 0.5, 0], C);
      const scale = interpolate(rawProgress, [0, 0.2, 1], [1.1, 1, 0.3], C);

      const hue = frag.hueShift < 20 ? 340 + frag.hueShift : 260 + frag.hueShift;
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
    });
  }, [frame, fragments]);

  // ── Page turn geometry (frame-driven for clipPath) ──
  const TURN_START = 102;
  const TURN_END = 126;
  const turnRaw = Math.max(0, Math.min(1, (frame - TURN_START) / (TURN_END - TURN_START)));
  // Eased progress
  const turnProgress = gsap.parseEase("power2.inOut")(turnRaw);

  const foldTX = 100 - 150 * turnProgress;
  const foldRY = 150 * turnProgress;
  const tx = Math.max(-5, Math.min(105, foldTX));
  const ry = Math.max(-5, Math.min(105, foldRY));
  const dxFold = 100 - tx;
  const dyFold = ry;
  const foldLineAngle = Math.atan2(dyFold, dxFold) * (180 / Math.PI);
  const foldLen = Math.sqrt(dxFold * dxFold + dyFold * dyFold) || 1;
  const shadowW = 4;
  const nxShadow = (-dyFold / foldLen) * shadowW;
  const nyShadow = (dxFold / foldLen) * shadowW;

  const pageOpacity = turnProgress > 0.85 ? Math.max(0, (1 - turnProgress) / 0.15) * 0.9 : 1;
  const pageTiltX = Math.min(turnProgress / 0.6, 1) * 8;
  const pageTiltY = Math.min(turnProgress / 0.6, 1) * -6;
  const foldAngle = turnProgress * 80;

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
            left: 0, right: 0, top: "50%",
            transform: "translateY(-50%)",
            display: "flex",
            justifyContent: "center",
            alignItems: "baseline",
          }}
        >
          {["And", "now", "it\u2019s", "time", "for"].map((word, i) => (
            <span
              key={word}
              className="word-reveal"
              style={{
                display: "inline-block",
                fontSize: 42,
                fontWeight: i === 0 ? 300 : i === 1 ? 400 : 300,
                fontFamily,
                color: i === 0 ? TEXT_GRAY : TEXT_DARK,
                marginRight: 11,
                letterSpacing: "-0.02em",
                lineHeight: 1.2,
                opacity: 0,
              }}
            >
              {word}
            </span>
          ))}
        </div>

        {/* ════ PHASE B-C: "the next chapter" ════ */}
        <div
          className="phase-b-row"
          style={{
            position: "absolute",
            left: 0, right: 0, top: "50%",
            transform: "translateY(-50%)",
            display: "flex",
            justifyContent: "center",
            alignItems: "baseline",
            opacity: 0,
          }}
        >
          <span style={{ position: "relative", display: "inline-block" }}>
            <span
              className="chapter-text"
              style={{
                fontSize: 42,
                fontWeight: 300,
                fontFamily,
                color: BLUE_TINT,
                letterSpacing: "-0.02em",
                lineHeight: 1.2,
                clipPath: "inset(0 100% 0 0)",
              }}
            >
              the next chapter
            </span>
            <span
              className="chapter-cursor"
              style={{
                display: "inline-block",
                width: 2,
                height: 42 * 0.65,
                backgroundColor: BLUE_TINT,
                opacity: 0,
                marginLeft: 1,
                verticalAlign: "baseline",
                transform: "translateY(2px)",
              }}
            />
          </span>
        </div>

        {/* ════ PAGE TURN ════ */}
        {frame >= TURN_START - 2 && frame <= TURN_END + 4 && (
          <>
            {/* White page clipped to un-peeled region */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                perspective: 1400,
                perspectiveOrigin: "30% 70%",
                zIndex: 1,
              }}
            >
              <AbsoluteFill
                style={{
                  backgroundColor: "#ffffff",
                  opacity: pageOpacity,
                  clipPath:
                    tx <= 100 && ry <= 100
                      ? `polygon(0% 0%, ${tx}% 0%, 100% ${ry}%, 100% 100%, 0% 100%)`
                      : "polygon(0% 0%, 0% 0%, 0% 0%)",
                  transform: `rotateX(${pageTiltX}deg) rotateY(${pageTiltY}deg)`,
                  transformOrigin: "0% 100%",
                }}
              >
                {/* Text ON the turning page */}
                <div
                  style={{
                    position: "absolute",
                    left: 0, right: 0, top: "50%",
                    transform: "translateY(-50%)",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "baseline",
                    opacity: turnProgress < 0.65 ? 1 - turnProgress / 0.65 : 0,
                  }}
                >
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
                </div>
              </AbsoluteFill>
            </div>

            {/* Fold shadow */}
            {turnProgress > 0.04 && (() => {
              const shadowClip = `polygon(
                ${tx - nxShadow}% ${0 - nyShadow}%,
                ${100 - nxShadow}% ${ry - nyShadow}%,
                ${100 + nxShadow}% ${ry + nyShadow}%,
                ${tx + nxShadow}% ${0 + nyShadow}%
              )`;
              const shadowOpacity = interpolate(turnProgress, [0.04, 0.15, 0.6, 1], [0, 0.18, 0.08, 0], C);

              return (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    clipPath: shadowClip,
                    background: `linear-gradient(
                      ${foldLineAngle + 90}deg,
                      transparent 10%,
                      rgba(0,0,0,${shadowOpacity}) 45%,
                      rgba(0,0,0,${shadowOpacity * 0.4}) 55%,
                      transparent 90%
                    )`,
                    pointerEvents: "none",
                    zIndex: 4,
                  }}
                />
              );
            })()}

            {/* Peeled flap — paper underside hint */}
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
                    clipPath: `polygon(${tx}% 0%, 100% 0%, 100% ${ry}%)`,
                    transformOrigin: `${(tx + 100) / 2}% ${ry / 2}%`,
                    transform: `rotate3d(${dyFold}, ${-dxFold}, 0, ${foldAngle * 0.5}deg)`,
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
        )}

        {/* ════ DARK PHASE ════ */}

        {/* Background glow halo */}
        <div
          className="bg-glow"
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: 360,
            height: 120,
            borderRadius: "50%",
            background: `radial-gradient(ellipse, rgba(160,170,230,0.18) 0%, rgba(140,130,210,0.09) 45%, transparent 75%)`,
            filter: "blur(32px)",
            pointerEvents: "none",
            opacity: 0,
          }}
        />

        {/* Dark phase text — "Today" gradient → "Today, Bard is becoming" */}
        <div
          className="dark-phase-text"
          style={{
            position: "absolute",
            left: 0, right: 0, top: "50%",
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
                fontSize: 46,
                fontWeight: 400,
                fontFamily,
                color: GRADIENT_PURPLE,
                opacity: 0,
                letterSpacing: "-0.02em",
                lineHeight: 1.2,
                filter: "blur(14px)",
                pointerEvents: "none",
              }}
            >
              Today
            </span>
            <span
              style={{
                fontSize: 46,
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
                fontWeight: 300,
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
                fontWeight: 300,
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
                fontWeight: 300,
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
