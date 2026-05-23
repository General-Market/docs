// Faithful port of the Codrops "Fluid Motion" four-section essay.
// The original page scrolled top→bottom and played GSAP demos on click; here
// the page translates upward over 10 s and every demo plays as it scrolls into
// view — both .yes and .no fire together. SVG geometry, ids, viewBoxes,
// fills, and class names come from the source verbatim.

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";

// ── Scroll geometry ────────────────────────────────────────────────────────

const VIEW_W = 1920;
const VIEW_H = 1080;
const SECTION_HEIGHT = 850;
const SECTION_COUNT = 4;
const PAGE_H = SECTION_COUNT * SECTION_HEIGHT + 300;

const easeScroll = Easing.bezier(0.4, 0, 0.2, 1);

// Linear ramp clamped to [0,1].
const ramp = (t: number, a: number, b: number) => {
  if (b <= a) return t >= b ? 1 : 0;
  return Math.max(0, Math.min(1, (t - a) / (b - a)));
};

// GSAP-equivalent easings.
const sineOut = (t: number) => Math.sin((t * Math.PI) / 2);
const sineIn = (t: number) => 1 - Math.cos((t * Math.PI) / 2);
const power3Out = (t: number) => 1 - Math.pow(1 - t, 3);
const power3In = (t: number) => t * t * t;
const backOut = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
const bounceOut = (t: number) => {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
  return n1 * (t -= 2.625 / d1) * t + 0.984375;
};
const elasticOut = (t: number) => {
  if (t === 0 || t === 1) return t;
  const c4 = (2 * Math.PI) / 3;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
};
const linear = (t: number) => t;

// Helpful: each ease exposed under the GSAP name for parity in comments.
const Sine = { easeOut: sineOut, easeIn: sineIn };
const Power3 = { easeOut: power3Out, easeIn: power3In };
const Back = { easeOut: backOut };
const Bounce = { easeOut: bounceOut };
const Elastic = { easeOut: elasticOut };
const Linear = { easeNone: linear };
// Side-effect to keep these in the bundle without an "unused" hint.
void Sine; void Power3; void Back; void Bounce; void Elastic; void Linear;

// ── Page CSS (the original SCSS flattened) ────────────────────────────────

const STYLE = `
.fluid-page {
  font-family: "Open Sans", "Helvetica Neue", Helvetica, Arial, sans-serif;
  color: #3b4144;
  background: #f4f5f6;
}
.fluid-page section {
  margin: 100px 0 50px;
  padding-top: 50px;
  position: relative;
}
.fluid-page section:first-child { margin: 50px 0; }
.fluid-page section:last-child { padding-bottom: 100px; }
.fluid-page section::after { content: ""; display: table; clear: both; }
.fluid-page p { margin: 0 0 15px; line-height: 1.5; }
.fluid-page h1 { margin: 0; font-weight: 600; }

.fluid-behind {
  color: white;
  font-family: "Oswald", "Helvetica Neue", sans-serif;
  text-shadow: 0 5px 20px rgba(0,0,0,0.15);
  text-transform: uppercase;
  font-size: 130px;
  letter-spacing: 0.15em;
  position: fixed;
  top: 50%; left: 20%;
  transform: translate(-15%, -40%);
  z-index: 1;
  pointer-events: none;
  white-space: nowrap;
  font-weight: 300;
}

.backgroundLowerlight { background: #f0f1f2; }
.backgroundMidnight { background: #2b2f33; }
.backgroundControls { background: #cdd1d4; }
.typeReversed { color: white; }
.typeLowlight { color: #6b7075; }
.floatRight { float: right; }

.containerFluid {
  position: relative;
  z-index: 10;
  padding: 0 60px;
  width: 100%;
  box-sizing: border-box;
}

nav {
  position: fixed; right: 20px; top: 10%; height: 80%;
  display: flex; flex-direction: column; justify-content: space-between;
  z-index: 50000; cursor: pointer;
}
nav .line {
  position: absolute; right: 17px; top: 14px; bottom: 14px;
  width: 2px;
}
nav .node {
  width: 16px; height: 16px; border-radius: 50%; position: relative;
  z-index: 2; transition: transform 120ms ease-out;
}
nav .node.last {
  width: 36px; height: 36px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  transform: translateX(-10px);
}
nav .node.last .iconDown { font-style: normal; font-size: 18px; }
nav a { display: block; }
nav .node.active { transform: scale(1.45); box-shadow: 0 0 0 4px rgba(43,47,51,0.18); }

.row {
  display: grid;
  grid-template-columns: 80px repeat(12, 1fr);
  grid-column-gap: 24px;
  position: relative;
}
.col-md-1 { grid-column: span 1; }
.col-md-2 { grid-column: span 2; }
.col-md-3 { grid-column: span 3; }
.col-md-4 { grid-column: span 4; }
.col-md-5 { grid-column: span 5; }
.col-md-6 { grid-column: span 6; }
.col-md-7 { grid-column: span 7; }
.col-md-8 { grid-column: span 8; }

.number {
  font-family: "Roboto Slab", serif;
  transform: rotate(270deg);
  font-size: 60px;
  font-weight: 700;
  color: #3b4144;
  margin-top: 110px;
  text-align: center;
  width: 60px;
}

.yes, .no {
  height: 220px;
  margin-top: 50px;
  margin-right: 20px;
  padding: 0;
  background: white;
  box-shadow: inset 0 0 1px 0 rgba(180,180,180,1);
  position: relative;
  overflow: hidden;
}
.yes { border-bottom: 5px solid #20c063; }
.no  { border-bottom: 5px solid #e13009; }
#section2 .yes, #section2 .no {
  background: linear-gradient(135deg, #d9e6cf 0%, #c9d8c0 30%, #d4d9c0 60%, #cfd6c5 100%);
}
#section4 .yes, #section4 .no { background: #e2f2e4; }

.demo {
  height: 100%; width: 100%;
  display: flex; align-items: center; justify-content: center;
  position: relative;
}
.demo svg { width: 170px; }
.demo svg.dev-yes, .demo svg.dev-no { width: 215px; }
.entranceyes, .entranceno { width: 280px !important; }

.demoOverlay {
  width: 100%; height: 100%; margin: 0;
  position: absolute; inset: 0;
  opacity: 0.97;
  padding: 0 5px; z-index: 3000;
  background: #2b2f33;
  display: flex; align-items: center; justify-content: center;
  gap: 14px;
}
.demoOverlay .iconContainer {
  width: 35px; height: 35px; border-radius: 6px;
  background: rgba(255,255,255,0.08);
  display: flex; align-items: center; justify-content: center;
  color: white; font-size: 18px;
}
.demoOverlay .play {
  font-size: 26px;
  display: block; opacity: 0.3;
  color: white;
}

.explainContain {
  height: 300px;
  margin-top: 50px;
  background: white;
  box-shadow: 0 5px 20px rgba(0,0,0,0.3);
  padding: 235px 20px 20px;
  position: relative;
}
.explainContain pre {
  margin: 0;
  font-family: "SF Mono", Menlo, Consolas, monospace;
  font-size: 12px;
  color: #6b7075;
  white-space: pre-wrap;
}
.descContain {
  background: white;
  box-shadow: 0 5px 20px rgba(0,0,0,0.3);
  padding: 80px 80px 50px;
  position: relative;
}
.description { margin-top: 110px; position: relative; }
.description h1 {
  letter-spacing: 0.3em;
  margin-top: 22px;
  font-size: 28px;
  text-transform: uppercase;
}
.hrSide {
  height: 10px; margin-top: 23px;
  background: #EFEFEF; width: 60px;
}

.sectTitle { z-index: 300; position: relative; }

/* Demo 2 marker pieces */
.markerPrimary {
  position: absolute; left: 50%; top: 50%;
  transform: translate(-50%, -50%);
  width: 14px; height: 14px;
  background: #10a75f;
  border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.7);
  box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  z-index: 5;
}
.markerstem {
  position: absolute; left: 50%; bottom: -10px;
  transform: translateX(-50%);
  width: 2px; height: 12px;
  background: #10a75f;
  border: 1px solid transparent;
}
.movet1 {
  position: absolute; left: 50%; top: 50%;
  transform: translate(-50%, calc(-50% - 28px));
  background: #2b2f33; color: white;
  padding: 4px 8px; font-size: 12px;
  font-weight: 700; border-radius: 3px;
  white-space: nowrap;
}
.movet2 { opacity: 0; }
.movet3 {
  margin-top: 21px; color: #3b4144;
  margin-left: 4px; font-weight: 700; font-size: 16px;
}
.houseBk {
  position: absolute; left: 10px; top: 32px;
  width: 42px; height: 26px; background: #ecf3ec;
  border-radius: 3px;
}
.greybar {
  position: absolute; right: 16px; height: 6px;
  border-radius: 2px;
}
.bar1 { top: 34px; width: 80px; }
.bar2 { top: 46px; width: 60px; }
.bar3 { top: 56px; left: 14px; right: auto; width: 90px; }
.bar4 { top: 70px; left: 14px; right: auto; width: 70px; }
.fakemodal {
  position: absolute; left: 50%; bottom: 16px;
  transform: translateX(-50%);
  width: 230px; height: 110px;
  background: white;
  border-radius: 4px;
  box-shadow: 0 18px 50px rgba(0,0,0,0.45);
  padding: 14px; box-sizing: border-box;
}
.house, .house2 { display: block; }

/* Demo 4 baseplate */
.devStage {
  position: absolute; inset: 0;
  background: #e2f2e4;
}
.devYesStart, .devNoStart {
  position: absolute; left: 14px; top: 14px;
  padding: 6px 12px; border-radius: 4px;
  background: #20c063; color: white;
  font-weight: 700; font-size: 13px;
  border: 1px solid #20c063;
}
`;

