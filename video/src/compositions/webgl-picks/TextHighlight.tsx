// Source: https://tympanus.net/Development/OnScrollTextHighlight/
import React, { useMemo } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";

// ─── Text content (from the original Codrops demo — Gustave Le Bon quotes) ───

interface HighlightedWord {
  text: string;
  effect: number;
}

interface Section {
  before: string;
  highlights: HighlightedWord[];
  after: string;
}

const SECTIONS: Section[] = [
  {
    before: "Organised crowds have always played an",
    highlights: [{ text: "important", effect: 1 }],
    after: "part in the life of peoples, but this part has never been of such moment as at present.",
  },
  {
    before: "The substitution of the",
    highlights: [{ text: "unconscious", effect: 2 }],
    after: "action of crowds for the conscious activity of individuals is one of the principal characteristics of the present age.",
  },
  {
    before: "The key features of an individual in a crowd are the",
    highlights: [{ text: "vanishing", effect: 3 }],
    after: "conscious personality, the rise of the unconscious, and the swift conversion of suggested ideas into actions through suggestion and contagion.",
  },
  {
    before: "He is no longer himself, but has",
    highlights: [{ text: "become an automaton", effect: 4 }],
    after: "who has ceased to be guided by his will.",
  },
  {
    before: "In the midst of the crowd,",
    highlights: [{ text: "individual", effect: 5 }],
    after: "judgment is swamped by the overwhelming force of the group\u2019s influence.",
  },
  {
    before: "Once submerged in a crowd, the individual becomes more susceptible to the",
    highlights: [{ text: "dynamics", effect: 6 }],
    after: "of group think, losing his personal ethical moorings.",
  },
  {
    before: "As part of the crowd, he is swept away by a",
    highlights: [{ text: "collective", effect: 7 }],
    after: "stream, often adopting extreme ideas or measures that he alone might not consider.",
  },
  {
    // Section 8: two highlighted words, both effect 8
    before: "In this",
    highlights: [{ text: "transformed state", effect: 8 }],
    after: ", the crowd member experiences a diminishing of personal fear as anonymity provides a comforting shield.",
  },
  {
    // Section 9: two highlighted words, both effect 9
    before: "Crowd",
    highlights: [{ text: "psychology", effect: 9 }],
    after: "facilitates a bizarre unity, melding disparate individuals into a single entity with a common focus.",
  },
  {
    before: "This unity is often directed by",
    highlights: [{ text: "charismatic", effect: 10 }],
    after: "or influential figures who can steer the crowd\u2019s emotions and actions with alarming ease.",
  },
  {
    // Section 11: Flip-style effect — large word shrinks into inline position
    before:
      "In this sea of sameness, the individual becomes startlingly easy to manipulate. Without the anchor of personal convictions, they drift,",
    highlights: [{ text: "vulnerable", effect: 11 }],
    after: "to whoever steers the crowd\u2019s will. It is here, in the pulse of the crowd, where manipulation is not only easy but often goes unnoticed.",
  },
  {
    // Section 12: highlighted word is "manipulation"
    before:
      "The vulnerability of individuals within crowds extends beyond mere",
    highlights: [{ text: "manipulation", effect: 12 }],
    after: ". Within the collective consciousness, moral responsibility becomes diffuse, diluted among the multitude.",
  },
  {
    before: "Actions that would be deemed unethical or",
    highlights: [{ text: "reprehensible", effect: 13 }],
    after: "on an individual level can be rationalized and justified within the context of the crowd.",
  },
];

// ─── Color palette (from the original CSS custom properties) ───

const COLORS = {
  bg: "#000",
  text: "#b8afaa",
  link: "#968a84",
  highlightStart: "#968a84",
  // per-effect CSS variables
  hx3End: "#d686c1",
  hx4End: "#49af42",
  hx4EndAlt: "#4252af",
  hx5Bg: "#6a5ace",
  hx5Text: "#e1def4",
  hx6Bg: "#dc764c",
  hx6Text: "#fadabd",
  hx7Bg: "#437745",
  hx7Text: "#d2f2d3",
  hx8End: "#c3c58c",
  hx9Start: "rgb(84,77,73)", // 61% opacity in original
  hx9End: "#b8afaa", // --color-text
  hx10Start: "#b8afaa", // --color-text
  hx12Start: "rgb(84,77,73)", // 61% opacity
  hx12End: "#fff",
  hx13Start: "#b8afaa", // --color-text
  glowPink: "#ffdbf5",
};

// ─── Helpers ───

const splitChars = (word: string): string[] => word.split("");

const sectionProgress = (
  globalProgress: number,
  sectionIndex: number,
  totalSections: number
): number => {
  const sliceSize = 1 / totalSections;
  const start = sectionIndex * sliceSize;
  const end = start + sliceSize;
  return Math.max(0, Math.min(1, (globalProgress - start) / (end - start)));
};

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

