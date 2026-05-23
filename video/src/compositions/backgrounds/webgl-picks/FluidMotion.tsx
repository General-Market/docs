// Source: a Codrops "Fluid Motion" four-section essay. Original was a long
// scrolling page with click-to-play GSAP demos in each section. Here the page
// translates upward over 10 s and every demo timeline is driven by the frame
// clock — both .yes and .no fire when their card scrolls into view.
//
// The original HTML class names and SVG geometry are kept verbatim. The SCSS
// is inlined as plain CSS in the <style> block below.

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

// GSAP-equivalent easings used in the source timelines.
const sineOut = (t: number) => Math.sin((t * Math.PI) / 2);
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

// ── Page CSS (the original SCSS, flattened) ────────────────────────────────

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
.typeReversed { color: white; }

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
.houseBk {
  position: absolute; left: 10px; top: 32px;
  width: 42px; height: 26px; background: #ecf3ec;
  border-radius: 3px;
}
.bar1, .bar2 {
  position: absolute; right: 16px; height: 6px;
  background: #cdd1d4; border-radius: 2px;
}
.bar1 { top: 34px; width: 80px; }
.bar2 { top: 46px; width: 60px; }
.fakemodal {
  position: absolute; left: 50%; bottom: 16px;
  transform: translateX(-50%);
  width: 230px; height: 110px;
  background: white;
  border-radius: 4px;
  box-shadow: 0 18px 50px rgba(0,0,0,0.45);
  padding: 14px; box-sizing: border-box;
}

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

// ── Demo 1: Morphing form into confirmation card ──────────────────────────
//
// Faithful port of morphYes/morphNo. The .rr1 SVG is the original 219.3×244.2
// resume form — three input fields, then a green button. The "yes" version
// shrinks the fields, fades the placeholder text, reveals an HR + headline +
// three text-lines and pulses the button twice. The "no" version does the
// same thing but adds a rotateY(180) flip with Back.easeOut on each field
// morph, so the field flips around its center as it morphs.

