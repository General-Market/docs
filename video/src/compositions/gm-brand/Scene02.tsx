import React, { useEffect, useRef, useMemo } from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { useGsapTimeline, gsap } from "../../lib/useGsapTimeline";
import { GM } from "./theme";

const fontFamily = GM.fontSans;

/**
 * Scene 02 — "the next era" kinetic text + GM disintegration
 *
 * GSAP rewrite: single paused timeline seeked per-frame via useGsapTimeline.
 * GM fragment physics remain frame-driven (independent curved trajectories
 * with gravity — GSAP can't express that without nested timelines).
 *
 * Flow (174 frames @ 30fps ≈ 5.8s):
 *   Phase A (0–50):   "And now it's time for" builds word by word
 *   Phase B (55–72):  "the next era" types in green char-by-char
 *   Phase C (72–100): "the next era" holds, settles to dark
 *   Phase D (100–126): page-turn corner peel from top-right
 *   Phase E (121–137): "Today" with luminous green gradient
 *   Phase F (135–148): "Today, GM" — Today white, GM green
 *   Phase G (90–118): scattered particles converge → GM logo assembly
 *   Phase H (148–174): logo holds with glow/shimmer → dissolve out
 */

const BG_LIGHT = GM.greenLight;
const BG_DARK = GM.bgDarkGreen;
const TEXT_DARK = GM.textPrimary;
const TEXT_GRAY = GM.textSecondary;
const BLUE_TINT = GM.green;
const PINK = GM.green;
const GRADIENT_PURPLE = GM.green;
const GRADIENT_BLUE = GM.greenStatus;

const C = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

// ── Seeded pseudo-random for deterministic fragments ──
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

interface LogoParticle {
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  /** Bezier control point offset from midpoint — creates curved paths */
  ctrlOffsetX: number;
  ctrlOffsetY: number;
  size: number;
  color: string;
  /** Staggered delay in frames for organic convergence */
  delay: number;
  /** Drift velocity for scatter phase */
  driftVX: number;
  driftVY: number;
}

/**
 * GM logo target positions — white horizontal bars inside a black square.
 * The logo is centered at (640, 360). Square is 200x200 → spans (540..740, 260..460).
 *
 * Bars represent the stylized "GM" mark:
 *   Bar 1: x=556-588, y=348-354  (left portion)
 *   Bar 2: x=592-624, y=348-354
 *   Bar 3: x=628-660, y=348-354
 *   Bar 4: x=564-596, y=370-376  (lower row, left)
 *   Bar 5: x=600-632, y=370-376
 *   Bar 6: x=644-676, y=370-376
 *   Bar 7: x=680-724, y=370-376  (lower row, right)
 */
function sampleLogoBars(): { x: number; y: number }[] {
  const bars: { x1: number; x2: number; y1: number; y2: number }[] = [
    { x1: 556, x2: 588, y1: 342, y2: 354 },
    { x1: 596, x2: 628, y1: 342, y2: 354 },
    { x1: 636, x2: 668, y1: 342, y2: 354 },
    { x1: 676, x2: 708, y1: 342, y2: 354 },
    { x1: 556, x2: 588, y1: 362, y2: 374 },
    { x1: 596, x2: 628, y1: 362, y2: 374 },
    { x1: 636, x2: 668, y1: 362, y2: 374 },
    { x1: 676, x2: 724, y1: 362, y2: 374 },
  ];

  const points: { x: number; y: number }[] = [];
  let seed = 42;
  bars.forEach((bar) => {
    const count = Math.round(((bar.x2 - bar.x1) * (bar.y2 - bar.y1)) / 12);
    for (let i = 0; i < count; i++) {
      seed++;
      const rx = seededRandom(seed * 3 + 1);
      const ry = seededRandom(seed * 3 + 2);
      points.push({
        x: bar.x1 + rx * (bar.x2 - bar.x1),
        y: bar.y1 + ry * (bar.y2 - bar.y1),
      });
    }
  });
  return points;
}

const PARTICLE_COLORS = [GM.green, GM.greenStatus, GM.greenDark, GM.greenLight];
const SIZE_TIERS = [2, 3.2, 4.8]; // small, medium, large

function generateLogoParticles(): LogoParticle[] {
  const targets = sampleLogoBars();
  const particles: LogoParticle[] = [];

  targets.forEach((target, i) => {
    const seed = i * 7 + 31;
    const r = (n: number) => seededRandom(seed + n * 137);

    const startX = r(0) * 1280;
    const startY = r(1) * 720;

    // Bezier control offset — larger offset = more curvature
    const dist = Math.sqrt((target.x - startX) ** 2 + (target.y - startY) ** 2);
    const ctrlOffsetX = (r(2) - 0.5) * dist * 0.6;
    const ctrlOffsetY = (r(3) - 0.5) * dist * 0.6;

    const tierIdx = r(4) < 0.5 ? 0 : r(4) < 0.82 ? 1 : 2;
    const size = SIZE_TIERS[tierIdx];
    const color = PARTICLE_COLORS[Math.floor(r(5) * PARTICLE_COLORS.length)];
    const delay = r(6) * 8; // 0–8 frame stagger (compressed)

    particles.push({
      startX, startY,
      targetX: target.x,
      targetY: target.y,
      ctrlOffsetX,
      ctrlOffsetY,
      size,
      color,
      delay,
      driftVX: (r(7) - 0.5) * 0.4,
      driftVY: (r(8) - 0.5) * 0.4,
    });
  });

  return particles;
}