const lerp = (
  progress: number,
  inputRange: [number, number],
  outputRange: [number, number],
  easing: (t: number) => number = Easing.linear
): number =>
  interpolate(progress, inputRange, outputRange, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  });

// ─── Utility: color interpolation ───

const hexToRgb = (hex: string): [number, number, number] => {
  // Handle rgb(r,g,b) strings
  const rgbMatch = hex.match(/rgb\((\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (rgbMatch) {
    return [
      parseInt(rgbMatch[1]),
      parseInt(rgbMatch[2]),
      parseInt(rgbMatch[3]),
    ];
  }
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
};

const rgbToHex = (r: number, g: number, b: number): string =>
  `#${[r, g, b]
    .map((v) =>
      Math.round(clamp(v, 0, 255))
        .toString(16)
        .padStart(2, "0")
    )
    .join("")}`;

const lerpColor = (from: string, to: string, t: number): string => {
  const [r1, g1, b1] = hexToRgb(from);
  const [r2, g2, b2] = hexToRgb(to);
  return rgbToHex(
    r1 + (r2 - r1) * t,
    g1 + (g2 - g1) * t,
    b1 + (b2 - b1) * t
  );
};

/** Elastic-out easing matching GSAP elastic.out(0.7) */
const elasticOut = (t: number, amplitude: number = 0.7): number => {
  if (t === 0 || t === 1) return t;
  const p = 0.3;
  const s = (p / (2 * Math.PI)) * Math.asin(1 / amplitude);
  return (
    amplitude *
      Math.pow(2, -10 * t) *
      Math.sin(((t - s) * (2 * Math.PI)) / p) +
    1
  );
};

// ─── Effect renderers ───
// Each returns a React node for the highlighted word(s).
// `p` is local animation progress 0..1

/**
 * Effect 1: 3D flip-in per character
 * GSAP: perspective 500, preserve-3d on words
 * fromTo chars: opacity 0→1, z 300→0, rotationX -45→0
 * duration 0.8, ease power2, stagger 0.04
 */
const renderEffect1 = (word: string, p: number) => {
  const chars = splitChars(word);
  const stagger = 0.04;
  const duration = 0.8;
  const totalTime = duration + stagger * (chars.length - 1);

  return (
    <span
      style={{
        display: "inline-block",
        perspective: 500,
        color: COLORS.highlightStart,
      }}
    >
      {chars.map((ch, i) => {
        const charStart = (i * stagger) / totalTime;
        const charEnd = charStart + duration / totalTime;
        const cp = clamp((p - charStart) / (charEnd - charStart), 0, 1);
        const eased = Easing.out(Easing.quad)(cp);

        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity: eased,
              transform: `translateZ(${300 * (1 - eased)}px) rotateX(${-45 * (1 - eased)}deg)`,
              transformStyle: "preserve-3d",
            }}
          >
            {ch}
          </span>
        );
      })}
    </span>
  );
};

/**
 * Effect 2: Blink per character
 * GSAP: per-char timeline, delay position*0.05, opacity→0 repeat:2 yoyo:true, then opacity→1
 * duration 0.6, ease power1
 */
const renderEffect2 = (word: string, p: number) => {
  const chars = splitChars(word);
  // Each char: delay = i * 0.05, then opacity to 0 with repeat:2 yoyo
  // repeat:2 yoyo means: 1→0, 0→1, 1→0, 0→1 (2 extra repeats)
  // Total per-char: delay + 3*duration (3 yoyo cycles) + final tween
  // duration 0.6, then final .to opacity:1 with duration 0.6
  const charDuration = 0.6;
  const totalPerChar = 3 * charDuration + charDuration; // yoyo 3 half-cycles + final
  const maxDelay = (chars.length - 1) * 0.05;
  const totalTime = maxDelay + totalPerChar;

  return (
    <span style={{ display: "inline-block", color: COLORS.highlightStart }}>
      {chars.map((ch, i) => {
        const charDelay = i * 0.05;
        const charLocalTime = clamp(
          (p * totalTime - charDelay) / totalPerChar,
          0,
          1
        );

        // repeat:2 yoyo: goes 1→0 (0-0.25), 0→1 (0.25-0.5), 1→0 (0.5-0.75), then final →1 (0.75-1.0)
        let opacity: number;
        if (charLocalTime < 0.25) {
          opacity = lerp(charLocalTime, [0, 0.25], [1, 0]);
        } else if (charLocalTime < 0.5) {
          opacity = lerp(charLocalTime, [0.25, 0.5], [0, 1]);
        } else if (charLocalTime < 0.75) {
          opacity = lerp(charLocalTime, [0.5, 0.75], [1, 0]);
        } else {
          opacity = lerp(charLocalTime, [0.75, 1], [0, 1]);
        }

        return (
          <span key={i} style={{ display: "inline-block", opacity }}>
            {ch}
          </span>
        );
      })}
    </span>
  );
};