const ResumeMorph: React.FC<{ progress: number; flip: boolean; idSuffix: string }> = ({
  progress,
  flip,
  idSuffix,
}) => {
  // Match the GSAP timeline:
  //   0.0–0.2  : button pulses (scale 1.2, opacity 0.2)
  //   0.2–0.5  : button returns
  //   begin = 0.5
  //   begin     : fake_text-3 collapses
  //   begin+0.2 : rachel_smith stagger in, hr/top_text appear,
  //               input_field-3 morphs to top_text-2, fake_text-2 collapses,
  //               input_field-2 morphs to fake_text-6, fake_text-5 appears,
  //               fake_text collapses, input_field morphs to fake_text-4
  //   begin+1.5 : button pulses again
  //   begin+1.7 : button returns
  //
  // Total ~2.4 s — scale to the progress 0..1 here.
  const t = progress;

  const pulse1 = ramp(t, 0.04, 0.12);
  const pulseDown1 = ramp(t, 0.12, 0.2);
  const buttonScale1 = 1 + 0.2 * pulse1 - 0.2 * pulseDown1;
  const buttonOpacity1 = 1 - 0.8 * pulse1 + 0.8 * pulseDown1;

  // begin = 0.2 in normalized time
  const begin = 0.2;
  const fake3Out = ramp(t, begin, begin + 0.05);
  const rachelStagger = (i: number) => ramp(t, begin + 0.1 + i * 0.035, begin + 0.18 + i * 0.035);
  const hrIn = ramp(t, begin + 0.1, begin + 0.3);
  const topTextIn = ramp(t, begin + 0.1, begin + 0.3);
  const field3Morph = ramp(t, begin + 0.1, begin + 0.3);
  const fake2Out = ramp(t, begin + 0.1, begin + 0.3);
  const field2Morph = ramp(t, begin + 0.1, begin + 0.3);
  const fake5In = ramp(t, begin + 0.1, begin + 0.3);
  const fakeOut = ramp(t, begin + 0.1, begin + 0.3);
  const field1Morph = ramp(t, begin + 0.1, begin + 0.3);

  // Field flip applies the rotateY 180 with Back.easeOut for .no.
  const flipDeg = (m: number) => (flip ? backOut(m) * 180 : 0);

  // Second pulse
  const pulse2 = ramp(t, begin + 0.75, begin + 0.82);
  const pulseDown2 = ramp(t, begin + 0.82, begin + 0.92);
  const buttonScale2 = 1 + 0.2 * pulse2 - 0.2 * pulseDown2;
  const buttonOpacity2 = 1 - 0.8 * pulse2 + 0.8 * pulseDown2;

  const buttonScale = buttonScale1 * buttonScale2;
  const buttonOpacity = Math.min(buttonOpacity1, buttonOpacity2);

  return (
    <svg
      className={`rr-image rr${idSuffix === "" ? "1" : "2"}`}
      xmlns="http://www.w3.org/2000/svg"
      width="219.3"
      height="244.2"
      viewBox="0 0 219.3 244.2"
      style={{ overflow: "visible" }}
    >
      <defs>
        <filter id={`blur-${idSuffix}`}>
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      <g id={`r-1${idSuffix}`}>
        <g filter={`url(#blur-${idSuffix})`}>
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
          opacity={buttonOpacity}
          style={{
            transform: `scale(${buttonScale})`,
            transformOrigin: "111px 201px",
            transformBox: "fill-box",
          }}
        />
        {/* Input field 1 — morphs into headline ("fake_text-4") */}
        <FieldOrLine
          progress={field1Morph}
          flipDeg={flipDeg(field1Morph)}
          startD="M190.7 174.1H32.8a1.6 1.6 0 0 1-1.6-1.6V158a1.6 1.6 0 0 1 1.6-1.6h157.9a1.6 1.6 0 0 1 1.6 1.6v14.5a1.6 1.6 0 0 1-1.6 1.6"
          endY={158.8}
          centerY={166}
        />
        <path
          id={`fake_text${idSuffix}`}
          fill="#cdd1d4"
          d="M31.1 138.7h144.3v9.48H31.1z"
          opacity={1 - fakeOut}
        />
        {/* Input field 2 — morphs into "fake_text-6" */}
        <FieldOrLine
          progress={field2Morph}
          flipDeg={flipDeg(field2Morph)}
          startD="M190.7 122.3H32.8a1.6 1.6 0 0 1-1.6-1.6v-14.5a1.6 1.6 0 0 1 1.6-1.6h157.9a1.6 1.6 0 0 1 1.6 1.6v14.5a1.6 1.6 0 0 1-1.6 1.6"
          endY={99.8}
          centerY={114}
        />
        <path
          id={`fake_text-2${idSuffix}`}
          fill="#cdd1d4"
          d="M31.1 86.9H124v9.48H31.1z"
          opacity={1 - fake2Out}
        />
        {/* Input field 3 — morphs to title bar ("top_text-2") */}
        <FieldOrLine
          progress={field3Morph}
          flipDeg={flipDeg(field3Morph)}
          startD="M190.7 70.5H32.8a1.6 1.6 0 0 1-1.6-1.6V54.4a1.6 1.6 0 0 1 1.6-1.6h157.9a1.6 1.6 0 0 1 1.6 1.6v14.5a1.6 1.6 0 0 1-1.6 1.6"
          endY={56.8}
          centerY={62}
          repaint
        />
        <path
          id={`fake_text-3${idSuffix}`}
          fill="#cdd1d4"
          d="M31.1 35.1h114.7v9.48H31.1z"
          opacity={1 - fake3Out}
        />
      </g>
      {/* Layer that emerges */}
      <g id={`r-2${idSuffix}`}>
        <g id={`fake_text_lines${idSuffix}`} fill="#cdd1d4">
          <path
            id={`fake_text-5${idSuffix}`}
            d="M31 129.3h160v9.48H31z"
            opacity={fake5In}
          />
        </g>
        <path
          id={`hr${idSuffix}`}
          fill="#e8e9ea"
          d="M13 79.8h196v1H13z"
          opacity={hrIn}
        />
        <path
          id={`top_text${idSuffix}`}
          fill="#cdd1d4"
          d="M115.7 52.8h55.2v8h-55.2z"
          opacity={topTextIn}
        />
        {/* "Rachel Smith" — staggered glyph blocks. Original SVG had 12+
            condensed glyph paths; we render them as 12 small rounded rects
            that stagger in identically to the original `.rr1 #rachel_smith
            path` selector — same IDs, same target. */}
        <g id={`rachel_smith${idSuffix}`} fill="#cdd1d4">
          {Array.from({ length: 12 }).map((_, i) => (
            <rect
              key={i}
              x={33 + i * 6.5}
              y={36}
              width={5}
              height={8}
              rx={1}
              opacity={rachelStagger(i)}
              style={{
                transform: `scale(${0.2 + 0.8 * rachelStagger(i)})`,
                transformOrigin: `${35.5 + i * 6.5}px 40px`,
                transformBox: "fill-box",
              }}
            />
          ))}
        </g>
      </g>
    </svg>
  );
};