// ── Section description copy ──────────────────────────────────────────────

type SectionCopy = {
  id: string;
  number: string;
  title: string;
  description: string;
  explain: string;
};

const SECTIONS: SectionCopy[] = [
  {
    id: "section1",
    number: "01",
    title: "Morphing",
    description:
      "Fluid Motion is built on a foundation of object permanence. Elements transform from one state to another — they don't blink in and out. Morphing teaches the eye what just happened.",
    explain:
      "Morphing does mean shapes can shift.\nMorphing does not get paired with flipping —\nthe field is the same object, only changed.",
  },
  {
    id: "section2",
    number: "02",
    title: "Context-Shifting",
    description:
      "Users scan in saccades; preserve placement. A panel that grows out of the marker keeps your spatial memory intact. A modal slamming in from elsewhere costs the reader a second of reorientation.",
    explain:
      "The marker becomes the panel.\nThe panel becomes the answer.\nNothing teleports.",
  },
  {
    id: "section3",
    number: "03",
    title: "Entrances and Exits",
    description:
      "Standardize the entrance. Ninety percent scale plus opacity reads as 'this grew into being'. Bigger overshoots, spins, and bounces read as a system that has lost its composure.",
    explain:
      "Entrances start from 90% scale —\nsubtle enough that the eye registers arrival,\nrestrained enough not to take the stage.",
  },
  {
    id: "section4",
    number: "04",
    title: "Developer Standards",
    description:
      "How a thing moves matters as much as the motion itself. Transform plus opacity, hardware accelerated, no 300 ms touch delay — those are the floor. Below the floor, the page feels stuck.",
    explain:
      "Touch events should not wait 300 ms.\nUse transform and opacity, never top/left.\nKeep the work on the compositor.",
  },
];

// ── Side nav ──────────────────────────────────────────────────────────────

const SideNav: React.FC<{ activeIdx: number }> = ({ activeIdx }) => (
  <nav>
    <div className="line backgroundMidnight" />
    {[0, 1, 2, 3].map((i) => (
      <a key={i} href={`#section${i + 1}`}>
        <div className={`node backgroundMidnight${i === activeIdx ? " active" : ""}`} />
      </a>
    ))}
    <div className="node last backgroundMidnight">
      <i className="iconDown typeReversed">↓</i>
    </div>
  </nav>
);

// ──────────────────────────────────────────────────────────────────────────
// Demo 1 — Morphing form (.rr1 / .rr2)
// Verbatim path d-strings from the original Renter Resume SVG.
// "Yes" plays the morph timeline. "No" wraps each field in a rotateY(180)
// flip with Back.easeOut, so it reads as a card flipping in place.
// ──────────────────────────────────────────────────────────────────────────

// Rachel Smith glyph paths — exact d-strings from the original SVG, in order.
const RACHEL_SMITH_GLYPHS: string[] = [
  "M39.1 37.2l2.1 3.6h-1.6l-1.9-3.4h-1.5v3.4h-1.4v-8.4h3c1.5 0 3 .6 3 2.4a2.3 2.3 0 0 1-1.7 2.4zm-1.5-3.6h-1.4v2.7h1.5c1.2 0 1.7-.5 1.7-1.4s-.6-1.4-1.8-1.4z",
  "M45.8 40a2 2 0 0 1-1.8.9 1.7 1.7 0 0 1-1.9-1.6c0-1.5 1.8-2 3.7-2V37a1.1 1.1 0 0 0-2.1-.1l-1.3-.2c.1-1.1 1.2-1.7 2.4-1.7a2 2 0 0 1 2.3 2.1v3a2.2 2.2 0 0 0 .1.8h-1.3a1.9 1.9 0 0 1-.1-.9zm0-1.4v-.4c-1.4 0-2.4.3-2.4 1a.8.8 0 0 0 .9.7 1.3 1.3 0 0 0 1.4-1.2z",
  "M51.1 34.9a2.3 2.3 0 0 1 2.4 1.6l-1.2.5a1.2 1.2 0 0 0-1.2-1c-.9 0-1.4.9-1.4 1.9s.4 1.9 1.4 1.9a1.2 1.2 0 0 0 1.1-.9l1.3.5a2.6 2.6 0 0 1-2.4 1.5 2.7 2.7 0 0 1-2.8-3 2.7 2.7 0 0 1 2.8-3z",
  "M54.7 32.4h1.4v3.5a1.9 1.9 0 0 1 1.7-.9 1.8 1.8 0 0 1 2 1.9v3.9h-1.3v-3.6a1 1 0 0 0-1.1-1.1 1.5 1.5 0 0 0-1.3 1.7v3h-1.4v-8.4z",
  "M66.3 39.5a2.6 2.6 0 0 1-2.4 1.4 2.7 2.7 0 0 1-2.8-3 2.7 2.7 0 0 1 2.8-3 2.6 2.6 0 0 1 2.7 3v.4h-4.1a1.5 1.5 0 0 0 1.4 1.6 1.3 1.3 0 0 0 1.3-.9zm-3.8-2.2h2.7a1.3 1.3 0 0 0-1.3-1.4 1.4 1.4 0 0 0-1.4 1.4z",
  "M67.8 32.4h1.4v8.4h-1.4v-8.4z",
  "M76.9 35.9c1.9.3 2.9 1 2.9 2.5s-1.2 2.5-3.2 2.5-3.3-1.2-3.3-2.5l1.4-.2a1.7 1.7 0 0 0 1.9 1.6c1.1 0 1.8-.5 1.8-1.4s-.5-1.1-1.9-1.4-3-.9-3-2.4 1.3-2.4 3-2.4a2.9 2.9 0 0 1 3.2 2.3l-1.4.3a1.6 1.6 0 0 0-1.8-1.4c-1.1 0-1.6.5-1.6 1.2s.6 1 2 1.3z",
  "M81.3 35.1h1.3v.9a1.8 1.8 0 0 1 1.7-1 1.8 1.8 0 0 1 1.7 1 2.2 2.2 0 0 1 1.8-1 1.8 1.8 0 0 1 1.9 1.9v3.9h-1.4v-3.6a1 1 0 0 0-.9-1.1c-.6 0-1.2.6-1.2 1.7v3h-1.4v-3.6a1 1 0 0 0-1-1.1c-.6 0-1.2.6-1.2 1.7v3h-1.4v-5.7z",
  "M92.1 32.2a.8.8 0 0 1 .8.8.85.85 0 0 1-1.7 0 .8.8 0 0 1 .9-.8zm-.7 2.9h1.4v5.7h-1.4v-5.7z",
  "M97.6 40.7l-1.2.2a1.5 1.5 0 0 1-1.7-1.6v-3.2h-1v-1h1v-1.6l1.4-.6v2.2h1.3v1h-1.3v3a.5.5 0 0 0 .5.7l.6-.2z",
  "M98.8 32.4h1.4v3.5a1.9 1.9 0 0 1 1.7-.9 1.8 1.8 0 0 1 2 1.9v3.9h-1.4v-3.6a1 1 0 0 0-1.1-1.1 1.5 1.5 0 0 0-1.3 1.7v3h-1.4v-8.4z",
];

