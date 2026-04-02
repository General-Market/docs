// Source: https://tympanus.net/Development/OnScrollTextHighlight/
import React, { useMemo } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";

// ─── Text content (inspired by the page's crowd-psychology theme) ───

interface Section {
  before: string;
  highlight: string;
  after: string;
  effect: number;
}

const SECTIONS: Section[] = [
  {
    before: "Organised crowds have always played an",
    highlight: "important",
    after: "part in the life of peoples, but this part has never been of such moment as at present.",
    effect: 1,
  },
  {
    before: "The substitution of the",
    highlight: "unconscious",
    after: "action of crowds for the conscious activity of individuals is one of the principal characteristics of the present age.",
    effect: 2,
  },
  {
    before: "The key features of an individual in a crowd are the",
    highlight: "vanishing",
    after: "conscious personality, the rise of the unconscious, and the swift conversion of suggested ideas into actions.",
    effect: 3,
  },
  {
    before: "He is no longer himself, but has",
    highlight: "become an automaton",
    after: "who has ceased to be guided by his will.",
    effect: 4,
  },
  {
    before: "In the midst of the crowd,",
    highlight: "individual",
    after: "judgment is swamped by the overwhelming force of the group\u2019s influence.",
    effect: 5,
  },
  {
    before: "Once submerged in a crowd, the individual becomes more susceptible to the",
    highlight: "dynamics",
    after: "of group think, losing his personal ethical moorings.",
    effect: 6,
  },
  {
    before: "As part of the crowd, he is swept away by a",
    highlight: "collective",
    after: "stream, often adopting extreme ideas or measures that he alone might not consider.",
    effect: 7,
  },
  {
    before: "In this",
    highlight: "transformed state",
    after: ", the crowd member experiences a diminishing of personal fear as anonymity provides a comforting shield.",
    effect: 8,
  },
  {
    before: "Crowd",
    highlight: "psychology",
    after: "facilitates a bizarre unity, melding disparate individuals into a single entity with a common focus.",
    effect: 9,
  },
  {
    before: "This unity is often directed by",
    highlight: "charismatic",
    after: "or influential figures who can steer the crowd\u2019s emotions and actions with alarming ease.",
    effect: 10,
  },
  {
    before: "Without the anchor of personal convictions, they drift,",
    highlight: "vulnerable",
    after: "to whoever steers the crowd\u2019s will. It is here, in the pulse of the crowd, where manipulation goes unnoticed.",
    effect: 11,
  },
  {
    before: "Within the collective consciousness, moral responsibility becomes diffuse, diluted among the",
    highlight: "multitude",
    after: ".",
    effect: 12,
  },
  {
    before: "Actions deemed",
    highlight: "reprehensible",
    after: "on an individual level can be rationalized and justified within the context of the crowd.",
    effect: 13,
  },
];

// ─── Color palette (from the original CSS variables) ───

const COLORS = {
  bg: "#000",
  text: "#b8afaa",
  highlightStart: "#968a84",
  // per-effect end colors
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
  hx12End: "#fff",
  glowPink: "#ffdbf5",
};

// ─── Helpers ───

/** Split a word into characters */
const splitChars = (word: string): string[] => word.split("");

/** Compute per-section local progress (0..1) from global scroll progress */
const sectionProgress = (
  globalProgress: number,
  sectionIndex: number,
  totalSections: number
): number => {
  // Each section occupies an equal slice of the total scroll
  // with a 30% overlap so animations start before the section is fully centered
  const sliceSize = 1 / totalSections;
  const start = sectionIndex * sliceSize;
  const end = start + sliceSize;
  return Math.max(0, Math.min(1, (globalProgress - start) / (end - start)));
};

/** Clamp */
const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

/** Remotion-safe interpolation shorthand */
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

// ─── Effect renderers ───
// Each returns a React node for the highlighted word(s).
// `p` is local animation progress 0..1