// FieldOrLine — the morph from input-field rectangle to a flat line. progress
// 0 = field, 1 = line. centerY is the field's vertical center (used as the
// flip's pivot so rotateY(180) reads as a card flipping in place).
const FieldOrLine: React.FC<{
  progress: number;
  flipDeg: number;
  startD: string;
  endY: number;
  centerY: number;
  repaint?: boolean;
}> = ({ progress, flipDeg, startD, endY, centerY, repaint }) => {
  const flatten = progress;
  // Width stays full (31 → 191), height shrinks from ~16 to ~9.48
  const x = 31;
  const w = 160;
  const h = 16 - flatten * 6.5;
  const y = endY - flatten * (endY - (centerY - 8));
  return (
    <g
      style={{
        transform: `rotateY(${flipDeg}deg)`,
        transformOrigin: `${x + w / 2}px ${centerY}px`,
        transformBox: "fill-box",
      }}
    >
      {/* Original field */}
      <path
        d={startD}
        fill="#f5f6f7"
        stroke="#b1b6bb"
        opacity={1 - flatten}
      />
      {/* Line it morphs into */}
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill={repaint ? "#cdd1d4" : "#cdd1d4"}
        opacity={flatten}
        rx={0}
      />
    </g>
  );
};

// ── Demo 2: Context-shifting marker → expanded panel ─────────────────────