/**
 * Effect 3: Scale down + fade out, then reappear in pink with glow
 * GSAP: timeline, stagger 0.06
 * Phase 1: chars to opacity 0, scale 0.8 (duration 0.5, ease power1)
 * Phase 2: chars to opacity 1, scale 1, color #d686c1,
 *   startAt filter drop-shadow(0 0 0 #ffdbf5), filter drop-shadow(0 0 20px #ffdbf5)
 * Phase 2 starts at duration offset (0.5)
 */
const renderEffect3 = (word: string, p: number) => {
  const chars = splitChars(word);
  const stagger = 0.06;
  const phaseDur = 0.5;
  const totalStagger = stagger * (chars.length - 1);
  // Phase 1: 0 to phaseDur + totalStagger
  // Phase 2: starts at phaseDur, lasts phaseDur + totalStagger
  const totalTime = phaseDur * 2 + totalStagger;

  return (
    <span style={{ display: "inline-block", color: COLORS.highlightStart }}>
      {chars.map((ch, i) => {
        const normalizedTime = p * totalTime;

        // Phase 1: fade out + scale down
        const p1Start = i * stagger;
        const p1End = p1Start + phaseDur;
        // Phase 2: fade in with color + glow
        const p2Start = phaseDur + i * stagger;
        const p2End = p2Start + phaseDur;

        let opacity = 1;
        let scale = 1;
        let color = COLORS.highlightStart;
        let filter = "drop-shadow(0px 0px 0px #ffdbf5)";

        if (normalizedTime >= p1Start && normalizedTime < p1End) {
          const cp = clamp(
            (normalizedTime - p1Start) / (p1End - p1Start),
            0,
            1
          );
          opacity = 1 - cp;
          scale = 1 - 0.2 * cp;
        } else if (
          normalizedTime >= p1End &&
          normalizedTime < p2Start
        ) {
          opacity = 0;
          scale = 0.8;
        } else if (normalizedTime >= p2Start) {
          const cp = clamp(
            (normalizedTime - p2Start) / (p2End - p2Start),
            0,
            1
          );
          opacity = cp;
          scale = 1;
          color = COLORS.hx3End;
          filter = `drop-shadow(0px 0px ${20 * cp}px #ffdbf5)`;
        }

        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity,
              transform: `scale(${scale})`,
              color,
              filter,
              willChange: "transform, opacity, color, filter",
            }}
          >
            {ch}
          </span>
        );
      })}
    </span>
  );
};

/**
 * Effect 4: Scale up to 1.45x in green, then settle to 1x in blue
 * GSAP: Phase 1: duration 0.3, ease power3.in, stagger 0.05, scale→1.45, color→#49af42
 *        Phase 2: duration 0.4, ease sine, stagger 0.05, scale→1, color→#4252af
 *        Phase 2 starts at offset 0.3 (= phase 1 duration)
 */
const renderEffect4 = (word: string, p: number) => {
  const chars = splitChars(word);
  const stagger = 0.05;
  const phase1Dur = 0.3;
  const phase2Dur = 0.4;
  const totalStagger = stagger * (chars.length - 1);
  const totalTime = phase1Dur + phase2Dur + totalStagger;

  return (
    <span style={{ display: "inline-block", color: COLORS.highlightStart }}>
      {chars.map((ch, i) => {
        const normalizedTime = p * totalTime;

        const p1Start = i * stagger;
        const p1End = p1Start + phase1Dur;
        const p2Start = phase1Dur + i * stagger;
        const p2End = p2Start + phase2Dur;

        let scale = 1;
        let color = COLORS.highlightStart;

        if (normalizedTime >= p1Start && normalizedTime < p1End) {
          const cp = clamp(
            (normalizedTime - p1Start) / (p1End - p1Start),
            0,
            1
          );
          // ease power3.in
          const eased = cp * cp * cp;
          scale = 1 + 0.45 * eased;
          color = lerpColor(COLORS.highlightStart, COLORS.hx4End, eased);
        } else if (normalizedTime >= p1End && normalizedTime < p2Start) {
          scale = 1.45;
          color = COLORS.hx4End;
        } else if (normalizedTime >= p2Start) {
          const cp = clamp(
            (normalizedTime - p2Start) / (p2End - p2Start),
            0,
            1
          );
          // ease sine (sine.out in GSAP default context)
          const eased = Math.sin((cp * Math.PI) / 2);
          scale = 1.45 - 0.45 * eased;
          color = lerpColor(COLORS.hx4End, COLORS.hx4EndAlt, eased);
        }

        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              transform: `scale(${scale})`,
              color,
              willChange: "transform, color",
            }}
          >
            {ch}
          </span>
        );
      })}
    </span>
  );
};

/**
 * Effect 5: Scale+fade in chars with purple background box scaling in
 * GSAP: chars fromTo scale 1.3→1, opacity 0→1
 *   duration 0.4, ease power1, stagger: pos => 0.1 + 0.05*pos
 *   Background ::after scale 0→1, duration 0.8, ease expo, starts at 0
 * CSS: hx-5 inline-flex, --color-highlight-start #e1def4, --color-bg-highlight #6a5ace
 */