/** Effect 1: 3D flip-in per character (rotationX + z-depth + opacity, staggered) */
const renderEffect1 = (word: string, p: number) => {
  const chars = splitChars(word);
  const staggerDur = 0.04 * 30; // 0.04s stagger at notional 30 char-steps
  const totalStagger = chars.length * staggerDur;
  const animDur = 0.8; // normalized

  return (
    <span style={{ display: "inline-block", perspective: 500, color: COLORS.highlightStart }}>
      {chars.map((ch, i) => {
        const charStart = (i * staggerDur) / (totalStagger + animDur);
        const charEnd = charStart + animDur / (totalStagger + animDur);
        const cp = clamp((p - charStart) / (charEnd - charStart), 0, 1);
        const eased = Easing.out(Easing.quad)(cp);

        const opacity = lerp(eased, [0, 1], [0, 1]);
        const z = lerp(eased, [0, 1], [300, 0]);
        const rotX = lerp(eased, [0, 1], [-45, 0]);

        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity,
              transform: `translateZ(${z}px) rotateX(${rotX}deg)`,
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

/** Effect 2: Blink per character (opacity 1->0->1->0->1, staggered) */
const renderEffect2 = (word: string, p: number) => {
  const chars = splitChars(word);

  return (
    <span style={{ display: "inline-block", color: COLORS.highlightStart }}>
      {chars.map((ch, i) => {
        const charDelay = i * 0.05;
        const totalCycleDur = 0.6 * 3 + 0.6; // 3 half-blinks + final settle
        const cp = clamp((p * 2.4 - charDelay) / (totalCycleDur * 0.3), 0, 1);

        // Simulate repeat:2 yoyo: opacity goes 1->0->1->0->1
        let opacity: number;
        if (cp < 0.2) opacity = lerp(cp, [0, 0.2], [1, 0]);
        else if (cp < 0.4) opacity = lerp(cp, [0.2, 0.4], [0, 1]);
        else if (cp < 0.6) opacity = lerp(cp, [0.4, 0.6], [1, 0]);
        else if (cp < 0.8) opacity = lerp(cp, [0.6, 0.8], [0, 1]);
        else opacity = lerp(cp, [0.8, 1], [1, 1]);

        return (
          <span key={i} style={{ display: "inline-block", opacity }}>
            {ch}
          </span>
        );
      })}
    </span>
  );
};

/** Effect 3: Scale down + fade out, then reappear in pink with glow */
const renderEffect3 = (word: string, p: number) => {
  const chars = splitChars(word);
  const stagger = 0.06;

  return (
    <span style={{ display: "inline-block", color: COLORS.highlightStart }}>
      {chars.map((ch, i) => {
        const phase1Start = i * stagger * 0.5;
        const phase1End = phase1Start + 0.35;
        const phase2Start = phase1End;
        const phase2End = phase2Start + 0.35;

        let opacity = 1;
        let scale = 1;
        let color = COLORS.highlightStart;
        let textShadow = "none";

        if (p >= phase1Start && p < phase1End) {
          const cp = clamp((p - phase1Start) / (phase1End - phase1Start), 0, 1);
          const eased = Easing.in(Easing.quad)(cp);
          opacity = 1 - eased;
          scale = 1 - 0.2 * eased;
        } else if (p >= phase2Start) {
          const cp = clamp(
            (p - phase2Start) / (phase2End - phase2Start),
            0,
            1
          );
          const eased = Easing.out(Easing.quad)(cp);
          opacity = eased;
          scale = 1;
          color = COLORS.hx3End;
          textShadow = `0 0 ${20 * eased}px ${COLORS.glowPink}`;
        }

        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity,
              transform: `scale(${scale})`,
              color,
              textShadow,
            }}
          >
            {ch}
          </span>
        );
      })}
    </span>
  );
};

/** Effect 4: Scale up to 1.45x in green, then settle to 1x in blue */
const renderEffect4 = (word: string, p: number) => {
  const chars = splitChars(word);
  const stagger = 0.05;

  return (
    <span style={{ display: "inline-block", color: COLORS.highlightStart }}>
      {chars.map((ch, i) => {
        const phase1Start = i * stagger * 0.3;
        const phase1End = phase1Start + 0.3;
        const phase2Start = phase1End;
        const phase2End = phase2Start + 0.4;

        let scale = 1;
        let color = COLORS.highlightStart;

        if (p >= phase1Start && p < phase1End) {
          const cp = clamp((p - phase1Start) / (phase1End - phase1Start), 0, 1);
          const eased = Easing.in(Easing.cubic)(cp);
          scale = 1 + 0.45 * eased;
          color = lerpColor(COLORS.highlightStart, COLORS.hx4End, eased);
        } else if (p >= phase2Start) {
          const cp = clamp(
            (p - phase2Start) / (phase2End - phase2Start),
            0,
            1
          );
          const eased = Easing.out(Easing.sin)(cp);
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
              willChange: "transform",
            }}
          >
            {ch}
          </span>
        );
      })}
    </span>
  );
};