// One morphing input field: cross-fade from the source rounded-rectangle to
// a flat fill-rect at the same vertical center. When `flip` is set, wrap the
// whole thing in a rotateY(180) tween eased with Back.easeOut.
const FieldMorph: React.FC<{
  progress: number;
  flip: boolean;
  startD: string;
  targetD: string;
  pivotX: number;
  pivotY: number;
}> = ({ progress, flip, startD, targetD, pivotX, pivotY }) => {
  const m = progress;
  const deg = flip ? backOut(m) * 180 : 0;
  return (
    <g
      style={{
        transform: `rotateY(${deg}deg)`,
        transformOrigin: `${pivotX}px ${pivotY}px`,
        transformBox: "fill-box",
      }}
    >
      <path d={startD} fill="#f5f6f7" stroke="#b1b6bb" strokeMiterlimit={10} opacity={1 - m} />
      <path d={targetD} fill="#cdd1d4" opacity={m} />
    </g>
  );
};

const ResumeMorph: React.FC<{ progress: number; flip: boolean; idSuffix: string }> = ({
  progress,
  flip,
  idSuffix,
}) => {
  const t = progress;

  // Button first pulse: 0.04→0.12 up, 0.12→0.20 down (Power3 easings).
  const p1 = ramp(t, 0.04, 0.12);
  const p1d = ramp(t, 0.12, 0.20);
  const buttonScale1 = 1 + 0.2 * power3Out(p1) - 0.2 * power3In(p1d);
  const buttonOpacity1 = 1 - 0.8 * p1 + 0.8 * p1d;

  // begin = 0.20 in normalized time.
  const begin = 0.20;
  const fake3Out = ramp(t, begin, begin + 0.05);
  const rachelStagger = (i: number) =>
    ramp(t, begin + 0.1 + i * 0.035, begin + 0.18 + i * 0.035);
  const hrIn = ramp(t, begin + 0.1, begin + 0.3);
  const topTextIn = ramp(t, begin + 0.1, begin + 0.3);
  const field3Morph = ramp(t, begin + 0.1, begin + 0.3);
  const fake2Out = ramp(t, begin + 0.1, begin + 0.3);
  const field2Morph = ramp(t, begin + 0.1, begin + 0.3);
  const fake5In = ramp(t, begin + 0.1, begin + 0.3);
  const fakeOut = ramp(t, begin + 0.1, begin + 0.3);
  const field1Morph = ramp(t, begin + 0.1, begin + 0.3);

  // Second pulse.
  const p2 = ramp(t, begin + 0.75, begin + 0.82);
  const p2d = ramp(t, begin + 0.82, begin + 0.92);
  const buttonScale2 = 1 + 0.2 * power3Out(p2) - 0.2 * power3In(p2d);
  const buttonOpacity2 = 1 - 0.8 * p2 + 0.8 * p2d;

  const buttonScale = buttonScale1 * buttonScale2;
  const buttonOpacity = Math.min(buttonOpacity1, buttonOpacity2);

  return (
    <svg
      className={`rr-image rr${idSuffix === "" ? "1" : "2"}`}
      xmlns="http://www.w3.org/2000/svg"
      width="219.3"
      height="244.2"
      viewBox="0 0 219.3 244.2"
      style={{ overflow: "visible", perspective: 200 }}
    >
      <defs>
        <filter id={`AI_GaussianBlur_4${idSuffix}`}>
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      <g id={`r-1${idSuffix}`}>
        <g filter={`url(#AI_GaussianBlur_4${idSuffix})`}>
          <path
            d="M12.5 233.6a3.8 3.8 0 0 1-3.9-3.7V13.1a3.8 3.8 0 0 1 3.9-3.7h197a3.8 3.8 0 0 1 3.9 3.7v216.8a3.8 3.8 0 0 1-3.9 3.7h-197z"
            fill="#ccc"
          />
        </g>
        <path
          id={`form_bg${idSuffix}`}
          d="M15.3 230.5a3.7 3.7 0 0 1-3.8-3.6V16.1a3.7 3.7 0 0 1 3.8-3.6h191.4a3.7 3.7 0 0 1 3.8 3.6v210.7a3.7 3.7 0 0 1-3.8 3.6H15.3z"
          fill="#fff"
          stroke="#10a75f"
          strokeMiterlimit={10}
          strokeWidth={2}
        />
        {/* Button — pulses twice with the timeline */}
        <path
          id={`button${idSuffix}`}
          d="M142.7 214.1H80.5a1.2 1.2 0 0 1-1.2-1.2v-22.5a1.2 1.2 0 0 1 1.2-1.2h62.2a1.2 1.2 0 0 1 1.2 1.2v22.5a1.2 1.2 0 0 1-1.2 1.2"
          fill="#10a75f"
          fillRule="evenodd"
          opacity={buttonOpacity}
          style={{
            transform: `scale(${buttonScale})`,
            transformOrigin: "111.6px 201.65px",
            transformBox: "fill-box",
          }}
        />
        {/* Input field 1 — morphs to fake_text-4 line */}
        <FieldMorph
          progress={field1Morph}
          flip={flip}
          startD="M190.7 174.1H32.8a1.6 1.6 0 0 1-1.6-1.6V158a1.6 1.6 0 0 1 1.6-1.6h157.9a1.6 1.6 0 0 1 1.6 1.6v14.5a1.6 1.6 0 0 1-1.6 1.6"
          targetD="M31 158.8h160v9.48H31z"
          pivotX={111.6}
          pivotY={165.25}
        />
        <path
          id={`fake_text${idSuffix}`}
          fill="#cdd1d4"
          d="M31.1 138.7h144.3v9.48H31.1z"
          opacity={1 - fakeOut}
        />
        {/* Input field 2 — morphs to fake_text-6 line */}
        <FieldMorph
          progress={field2Morph}
          flip={flip}
          startD="M190.7 122.3H32.8a1.6 1.6 0 0 1-1.6-1.6v-14.5a1.6 1.6 0 0 1 1.6-1.6h157.9a1.6 1.6 0 0 1 1.6 1.6v14.5a1.6 1.6 0 0 1-1.6 1.6"
          targetD="M31 99.8h160v9.48H31z"
          pivotX={111.6}
          pivotY={113.45}
        />
        <path
          id={`fake_text-2${idSuffix}`}
          fill="#cdd1d4"
          d="M31.1 86.9H124v9.48H31.1z"
          opacity={1 - fake2Out}
        />
        {/* Input field 3 — morphs to top_text-2 banner */}
        <FieldMorph
          progress={field3Morph}
          flip={flip}
          startD="M190.7 70.5H32.8a1.6 1.6 0 0 1-1.6-1.6V54.4a1.6 1.6 0 0 1 1.6-1.6h157.9a1.6 1.6 0 0 1 1.6 1.6v14.5a1.6 1.6 0 0 1-1.6 1.6"
          targetD="M33.6 52.8h72.2v8H33.6z"
          pivotX={111.6}
          pivotY={61.65}
        />
        <path
          id={`fake_text-3${idSuffix}`}
          fill="#cdd1d4"
          d="M31.1 35.1h114.7v9.48H31.1z"
          opacity={1 - fake3Out}
        />
      </g>
      <g id={`r-2${idSuffix}`}>
        <g id={`fake_text_lines${idSuffix}`} fill="#cdd1d4">
          <path
            id={`fake_text-4${idSuffix}`}
            d="M31 158.8h160v9.48H31z"
            opacity={field1Morph}
          />
          <path
            id={`fake_text-5${idSuffix}`}
            d="M31 129.3h160v9.48H31z"
            opacity={fake5In}
          />
          <path
            id={`fake_text-6${idSuffix}`}
            d="M31 99.8h160v9.48H31z"
            opacity={field2Morph}
          />
        </g>
        <path
          id={`hr${idSuffix}`}
          fill="#e8e9ea"
          d="M13 79.8h196v1H13z"
          opacity={hrIn}
          style={{
            transform: `scale(${0.6 + 0.4 * hrIn})`,
            transformOrigin: "111px 80.3px",
            transformBox: "fill-box",
          }}
        />
        <path
          id={`top_text${idSuffix}`}
          fill="#cdd1d4"
          d="M115.7 52.8h55.2v8h-55.2z"
          opacity={topTextIn}
          style={{
            transform: `scale(${0.6 + 0.4 * topTextIn})`,
            transformOrigin: "143.3px 56.8px",
            transformBox: "fill-box",
          }}
        />
        <g id={`rachel_smith${idSuffix}`} fill="#cdd1d4">
          {RACHEL_SMITH_GLYPHS.map((d, i) => {
            const e = rachelStagger(i);
            return (
              <path
                key={i}
                d={d}
                opacity={e}
                style={{
                  transform: `scale(${0.3 + 0.7 * sineOut(e)})`,
                  transformOrigin: "65px 37px",
                  transformBox: "fill-box",
                }}
              />
            );
          })}
        </g>
      </g>
    </svg>
  );
};