const renderEffect5 = (word: string, p: number) => {
  const chars = splitChars(word);
  const charDur = 0.4;
  // Stagger: 0.1 + 0.05*pos — each char starts later
  const lastCharStart = 0.1 + 0.05 * (chars.length - 1);
  const totalCharTime = lastCharStart + charDur;
  const bgDur = 0.8;
  const totalTime = Math.max(totalCharTime, bgDur);

  // Background box scale: duration 0.8, ease expo
  const bgProgress = clamp(p * totalTime / bgDur, 0, 1);
  const boxScale = Easing.out(Easing.exp)(bgProgress);

  return (
    <span
      style={{
        display: "inline-flex",
        position: "relative",
        color: COLORS.hx5Text,
      }}
    >
      <span
        style={{
          position: "absolute",
          left: "-2.5%",
          top: "10%",
          bottom: "-7.5%",
          width: "105%",
          background: COLORS.hx5Bg,
          borderRadius: 8,
          transform: `scale3d(${boxScale},${boxScale},${boxScale})`,
          zIndex: -1,
        }}
      />
      {chars.map((ch, i) => {
        const charStart = (0.1 + 0.05 * i) / totalTime;
        const charEnd = charStart + charDur / totalTime;
        const cp = clamp((p - charStart) / (charEnd - charStart), 0, 1);
        // ease power1 (linear power)
        const eased = cp;

        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity: eased,
              transform: `scale(${1.3 - 0.3 * eased})`,
            }}
          >
            {ch}
          </span>
        );
      })}
    </span>
  );
};

/**
 * Effect 6: Chars fade out in reverse, fade in forward, orange bar grows left-to-right
 * GSAP: duration 0.1, ease sine
 *   Phase 1: chars to opacity 0, stagger (pos,_,arr) => 0.06*(arr.length-1-pos) [reverse]
 *   Phase 2: chars to opacity 1, stagger pos => 0.2+0.05*pos
 *   Bar: --after-width 0% → 105%, duration 1, ease power4, starts at '<' (same as phase 2)
 * CSS: hx-6 inline-flex, --color-bg-highlight #dc764c, --color-highlight-start #fadabd
 */
const renderEffect6 = (word: string, p: number) => {
  const chars = splitChars(word);
  const total = chars.length;
  const fadeDur = 0.1;

  // Phase 1 total: last reverse stagger + duration
  const phase1MaxStagger = 0.06 * (total - 1);
  const phase1Total = phase1MaxStagger + fadeDur;
  // Phase 2 total: last forward stagger + duration
  const phase2MaxStagger = 0.2 + 0.05 * (total - 1);
  const phase2Total = phase2MaxStagger + fadeDur;
  // Bar: duration 1
  const barDur = 1;
  const totalTime = phase1Total + Math.max(phase2Total, barDur);

  // Bar width: starts when phase 2 starts (at phase1Total), duration 1, ease power4
  const barStart = phase1Total / totalTime;
  const barEnd = barStart + barDur / totalTime;
  const barP = clamp((p - barStart) / (barEnd - barStart), 0, 1);
  const barWidth = Easing.out(Easing.poly(4))(barP) * 105;

  return (
    <span
      style={{
        display: "inline-flex",
        position: "relative",
        color: COLORS.hx6Text,
      }}
    >
      <span
        style={{
          position: "absolute",
          left: "-2.5%",
          top: "15%",
          bottom: "-10.5%",
          width: `${barWidth}%`,
          background: COLORS.hx6Bg,
          borderRadius: 8,
          zIndex: -1,
        }}
      />
      {chars.map((ch, i) => {
        const normalizedTime = p * totalTime;

        // Phase 1: fade out, reverse stagger
        const revStagger = 0.06 * (total - 1 - i);
        const p1Start = revStagger;
        const p1End = p1Start + fadeDur;
        // Phase 2: fade in, forward stagger
        const fwdStagger = 0.2 + 0.05 * i;
        const p2Start = phase1Total + fwdStagger;
        const p2End = p2Start + fadeDur;

        let opacity = 1;
        if (normalizedTime < phase1Total) {
          if (normalizedTime >= p1Start && normalizedTime < p1End) {
            opacity = 1 - (normalizedTime - p1Start) / fadeDur;
          } else if (normalizedTime >= p1End) {
            opacity = 0;
          }
        } else {
          if (normalizedTime < p2Start) {
            opacity = 0;
          } else if (normalizedTime < p2End) {
            opacity = (normalizedTime - p2Start) / fadeDur;
          } else {
            opacity = 1;
          }
        }

        return (
          <span key={i} style={{ display: "inline-block", opacity }}>
            {ch}
          </span>
        );
      })}
    </span>
  );
};