/** Quadratic bezier at parameter t */
function bezierPoint(
  p0: number, p1: number, p2: number, t: number,
): number {
  const mt = 1 - t;
  return mt * mt * p0 + 2 * mt * t * p1 + t * t * p2;
}

/** power2 inOut easing */
function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

const FPS = 30;
const s = (f: number) => f / FPS;

const CHAPTER_TEXT = "the next era";
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
  const particles = useMemo(() => generateLogoParticles(), []);
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

    // Phase B: "the next era" row fade in
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

    // "GM" green text
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

    // Phase G: GM intact text vanishes as particles begin assembly
    const bardIntact = el.querySelector<HTMLElement>(".bard-intact");
    if (bardIntact) {
      t.to(bardIntact, { opacity: 0, duration: s(3) }, s(148));
    }

    // "is" and "becoming" also fade for the logo assembly takeover
    if (isWord) {
      t.to(isWord, { opacity: 0, duration: s(4) }, s(148));
    }
    if (becomingWord) {
      t.to(becomingWord, { opacity: 0, duration: s(4) }, s(148));
    }
    const todayWhiteEl = el.querySelector<HTMLElement>(".today-white");
    if (todayWhiteEl) {
      t.to(todayWhiteEl, { opacity: 0, duration: s(5) }, s(148));
    }

    // "General Market" text fades in under the assembled logo
    const gmLabel = el.querySelector<HTMLElement>(".gm-label");
    if (gmLabel) {
      t.fromTo(gmLabel, { opacity: 0 }, { opacity: 1, duration: s(8) }, s(150));
    }

    // Phase H: dissolve out — logo, particles, and label
    if (darkPhase) {
      t.to(darkPhase, { opacity: 0, duration: s(8) }, s(166));
    }
    const logoOverlay = el.querySelector<HTMLElement>(".logo-overlay");
    if (logoOverlay) {
      t.to(logoOverlay, { opacity: 0, duration: s(8) }, s(166));
    }
    if (gmLabel) {
      t.to(gmLabel, { opacity: 0, duration: s(6) }, s(166));
    }

    // Seek immediately after build — Remotion stills only get one render cycle
    t.seek(frame / fps);
  }, []);

  // ── Particle assembly phases (frame-driven, deterministic) ──
  //
  // Phase 1 (90-100): scattered particles drift (10 frames)
  // Phase 2 (100-118): converge along bezier curves to logo positions (18 frames)
  // Phase 3 (118-166): hold as logo, shimmer, glow pulses
  // Phase 4 (166-174): dissolve — drift apart, fade to 0
  //
  const SCATTER_START = 90;
  const CONVERGE_START = 100;
  const CONVERGE_END = 118;
  const HOLD_END = 166;
  const DISSOLVE_END = 174;

  const particleElements = useMemo(() => {
    if (frame < SCATTER_START) return null;

    return particles.map((p, i) => {
      // Drift offset during scatter phase (noise-like, deterministic)
      const driftX = p.driftVX * (frame - SCATTER_START);
      const driftY = p.driftVY * (frame - SCATTER_START);

      // Convergence progress per particle (staggered by delay)
      const convergeRaw = Math.max(
        0,
        Math.min(
          1,
          (frame - CONVERGE_START - p.delay) /
            (CONVERGE_END - CONVERGE_START - p.delay),
        ),
      );
      const convergeT = easeInOut(convergeRaw);

      // Bezier control point (midpoint + offset)
      const midX = (p.startX + p.targetX) / 2 + p.ctrlOffsetX;
      const midY = (p.startY + p.targetY) / 2 + p.ctrlOffsetY;

      // Current position — bezier from scatter to target
      let x: number;
      let y: number;

      if (convergeT <= 0) {
        // Still scattered — apply drift
        x = p.startX + driftX;
        y = p.startY + driftY;
      } else if (convergeT >= 1) {
        // Arrived at target
        x = p.targetX;
        y = p.targetY;
      } else {
        // Bezier interpolation along curved path
        const sx = p.startX + driftX * (1 - convergeT);
        const sy = p.startY + driftY * (1 - convergeT);
        x = bezierPoint(sx, midX, p.targetX, convergeT);
        y = bezierPoint(sy, midY, p.targetY, convergeT);
      }

      // Phase 3: subtle shimmer jitter when holding
      if (frame >= CONVERGE_END && frame < HOLD_END) {
        const jitterSeed = i * 13 + frame * 7;
        x += (seededRandom(jitterSeed) - 0.5) * 2;
        y += (seededRandom(jitterSeed + 1) - 0.5) * 2;
      }

      // Phase 4: drift apart during dissolve
      let dissolveOffset = 0;
      if (frame >= HOLD_END) {
        const dissolveProg = (frame - HOLD_END) / (DISSOLVE_END - HOLD_END);
        dissolveOffset = dissolveProg * 40;
        x += p.driftVX * dissolveOffset * 80;
        y += p.driftVY * dissolveOffset * 80;
      }

      // Opacity: scatter phase → convergence brightening → hold → dissolve
      let opacity: number;
      if (frame < CONVERGE_START) {
        // Scatter: varied opacity 0.3–0.8
        opacity = interpolate(
          frame,
          [SCATTER_START, SCATTER_START + 5],
          [0, 0.3 + seededRandom(i * 99) * 0.5],
          C,
        );
      } else if (frame < CONVERGE_END) {
        // Converging: brighten toward 1 as they arrive
        opacity = interpolate(convergeT, [0, 0.7, 1], [0.4, 0.7, 1], C);
      } else if (frame < HOLD_END) {
        // Holding: full brightness
        opacity = 1;
      } else {
        // Dissolve
        opacity = interpolate(
          frame,
          [HOLD_END, DISSOLVE_END],
          [1, 0],
          C,
        );
      }

      // Color: transitions to white as particles arrive
      const color =
        convergeT >= 0.85 ? GM.textInverse : convergeT >= 0.5
          ? GM.greenLight
          : p.color;

      return (
        <div
          key={i}
          style={{
            position: "absolute",
            left: x,
            top: y,
            width: p.size,
            height: p.size,
            borderRadius: "50%",
            backgroundColor: color,
            opacity,
            boxShadow:
              convergeT >= 0.85
                ? `0 0 ${p.size * 2}px rgba(255,255,255,0.5)`
                : `0 0 ${p.size * 2}px ${p.color}`,
            pointerEvents: "none" as const,
            transform: "translate(-50%, -50%)",
          }}
        />
      );
    });
  }, [frame, particles]);

  // Black square background for the logo — fades in during convergence
  const logoSquareOpacity = interpolate(
    frame,
    [CONVERGE_START + 5, CONVERGE_END],
    [0, 1],
    C,
  );
  const logoSquareFinalOpacity =
    frame >= HOLD_END
      ? interpolate(frame, [HOLD_END, DISSOLVE_END], [1, 0], C)
      : logoSquareOpacity;

  // Green glow behind logo — pulses during hold phase
  const glowOpacity =
    frame >= CONVERGE_END && frame < HOLD_END
      ? 0.2 + 0.2 * Math.sin((frame - CONVERGE_END) * 0.35)
      : frame >= HOLD_END
        ? interpolate(frame, [HOLD_END, DISSOLVE_END], [0.3, 0], C)
        : interpolate(frame, [CONVERGE_START + 10, CONVERGE_END], [0, 0.2], C);

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
            background: `radial-gradient(ellipse at 50% 50%, #F0FDF4 0%, ${BG_LIGHT} 70%, #D1FAE5 100%)`,
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
              background: "radial-gradient(ellipse, rgba(0,163,108,0.15) 0%, transparent 70%)",
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

        {/* ════ PHASE B-C: "the next era" ════ */}
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
                  backgroundColor: GM.bgSurface,
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
                    the next era
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
                      rgba(209,250,229,0.45) 0%,
                      rgba(236,253,245,0.25) 60%,
                      rgba(187,247,208,0.1) 100%
                    )`,
                  }}
                />
              </div>
            )}
          </>
        )}

        {/* ════ DARK PHASE ════ */}


        {/* Dark phase text — "Today" gradient → "Today, GM is becoming" */}
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

          {/* "Today, GM is becoming" — white version, crossfades over gradient */}
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
                GM
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

        {/* ════ PARTICLE ASSEMBLY + LOGO ════ */}
        {frame >= SCATTER_START && (
          <div
            className="logo-overlay"
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
            }}
          >
            {/* Green glow behind logo */}
            <div
              style={{
                position: "absolute",
                left: 640 - 140,
                top: 360 - 140,
                width: 280,
                height: 280,
                borderRadius: "50%",
                background:
                  "radial-gradient(circle, rgba(0,163,108,0.6) 0%, rgba(0,163,108,0.15) 50%, transparent 80%)",
                opacity: glowOpacity,
                pointerEvents: "none",
              }}
            />

            {/* Black square — logo background */}
            <div
              style={{
                position: "absolute",
                left: 640 - 100,
                top: 360 - 100,
                width: 200,
                height: 200,
                backgroundColor: "#000000",
                borderRadius: 6,
                opacity: logoSquareFinalOpacity,
              }}
            />

            {/* Particles */}
            {particleElements}

            {/* "General Market" label */}
            <div
              className="gm-label"
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 360 + 120,
                textAlign: "center",
                opacity: 0,
              }}
            >
              <span
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                  fontFamily,
                  color: GM.textInverse,
                  letterSpacing: "-0.03em",
                }}
              >
                General Market
              </span>
            </div>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

export const scene02Meta = {
  id: "GMScene02",
  component: Scene02,
  width: 1280,
  height: 720,
  fps: 30,
  durationInFrames: 174,
};