// ──────────────────────────────────────────────────────────────────────────
// Demo 2 — Context-shifting (.demo2-1 / .demo2-2)
// The "yes" branch: marker grows into a panel containing the detailed house
// SVG. The "no" branch: a modal slams in below.
// ──────────────────────────────────────────────────────────────────────────

// The original 71.8×43.4 cottage SVG, verbatim.
const HouseSvg: React.FC<{ className?: string; style?: React.CSSProperties }> = ({
  className,
  style,
}) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    width="71.8"
    height="43.4"
    viewBox="0 0 71.8 43.4"
    style={style}
  >
    <title>context-house</title>
    <path d="M70 17.9H14.7a.4.4 0 0 0-.4.4v20.3a.4.4 0 0 0 .4.4H70a.4.4 0 0 0 .4-.4V18.4a.4.4 0 0 0-.4-.5z" fill="#cdd1d4" stroke="#869099" strokeMiterlimit={10} strokeWidth={2} />
    <path d="M67.5 6.2a.4.4 0 0 0-.4-.3H17.7a.4.4 0 0 0-.4.3l-3 11.6a.4.4 0 0 0 .1.4l.3.2H70l.3-.2a.4.4 0 0 0 .1-.4zM13.97 42.32l.007-4.5 56.82.1-.007 4.5z" fill="#b1b6bb" stroke="#869099" strokeMiterlimit={10} strokeWidth={2} />
    <path fill="#fff" stroke="#869099" strokeMiterlimit={10} strokeWidth={2} d="M21.334 32.244l.016-8.9 5.92.01-.016 8.9z" />
    <path fill="#869099" d="M20.04 33.45l.003-1.5 8.4.015-.002 1.5z" />
    <path d="M24.3 23.1a.4.4 0 0 0-.4.4v8.3a.45.45 0 1 0 .9 0v-8.3a.4.4 0 0 0-.5-.4z" fill="#869099" />
    <path d="M27 27.3h-5.6a.45.45 0 0 0 0 .9H27a.45.45 0 0 0 0-.9z" fill="#869099" />
    <path fill="#9dfcb2" d="M32 19.6H52.8l-10.4-7.2L32 19.6" />
    <path d="M53 19.2L42.6 12a.4.4 0 0 0-.5 0l-10.4 7.2a.412.412 0 0 0 .2.8h20.8a.427.427 0 0 0 .3-.8z" fill="#869099" />
    <path fill="#f5f6f7" stroke="#869099" strokeMiterlimit={10} strokeWidth={2} d="M34.2 19.8v22.6h16.3l.1-22.5-8.2-5.6-8.2 5.5z" />
    <path fill="#e8e9ea" stroke="#869099" strokeMiterlimit={10} strokeWidth={2} d="M21.034 9.808l.012-6.8 4.1.007-.012 6.8z" />
    <path fill="#b1b6bb" stroke="#869099" strokeMiterlimit={10} strokeWidth={2} d="M20.038 3l.004-2 5.96.01-.004 2z" />
    <path fill="#fff" stroke="#869099" strokeMiterlimit={10} strokeWidth={2} d="M39.366 32.244l.015-8.9 5.92.01-.014 8.9z" />
    <path fill="#fff" d="M43.7 30.1v-5.2h-2.2l2.2 5.2" />
    <path fill="#869099" d="M38.172 33.55l.003-1.5 8.4.015-.003 1.5z" />
    <path d="M42.4 23.2a.4.4 0 0 0-.4.4v8.3a.45.45 0 1 0 .9 0v-8.3a.4.4 0 0 0-.5-.4z" fill="#869099" />
    <path d="M45.1 27.3h-5.6a.45.45 0 0 0 0 .9h5.6a.45.45 0 0 0 0-.9z" fill="#869099" />
    <path fill="#fff" stroke="#869099" strokeMiterlimit={10} strokeWidth={2} d="M57.497 32.244l.016-8.9 5.92.01-.016 8.9z" />
    <path fill="#869099" d="M56.204 33.55l.002-1.5 8.4.015-.002 1.5z" />
    <path d="M60.5 23.2a.4.4 0 0 0-.4.4v8.3a.45.45 0 1 0 .9 0v-8.3a.4.4 0 0 0-.5-.4z" fill="#869099" />
    <path d="M63.2 27.4h-5.6a.45.45 0 0 0 0 .9h5.6a.45.45 0 0 0 0-.9zM5.4 33.1h1.2v9.56H5.4z" fill="#869099" />
    <path d="M1.4 28.4c-1.1 2.7-.4 5.6 2 8a3.5 3.5 0 0 0 5 0c2.4-2.4 3.1-5.3 2-8a4.9 4.9 0 0 0-9 0z" fill="#b1b6bb" />
    <path d="M10.5 28.4A4.8 4.8 0 0 0 6 25.3v12.2a3.5 3.5 0 0 0 2.5-1.1c2.3-2.4 3.1-5.3 2-8z" fill="#cdd1d4" />
    <path d="M1.4 28.4c-1.1 2.7-.4 5.6 2 8a3.5 3.5 0 0 0 5 0c2.4-2.4 3.1-5.3 2-8a4.9 4.9 0 0 0-9 0z" fill="none" stroke="#869099" strokeMiterlimit={10} strokeWidth={2} />
  </svg>
);