/**
 * Effect 7: Chars scaleY from 0 to 1 (origin 50% 80%), green background grows in height
 * GSAP: duration 0.2, ease sine
 *   chars fromTo scaleY 0→1, stagger pos => 0.2+0.05*pos
 *   Bar: --after-height 0%→100%, duration 0.7, ease sine.inOut, starts at '<' (same time)
 * CSS: hx-7, --color-bg-highlight #437745, --color-highlight-start #d2f2d3
 */
const renderEffect7 = (word: string, p: number) => {
  const chars = splitChars(word);
  const charDur = 0.2;
  const lastCharStagger = 0.2 + 0.05 * (chars.length - 1);
  const totalCharTime = lastCharStagger + charDur;
  const barDur = 0.7;
  const totalTime = Math.max(totalCharTime, barDur);

  // Bar height: starts at 0, grows over 0.7 with sine.inOut
  const barP = clamp(p * totalTime / barDur, 0, 1);
  const barHeight = Easing.inOut(Easing.sin)(barP) * 100;

  return (
    <span
      style={{
        display: "inline-block",
        position: "relative",
        color: COLORS.hx7Text,
      }}
    >
      <span
        style={{
          position: "absolute",
          left: "-2.5%",
          top: "10%",
          width: "105%",
          height: `${barHeight}%`,
          background: COLORS.hx7Bg,
          borderRadius: 8,
          zIndex: -1,
        }}
      />
      {chars.map((ch, i) => {
        const charStart = (0.2 + 0.05 * i) / totalTime;
        const charEnd = charStart + charDur / totalTime;
        const cp = clamp((p - charStart) / (charEnd - charStart), 0, 1);
        // ease sine (sine.out in gsap default)
        const eased = Math.sin((cp * Math.PI) / 2);

        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              transform: `scaleY(${eased})`,
              transformOrigin: "50% 80%",
            }}
          >
            {ch}
          </span>
        );
      })}
    </span>
  );
};

/**
 * Effect 8: WORD-based rotation with elastic ease + color change
 * GSAP: duration 1.2, ease elastic.out(0.7), transformOrigin '0% 50%'
 *   words fromTo: opacity 0→1, rotationZ -30→0, stagger 0.2
 *   color → --color-highlight-end (#c3c58c)
 */
const renderEffect8 = (word: string, p: number) => {
  const words = word.split(" ");
  const stagger = 0.2;
  const duration = 1.2;
  const totalTime = duration + stagger * (words.length - 1);

  return (
    <span style={{ display: "inline-block", color: COLORS.highlightStart }}>
      {words.map((w, i) => {
        const wordStart = (i * stagger) / totalTime;
        const wordEnd = wordStart + duration / totalTime;
        const cp = clamp((p - wordStart) / (wordEnd - wordStart), 0, 1);

        const eased = elasticOut(cp, 0.7);
        const opacity = clamp(cp * 4, 0, 1); // fast fade in
        const rotation = -30 * (1 - eased);
        const color = lerpColor(COLORS.highlightStart, COLORS.hx8End, cp);

        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity,
              transform: `rotate(${rotation}deg)`,
              transformOrigin: "0% 50%",
              color,
              marginRight: i < words.length - 1 ? "0.3em" : 0,
            }}
          >
            {w}
          </span>
        );
      })}
    </span>
  );
};

/**
 * Effect 9: Chars tumble in with random rotation, clone chars explode upward and fade
 * GSAP: duration 0.2, ease sine
 *   Main chars fromTo: opacity 0→1, yPercent 80→0, rotation random→0, stagger pos => 0.06*pos
 *   Clone chars: to duration 1, ease expo, stagger pos => 0.06*pos
 *     xPercent random(-15,15), yPercent random(-130,-50), rotation -1*original, scale random(1,2), opacity 0
 *   Both start at time 0
 */