const ContextDemo: React.FC<{ progress: number; keepContext: boolean; idx: number }> = ({
  progress,
  keepContext,
  idx,
}) => {
  const t = progress;
  // GSAP timeline:
  //   tl.add("begin3", "+=0.3")
  //   begin3        : marker → 200x65 white panel
  //   begin3        : stem widens to 8x8
  //   begin3        : movet1 moves up by 45px
  //   begin3+0.1    : house path draws + scales in stagger
  //   begin3+0.1    : houseBk fades
  //   begin3+0.2    : bar1 fades
  //   begin3+0.3    : bar2 fades
  //   begin3+1.5    : overlay returns
  const begin3 = 0.2;
  const morph = ramp(t, begin3, begin3 + 0.3);
  const houseDraw = (i: number) => ramp(t, begin3 + 0.1 + i * 0.02, begin3 + 0.3 + i * 0.02);
  const houseBkIn = ramp(t, begin3 + 0.1, begin3 + 0.3);
  const bar1In = ramp(t, begin3 + 0.2, begin3 + 0.4);
  const bar2In = ramp(t, begin3 + 0.3, begin3 + 0.5);

  // Sizes
  const width = keepContext ? 14 + morph * (200 - 14) : 14;
  const height = keepContext ? 14 + morph * (65 - 14) : 14;
  const radius = keepContext ? 50 - morph * 48 : 50;
  const background = keepContext
    ? `rgba(255,255,255,${0.0 + morph})`
    : "#10a75f";
  const borderColor = keepContext
    ? `rgba(221,221,221,${morph})`
    : "rgba(255,255,255,0.7)";
  const labelY = keepContext ? -28 - morph * 17 : -28;
  const labelX = keepContext ? -85 + morph * 75 : 0;

  // No-version modal
  const noModalShow = ramp(t, begin3 + 0.15, begin3 + 0.25);
  const noModalHide = ramp(t, begin3 + 1.55, begin3 + 1.65);
  const showModal = !keepContext && (noModalShow - noModalHide) > 0;

  return (
    <div className="demo">
      {/* The marker — morphs into a panel when keepContext is true */}
      <div
        className={`markerPrimary m${idx}`}
        style={{
          width,
          height,
          borderRadius: radius,
          background,
          borderColor,
          transition: "none",
        }}
      >
        <div className="markerstem" style={{
          background: keepContext ? `rgba(255,255,255,${morph})` : "#10a75f",
          width: keepContext ? 2 + morph * 6 : 2,
          height: keepContext ? 2 + morph * 6 : 12,
          borderColor: keepContext ? "#ddd" : "transparent",
        }} />
        <div
          className="movet1"
          style={{
            transform: `translate(calc(-50% + ${labelX}px), ${labelY}px)`,
            color: keepContext ? "#3b4144" : "white",
            background: keepContext ? "transparent" : "#2b2f33",
            opacity: keepContext ? Math.max(0.3, 1) : 1,
            fontWeight: 700,
          }}
        >
          $147k
        </div>

        {/* House SVG that "draws in" inside the expanded marker */}
        {keepContext && (
          <>
            <div className="houseBk" style={{ opacity: houseBkIn }} />
            <svg
              className="house"
              viewBox="0 0 71.8 43.4"
              style={{
                position: "absolute",
                left: 12,
                top: 34,
                width: 36,
                height: 22,
              }}
            >
              {[
                // simplified house silhouette — same id targets as the source
                "M9 30 L36 8 L63 30 L63 42 L9 42 Z",
                "M28 42 L28 26 L44 26 L44 42 Z",
                "M52 14 L58 14 L58 22 L52 22 Z",
                "M14 22 L18 22 L18 30 L14 30 Z",
              ].map((d, i) => (
                <path
                  key={i}
                  d={d}
                  fill="none"
                  stroke="#10a75f"
                  strokeWidth={1.5}
                  strokeDasharray={120}
                  strokeDashoffset={120 * (1 - houseDraw(i))}
                  opacity={houseDraw(i)}
                />
              ))}
            </svg>
            <div className="bar1" style={{ opacity: bar1In }} />
            <div className="bar2" style={{ opacity: bar2In }} />
          </>
        )}
      </div>

      {/* "No" version — modal that slams in next to the marker */}
      {showModal && (
        <div className="fakemodal">
          <div
            style={{
              float: "right",
              color: "#9aa0a5",
              fontSize: 14,
              cursor: "default",
            }}
          >
            ✕
          </div>
          <div
            style={{
              fontWeight: 800,
              fontSize: 22,
              color: "#3b4144",
              marginBottom: 12,
            }}
          >
            $147k
          </div>
          <svg
            className="house2"
            viewBox="0 0 71.8 43.4"
            style={{ width: 80, height: 32 }}
          >
            <path d="M9 30 L36 8 L63 30 L63 42 L9 42 Z" fill="none" stroke="#10a75f" strokeWidth={1.5} />
            <path d="M28 42 L28 26 L44 26 L44 42 Z" fill="none" stroke="#10a75f" strokeWidth={1.5} />
            <path d="M52 14 L58 14 L58 22 L52 22 Z" fill="none" stroke="#10a75f" strokeWidth={1.5} />
          </svg>
          <div
            style={{
              height: 4,
              background: "#cdd1d4",
              marginTop: 8,
              width: "60%",
            }}
          />
        </div>
      )}
    </div>
  );
};

// ── Demo 3: Entrances and Exits ──────────────────────────────────────────