const ContextYes: React.FC<{ progress: number }> = ({ progress }) => {
  const t = progress;
  const begin3 = 0.20;
  const morph = ramp(t, begin3, begin3 + 0.15);
  const houseShow = ramp(t, begin3 + 0.1, begin3 + 0.5);
  const houseBkIn = ramp(t, begin3 + 0.1, begin3 + 0.3);
  const bar1In = ramp(t, begin3 + 0.2, begin3 + 0.4);
  const bar2In = ramp(t, begin3 + 0.3, begin3 + 0.5);

  const width = 14 + sineOut(morph) * (200 - 14);
  const height = 14 + sineOut(morph) * (65 - 14);
  const radius = 50 - sineOut(morph) * 48;
  const labelY = -22 - sineOut(morph) * 23;
  const labelX = sineOut(morph) * 10;

  return (
    <div className="demo">
      <div
        className="markerPrimary m1"
        id="t1"
        style={{
          width,
          height,
          borderRadius: radius,
          background: morph > 0 ? `rgba(255,255,255,${morph})` : "#10a75f",
          borderColor: morph > 0 ? "#ddd" : "rgba(255,255,255,0.7)",
        }}
      >
        <div className="movet2">$147k</div>
      </div>
      <div
        className="markerstem"
        style={{
          background: morph > 0 ? "white" : "#10a75f",
          width: 4 + sineOut(morph) * 4,
          height: 4 + sineOut(morph) * 4,
          borderColor: morph > 0 ? "#ddd" : "transparent",
          transform: `rotate(45deg) translate(-50%, -50%)`,
        }}
      />
      <div
        className="movet1"
        style={{
          transform: `translate(calc(-50% + ${labelX}px), calc(-50% + ${labelY}px))`,
          color: morph > 0 ? "#3b4144" : "white",
          background: morph > 0.4 ? "transparent" : "#2b2f33",
        }}
      >
        $147k
      </div>
      <div className="houseBk backgroundLowerlight" style={{ opacity: houseBkIn }} />
      <div className="greybar bar1 backgroundControls" style={{ opacity: bar1In }} />
      <div className="greybar bar2 backgroundControls" style={{ opacity: bar2In }} />
      <HouseSvg
        className="house"
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 72,
          transform: `translate(-50%, -50%) translate(-55px, -24px)`,
          opacity: houseShow,
          zIndex: 50,
        }}
      />
    </div>
  );
};