const renderEffect9 = (word: string, p: number) => {
  const chars = splitChars(word);

  // Deterministic pseudo-random rotations per character (replacing gsap.utils.random)
  const rotations = useMemo(
    () => chars.map((_, i) => ((i * 137.5 + 23) % 90) - 45),
    [chars.length]
  );
  // Deterministic clone explosion params
  const cloneXs = useMemo(
    () => chars.map((_, i) => ((i * 47 + 11) % 30) - 15),
    [chars.length]
  );
  const cloneYs = useMemo(
    () => chars.map((_, i) => -130 + ((i * 71 + 3) % 80)),
    [chars.length]
  );
  const cloneScales = useMemo(
    () => chars.map((_, i) => 1 + ((i * 31 + 7) % 10) / 10),
    [chars.length]
  );

  const mainDur = 0.2;
  const cloneDur = 1;
  const lastStagger = 0.06 * (chars.length - 1);
  const totalTime = Math.max(lastStagger + mainDur, lastStagger + cloneDur);

  return (
    <span
      style={{
        display: "inline-block",
        position: "relative",
        color: COLORS.highlightStart,
      }}
    >
      {/* Exploding clones (behind) — start at time 0 */}
      {chars.map((ch, i) => {
        const cloneStart = (0.06 * i) / totalTime;
        const cloneEnd = cloneStart + cloneDur / totalTime;
        const cp = clamp((p - cloneStart) / (cloneEnd - cloneStart), 0, 1);
        const eased = Easing.out(Easing.exp)(cp);

        return (
          <span
            key={`clone-${i}`}
            style={{
              display: "inline-block",
              position: "absolute",
              left: `${i * 0.62}em`,
              opacity: 1 - eased,
              transform: `translate(${cloneXs[i] * eased}%, ${cloneYs[i] * eased}%) rotate(${-rotations[i] * eased}deg) scale(${1 + (cloneScales[i] - 1) * eased})`,
              color: COLORS.highlightStart,
              pointerEvents: "none",
            }}
          >
            {ch}
          </span>
        );
      })}
      {/* Main chars tumbling in */}
      {chars.map((ch, i) => {
        const charStart = (0.06 * i) / totalTime;
        const charEnd = charStart + mainDur / totalTime;
        const cp = clamp((p - charStart) / (charEnd - charStart), 0, 1);
        // ease sine
        const eased = Math.sin((cp * Math.PI) / 2);

        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity: eased,
              transform: `translateY(${80 * (1 - eased)}%) rotate(${rotations[i] * (1 - eased)}deg)`,
            }}
          >
            {ch}
          </span>
        );
      })}
    </span>
  );
};

/**
 * Effect 10: Chars randomly brighten with red glow, then settle
 * GSAP: duration 0.2, ease power2.in
 *   Per-char: fromTo filter brightness(100%) drop-shadow(0 0 0 red)
 *     → brightness(300%) drop-shadow(0 0 50px red)
 *     delay gsap.utils.random(0,1), repeat:1, yoyo:true
 */
const renderEffect10 = (word: string, p: number) => {
  const chars = splitChars(word);

  // Deterministic "random" delays per character (0..1)
  const delays = useMemo(
    () => chars.map((_, i) => ((i * 73 + 17) % 100) / 100),
    [chars.length]
  );

  // Per-char: delay + duration*2 (repeat:1 yoyo means one forward + one reverse)
  const duration = 0.2;
  const maxDelay = 1;
  const totalTime = maxDelay + duration * 2; // delay + forward + reverse

  return (
    <span style={{ display: "inline-block", color: COLORS.hx10Start }}>
      {chars.map((ch, i) => {
        const normalizedTime = p * totalTime;
        const charStart = delays[i];
        const charMid = charStart + duration; // peak brightness
        const charEnd = charMid + duration; // back to normal

        let brightness = 100;
        let glowSize = 0;

        if (normalizedTime >= charStart && normalizedTime < charMid) {
          const cp = (normalizedTime - charStart) / duration;
          // ease power2.in
          const eased = cp * cp;
          brightness = 100 + 200 * eased;
          glowSize = 50 * eased;
        } else if (normalizedTime >= charMid && normalizedTime < charEnd) {
          const cp = (normalizedTime - charMid) / duration;
          // yoyo reverses with same ease
          const eased = cp * cp;
          brightness = 300 - 200 * eased;
          glowSize = 50 * (1 - eased);
        }

        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              filter: `brightness(${brightness}%) drop-shadow(0px 0px ${glowSize}px #ff0000)`,
              willChange: "filter",
            }}
          >
            {ch}
          </span>
        );
      })}
    </span>
  );
};

/**
 * Effect 11: Flip-style — large word shrinks and deblurs into inline position
 * Original: uses GSAP Flip plugin with scrub-based ScrollTrigger
 *   Large heading "vulnarable" (hx-flip__inner) Flips into the inline <mark> position
 *   filter blur(6px) → blur(0px), font-size shrinks, position moves
 *   Paragraph: scale 0.9 + blur(3px) → scale 1 + blur(0px), ease sine.inOut
 */
const renderEffect11 = (word: string, p: number) => {
  const eased = Easing.inOut(Easing.sin)(p);

  // Simulate Flip: large word shrinks to inline size
  const fontSize = lerp(eased, [0, 1], [4, 1]);
  const blur = lerp(eased, [0, 1], [6, 0]);
  const yOffset = lerp(eased, [0, 1], [-60, 0]);

  return (
    <span
      style={{
        display: "inline-block",
        color: COLORS.highlightStart,
        transform: `scale(${fontSize}) translateY(${yOffset}%)`,
        filter: `blur(${blur}px)`,
        transformOrigin: "0% 100%",
        willChange: "transform, filter",
      }}
    >
      {word}
    </span>
  );
};