/** Effect 5: Scale+fade in chars with purple background box scaling in */
const renderEffect5 = (word: string, p: number) => {
  const chars = splitChars(word);

  // Background box scale
  const boxScale = lerp(p, [0, 0.7], [0, 1], Easing.out(Easing.exp));

  return (
    <span
      style={{
        display: "inline-flex",
        position: "relative",
        color: COLORS.hx5Text,
      }}
    >
      {/* Background box */}
      <span
        style={{
          position: "absolute",
          left: "-2.5%",
          top: "10%",
          bottom: "-7.5%",
          width: "105%",
          background: COLORS.hx5Bg,
          borderRadius: 8,
          transform: `scale(${boxScale})`,
          zIndex: -1,
        }}
      />
      {chars.map((ch, i) => {
        const charStart = 0.1 + 0.05 * i;
        const charEnd = charStart + 0.4;
        const cp = clamp((p - charStart) / (charEnd - charStart), 0, 1);
        const eased = Easing.out(Easing.quad)(cp);

        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity: eased,
              transform: `scale(${1 + 0.3 * (1 - eased)})`,
            }}
          >
            {ch}
          </span>
        );
      })}
    </span>
  );
};

/** Effect 6: Chars fade out reverse, fade in forward, orange bar grows left-to-right */
const renderEffect6 = (word: string, p: number) => {
  const chars = splitChars(word);
  const total = chars.length;

  // Bar width animation
  const barWidth = lerp(p, [0.3, 1], [0, 105], Easing.out(Easing.poly(4)));

  return (
    <span
      style={{
        display: "inline-flex",
        position: "relative",
        color: COLORS.hx6Text,
      }}
    >
      {/* Background bar */}
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
        // Phase 1: fade out in reverse order
        const revDelay = 0.06 * (total - 1 - i);
        const fadeOutStart = revDelay * 0.15;
        const fadeOutEnd = fadeOutStart + 0.1;
        // Phase 2: fade in forward
        const fadeInStart = 0.3 + 0.05 * i;
        const fadeInEnd = fadeInStart + 0.2;

        let opacity = 1;
        if (p < 0.3) {
          if (p >= fadeOutStart && p < fadeOutEnd) {
            opacity = lerp(p, [fadeOutStart, fadeOutEnd], [1, 0]);
          } else if (p >= fadeOutEnd) {
            opacity = 0;
          }
        } else {
          if (p < fadeInStart) opacity = 0;
          else if (p < fadeInEnd)
            opacity = lerp(p, [fadeInStart, fadeInEnd], [0, 1]);
          else opacity = 1;
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

/** Effect 7: Chars scale in from bottom (scaleY 0->1), green background grows in height */
const renderEffect7 = (word: string, p: number) => {
  const chars = splitChars(word);

  const barHeight = lerp(p, [0.1, 0.8], [0, 100], Easing.inOut(Easing.sin));

  return (
    <span
      style={{
        display: "inline-block",
        position: "relative",
        color: COLORS.hx7Text,
      }}
    >
      {/* Background box that grows in height */}
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
        const charStart = 0.2 + 0.05 * i;
        const charEnd = charStart + 0.2;
        const cp = clamp((p - charStart) / (charEnd - charStart), 0, 1);
        const eased = Easing.out(Easing.sin)(cp);

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

/** Effect 8: Words rotate in from -30deg with elastic ease, color to gold */
const renderEffect8 = (word: string, p: number) => {
  const words = word.split(" ");

  return (
    <span style={{ display: "inline-block", color: COLORS.highlightStart }}>
      {words.map((w, i) => {
        const wordStart = i * 0.2;
        const wordEnd = wordStart + 0.8;
        const cp = clamp((p - wordStart) / (wordEnd - wordStart), 0, 1);

        // Simulate elastic.out(0.7) with a spring-like overshoot
        const eased = elasticOut(cp, 0.7);

        const opacity = lerp(cp, [0, 0.3], [0, 1]);
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

/** Effect 9: Chars tumble in with random rotation, clone chars explode upward and fade */
const renderEffect9 = (word: string, p: number) => {
  const chars = splitChars(word);

  // Deterministic "random" rotations per character
  const rotations = useMemo(
    () => chars.map((_, i) => ((i * 137.5) % 90) - 45),
    [chars.length]
  );

  return (
    <span
      style={{
        display: "inline-block",
        position: "relative",
        color: COLORS.highlightStart,
      }}
    >
      {/* Exploding clones (behind) */}
      {chars.map((ch, i) => {
        const cp = clamp(p * 1.5 - i * 0.06, 0, 1);
        const eased = Easing.out(Easing.exp)(cp);

        const xOff = ((i * 37) % 30) - 15;
        const yOff = -50 - ((i * 53) % 80);
        const scl = 1 + ((i * 29) % 10) / 10;

        return (
          <span
            key={`clone-${i}`}
            style={{
              display: "inline-block",
              position: "absolute",
              left: `${i * 0.62}em`,
              opacity: 1 - eased,
              transform: `translate(${xOff * eased}%, ${yOff * eased}%) rotate(${-rotations[i] * eased}deg) scale(${1 + (scl - 1) * eased})`,
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
        const charStart = i * 0.06 * 0.5;
        const charEnd = charStart + 0.5;
        const cp = clamp((p - charStart) / (charEnd - charStart), 0, 1);
        const eased = Easing.out(Easing.quad)(cp);

        const yPct = 80 * (1 - eased);
        const rot = rotations[i] * (1 - eased);

        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity: eased,
              transform: `translateY(${yPct}%) rotate(${rot}deg)`,
            }}
          >
            {ch}
          </span>
        );
      })}
    </span>
  );
};

/** Effect 10: Chars randomly brighten with red glow, then settle */
const renderEffect10 = (word: string, p: number) => {
  const chars = splitChars(word);

  // Deterministic "random" delays per character
  const delays = useMemo(
    () => chars.map((_, i) => ((i * 73 + 17) % 100) / 100),
    [chars.length]
  );

  return (
    <span style={{ display: "inline-block", color: COLORS.highlightStart }}>
      {chars.map((ch, i) => {
        const charStart = delays[i] * 0.5;
        const charMid = charStart + 0.2;
        const charEnd = charMid + 0.2;

        let brightness = 100;
        let glowSize = 0;

        if (p >= charStart && p < charMid) {
          const cp = (p - charStart) / (charMid - charStart);
          brightness = 100 + 200 * Easing.in(Easing.quad)(cp);
          glowSize = 50 * Easing.in(Easing.quad)(cp);
        } else if (p >= charMid && p < charEnd) {
          const cp = (p - charMid) / (charEnd - charMid);
          brightness = 300 - 200 * cp;
          glowSize = 50 * (1 - cp);
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

/** Effect 11: Large word scales down and deblurs into inline position (Flip-style) */
const renderEffect11 = (word: string, p: number) => {
  const eased = Easing.inOut(Easing.sin)(p);

  // Simulate Flip: large blurred word shrinks to inline highlighted word
  const fontSize = lerp(eased, [0, 1], [4, 1]); // 4x -> 1x scale
  const blur = lerp(eased, [0, 1], [6, 0]);
  const yOffset = lerp(eased, [0, 1], [-60, 0]); // slides down into position

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

/** Effect 12: 8 ghost clones slide up and vanish sequentially, then word gets bright */
const renderEffect12 = (word: string, p: number) => {
  const cloneCount = 8;
  const cloneDur = 0.6;
  const stagger = 0.15 * 0.5;

  return (
    <span
      style={{
        display: "inline-block",
        position: "relative",
        color: COLORS.highlightStart,
      }}
    >
      {/* Ghost clones */}
      {Array.from({ length: cloneCount }).map((_, i) => {
        const cloneStart = i * stagger;
        const cloneEnd = cloneStart + cloneDur;
        const cp = clamp((p - cloneStart) / (cloneEnd - cloneStart), 0, 1);
        const eased = Easing.out(Easing.exp)(cp);

        // Slide in from below and vanish
        const yPct = 150 * (1 - eased);
        const opacity = cp < 0.9 ? eased : lerp(cp, [0.9, 1], [1, 0]);

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
              color: `rgba(150,138,132,${0.3 + 0.1 * i})`,
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
            COLORS.highlightStart,
            COLORS.hx12End,
            clamp((p - 0.7) / 0.3, 0, 1)
          ),
          position: "relative",
        }}
      >
        {word}
      </span>
    </span>
  );
};

/** Effect 13: Chars get pink glow + selection highlight bar grows */
const renderEffect13 = (word: string, p: number) => {
  const chars = splitChars(word);

  // Selection bar width
  const selectWidth = lerp(p, [0, 0.8], [0, 103], Easing.out(Easing.exp));

  return (
    <span
      style={{
        display: "inline-block",
        position: "relative",
        color: COLORS.text,
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
        const glowStart = i * 0.03;
        const glowEnd = glowStart + 0.4;
        const cp = clamp((p - glowStart) / (glowEnd - glowStart), 0, 1);
        const glowSize = 20 * Easing.out(Easing.quad)(cp);

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

// ─── Utility: color interpolation ───

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
};

const rgbToHex = (r: number, g: number, b: number): string =>
  `#${[r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, "0")).join("")}`;

const lerpColor = (from: string, to: string, t: number): string => {
  const [r1, g1, b1] = hexToRgb(from);
  const [r2, g2, b2] = hexToRgb(to);
  return rgbToHex(
    r1 + (r2 - r1) * t,
    g1 + (g2 - g1) * t,
    b1 + (b2 - b1) * t
  );
};

/** Elastic-out easing with configurable amplitude */
const elasticOut = (t: number, amplitude: number = 1): number => {
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

  // Fade in/out for the entire block
  const blockOpacity = interpolate(sp, [0, 0.15, 0.85, 1], [0, 1, 1, 0.3], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Slide up as scroll progresses
  const yOffset = interpolate(sp, [0, 0.15, 1], [80, 0, -30], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  // Highlight animation starts at 15% of section progress and runs until 85%
  const highlightP = clamp((sp - 0.15) / 0.7, 0, 1);

  const renderer = EFFECT_RENDERERS[section.effect];

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
          lineHeight: 1.25,
          letterSpacing: "-0.025em",
          color: COLORS.text,
          maxWidth: 1200,
          textWrap: "balance" as never,
          fontWeight: 300,
          margin: 0,
        }}
      >
        {section.before}{" "}
        {renderer ? renderer(section.highlight, highlightP) : section.highlight}{" "}
        {section.after}
      </p>
    </div>
  );
};

// ─── Main composition ───

export const TextHighlight: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames, width } = useVideoConfig();

  // Global scroll progress 0..1
  const progress = frame / durationInFrames;

  // Determine which sections are "visible" (render ~3 at a time for overlap)
  const currentSectionFloat =
    progress * SECTIONS.length;
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
        fontFamily: '"Georgia", "Times New Roman", serif',
        overflow: "hidden",
      }}
    >
      {/* Subtle radial gradient background matching the original */}
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

      {/* Intro title — visible at the very beginning */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "flex-start",
          padding: "0 60px 160px 60px",
          opacity: interpolate(progress, [0, 0.02, 0.06, 0.1], [0, 1, 1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          zIndex: 5,
        }}
      >
        <h2
          style={{
            fontSize: clamp(width * 0.06, 60, 120),
            lineHeight: 0.85,
            margin: 0,
            textTransform: "uppercase",
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

      {/* Content sections — rendered as overlapping layers */}
      {visibleIndices.map((i) => (
        <SectionBlock
          key={i}
          section={SECTIONS[i]}
          index={i}
          progress={progress}
          totalSections={SECTIONS.length}
        />
      ))}

      {/* Subtle noise overlay */}
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