const ContextNo: React.FC<{ progress: number }> = ({ progress }) => {
  const t = progress;
  const begin4 = 0.20;
  const modalIn = ramp(t, begin4, begin4 + 0.1);
  const modalOut = ramp(t, begin4 + 1.25, begin4 + 1.35);
  const opacity = modalIn - modalOut;

  return (
    <div className="demo">
      <div className="markerPrimary">$147k</div>
      <div className="markerstem" />
      {opacity > 0 && (
        <div className="fakemodal" style={{ opacity }}>
          <i className="iconCancel typeLowlight floatRight">✕</i>
          <div className="movet3">$147k</div>
          <HouseSvg
            className="house2"
            style={{ width: 72, marginLeft: -40, marginTop: 4 }}
          />
          <div className="greybar bar3 backgroundControls" />
          <div className="greybar bar4 backgroundControls" />
        </div>
      )}
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────────────
// Demo 3 — Entrances and Exits (.demo3-1 / .demo3-2)
// Two stacks of four pie quadrants — verbatim path data from the original.
// "Yes" — Sine.easeOut, start {opacity:0, scale:0.9, rotation:50}.
// "No"  — Bounce.easeOut, start {opacity:0, scale:0, rotation:500}.
// ──────────────────────────────────────────────────────────────────────────

// Each pie quadrant is one verbatim path from the source SVG.
type PiePath = { d: string; fill: string };
const TOP_RED: PiePath[] = [
  { d: "M156.5 109.8L76.4 107c1.5-43.4 38.1-78.4 80.1-78.4v81.2z", fill: "#b51d02" },
  { d: "M157.1 109.8l81-5.7a81.2 81.2 0 0 1-162 11.3 67.6 67.6 0 0 1-.1-8.5z", fill: "#e13009" },
  { d: "M157.1 109.8l38.2-71.7a79.9 79.9 0 0 1 42.9 66z", fill: "#fbb100" },
  { d: "M156.5 109.8V28.6a79.8 79.8 0 0 1 39.1 9.5z", fill: "#fdd167" },
];
const BOTTOM_RED: PiePath[] = [
  { d: "M156.5 328.5l-74.7-31.7a80.2 80.2 0 0 1 74.7-49.5v81.2z", fill: "#b51d02" },
  { d: "M156.9 328.5l71.6-38.1a81.2 81.2 0 1 1-143.3 76.2c-12-22.5-13-46.4-3-69.8z", fill: "#e13009" },
  { d: "M156.9 328.5l19.6-78.8a79.1 79.1 0 0 1 52 40.7z", fill: "#fbb100" },
  { d: "M156.5 328.5v-81.2a74.9 74.9 0 0 1 19.6 2.4z", fill: "#fdd167" },
];
const TOP_GREEN: PiePath[] = [
  { d: "M375.8 109.8L307.7 154a81.2 81.2 0 0 1 23.8-112.3c13.8-8.9 26.4-12.8 42.8-13.1z", fill: "#004f3a" },
  { d: "M375.8 109.8l48.9 64.8a81.2 81.2 0 0 1-113.7-16l-3.3-4.6z", fill: "#10a75f" },
  { d: "M375.8 109.8l41.8-69.6a81.2 81.2 0 0 1 27.8 111.4 75.6 75.6 0 0 1-20.7 23z", fill: "#20c063" },
  { d: "M375.5 109.8l-1-81.2a81.5 81.5 0 0 1 42.8 11.6z", fill: "#2ed975" },
];
const BOTTOM_GREEN: PiePath[] = [
  { d: "M375.5 328.3l-27.6 76.1a81 81 0 0 1-48.4-103.8c11.7-32.2 41-53.3 76-53.3v81z", fill: "#004f3a" },
  { d: "M375.8 328.3l62 52.1c-22.5 26.8-56.8 36-89.7 24z", fill: "#10a75f" },
  { d: "M375.8 328.3l52.1-62c34.1 28.6 38.6 80 10 114.1z", fill: "#20c063" },
  { d: "M375.5 328.3v-81c20 0 36.5 5.9 52.1 18.9z", fill: "#2ed975" },
];

// Quadrant centroid for transform-origin (approximate centre of mass of each
// pie slice). Pulled from the source via the visual centre of each path.
const QUADRANT_CENTRES: ReadonlyArray<[number, number]> = [
  [156.5, 109.8],
  [156.5, 328.5],
  [375.5, 109.8],
  [375.5, 328.5],
];

const EntranceDemo: React.FC<{ progress: number; calm: boolean; idSuffix: string }> = ({
  progress,
  calm,
  idSuffix,
}) => {
  const stagger = 0.06;
  const begin5 = 0.20;

  const quadrants: PiePath[][] = [TOP_RED, BOTTOM_RED, TOP_GREEN, BOTTOM_GREEN];

  const barOneT = ramp(progress, begin5, begin5 + 0.5);
  const barTwoT = ramp(progress, begin5 + 0.1, begin5 + 0.6);
  const barOneE = calm ? sineOut(barOneT) : elasticOut(barOneT);
  const barTwoE = calm ? sineOut(barTwoT) : elasticOut(barTwoT);

  return (
    <div className="demo">
      <svg
        className={calm ? "entranceyes" : "entranceno"}
        xmlns="http://www.w3.org/2000/svg"
        width="484"
        height="436.5"
        viewBox="0 0 484 436.5"
      >
        <g className={calm ? "charts" : "charts2"}>
          {quadrants.map((quad, qi) => {
            const [cx, cy] = QUADRANT_CENTRES[qi];
            const ids = ["top-red", "bottom-red", "top-green", "bottom-green"];
            return (
              <g id={`${ids[qi]}${idSuffix}`} key={qi}>
                {quad.map((p, pi) => {
                  const idx = qi * 4 + pi;
                  const local = ramp(progress, begin5 + idx * stagger, begin5 + idx * stagger + 0.5);
                  const eased = calm ? sineOut(local) : bounceOut(local);
                  const scale = calm ? 0.9 + 0.1 * eased : eased;
                  const rot = calm ? 50 * (1 - eased) : 500 * (1 - eased);
                  return (
                    <path
                      key={pi}
                      d={p.d}
                      fill={p.fill}
                      opacity={eased}
                      style={{
                        transform: `rotate(${rot}deg) scale(${scale})`,
                        transformOrigin: `${cx}px ${cy}px`,
                        transformBox: "fill-box",
                      }}
                    />
                  );
                })}
              </g>
            );
          })}
        </g>
        <path
          fill="none"
          stroke="#b1b6bb"
          strokeMiterlimit={10}
          d="M483.5 436H.5V.5h483V436zM265.8 436V.5M48 436V.5M.5 218.3h483"
        />
        <path
          id={`bbone${idSuffix}`}
          fill="#cdd1d4"
          d="M14.5 22.7h20v176.6h-20z"
          opacity={barOneE}
          style={{
            transform: calm
              ? `scale(${0.9 + 0.1 * barOneE}, 1)`
              : `scale(${barOneE}, ${barOneE})`,
            transformOrigin: calm ? "24.5px 22.7px" : "24.5px 110.5px",
            transformBox: "fill-box",
          }}
        />
        <path
          id={`bbtwo${idSuffix}`}
          fill="#cdd1d4"
          d="M14.5 239.5h20v176.6h-20z"
          opacity={barTwoE}
          style={{
            transform: calm
              ? `scale(${0.9 + 0.1 * barTwoE}, 1)`
              : `scale(${barTwoE}, ${barTwoE})`,
            transformOrigin: calm ? "24.5px 239.5px" : "24.5px 328.5px",
            transformBox: "fill-box",
          }}
        />
      </svg>
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────────────
// Demo 4 — Developer Standards (.dev-yes / .dev-no)
// A 300.6×245.2 stage with a coloured cottage, two wind turbines, a washer
// with an Energy Star badge, three bar groups, six "%" labels, nine text
// stubs, and two faint #009245 accent lines. The "Start" button hits orange
// then disappears; the .dev-yes content fades in right after, the .dev-no
// content fades in noticeably later — that's the lesson.
// ──────────────────────────────────────────────────────────────────────────

const DevDemo: React.FC<{ progress: number; fast: boolean; idSuffix: string }> = ({
  progress,
  fast,
  idSuffix,
}) => {
  const t = progress;

  // Button press anchored at +0.75 of the local timeline (normalised here to
  // 0.25). For .dev-no the reveal lags by a further 0.10 — the "stuck" feel.
  const buttonHit = ramp(t, 0.25, 0.28);
  const buttonOut = ramp(t, 0.28, 0.32);
  const stageReveal = ramp(t, fast ? 0.30 : 0.40, fast ? 0.36 : 0.48);

  const begin7 = fast ? 0.36 : 0.48;
  const washer = ramp(t, begin7, begin7 + 0.1);
  const wind = ramp(t, begin7 + 0.1, begin7 + 0.2);
  const house = ramp(t, begin7 + 0.2, begin7 + 0.3);
  const bars1At = (i: number) =>
    ramp(t, begin7 + i * 0.03, begin7 + 0.18 + i * 0.03);
  const bars2At = (i: number) =>
    ramp(t, begin7 + 0.2 + i * 0.03, begin7 + 0.38 + i * 0.03);
  const bars3At = (i: number) =>
    ramp(t, begin7 + 0.4 + i * 0.03, begin7 + 0.58 + i * 0.03);
  const percentAt = (i: number) =>
    ramp(t, begin7 + 0.2 + i * 0.04, begin7 + 0.35 + i * 0.04);
  const textAt = (i: number) =>
    ramp(t, begin7 + i * 0.04, begin7 + 0.15 + i * 0.04);

  // Geometry shared between the three bar groups.
  const barRow = (yTop: number, opacityFn: (i: number) => number) => {
    const lengths = [50, 62, 78];
    const xStart = 196.1;
    return lengths.flatMap((len, i) => {
      const opacity = opacityFn(i);
      const eased = sineOut(opacity);
      return [
        <path
          key={`top-${i}`}
          d={`M${xStart} ${yTop}h${len}v6h-${len}z`}
          fill="#20c063"
          opacity={opacity}
          style={{
            transform: `scale(${eased}, 1)`,
            transformOrigin: `${xStart}px ${yTop + 3}px`,
            transformBox: "fill-box",
          }}
        />,
        <path
          key={`bot-${i}`}
          d={`M${xStart} ${yTop + 7}h${len}v6h-${len}z`}
          fill="#00d2a9"
          opacity={opacity}
          style={{
            transform: `scale(${eased}, 1)`,
            transformOrigin: `${xStart}px ${yTop + 10}px`,
            transformBox: "fill-box",
          }}
        />,
      ];
    });
  };

  return (
    <div className="demo">
      <div className="devStage" />
      <div
        className={fast ? "devYesStart" : "devNoStart"}
        style={{
          background: buttonHit > 0 ? "#ff7857" : "#20c063",
          borderColor: buttonHit > 0 ? "#ff7857" : "#20c063",
          transform: `scale(${1 + 0.15 * sineOut(buttonHit)})`,
          opacity: 1 - buttonOut,
        }}
      >
        Start
      </div>
      <svg
        className={fast ? "dev-yes" : "dev-no"}
        xmlns="http://www.w3.org/2000/svg"
        width="300.6"
        height="245.2"
        viewBox="0 0 300.6 245.2"
        style={{ opacity: stageReveal, position: "relative" }}
      >
        {/* Faint horizontal accents */}
        <line x1={20} y1={73} x2={285} y2={73} stroke="#009245" strokeOpacity={0.2} />
        <line x1={20} y1={170} x2={285} y2={170} stroke="#009245" strokeOpacity={0.2} />

        {/* ── Washer ─────────────────────────────────────────────────── */}
        <g
          id={`washer${idSuffix}`}
          opacity={washer}
          style={{
            transform: `scale(${0.9 + 0.1 * washer})`,
            transformOrigin: "112px 132px",
            transformBox: "fill-box",
          }}
        >
          {/* Body */}
          <rect x={92} y={107.31} width={39.3} height={49.69} rx={3} ry={3} fill="#fff" stroke="#869099" strokeWidth={1} />
          {/* Control panel */}
          <rect x={94} y={110} width={35.3} height={6.2} fill="#e8e9ea" />
          <circle cx={98} cy={113.1} r={1.2} fill="#869099" />
          <circle cx={103} cy={113.1} r={1.2} fill="#cdd1d4" />
          {/* Drum outer */}
          <circle cx={111.65} cy={132.6} r={11.9} fill="#cdd1d4" stroke="#869099" strokeWidth={1} />
          {/* Drum inner */}
          <circle cx={111.65} cy={132.6} r={9.1} fill="#5c6972" />
          <circle cx={111.65} cy={132.6} r={6.4} fill="#3f4951" />
          {/* Knobs */}
          <circle cx={123} cy={113.1} r={1.6} fill="#b1b6bb" />
          <circle cx={126.5} cy={113.1} r={1.6} fill="#b1b6bb" />
          {/* Energy Star badge — pentagonal-ish in the source */}
          <path
            d="M127.8 119.5l3.4 2.2-1.3 3.9-4.1.05-1.3-3.9 3.4-2.25z"
            fill="#20c063"
            stroke="#0f7a3d"
            strokeWidth={0.4}
          />
          <text
            x={127.8}
            y={124}
            fontSize={3}
            fontFamily="Helvetica, sans-serif"
            fontWeight={700}
            fill="#fff"
            textAnchor="middle"
          >
            ★
          </text>
        </g>

        {/* ── Wind turbines ──────────────────────────────────────────── */}
        <g
          id={`wind${idSuffix}`}
          opacity={wind}
          style={{
            transform: `scale(${0.9 + 0.1 * wind})`,
            transformOrigin: "55px 100px",
            transformBox: "fill-box",
          }}
        >
          {/* Grass slope at base */}
          <path d="M20 158 L94 158 L88 152 L26 152 Z" fill="#03ed86" opacity={0.55} />

          {/* Tower A */}
          <g>
            {/* Tapered post — lighter side */}
            <path d="M40.5 60 L42.5 60 L46 156 L37 156 Z" fill="#8eb9bc" />
            {/* Shadow side */}
            <path d="M41.5 60 L42.5 60 L46 156 L41.5 156 Z" fill="#72a4a5" />
            {/* Nacelle */}
            <ellipse cx={41.5} cy={60} rx={3} ry={2.4} fill="#5d9e9d" />
            {/* Three blades meeting at hub */}
            <g style={{ transformOrigin: "41.5px 60px", transformBox: "fill-box" }}>
              {/* Blade 1 — up */}
              <path d="M41.5 60 L40.5 30 L42.5 30 Z" fill="#8eb9bc" />
              <path d="M40.5 30 L42.5 30 L41.5 26 Z" fill="#ff7857" />
              {/* Blade 2 — lower-right */}
              <path d="M41.5 60 L66 76 L65 78 Z" fill="#8eb9bc" />
              <path d="M66 76 L68 75 L65 78 Z" fill="#f74a27" />
              {/* Blade 3 — lower-left */}
              <path d="M41.5 60 L18 76 L19 78 Z" fill="#72a4a5" />
              <path d="M18 76 L16 75 L19 78 Z" fill="#ff7857" />
            </g>
            <circle cx={41.5} cy={60} r={1.6} fill="#3f5069" />
          </g>

          {/* Tower B */}
          <g>
            <path d="M75.5 80 L77.5 80 L80 156 L72 156 Z" fill="#8eb9bc" />
            <path d="M76.5 80 L77.5 80 L80 156 L76.5 156 Z" fill="#72a4a5" />
            <ellipse cx={76.5} cy={80} rx={2.6} ry={2} fill="#5d9e9d" />
            <g style={{ transformOrigin: "76.5px 80px", transformBox: "fill-box" }}>
              <path d="M76.5 80 L75.5 56 L77.5 56 Z" fill="#8eb9bc" />
              <path d="M75.5 56 L77.5 56 L76.5 52 Z" fill="#ff7857" />
              <path d="M76.5 80 L96 92 L95 94 Z" fill="#8eb9bc" />
              <path d="M96 92 L98 91 L95 94 Z" fill="#f74a27" />
              <path d="M76.5 80 L57 92 L58 94 Z" fill="#72a4a5" />
              <path d="M57 92 L55 91 L58 94 Z" fill="#ff7857" />
            </g>
            <circle cx={76.5} cy={80} r={1.4} fill="#3f5069" />
          </g>
        </g>

        {/* ── Cottage house ─────────────────────────────────────────── */}
        <g
          id={`house${idSuffix}`}
          opacity={house}
          style={{
            transform: `scale(${0.9 + 0.1 * house})`,
            transformOrigin: "55px 200px",
            transformBox: "fill-box",
          }}
        >
          {/* Grass strip */}
          <rect x={14} y={224} width={140} height={14} fill="#7fb141" />

          {/* Walkway — dotted zigzag */}
          <path
            d="M30 238 L42 232 L54 238 L66 232 L78 238 L90 232 L102 238"
            stroke="#00c767"
            strokeWidth={1.2}
            strokeDasharray="3 3"
            fill="none"
          />

          {/* Roof — main */}
          <path d="M22 200 L55 174 L88 200 Z" fill="#be574d" />
          {/* Roof — gable end */}
          <path d="M22 200 L36 200 L36 184 Z" fill="#f27350" />
          {/* Roof ridge cap */}
          <path d="M22 200 L88 200 L84 203 L26 203 Z" fill="#3f5069" />

          {/* Walls */}
          <rect x={28} y={200} width={56} height={24} fill="#f27350" />

          {/* Door */}
          <rect x={50} y={208} width={11} height={16} fill="#155e71" />
          <circle cx={58.5} cy={216} r={0.8} fill="#5d9e9d" />

          {/* Left window */}
          <rect x={33} y={206} width={10} height={8} fill="#4c8684" />
          <line x1={38} y1={206} x2={38} y2={214} stroke="#fdf167" strokeWidth={0.4} />
          <line x1={33} y1={210} x2={43} y2={210} stroke="#fdf167" strokeWidth={0.4} />
          {/* Right window */}
          <rect x={69} y={206} width={10} height={8} fill="#4c8684" />
          <line x1={74} y1={206} x2={74} y2={214} stroke="#fdf167" strokeWidth={0.4} />
          <line x1={69} y1={210} x2={79} y2={210} stroke="#fdf167" strokeWidth={0.4} />

          {/* Window frame trim */}
          <rect x={33} y={206} width={10} height={8} fill="none" stroke="#be574d" strokeWidth={0.6} />
          <rect x={69} y={206} width={10} height={8} fill="none" stroke="#be574d" strokeWidth={0.6} />

          {/* Mailbox */}
          <rect x={94} y={216} width={1.4} height={10} fill="#83694e" />
          <rect x={91} y={212} width={7} height={4} fill="#a48a6c" />
          <rect x={91} y={212} width={7} height={4} fill="none" stroke="#83694e" strokeWidth={0.3} />

          {/* Bushes */}
          <circle cx={25} cy={224} r={3.5} fill="#b0d364" />
          <circle cx={29} cy={222} r={3} fill="#b0d364" />
          <circle cx={86} cy={222} r={3} fill="#b0d364" />
          <circle cx={90} cy={224} r={3.5} fill="#b0d364" />
        </g>

        {/* ── Bars ──────────────────────────────────────────────────── */}
        <g id={`bars1${idSuffix}`}>{barRow(38, bars1At)}</g>
        <g id={`bars2${idSuffix}`}>{barRow(110, bars2At)}</g>
        <g id={`bars3${idSuffix}`}>{barRow(190, bars3At)}</g>

        {/* ── Percent labels ────────────────────────────────────────── */}
        <g id={`percent${idSuffix}`} fontFamily="Helvetica, sans-serif" fontWeight={700}>
          {[
            { x: 240, y: 47, label: "37%" },
            { x: 263, y: 47, label: "29%" },
            { x: 240, y: 119, label: "44%" },
            { x: 263, y: 119, label: "12%" },
            { x: 240, y: 199, label: "61%" },
            { x: 263, y: 199, label: "9%" },
          ].map((p, i) => (
            <text
              key={i}
              x={p.x}
              y={p.y}
              fontSize={6}
              fill="#fff"
              opacity={percentAt(i)}
            >
              {p.label}
            </text>
          ))}
        </g>

        {/* ── Text stubs (3 groups of 3) ────────────────────────────── */}
        <g id={`text${idSuffix}`}>
          {[
            ...[0, 1, 2].map((i) => ({ x: 196.1, y: 25 + i * 3, w: [22, 18, 14][i], idx: i })),
            ...[0, 1, 2].map((i) => ({ x: 196.1, y: 97 + i * 3, w: [22, 18, 14][i], idx: 3 + i })),
            ...[0, 1, 2].map((i) => ({ x: 196.1, y: 177 + i * 3, w: [22, 18, 14][i], idx: 6 + i })),
          ].map((r, i) => (
            <path
              key={i}
              d={`M${r.x} ${r.y}h${r.w}v2h-${r.w}z`}
              fill="#cdd1d4"
              opacity={textAt(r.idx)}
            />
          ))}
        </g>
      </svg>
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────────────
// Section shell + composition
// ──────────────────────────────────────────────────────────────────────────

const DemoOverlay: React.FC<{ ok: boolean; opacity: number; cls: string }> = ({
  ok,
  opacity,
  cls,
}) => (
  <div className={`demoOverlay ${cls}`} style={{ opacity }}>
    <div className="iconContainer">{ok ? "✓" : "✕"}</div>
    <i className="play">▶</i>
  </div>
);

const Section: React.FC<{
  copy: SectionCopy;
  index: number;
  yesOverlay: number;
  noOverlay: number;
  yesContent: React.ReactNode;
  noContent: React.ReactNode;
}> = ({ copy, index, yesOverlay, noOverlay, yesContent, noContent }) => (
  <section id={copy.id}>
    <div className="row">
      <div className="col-md-1">
        <div className="number">{copy.number}</div>
      </div>
      <div className="col-md-2">
        <div className="explainContain backgroundLowerlight sectTitle typeLowlight">
          <pre>{copy.explain}</pre>
        </div>
      </div>
      <div className="col-md-4">
        <div className="yes">
          {yesContent}
          <DemoOverlay ok opacity={yesOverlay} cls={`demo${index + 1}-1`} />
        </div>
      </div>
      <div className="col-md-4">
        <div className="no">
          {noContent}
          <DemoOverlay ok={false} opacity={noOverlay} cls={`demo${index + 1}-2`} />
        </div>
      </div>
      <div className="col-md-1" />
    </div>
    <div className="row">
      <div className="col-md-1" />
      <div className="col-md-1" />
      <div className="col-md-8">
        <div className="descContain description">
          <h1>{copy.title}</h1>
          <div className="hrSide" />
          <p style={{ marginTop: 24 }}>{copy.description}</p>
        </div>
      </div>
      <div className="col-md-2" />
    </div>
  </section>
);

export const FluidMotion: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = frame / Math.max(1, durationInFrames - 1);
  const scrollProgress = easeScroll(Math.max(0, Math.min(1, t)));
  const scrollY = scrollProgress * (PAGE_H - VIEW_H);

  // Each section's local timeline begins when it crosses ~60% of the viewport
  // and runs over ~2.5 s. Both .yes and .no follow the same local progress so
  // they play together as the camera passes through.
  const sectionLocals = SECTIONS.map((_, i) => {
    const topPx = 200 + i * SECTION_HEIGHT;
    const enter = topPx - VIEW_H * 0.6;
    const finish = topPx - VIEW_H * 0.1;
    if (scrollY < enter) return 0;
    if (scrollY > finish + 400) return 1;
    return Math.max(0, Math.min(1, (scrollY - enter) / Math.max(1, finish - enter)));
  });

  const activeIdx = sectionLocals.reduce(
    (acc, p, i) => (p > 0.1 ? i : acc),
    0,
  );

  // Overlay envelope: opaque until 0.05, fades to 0 by 0.15, returns by 0.95.
  const overlayFor = (p: number) => {
    if (p < 0.05) return 0.97;
    if (p < 0.15) return interpolate(p, [0.05, 0.15], [0.97, 0]);
    if (p < 0.85) return 0;
    return interpolate(p, [0.85, 0.95], [0, 0.97], {
      extrapolateRight: "clamp",
    });
  };

  return (
    <AbsoluteFill style={{ background: "#f0f1f2", overflow: "hidden" }}>
      <style>{STYLE}</style>

      <div className="fluid-page" style={{ width: VIEW_W, height: VIEW_H, position: "relative" }}>
        <div className="fluid-behind">Fluid Motion</div>
        <SideNav activeIdx={activeIdx} />

        <div
          className="containerFluid backgroundLowerlight"
          id="wrapper"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            transform: `translateY(${-scrollY}px)`,
            willChange: "transform",
            minHeight: PAGE_H,
          }}
        >
          {SECTIONS.map((copy, i) => {
            const p = sectionLocals[i];
            const overlay = overlayFor(p);
            let yesContent: React.ReactNode;
            let noContent: React.ReactNode;

            switch (i) {
              case 0:
                yesContent = <ResumeMorph progress={p} flip={false} idSuffix="" />;
                noContent = <ResumeMorph progress={p} flip idSuffix="n" />;
                break;
              case 1:
                yesContent = <ContextYes progress={p} />;
                noContent = <ContextNo progress={p} />;
                break;
              case 2:
                yesContent = <EntranceDemo progress={p} calm idSuffix="" />;
                noContent = <EntranceDemo progress={p} calm={false} idSuffix="n" />;
                break;
              case 3:
              default:
                yesContent = <DevDemo progress={p} fast idSuffix="" />;
                noContent = <DevDemo progress={p} fast={false} idSuffix="n" />;
            }

            return (
              <Section
                key={copy.id}
                copy={copy}
                index={i}
                yesOverlay={overlay}
                noOverlay={overlay}
                yesContent={
                  <div className="demo" style={{ position: "absolute", inset: 0 }}>
                    {yesContent}
                  </div>
                }
                noContent={
                  <div className="demo" style={{ position: "absolute", inset: 0 }}>
                    {noContent}
                  </div>
                }
              />
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