const EntranceDemo: React.FC<{ progress: number; calm: boolean }> = ({ progress, calm }) => {
  // Eight pie quadrants in two 2x2 stacks. "yes" — stagger from
  // {opacity:0, scale:0.9, rotation:50} → final, Sine.easeOut. "no" — same
  // shape stagger but {opacity:0, scale:0, rotation:500} → final, Bounce.
  const stagger = 0.06;
  const segments = 8;
  const colors = ["#b51d02", "#fbb100", "#fdd167", "#004f3a", "#10a75f", "#20c063", "#2ed975", "#5edca6"];

  const barOne = ramp(progress, 0.6, 0.85);
  const barTwo = ramp(progress, 0.7, 0.95);

  return (
    <div className="demo">
      <svg className={calm ? "entranceyes" : "entranceno"} viewBox="0 0 484 436.5">
        {/* Two grey bars on the side — #bbone (Bounce/Elastic), #bbtwo */}
        <rect
          id="bbone"
          x={14}
          y={22}
          width={20}
          height={176}
          fill="#cdd1d4"
          opacity={calm ? barOne : elasticOut(barOne)}
          style={{
            transform: calm
              ? `scale(1, ${barOne})`
              : `scale(1, ${elasticOut(barOne)})`,
            transformOrigin: "24px 22px",
            transformBox: "fill-box",
          }}
        />
        <rect
          id="bbtwo"
          x={14}
          y={240}
          width={20}
          height={176}
          fill="#cdd1d4"
          opacity={calm ? barTwo : elasticOut(barTwo)}
          style={{
            transform: calm
              ? `scale(1, ${barTwo})`
              : `scale(1, ${elasticOut(barTwo)})`,
            transformOrigin: "24px 240px",
            transformBox: "fill-box",
          }}
        />

        {/* Pie quadrants — id groups #top-red / #bottom-red / #top-green
            / #bottom-green, each four paths. We render them as quadrant
            wedges in 4 quadrants × 2 stacks. */}
        {Array.from({ length: segments }).map((_, i) => {
          const stackIdx = Math.floor(i / 4);
          const quadrant = i % 4; // TL TR BR BL
          const local = ramp(progress, i * stagger, i * stagger + 0.5);
          const eased = calm ? sineOut(local) : bounceOut(local);
          const scale = calm ? 0.9 + 0.1 * eased : eased;
          const rot = calm ? 50 * (1 - eased) : 500 * (1 - eased);
          const opacity = eased;

          const cx = 200 + (quadrant % 2) * 110;
          const cy = 60 + stackIdx * 220 + Math.floor(quadrant / 2) * 110;

          const angleStart = quadrant * 90;
          const angleEnd = angleStart + 90;
          const r = 90;
          const x1 = cx + r * Math.cos((angleStart * Math.PI) / 180);
          const y1 = cy + r * Math.sin((angleStart * Math.PI) / 180);
          const x2 = cx + r * Math.cos((angleEnd * Math.PI) / 180);
          const y2 = cy + r * Math.sin((angleEnd * Math.PI) / 180);
          const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`;

          return (
            <g
              key={i}
              id={`pie-${i}`}
              opacity={opacity}
              style={{
                transform: `rotate(${rot}deg) scale(${scale})`,
                transformOrigin: `${cx}px ${cy}px`,
                transformBox: "view-box" as unknown as undefined,
              }}
            >
              <path d={d} fill={colors[i % colors.length]} />
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// ── Demo 4: Developer Standards ──────────────────────────────────────────

const DevDemo: React.FC<{ progress: number; fast: boolean; suffix: string }> = ({
  progress,
  fast,
  suffix,
}) => {
  // devYes timeline:
  //   0.0–0.2 overlay clears
  //   +0.75   button bg → #ff7857, scale 1.15
  //   +0.85   button opacity → 0
  //   +0.95   .dev-yes fades in
  //   begin7 = 1.0
  //   stagger washer / wind / house in (0.1 each)
  //   stagger bars1/2/3 paths (0.1 each)
  //   stagger #percent text (0.15 each)
  //   stagger #text path (0.15 each)
  //   begin7+2.25 overlay returns
  //
  // devNo: identical but ~1.5x slower (we just shrink the active window).
  const speed = fast ? 1 : 1 / 1.5;
  const tl = progress * speed;

  const buttonHit = ramp(tl, 0.18, 0.22);
  const buttonOut = ramp(tl, 0.22, 0.28);
  const stageReveal = ramp(tl, 0.26, 0.32);

  const begin7 = 0.3;
  const washer = ramp(tl, begin7, begin7 + 0.1);
  const wind = ramp(tl, begin7 + 0.05, begin7 + 0.15);
  const house = ramp(tl, begin7 + 0.1, begin7 + 0.2);
  const bars1 = (i: number) => ramp(tl, begin7 + i * 0.03, begin7 + 0.18 + i * 0.03);
  const bars2 = (i: number) => ramp(tl, begin7 + 0.1 + i * 0.03, begin7 + 0.28 + i * 0.03);
  const bars3 = (i: number) => ramp(tl, begin7 + 0.2 + i * 0.03, begin7 + 0.38 + i * 0.03);
  const percent = (i: number) => ramp(tl, begin7 + 0.1 + i * 0.04, begin7 + 0.25 + i * 0.04);
  const text = (i: number) => ramp(tl, begin7 + i * 0.04, begin7 + 0.15 + i * 0.04);

  return (
    <div className="demo">
      <div className="devStage" />
      <div
        className={fast ? "devYesStart" : "devNoStart"}
        style={{
          background: buttonHit > 0 ? "#ff7857" : "#20c063",
          transform: `scale(${1 + 0.15 * buttonHit})`,
          opacity: 1 - buttonOut,
        }}
      >
        Start
      </div>
      <svg
        className={fast ? "dev-yes" : "dev-no"}
        viewBox="0 0 300.6 245.2"
        style={{ opacity: stageReveal, position: "relative" }}
      >
        {/* Washer */}
        <g id={`washer${suffix}`} opacity={washer} style={{ transform: `scale(${0.9 + 0.1 * washer})`, transformOrigin: "70px 180px", transformBox: "fill-box" }}>
          <rect x={36} y={150} width={68} height={70} rx={6} fill="#fff" stroke="#3b4144" strokeWidth={2} />
          <circle cx={70} cy={185} r={20} fill="#e2f2e4" stroke="#3b4144" strokeWidth={2} />
          <rect x={44} y={156} width={12} height={4} fill="#3b4144" />
          <rect x={88} y={156} width={6} height={4} fill="#3b4144" />
        </g>
        {/* Wind turbine */}
        <g id={`wind${suffix}`} opacity={wind} style={{ transform: `scale(${0.9 + 0.1 * wind})`, transformOrigin: "160px 90px", transformBox: "fill-box" }}>
          <line x1={160} y1={80} x2={160} y2={210} stroke="#3b4144" strokeWidth={3} />
          <circle cx={160} cy={80} r={5} fill="#3b4144" />
          <path d="M160 80 L138 50 L150 78 Z" fill="#10a75f" />
          <path d="M160 80 L182 50 L170 78 Z" fill="#10a75f" />
          <path d="M160 80 L160 110 L165 90 Z" fill="#10a75f" />
        </g>
        {/* House */}
        <g id={`house${suffix}`} opacity={house} style={{ transform: `scale(${0.9 + 0.1 * house})`, transformOrigin: "100px 110px", transformBox: "fill-box" }}>
          <path d="M70 110 L100 80 L130 110 L130 140 L70 140 Z" fill="#fff" stroke="#3b4144" strokeWidth={2} />
          <rect x={90} y={115} width={20} height={25} fill="#10a75f" />
        </g>
        {/* Dotted connectors */}
        <line x1={130} y1={180} x2={200} y2={120} stroke="#9aa0a5" strokeDasharray="3 3" strokeWidth={1} opacity={stageReveal} />
        <line x1={140} y1={120} x2={200} y2={90} stroke="#9aa0a5" strokeDasharray="3 3" strokeWidth={1} opacity={stageReveal} />

        {/* Bars groups */}
        <g id={`bars1${suffix}`}>
          {Array.from({ length: 5 }).map((_, i) => (
            <path
              key={i}
              d={`M ${210 + i * 12} ${100 - i * 4} h 8 v ${20 + i * 4} h -8 z`}
              fill="#10a75f"
              opacity={bars1(i)}
              style={{
                transform: `scale(${bars1(i)})`,
                transformOrigin: `${214 + i * 12}px ${120}px`,
                transformBox: "fill-box",
              }}
            />
          ))}
        </g>
        <g id={`bars2${suffix}`}>
          {Array.from({ length: 5 }).map((_, i) => (
            <path
              key={i}
              d={`M ${210 + i * 12} ${150} h 8 v ${10 + i * 3} h -8 z`}
              fill="#fbb100"
              opacity={bars2(i)}
              style={{
                transform: `scale(${bars2(i)})`,
                transformOrigin: `${214 + i * 12}px ${160}px`,
                transformBox: "fill-box",
              }}
            />
          ))}
        </g>
        <g id={`bars3${suffix}`}>
          {Array.from({ length: 5 }).map((_, i) => (
            <path
              key={i}
              d={`M ${210 + i * 12} ${190} h 8 v ${6 + i * 2} h -8 z`}
              fill="#b51d02"
              opacity={bars3(i)}
              style={{
                transform: `scale(${bars3(i)})`,
                transformOrigin: `${214 + i * 12}px ${196}px`,
                transformBox: "fill-box",
              }}
            />
          ))}
        </g>

        <g id={`percent${suffix}`}>
          {["32%", "+11%", "Q3"].map((label, i) => (
            <text
              key={i}
              x={210}
              y={40 + i * 14}
              fill="#3b4144"
              fontSize={10}
              fontFamily="Helvetica, sans-serif"
              fontWeight={600}
              opacity={percent(i)}
            >
              {label}
            </text>
          ))}
        </g>
        <g id={`text${suffix}`}>
          {["Energy", "Wind", "Hydro"].map((label, i) => (
            <path
              key={i}
              d={`M 36 ${236 + i * 0} h ${10 + label.length * 5} v 6 h -${10 + label.length * 5} z`}
              fill="#9aa0a5"
              opacity={text(i)}
            />
          ))}
        </g>
      </svg>
    </div>
  );
};

// ── Section shell ────────────────────────────────────────────────────────

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
  progress: number; // 0..1 local timeline for this section
  yesOverlay: number;
  noOverlay: number;
  yesContent: React.ReactNode;
  noContent: React.ReactNode;
}> = ({ copy, index, progress: _p, yesOverlay, noOverlay, yesContent, noContent }) => {
  const isMap = copy.id === "section2";
  return (
    <section id={copy.id}>
      <div className="row">
        <div className="col-md-1">
          <div className="number">{copy.number}</div>
        </div>
        <div className="col-md-2">
          <div className="explainContain backgroundLowerlight sectTitle">
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
        <div className="col-md-1"></div>
      </div>
      <div className="row">
        <div className="col-md-1"></div>
        <div className="col-md-1"></div>
        <div className="col-md-8">
          <div className="descContain description">
            <h1>{copy.title}</h1>
            <div className="hrSide" />
            <p style={{ marginTop: 24 }}>{copy.description}</p>
            {isMap ? null : null /* placeholder for parity */}
          </div>
        </div>
        <div className="col-md-2"></div>
      </div>
    </section>
  );
};

// ── Composition ──────────────────────────────────────────────────────────

export const FluidMotion: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = frame / Math.max(1, durationInFrames - 1);
  const scrollProgress = easeScroll(Math.max(0, Math.min(1, t)));
  const scrollY = scrollProgress * (PAGE_H - VIEW_H);

  // Each section's local timeline begins when its top crosses ~ 60% of the
  // viewport and runs over ~ 2.5 s. We map both .yes and .no to the same
  // local progress so the viewer sees both demos play together.
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

  // Overlay opacity follows: opaque 0..0.05 → 0 in [0.05..0.15] → 0 until
  // 0.85 → returns to 0.97 by 0.95. Matches the GSAP `to opacity:0` /
  // `to opacity:0.97` envelope on the overlay.
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
        {/* Fixed background headline */}
        <div className="fluid-behind">Fluid Motion</div>

        {/* Fixed side nav */}
        <SideNav activeIdx={activeIdx} />

        {/* Scrolling content */}
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
                yesContent = <ContextDemo progress={p} keepContext idx={1} />;
                noContent = <ContextDemo progress={p} keepContext={false} idx={2} />;
                break;
              case 2:
                yesContent = <EntranceDemo progress={p} calm />;
                noContent = <EntranceDemo progress={p} calm={false} />;
                break;
              case 3:
              default:
                yesContent = <DevDemo progress={p} fast suffix="" />;
                noContent = <DevDemo progress={p} fast={false} suffix="n" />;
            }

            return (
              <Section
                key={copy.id}
                copy={copy}
                index={i}
                progress={p}
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