/**
 * Effect 12: 8 word clones slide up and vanish, then word gets bright
 * GSAP: duration 1.2, ease expo
 *   8 clones: fromTo yPercent 150→0, opacity 0→1, stagger 0.15
 *   Then clones to opacity 0 (duration 0.01, stagger 0.15)
 *   Then main word color → #fff
 * CSS: --color-highlight-start: rgb(84 77 73 / 61%), --color-highlight-end: #fff
 *   Clone words positioned absolute
 */
const renderEffect12 = (word: string, p: number) => {
  const cloneCount = 8;
  const duration = 1.2;
  const stagger = 0.15;
  // Phase 1: clones slide in. Total = duration + stagger * (cloneCount - 1)
  const phase1Total = duration + stagger * (cloneCount - 1);
  // Phase 2: clones vanish (0.01 duration, staggered)
  const phase2Start = duration; // starts at animationDefaults.duration
  const phase2Total = 0.01 + stagger * (cloneCount - 1);
  // Phase 3: word color change. Starts at phase2Start + stagger * cloneCount - 1
  const phase3Start = duration + stagger * cloneCount - 1;
  const totalTime = Math.max(phase1Total, phase2Start + phase2Total, phase3Start + duration);

  return (
    <span
      style={{
        display: "inline-block",
        position: "relative",
        color: COLORS.hx12Start,
      }}
    >
      {/* Ghost clones */}
      {Array.from({ length: cloneCount }).map((_, i) => {
        const normalizedTime = p * totalTime;

        // Phase 1: slide in from below
        const cloneStart = i * stagger;
        const cloneEnd = cloneStart + duration;
        const slideP = clamp(
          (normalizedTime - cloneStart) / (cloneEnd - cloneStart),
          0,
          1
        );
        const slideEased = Easing.out(Easing.exp)(slideP);
        const yPct = 150 * (1 - slideEased);

        // Phase 2: vanish
        const vanishStart = phase2Start + i * stagger;
        const vanishEnd = vanishStart + 0.01;
        let opacity = slideP > 0 ? slideEased : 0;
        if (normalizedTime >= vanishStart) {
          const vanishP = clamp(
            (normalizedTime - vanishStart) / (vanishEnd - vanishStart),
            0,
            1
          );
          opacity = 1 - vanishP;
        }

        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              position: "absolute",
              top: 0,
              left: 0,
              opacity,
              transform: `translateY(${yPct}%)`,
              color: COLORS.hx12End,
              pointerEvents: "none",
            }}
          >
            {word}
          </span>
        );
      })}
      {/* Main word brightens at end */}
      <span
        style={{
          display: "inline-block",
          color: lerpColor(
            COLORS.hx12Start,
            COLORS.hx12End,
            clamp((p * totalTime - phase3Start) / duration, 0, 1)
          ),
          position: "relative",
        }}
      >
        {word}
      </span>
    </span>
  );
};

/**
 * Effect 13: Chars get pink glow + selection highlight bar grows
 * GSAP: duration 0.4, ease power1.inOut
 *   chars fromTo: filter drop-shadow(0 0 0 #ffdbf5) → drop-shadow(0 0 20px #ffdbf5), stagger 0.03
 *   selectMarker: --select-width 0% → 103%, duration 0.8, ease expo, starts at 0
 * CSS: --color-highlight-start: var(--color-text), selection bg rgb(109 215 230 / 14%) mix-blend-mode plus-lighter
 *   select marker has ::before/::after SVG decorators
 */
const renderEffect13 = (word: string, p: number) => {
  const chars = splitChars(word);
  const charDur = 0.4;
  const lastCharStagger = 0.03 * (chars.length - 1);
  const totalCharTime = lastCharStagger + charDur;
  const selectDur = 0.8;
  const totalTime = Math.max(totalCharTime, selectDur);

  // Selection bar width: duration 0.8, ease expo, starts at 0
  const selectP = clamp(p * totalTime / selectDur, 0, 1);
  const selectWidth = Easing.out(Easing.exp)(selectP) * 103;

  return (
    <span
      style={{
        display: "inline-block",
        position: "relative",
        color: COLORS.hx13Start,
      }}
    >
      {/* Selection highlight bar */}
      <span
        style={{
          position: "absolute",
          width: `${selectWidth}%`,
          height: "100%",
          left: "-1%",
          top: "10%",
          background: "rgba(109, 215, 230, 0.14)",
          mixBlendMode: "screen",
          pointerEvents: "none",
        }}
      />
      {chars.map((ch, i) => {
        const charStart = (0.03 * i) / totalTime;
        const charEnd = charStart + charDur / totalTime;
        const cp = clamp((p - charStart) / (charEnd - charStart), 0, 1);
        // ease power1.inOut
        const eased = Easing.inOut(Easing.linear)(cp);
        const glowSize = 20 * eased;

        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              filter: `drop-shadow(0px 0px ${glowSize}px ${COLORS.glowPink})`,
              willChange: "filter",
            }}
          >
            {ch}
          </span>
        );
      })}
    </span>
  );
};

// ─── Effect dispatcher ───

const EFFECT_RENDERERS: Record<
  number,
  (word: string, p: number) => React.ReactNode
> = {
  1: renderEffect1,
  2: renderEffect2,
  3: renderEffect3,
  4: renderEffect4,
  5: renderEffect5,
  6: renderEffect6,
  7: renderEffect7,
  8: renderEffect8,
  9: renderEffect9,
  10: renderEffect10,
  11: renderEffect11,
  12: renderEffect12,
  13: renderEffect13,
};

// ─── Section component ───

interface SectionBlockProps {
  section: Section;
  index: number;
  progress: number;
  totalSections: number;
}

const SectionBlock: React.FC<SectionBlockProps> = ({
  section,
  index,
  progress,
  totalSections,
}) => {
  const sp = sectionProgress(progress, index, totalSections);

  const blockOpacity = interpolate(sp, [0, 0.15, 0.85, 1], [0, 1, 1, 0.3], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const yOffset = interpolate(sp, [0, 0.15, 1], [80, 0, -30], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  // Highlight animation starts at 15% of section progress and runs until 85%
  const highlightP = clamp((sp - 0.15) / 0.7, 0, 1);

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 120px",
        opacity: blockOpacity,
        transform: `translateY(${yOffset}px)`,
      }}
    >
      <p
        style={{
          fontSize: 52,
          lineHeight: 1.2,
          letterSpacing: "-0.0225em",
          color: COLORS.text,
          maxWidth: 900,
          textWrap: "balance" as never,
          fontWeight: 300,
          margin: 0,
        }}
      >
        {section.before}{" "}
        {section.highlights.map((hl, hlIdx) => {
          const renderer = EFFECT_RENDERERS[hl.effect];
          return (
            <React.Fragment key={hlIdx}>
              {renderer ? renderer(hl.text, highlightP) : hl.text}
              {hlIdx < section.highlights.length - 1 ? " " : ""}
            </React.Fragment>
          );
        })}{" "}
        {section.after}
      </p>
    </div>
  );
};

// ─── Main composition ───

export const TextHighlight: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames, width } = useVideoConfig();

  const progress = frame / durationInFrames;

  const currentSectionFloat = progress * SECTIONS.length;
  const visibleIndices: number[] = [];
  for (let i = 0; i < SECTIONS.length; i++) {
    const dist = Math.abs(i + 0.5 - currentSectionFloat);
    if (dist < 1.5) {
      visibleIndices.push(i);
    }
  }

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bg,
        fontFamily: '"parabolica", "Georgia", serif',
        overflow: "hidden",
      }}
    >
      {/* Background: radial gradients + noise texture matching original CSS */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at top, #242937, transparent), radial-gradient(ellipse at bottom, #171340, transparent)",
          backgroundSize: "100% 100%, 200% 200%",
          opacity: 0.7,
        }}
      />

      {/* Header — visible at start */}
      <div
        style={{
          position: "absolute",
          top: 60,
          left: 60,
          right: 60,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          opacity: interpolate(progress, [0, 0.05, 0.12], [1, 1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          zIndex: 10,
        }}
      >
        <span
          style={{
            fontSize: 14,
            textTransform: "uppercase",
            color: COLORS.text,
            opacity: 0.6,
            letterSpacing: 1,
            fontWeight: 400,
          }}
        >
          On-Scroll Text Highlight Effects
        </span>
      </div>

      {/* Intro title — matching original HTML structure */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "flex-start",
          padding: "0 60px 160px 60px",
          opacity: interpolate(
            progress,
            [0, 0.02, 0.06, 0.1],
            [0, 1, 1, 0],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }
          ),
          zIndex: 5,
        }}
      >
        <h2
          style={{
            fontSize: clamp(width * 0.06, 60, 120),
            lineHeight: 0.8,
            margin: 0,
            textTransform: "uppercase",
            fontFamily: '"the-seasons", "Georgia", serif',
            fontWeight: 300,
            color: COLORS.text,
            letterSpacing: "-0.02em",
          }}
        >
          On-Scroll Animations
          <br />
          for{" "}
          <span
            style={{
              filter: `brightness(${lerp(progress, [0, 0.08], [60, 150])}%) blur(${lerp(progress, [0, 0.08], [6, 0])}px)`,
            }}
          >
            Highlighted
          </span>{" "}
          Text
        </h2>
      </div>

      {/* Content sections */}
      {visibleIndices.map((i) => (
        <SectionBlock
          key={i}
          section={SECTIONS[i]}
          index={i}
          progress={progress}
          totalSections={SECTIONS.length}
        />
      ))}

      {/* Noise overlay (original uses img/noise.png tiled at 200px) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.03,
          background:
            "repeating-conic-gradient(rgba(255,255,255,0.1) 0% 25%, transparent 0% 50%) 0 0 / 4px 4px",
          pointerEvents: "none",
          zIndex: 20,
        }}
      />
    </AbsoluteFill>
  );
};
