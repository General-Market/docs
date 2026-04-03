// Source: wasm.md scene #19
//
// Pure-CSS playing card — King of Hearts by Ben Evans (ivorjetski).
// The original uses <x> elements, SCSS nth-of-type selectors, and
// animation-timeline: scroll() to 3D-rotate the card on scroll.
// Here we drive the rotation with useCurrentFrame().
//
// The card front is an elaborate CSS illustration: crown, face with
// spiraling curls, sword, coat of arms, striped robes. The back is
// a classic cross-hatch pattern. A radial shadow morphs beneath.
//
// 600 frames at 60fps = 10s. Continuous diagonal-axis rotation.

import React, { CSSProperties } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  spring,
} from "remotion";

const FPS = 60;

// ── Colors (SCSS variables from the original) ──

const BODY = "#190d23";
const CARD = "#f5e3e3";
const BLUE = "#302E9B";
const RED = "#B32B28";
const YELLOW = "#BDB725";

// ── Sizing ──
// Original uses font-size: .7vh as rem base. On 1080p that's ~7.56px.
// We use REM = 7.5 for clean math. The card is 96rem × 64.5rem.

const REM = 7.5;
const CARD_W = 64.5 * REM;
const CARD_H = 96 * REM;

// ── Style helpers ──

const abs = (extra?: CSSProperties): CSSProperties => ({
  position: "absolute",
  left: 0,
  top: 0,
  display: "block",
  boxSizing: "border-box",
  ...extra,
});

const r = (n: number) => n * REM;

// ── Corner pip (heart symbol + K) ──

const CornerPip: React.FC<{ flipped?: boolean }> = ({ flipped }) => (
  <div
    style={{
      ...abs(),
      width: "100%",
      height: "100%",
      transform: flipped ? "rotate(180deg)" : undefined,
    }}
  >
    {/* Heart suit symbol — uses scaleX + box-shadow like the original */}
    <div
      style={{
        ...abs(),
        transform: `translate(${r(2)}px, ${r(13)}px) scaleX(0.7)`,
        height: r(4),
        width: r(4),
        background: RED,
        borderRadius: "50%",
        boxShadow: `${r(3.25)}px 0 0 ${RED}`,
      }}
    >
      {/* Diamond bottom of heart */}
      <div
        style={{
          ...abs(),
          transform: `translate(${r(1.7)}px, ${r(1.7)}px) rotate(45deg)`,
          background: RED,
          width: r(4),
          height: r(4),
        }}
      />
      {/* K letter */}
      <div
        style={{
          ...abs(),
          color: RED,
          fontFamily: "'Courier New', monospace",
          fontSize: r(12),
          fontWeight: 400,
          lineHeight: 1,
          transform: `translate(0, ${r(-12)}px)`,
        }}
      >
        K
      </div>
    </div>
  </div>
);

// ── Crown ──

const Crown: React.FC = () => (
  <div
    style={{
      ...abs(),
      width: r(30),
      height: r(30),
      background: YELLOW,
      boxShadow: `inset 0 0 0 ${r(0.1)}px #fff, inset 0 0 0 ${r(0.6)}px ${BLUE}`,
      transform: `translate(${r(7)}px, ${r(-23)}px) rotate(37deg) skewY(20deg)`,
      overflow: "hidden",
    }}
  >
    {/* White arc cutout */}
    <div
      style={{
        ...abs(),
        width: r(40),
        height: r(10),
        borderRadius: "50%",
        background: "#fff",
        transform: `translate(${r(4)}px, ${r(25.5)}px) rotate(-50deg)`,
        boxShadow: `0 0 0 ${r(1.5)}px ${BODY}`,
      }}
    />
    {/* Crown points */}
    <div
      style={{
        ...abs(),
        width: r(1.5),
        height: r(1.5),
        background: BODY,
        borderRadius: "50%",
        transform: `translate(${r(16.5)}px, ${r(26.5)}px) rotate(-1deg)`,
        boxShadow: [
          `0 0 0 ${r(1.5)}px ${YELLOW}`,
          `0 0 0 ${r(2)}px ${BODY}`,
          `${r(5)}px ${r(-5)}px 0 ${BODY}`,
          `${r(5)}px ${r(-5)}px 0 ${r(1.5)}px ${YELLOW}`,
          `${r(5)}px ${r(-5)}px 0 ${r(2)}px ${BODY}`,
          `${r(10)}px ${r(-10)}px 0 ${BODY}`,
          `${r(10)}px ${r(-10)}px 0 ${r(1.5)}px ${YELLOW}`,
          `${r(10)}px ${r(-10)}px 0 ${r(2)}px ${BODY}`,
        ].join(", "),
      }}
    />
  </div>
);

// ── Face ──

const Face: React.FC = () => (
  <div
    style={{
      ...abs(),
      width: r(40),
      height: r(20),
      transform: `translate(${r(-0.5)}px, ${r(6.5)}px)`,
      borderRadius: "50%",
      overflow: "hidden",
    }}
  >
    {/* Hair (nth-of-type(1)) */}
    <div
      style={{
        ...abs(),
        width: r(3),
        height: r(14),
        borderRadius: r(2),
        transform: `translate(${r(15)}px, ${r(-4)}px) rotate(25deg)`,
        boxShadow: [
          `${r(0.4)}px ${r(0.4)}px 0 ${BLUE}`,
          `${r(1)}px ${r(0.8)}px 0 #fff`,
          `${r(1.4)}px ${r(1.2)}px 0 ${BLUE}`,
          `${r(2)}px ${r(1.6)}px 0 #fff`,
          `${r(2.4)}px ${r(2)}px 0 ${BLUE}`,
          `${r(3)}px ${r(2.4)}px 0 #fff`,
          `${r(3.4)}px ${r(2.8)}px 0 ${BLUE}`,
          `${r(4)}px ${r(2.3)}px 0 #fff`,
          `${r(4.4)}px ${r(2.6)}px 0 ${BLUE}`,
          `${r(5)}px ${r(2)}px 0 #fff`,
          `${r(5.4)}px ${r(2.1)}px 0 ${BLUE}`,
        ].join(", "),
      }}
    >
      {/* Face shape (:after) */}
      <div
        style={{
          ...abs(),
          background: "#fff",
          width: r(10.8),
          height: r(12),
          borderRadius: `${r(5)}px 0 60% ${r(2)}px / ${r(1.25)}px 0 60% ${r(5)}px`,
          transform: `translate(${r(1.5)}px, ${r(1)}px) rotate(-29deg)`,
          boxShadow: `${r(-0.4)}px ${r(-0.3)}px 0 ${BLUE}`,
        }}
      />
      {/* Big beardy bit (:before) */}
      <div
        style={{
          ...abs(),
          width: r(7),
          height: r(10),
          borderRadius: r(2.5),
          transform: `translate(${r(6.5)}px, ${r(4)}px) rotate(-55deg)`,
          border: `${r(0.4)}px solid #fff`,
          boxShadow: [
            `0 0 0 ${r(0.4)}px ${BLUE}`,
            `inset 0 0 0 ${r(0.4)}px ${BLUE}`,
            `inset ${r(0.5)}px 0 0 ${r(0.4)}px #fff`,
            `inset ${r(0.9)}px 0 0 ${r(0.4)}px ${BLUE}`,
            `inset ${r(1.4)}px ${r(0.2)}px 0 ${r(0.4)}px #fff`,
            `inset ${r(1.8)}px ${r(0.2)}px 0 ${r(0.4)}px ${BLUE}`,
            `inset ${r(2.3)}px ${r(0.4)}px 0 ${r(0.4)}px #fff`,
            `inset ${r(2.7)}px ${r(0.4)}px 0 ${r(0.4)}px ${BLUE}`,
            `inset ${r(3.2)}px ${r(0.8)}px 0 ${r(0.4)}px #fff`,
            `inset ${r(3.6)}px ${r(0.8)}px 0 ${r(0.4)}px ${BLUE}`,
            `inset ${r(-0.5)}px 0 0 ${r(0.4)}px #fff`,
            `inset ${r(-0.9)}px 0 0 ${r(0.4)}px ${BLUE}`,
            `inset ${r(-1.4)}px ${r(0.2)}px 0 ${r(0.4)}px #fff`,
            `inset ${r(-1.8)}px ${r(0.2)}px 0 ${r(0.4)}px ${BLUE}`,
            `inset ${r(-2.3)}px ${r(0.4)}px 0 ${r(0.4)}px #fff`,
            `inset ${r(-2.7)}px ${r(0.4)}px 0 ${r(0.4)}px ${BLUE}`,
          ].join(", "),
        }}
      />
    </div>
    {/* Spiral curl (:before of face container) */}
    <div
      style={{
        ...abs(),
        width: r(1),
        height: r(1),
        background: "#fff",
        borderRadius: "50%",
        transform: `translate(${r(13.35)}px, ${r(7.85)}px)`,
        boxShadow: [
          `${r(0.4)}px 0 0 ${BLUE}`,
          `${r(0.4)}px ${r(0.4)}px 0 ${r(0.3)}px #fff`,
          `${r(0.1)}px ${r(0.4)}px 0 ${r(0.6)}px ${BLUE}`,
        ].join(", "),
      }}
    />
    {/* More curls (nth-of-type(2)) */}
    <div
      style={{
        ...abs(),
        width: r(1.5),
        height: r(1.5),
        background: "#fff",
        borderRadius: "50%",
        transform: `translate(${r(25)}px, ${r(10.65)}px)`,
        boxShadow: [
          `${r(0.4)}px 0 0 ${BLUE}`,
          `${r(0.4)}px ${r(0.4)}px 0 ${r(0.4)}px #fff`,
          `${r(0.1)}px ${r(0.4)}px 0 ${r(0.6)}px ${BLUE}`,
        ].join(", "),
      }}
    >
      {/* Curl :after */}
      <div
        style={{
          ...abs(),
          width: r(1),
          height: r(1),
          background: "#fff",
          borderRadius: "50%",
          transform: `translate(${r(-1.5)}px, ${r(1.2)}px) rotate(-70deg)`,
          boxShadow: [
            `${r(-0.4)}px 0 0 ${BLUE}`,
            `${r(-0.4)}px ${r(0.4)}px 0 ${r(0.4)}px #fff`,
            `${r(-0.1)}px ${r(0.4)}px 0 ${r(0.6)}px ${BLUE}`,
          ].join(", "),
        }}
      />
      {/* Curl :before */}
      <div
        style={{
          ...abs(),
          width: r(0.75),
          height: r(0.75),
          background: "#fff",
          borderRadius: "50%",
          transform: `translate(${r(-11.25)}px, ${r(-7)}px) rotate(-50deg)`,
          boxShadow: [
            `${r(0.4)}px 0 0 ${BLUE}`,
            `${r(0.4)}px ${r(0.4)}px 0 ${r(0.3)}px #fff`,
            `${r(0.1)}px ${r(0.4)}px 0 ${r(0.6)}px ${BLUE}`,
          ].join(", "),
        }}
      />
    </div>
    {/* Nose (nth-of-type(3)) */}
    <div
      style={{
        ...abs(),
        width: r(2),
        height: r(1.25),
        background: "#fff",
        borderRadius: "50%",
        boxShadow: `${r(0.3)}px 0 0 0 ${BLUE}`,
        transform: `translate(${r(18.75)}px, ${r(6)}px) rotate(45deg)`,
      }}
    >
      {/* Nose :before */}
      <div
        style={{
          ...abs(),
          width: r(4),
          height: r(4),
          transform: `translate(${r(0.25)}px, ${r(0.25)}px)`,
          boxShadow: `${r(-0.2)}px ${r(-0.2)}px 0 ${BLUE}`,
          borderRadius: r(1),
        }}
      />
      {/* Chin :after */}
      <div
        style={{
          ...abs(),
          width: r(1),
          height: r(1),
          boxShadow: `0 ${r(-0.4)}px 0 ${BLUE}`,
          transform: `translate(${r(3.25)}px, ${r(3.25)}px) rotate(-45deg)`,
          borderRadius: "50%",
        }}
      />
    </div>
    {/* Eyebrows (nth-of-type(4)) */}
    <div
      style={{
        ...abs(),
        width: r(3),
        height: r(1),
        borderRadius: "50%",
        borderTop: `${r(0.4)}px solid ${BLUE}`,
        transform: `translate(${r(21)}px, ${r(1)}px)`,
        boxShadow: `${r(-5)}px ${r(0.4)}px 0 #fff, ${r(-5.5)}px 0 0 ${BLUE}`,
      }}
    >
      {/* Eyebrow :after — vertical line */}
      <div
        style={{
          ...abs(),
          width: r(0.3),
          height: r(2),
          background: BLUE,
          transform: `translate(${r(-2.65)}px, 0) rotate(-15deg)`,
        }}
      />
      {/* Eyebrow :before — brow shape */}
      <div
        style={{
          ...abs(),
          width: r(2.5),
          height: r(5),
          borderRadius: r(2),
          transform: `translate(${r(-2.5)}px, ${r(1.25)}px) rotate(15deg) skewY(-10deg)`,
          boxShadow: `${r(-0.2)}px ${r(0.3)}px 0 ${BLUE}`,
          background: "#fff",
        }}
      />
    </div>
    {/* Eye 1 (nth-of-type(5)) */}
    <div
      style={{
        ...abs(),
        width: r(0.6),
        height: r(0.6),
        background: BLUE,
        borderRadius: "50%",
        boxShadow: `0 0 0 ${r(0.5)}px #fff, 0 0 0 ${r(0.8)}px ${BLUE}`,
        transform: `translate(${r(21.5)}px, ${r(3)}px) rotate(5deg)`,
      }}
    >
      {/* Eye socket :before */}
      <div
        style={{
          ...abs(),
          width: r(3.5),
          height: r(3),
          borderRadius: "50%",
          borderTop: `${r(0.4)}px solid ${BLUE}`,
          transform: `translate(${r(-1)}px, ${r(-0.4)}px)`,
          boxShadow: `0 ${r(-0.8)}px 0 ${r(-0.4)}px #fff`,
        }}
      />
      {/* Under-eye :after */}
      <div
        style={{
          ...abs(),
          width: r(1.5),
          height: r(0.75),
          borderRadius: "50%",
          boxShadow: `${r(-0.2)}px ${r(0.2)}px 0 0 ${BLUE}`,
          transform: `translate(${r(-0.75)}px, ${r(1)}px) rotate(20deg)`,
        }}
      />
    </div>
    {/* Eye 2 (nth-of-type(6)) */}
    <div
      style={{
        ...abs(),
        width: r(0.6),
        height: r(0.6),
        background: BLUE,
        borderRadius: "50%",
        boxShadow: `0 0 0 ${r(0.5)}px #fff, 0 0 0 ${r(0.8)}px ${BLUE}`,
        transform: `translate(${r(16.6)}px, ${r(2.75)}px) rotate(5deg)`,
      }}
    >
      {/* Eye socket :before */}
      <div
        style={{
          ...abs(),
          width: r(3.5),
          height: r(3),
          borderRadius: "50%",
          borderTop: `${r(0.4)}px solid ${BLUE}`,
          transform: `translate(${r(-1)}px, ${r(-0.4)}px)`,
          boxShadow: `0 ${r(-0.8)}px 0 ${r(-0.4)}px #fff`,
        }}
      />
      {/* Under-eye :after */}
      <div
        style={{
          ...abs(),
          width: r(1),
          height: r(0.75),
          borderRadius: "50%",
          boxShadow: `0 ${r(0.2)}px 0 0 ${BLUE}`,
          transform: `translate(${r(-0.75)}px, ${r(1)}px) rotate(30deg)`,
        }}
      />
    </div>
    {/* Mouth (nth-of-type(7)) */}
    <div
      style={{
        ...abs(),
        width: r(0.6),
        height: r(0.6),
        background: BLUE,
        borderRadius: "50%",
        boxShadow: `${r(1)}px 0 0 0 ${BLUE}, ${r(0.5)}px ${r(0.3)}px 0 0 ${BLUE}`,
        transform: `translate(${r(18.75)}px, ${r(8.5)}px)`,
      }}
    >
      {/* Mouth curve :after */}
      <div
        style={{
          ...abs(),
          width: r(3.2),
          height: r(0.5),
          boxShadow: `0 ${r(-0.2)}px 0 ${BLUE}`,
          transform: `translate(${r(-0.7)}px, ${r(0.4)}px)`,
          borderRadius: "50%",
        }}
      />
    </div>
    {/* Face :after — diagonal hair strands */}
    <div
      style={{
        ...abs(),
        width: r(5),
        height: r(14),
        borderRadius: r(3),
        transform: `translate(${r(21.5)}px, ${r(-1)}px) rotate(-20deg) skewY(-10deg)`,
        boxShadow: [
          `${r(0.4)}px ${r(0.4)}px 0 ${BLUE}`,
          `${r(1)}px ${r(0.8)}px 0 #fff`,
          `${r(1.4)}px ${r(1.2)}px 0 ${BLUE}`,
          `${r(2)}px ${r(1.6)}px 0 #fff`,
          `${r(2.4)}px ${r(2)}px 0 ${BLUE}`,
          `${r(3)}px ${r(2.4)}px 0 #fff`,
          `${r(3.4)}px ${r(2.8)}px 0 ${BLUE}`,
          `${r(4)}px ${r(3.2)}px 0 #fff`,
          `${r(4.4)}px ${r(3.6)}px 0 ${BLUE}`,
        ].join(", "),
      }}
    />
  </div>
);

// ── Big Heart (in picture area) ──

const BigHeart: React.FC = () => (
  <div
    style={{
      ...abs(),
      transform: `translate(${r(0.5)}px, ${r(2.5)}px) scaleX(0.7)`,
      height: r(8),
      width: r(8),
      background: RED,
      borderRadius: "50%",
      boxShadow: `${r(6.5)}px 0 0 ${RED}`,
    }}
  >
    {/* Diamond bottom */}
    <div
      style={{
        ...abs(),
        transform: `translate(${r(3.25)}px, ${r(3.25)}px) rotate(45deg)`,
        background: RED,
        width: r(8),
        height: r(8),
      }}
    />
  </div>
);

// ── Body — striped torso with coat of arms ──

const Body: React.FC = () => (
  <div
    style={{
      ...abs(),
      border: `${r(0.5)}px solid ${BLUE}`,
      transform: `translate(${r(-6.5)}px, ${r(16)}px)`,
      width: r(56),
      height: r(43),
      borderRadius: "50% 48%",
      boxShadow: [
        `inset 0 0 0 ${r(1)}px ${YELLOW}`,
        `inset 0 0 0 ${r(4.5)}px ${BLUE}`,
        `inset 0 0 0 ${r(5)}px ${YELLOW}`,
        `inset 0 0 0 ${r(5.5)}px ${BLUE}`,
      ].join(", "),
      background: `repeating-linear-gradient(${RED}, ${RED} 50%, #fff 50%, #fff)`,
      backgroundSize: `100% ${r(1)}px`,
      overflow: "hidden",
    }}
  >
    {/* Inner shirt (nth-of-type(1)) */}
    <div
      style={{
        ...abs(),
        width: r(16),
        height: r(53),
        transform: `translate(${r(20)}px, 0)`,
        overflow: "hidden",
      }}
    >
      {/* Red triangle :before */}
      <div
        style={{
          ...abs(),
          height: r(20),
          width: r(35),
          background: RED,
          transform: `translate(${r(-10)}px, ${r(-10)}px) rotate(-45deg)`,
        }}
      />
      {/* White sash with pattern :after */}
      <div
        style={{
          ...abs(),
          height: r(5),
          width: r(30),
          background: "#fff",
          transform: `translate(${r(-10)}px, ${r(10)}px) rotate(-45deg)`,
          border: `${r(0.5)}px solid #fff`,
          boxShadow: `inset 0 0 0 ${r(0.4)}px ${BLUE}, 0 0 0 ${r(0.4)}px ${BLUE}`,
          backgroundImage: [
            `radial-gradient(${RED} 25%, ${YELLOW} 35%, ${BODY} 45%, transparent 0)`,
            `radial-gradient(${RED} 25%, ${YELLOW} 35%, ${BODY} 45%, transparent 0)`,
          ].join(", "),
          backgroundSize: `${r(6)}px ${r(6)}px`,
          backgroundPosition: `0 0, ${r(3)}px ${r(3)}px`,
        }}
      />
      {/* Blue belt (nth-of-type(1) inside inner shirt) */}
      <div
        style={{
          ...abs(),
          transform: `translate(0, ${r(18)}px)`,
          background: BLUE,
          height: r(5),
          width: r(20),
        }}
      >
        {/* Lower red triangle :before */}
        <div
          style={{
            ...abs(),
            height: r(20),
            width: r(35),
            background: RED,
            transform: `translate(${r(-10)}px, ${r(15)}px) rotate(-45deg)`,
          }}
        />
        {/* Lower sash with pattern :after */}
        <div
          style={{
            ...abs(),
            height: r(5),
            width: r(30),
            background: "#fff",
            transform: `translate(${r(-10)}px, ${r(12)}px) rotate(-45deg)`,
            border: `${r(0.5)}px solid #fff`,
            boxShadow: `inset 0 0 0 ${r(0.4)}px ${BLUE}, 0 0 0 ${r(0.4)}px ${BLUE}`,
            backgroundImage: [
              `radial-gradient(${RED} 25%, ${YELLOW} 35%, ${BODY} 45%, transparent 0)`,
              `radial-gradient(${RED} 25%, ${YELLOW} 35%, ${BODY} 45%, transparent 0)`,
            ].join(", "),
            backgroundSize: `${r(6)}px ${r(6)}px`,
            backgroundPosition: `0 0, ${r(3)}px ${r(3)}px`,
          }}
        />
      </div>
    </div>
    {/* Right sleeve circle (nth-of-type(2)) */}
    <div
      style={{
        ...abs(),
        width: r(50),
        height: r(60),
        border: `${r(5)}px solid #fff`,
        borderLeftWidth: r(3),
        transform: `translate(${r(30)}px, ${r(-9)}px)`,
        boxShadow: `inset 0 0 0 ${r(0.5)}px ${BLUE}, 0 0 0 ${r(0.5)}px ${BLUE}`,
        borderRadius: "50%",
        overflow: "hidden",
      }}
    >
      {/* Red upper section :before */}
      <div
        style={{
          ...abs(),
          width: r(40),
          height: r(31),
          background: RED,
          boxShadow: `inset ${r(5)}px ${r(14)}px 0 0 ${BLUE}, inset 0 ${r(14.9)}px 0 0 ${YELLOW}, inset 0 ${r(15.3)}px 0 0 ${BLUE}`,
        }}
      />
      {/* Yellow stripe :after */}
      <div
        style={{
          ...abs(),
          width: r(2),
          background: YELLOW,
          height: r(30),
          transform: `translate(${r(10.5)}px, 0)`,
          border: `solid ${r(0.5)}px ${BLUE}`,
        }}
      />
      {/* Shield circle (nth-of-type(1) inside sleeve) */}
      <div
        style={{
          ...abs(),
          width: r(24),
          height: r(24),
          border: `${r(1)}px solid ${BODY}`,
          transform: `translate(${r(-15)}px, ${r(6)}px)`,
          borderRadius: "50%",
          boxShadow: [
            `inset 0 0 0 ${r(1)}px ${YELLOW}`,
            `inset 0 0 0 ${r(1.5)}px ${BODY}`,
            `inset 0 0 0 ${r(3.5)}px #fff`,
            `inset 0 0 0 ${r(4)}px ${BODY}`,
            `inset 0 0 0 ${r(4.5)}px ${YELLOW}`,
            `inset 0 0 0 ${r(5)}px ${BODY}`,
          ].join(", "),
          background: `repeating-linear-gradient(${RED}, ${RED} 50%, #fff 50%, #fff)`,
          backgroundSize: `100% ${r(1)}px`,
        }}
      >
        {/* Dotted ring :before */}
        <div
          style={{
            ...abs(),
            width: r(18),
            height: r(18),
            border: `${r(1)}px dotted ${RED}`,
            bottom: 0,
            right: 0,
            margin: "auto",
            borderRadius: "50%",
          }}
        />
        {/* Diamond decorations :after */}
        <div
          style={{
            ...abs(),
            width: r(5),
            height: r(5),
            transform: `translate(${r(29)}px, ${r(5)}px) rotate(45deg)`,
            background: RED,
            boxShadow: [
              `0 0 0 ${r(0.4)}px ${BLUE}`,
              `0 0 0 ${r(0.9)}px ${YELLOW}`,
              `0 0 0 ${r(1.1)}px ${BLUE}`,
              `0 0 0 ${r(1.6)}px ${YELLOW}`,
              `0 0 0 ${r(2)}px ${BLUE}`,
              `${r(4)}px ${r(4)}px 0 0 ${RED}`,
              `${r(4)}px ${r(4)}px 0 ${r(0.4)}px ${BLUE}`,
              `${r(4)}px ${r(4)}px 0 ${r(0.9)}px ${YELLOW}`,
              `${r(4)}px ${r(4)}px 0 ${r(1.1)}px ${BLUE}`,
              `${r(4)}px ${r(4)}px 0 ${r(1.6)}px ${YELLOW}`,
              `${r(4)}px ${r(4)}px 0 ${r(2)}px ${BLUE}`,
              `${r(8)}px ${r(8)}px 0 0 ${RED}`,
              `${r(8)}px ${r(8)}px 0 ${r(0.4)}px ${BLUE}`,
              `${r(8)}px ${r(8)}px 0 ${r(0.9)}px ${YELLOW}`,
              `${r(8)}px ${r(8)}px 0 ${r(1.1)}px ${BLUE}`,
              `${r(8)}px ${r(8)}px 0 ${r(1.6)}px ${YELLOW}`,
              `${r(8)}px ${r(8)}px 0 ${r(2)}px ${BLUE}`,
              `${r(-4)}px ${r(-4)}px 0 0 ${RED}`,
              `${r(-4)}px ${r(-4)}px 0 ${r(0.4)}px ${BLUE}`,
              `${r(-4)}px ${r(-4)}px 0 ${r(0.9)}px ${YELLOW}`,
              `${r(-4)}px ${r(-4)}px 0 ${r(1.1)}px ${BLUE}`,
              `${r(-4)}px ${r(-4)}px 0 ${r(1.6)}px ${YELLOW}`,
              `${r(-4)}px ${r(-4)}px 0 ${r(2)}px ${BLUE}`,
            ].join(", "),
          }}
        />
      </div>
    </div>
    {/* Dotted circle decoration (nth-of-type(3)) */}
    <div
      style={{
        ...abs(),
        width: r(50),
        height: r(60),
        border: `${r(2)}px dotted ${BLUE}`,
        transform: `translate(${r(31)}px, ${r(-9)}px)`,
        borderRadius: "50%",
      }}
    />
    {/* Yellow buttons :before */}
    <div
      style={{
        ...abs(),
        width: r(2),
        height: r(2),
        background: YELLOW,
        transform: `translate(${r(45.75)}px, ${r(31.4)}px)`,
        boxShadow: `${r(-2.5)}px ${r(2)}px 0 0 ${YELLOW}, ${r(-5.5)}px ${r(4)}px 0 0 ${YELLOW}`,
      }}
    />
    {/* Diamond buttons :after */}
    <div
      style={{
        ...abs(),
        width: r(2),
        height: r(2),
        background: BODY,
        transform: `translate(${r(45.7)}px, ${r(31.3)}px) rotate(-45deg)`,
        boxShadow: [
          `inset 0 0 0 ${r(0.55)}px ${YELLOW}`,
          `${r(-3.25)}px ${r(-0.25)}px 0 ${r(-0.55)}px ${BODY}`,
          `${r(-3.25)}px ${r(-0.25)}px 0 0 ${YELLOW}`,
          `${r(-6.75)}px ${r(-1)}px 0 ${r(-0.55)}px ${BODY}`,
          `${r(-6.75)}px ${r(-1)}px 0 0 ${YELLOW}`,
        ].join(", "),
      }}
    />
  </div>
);

// ── Arm — yellow sleeve with ornaments ──

const Arm: React.FC = () => (
  <div
    style={{
      ...abs(),
      transform: `translate(${r(30)}px, ${r(13)}px)`,
      height: r(20),
      width: r(20),
      background: YELLOW,
    }}
  >
    {/* White circle cutout :before */}
    <div
      style={{
        ...abs(),
        borderRadius: "50%",
        background: "#fff",
        width: r(10),
        height: r(30),
        boxShadow: `${r(-0.4)}px ${r(0.4)}px 0 0 ${BLUE}, ${r(-12.5)}px ${r(-1)}px 0 0 #fff, ${r(-12)}px ${r(-1)}px 0 0 ${BLUE}`,
        transform: `translate(${r(9)}px, ${r(-22)}px)`,
      }}
    />
    {/* White background :after */}
    <div
      style={{
        ...abs(),
        background: "#fff",
        width: r(30),
        height: r(20),
        transform: `translate(0, ${r(-20)}px)`,
      }}
    />
    {/* Red/yellow diamond ornament (nth-of-type(1)) */}
    <div
      style={{
        ...abs(),
        background: RED,
        border: `${r(0.5)}px solid ${BLUE}`,
        transform: `translate(${r(5)}px, ${r(9)}px) rotate(-40deg) skewY(-30deg)`,
        width: r(10),
        height: r(10),
        boxShadow: `0 0 0 ${r(1)}px ${YELLOW}, 0 0 0 ${r(1.5)}px ${BLUE}`,
        zIndex: -1,
        borderRadius: "50% 0",
      }}
    >
      {/* Ornament :before */}
      <div
        style={{
          ...abs(),
          background: RED,
          border: `${r(0.5)}px solid ${BLUE}`,
          transform: `translate(${r(-4)}px, ${r(-5.5)}px) rotate(20deg) skewY(0deg)`,
          width: r(10),
          height: r(10),
          boxShadow: `0 0 0 ${r(1)}px ${YELLOW}, 0 0 0 ${r(1.5)}px ${BLUE}`,
          borderRadius: "50% 0",
        }}
      />
      {/* Ornament :after */}
      <div
        style={{
          ...abs(),
          background: BLUE,
          transform: `translate(${r(11.75)}px, ${r(-11.75)}px) rotate(15deg) skewY(0deg)`,
          width: r(10),
          height: r(10),
          boxShadow: `0 0 0 ${r(0.5)}px ${YELLOW}, 0 0 0 ${r(1)}px ${BLUE}`,
          borderRadius: "50% 0",
        }}
      />
    </div>
  </div>
);

// ── Sword — blade, handle, and hand ──

const Sword: React.FC = () => (
  <>
    {/* Sword blade (nth-of-type(3)) */}
    <div
      style={{
        ...abs(),
        transform: `translate(${r(31.25)}px, ${r(6)}px)`,
        border: `${r(0.5)}px solid ${BLUE}`,
        width: r(3),
        height: r(3),
        boxShadow: `inset 0 0 0 ${r(0.5)}px #fff, inset 0 0 0 ${r(1)}px ${BLUE}, ${r(-3)}px 0 0 0 ${BLUE}`,
      }}
    >
      {/* Pommel :before */}
      <div
        style={{
          ...abs(),
          transform: `translate(${r(4)}px, ${r(5)}px)`,
          width: r(3.5),
          height: r(1.5),
          borderRadius: "50%",
          boxShadow: `0 0 0 ${r(0.5)}px ${BLUE}`,
          background: YELLOW,
        }}
      />
    </div>
    {/* Sword handle (nth-of-type(4)) */}
    <div
      style={{
        ...abs(),
        transform: `translate(${r(35.25)}px, ${r(6.5)}px)`,
        border: `${r(0.5)}px solid ${BLUE}`,
        width: r(4.75),
        height: r(5.5),
        borderRadius: "50%",
        background: "#fff",
      }}
    >
      {/* Guard circle :before */}
      <div
        style={{
          ...abs(),
          transform: `translate(${r(4)}px, ${r(-0.1)}px)`,
          width: r(2),
          height: r(2),
          borderRadius: "100%",
          boxShadow: `0 0 0 ${r(0.5)}px ${BLUE}, inset 0 ${r(-0.25)}px 0 ${r(0.5)}px ${YELLOW}, inset 0 ${r(-0.5)}px 0 ${r(1)}px ${BLUE}`,
          background: YELLOW,
        }}
      />
      {/* Grip :after */}
      <div
        style={{
          ...abs(),
          transform: `translate(${r(-1.5)}px, ${r(-3)}px)`,
          width: r(1),
          height: r(7),
          borderRadius: r(0.5),
          boxShadow: `0 0 0 ${r(0.5)}px ${BLUE}`,
          background: YELLOW,
        }}
      />
    </div>
    {/* Hand (nth-of-type(5)) */}
    <div
      style={{
        ...abs(),
        transform: `translate(${r(36)}px, ${r(5)}px)`,
        border: `${r(0.3)}px solid ${BLUE}`,
        width: r(2),
        height: r(3.85),
        borderRadius: r(1),
        background: "#fff",
        boxShadow: [
          `${r(0.75)}px ${r(0.3)}px 0 ${r(-0.3)}px #fff`,
          `${r(0.75)}px ${r(0.3)}px 0 ${BLUE}`,
          `${r(1.75)}px ${r(0.5)}px 0 ${r(-0.5)}px #fff`,
          `${r(1.75)}px ${r(0.5)}px 0 ${r(-0.2)}px ${BLUE}`,
          `${r(2.65)}px ${r(0.6)}px 0 ${r(-0.8)}px #fff`,
          `${r(2.65)}px ${r(0.6)}px 0 ${r(-0.4)}px ${BLUE}`,
        ].join(", "),
      }}
    >
      {/* Thumb :before */}
      <div
        style={{
          ...abs(),
          transform: `translate(${r(-1)}px, ${r(-0.75)}px)`,
          border: `${r(0.5)}px solid ${BLUE}`,
          borderBottom: "none",
          width: r(1.65),
          height: r(4),
          borderRadius: `${r(1)}px ${r(1)}px 0 0`,
          background: "#fff",
        }}
      />
      {/* Wrist curve :after */}
      <div
        style={{
          ...abs(),
          transform: `translate(0, ${r(3.5)}px)`,
          width: r(2),
          height: r(2),
          borderRadius: "0 100% 0 0",
          boxShadow: `${r(0.3)}px ${r(-0.3)}px 0 ${BLUE}`,
        }}
      />
    </div>
  </>
);

// ── Shoulder / collar piece (nth-of-type(9)) ──

const ShoulderPiece: React.FC = () => (
  <div
    style={{
      ...abs(),
      width: r(50),
      height: r(37),
      transform: `translate(${r(25)}px, ${r(19)}px)`,
      overflow: "hidden",
    }}
  >
    {/* Inner arc :after */}
    <div
      style={{
        ...abs(),
        width: r(50),
        height: r(53),
        transform: `translate(${r(2)}px, ${r(-8)}px)`,
        boxShadow: `inset 0 0 0 ${r(0.5)}px ${BLUE}, 0 0 0 ${r(1)}px #fff`,
        borderRadius: "50%",
      }}
    />
    {/* Strap :before */}
    <div
      style={{
        ...abs(),
        width: r(15),
        background: BODY,
        height: r(2),
        transform: `translate(${r(8.5)}px, 0) skewX(-35deg)`,
        boxShadow: `0 0 0 ${r(0.5)}px ${BLUE}, 0 0 0 ${r(1)}px ${BODY}, 0 0 0 ${r(1.5)}px ${YELLOW}`,
      }}
    />
  </div>
);

// ── Bottom wrist (nth-of-type(10)) ──

const BottomWrist: React.FC = () => (
  <div
    style={{
      ...abs(),
      width: r(10),
      height: r(8),
      transform: `translate(${r(32.5)}px, ${r(40.5)}px)`,
      overflow: "hidden",
    }}
  >
    {/* Upper cuff :before */}
    <div
      style={{
        ...abs(),
        borderRadius: "50%",
        transform: `translate(${r(-2.5)}px, ${r(-2.5)}px)`,
        width: r(7.5),
        height: r(5),
        border: `${r(0.5)}px solid ${BLUE}`,
        boxShadow: `0 0 0 ${r(1)}px ${YELLOW}`,
      }}
    />
    {/* Lower cuff :after */}
    <div
      style={{
        ...abs(),
        borderRadius: "50%",
        transform: `translate(${r(-2.5)}px, ${r(5)}px)`,
        width: r(7.5),
        height: r(6),
        border: `${r(0.5)}px solid ${BLUE}`,
        boxShadow: `0 0 0 ${r(1)}px ${YELLOW}`,
      }}
    />
  </div>
);

// ── Bottom arm diamond (nth-of-type(11)) ──

const BottomArm: React.FC = () => (
  <div
    style={{
      ...abs(),
      width: r(10),
      height: r(4),
      transform: `translate(${r(33.75)}px, ${r(42.2)}px) scaleY(0.7)`,
      overflow: "hidden",
    }}
  >
    {/* Diamond :after */}
    <div
      style={{
        ...abs(),
        width: r(2.5),
        height: r(2.5),
        transform: `translate(0, ${r(0.5)}px) rotate(45deg)`,
        background: BLUE,
        border: `${r(0.75)}px solid ${YELLOW}`,
        boxShadow: `0 0 0 ${r(0.5)}px ${BLUE}, 0 0 0 ${r(2)}px ${YELLOW}`,
      }}
    />
  </div>
);

// ── Bottom epaulette (nth-of-type(12)) ──

const BottomEpaulette: React.FC = () => (
  <div
    style={{
      ...abs(),
      transform: `translate(${r(-1)}px, ${r(21.5)}px)`,
      width: r(45),
      height: r(32),
      borderRadius: "50%",
      overflow: "hidden",
    }}
  >
    {/* Striped section :before */}
    <div
      style={{
        ...abs(),
        width: r(20),
        height: r(8),
        background: `repeating-linear-gradient(-45deg, ${BLUE}, ${BLUE} ${r(0.2)}px, transparent ${r(0.2)}px, transparent ${r(1)}px), ${YELLOW}`,
        transform: `translate(${r(38)}px, ${r(19)}px)`,
        border: `${r(0.5)}px solid ${BLUE}`,
      }}
    />
    {/* Button :after */}
    <div
      style={{
        ...abs(),
        width: r(2.5),
        height: r(5),
        transform: `translate(${r(33.5)}px, ${r(20.25)}px)`,
        background: YELLOW,
        border: `${r(0.4)}px solid ${BLUE}`,
        borderRadius: "50%",
      }}
    />
  </div>
);

// ── Bottom hand (nth-of-type(13)) ──

const BottomHand: React.FC = () => (
  <div
    style={{
      ...abs(),
      transform: `translate(${r(28.5)}px, ${r(46)}px)`,
      border: `${r(0.4)}px solid ${BLUE}`,
      borderTop: "none",
      width: r(4.25),
      height: r(2),
      borderRadius: `${r(1.5)}px 0 100% ${r(0.75)}px`,
      background: "#fff",
      boxShadow: `${r(0.75)}px ${r(-1)}px 0 ${BLUE}`,
    }}
  >
    {/* Fingers :before */}
    <div
      style={{
        ...abs(),
        transform: `translate(${r(-4)}px, ${r(-2)}px)`,
        border: `${r(0.4)}px solid ${BLUE}`,
        borderRight: "none",
        width: r(5.5),
        height: r(1.8),
        borderRadius: `${r(1)}px 0 0 ${r(1)}px`,
        background: "#fff",
        boxShadow: [
          `${r(0.7)}px ${r(1)}px 0 ${r(-0.4)}px #fff`,
          `${r(0.3)}px ${r(1.4)}px 0 ${r(-0.4)}px ${BLUE}`,
          `${r(0.8)}px ${r(-1.3)}px 0 ${r(-0.5)}px #fff`,
          `${r(0.8)}px ${r(-1.3)}px 0 ${r(-0.1)}px ${BLUE}`,
          `${r(1.8)}px ${r(-2.3)}px 0 ${r(-0.6)}px #fff`,
          `${r(1.8)}px ${r(-2.3)}px 0 ${r(-0.2)}px ${BLUE}`,
        ].join(", "),
      }}
    />
    {/* Palm :after */}
    <div
      style={{
        ...abs(),
        transform: `translate(${r(1)}px, ${r(-4.2)}px)`,
        width: r(4),
        height: r(4.5),
        borderRadius: "0 100% 100% 0",
        border: `${r(0.4)}px solid ${BLUE}`,
        borderLeft: "none",
        borderBottom: "none",
        background: "#fff",
      }}
    />
  </div>
);

// ── Picture Area — assembles all illustration elements ──

const PictureArea: React.FC = () => (
  <div
    style={{
      ...abs(),
      border: `${r(0.5)}px solid ${BLUE}`,
      width: "68%",
      height: "79.5%",
      bottom: 0,
      right: 0,
      margin: "auto",
      borderRadius: r(0.5),
      overflow: "hidden",
    }}
  >
    {/* Order matches the original nth-of-type rendering order */}
    <Arm />
    <Body />
    <Sword />
    <Crown />
    <Face />
    <BigHeart />
    <ShoulderPiece />
    <BottomWrist />
    <BottomArm />
    <BottomEpaulette />
    <BottomHand />
  </div>
);

// ── One half of the card face (king is mirrored top-bottom) ──

const KingHalf: React.FC<{ flipped?: boolean }> = ({ flipped }) => (
  <div
    style={{
      ...abs(),
      width: "100%",
      height: "100%",
      transform: flipped ? "rotate(180deg)" : undefined,
    }}
  >
    <CornerPip flipped={flipped} />
    <PictureArea />
  </div>
);

// ── Card front face ──

const CardFront: React.FC = () => (
  <div
    style={{
      ...abs(),
      width: "100%",
      height: "100%",
      transform: `translateZ(${r(0.1)}px)`,
      backfaceVisibility: "hidden",
    }}
  >
    <KingHalf />
    <KingHalf flipped />
  </div>
);

// ── Card back — cross-hatch pattern ──

const CardBack: React.FC = () => (
  <div
    style={{
      ...abs(),
      transform: `translateZ(${r(-0.1)}px) rotateY(180deg)`,
      width: "100%",
      height: "100%",
      backfaceVisibility: "hidden",
      borderRadius: r(5),
      background: CARD,
    }}
  >
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        margin: "auto",
        width: "90%",
        height: "93%",
        boxShadow: `0 0 0 ${r(1)}px ${BLUE}, inset 0 0 0 ${r(1)}px ${BLUE}, inset 0 0 0 ${r(2)}px ${CARD}`,
        borderRadius: r(1),
        border: `${r(2)}px solid transparent`,
        backgroundPosition: `${r(0.9)}px ${r(0.99)}px`,
        backgroundImage: [
          `repeating-linear-gradient(45deg, transparent, transparent ${r(0.99)}px, ${BLUE} ${r(0.99)}px, ${BLUE} ${r(1.98)}px)`,
          `repeating-linear-gradient(-45deg, transparent, transparent ${r(0.99)}px, ${BLUE} ${r(0.99)}px, ${BLUE} ${r(1.98)}px)`,
        ].join(", "),
      }}
    />
  </div>
);

// ── Main Composition ──

export const Scene19: React.FC = () => {
  const frame = useCurrentFrame();

  // Continuous rotation: the original CSS does rotate3d(1,1,0,-360deg)
  // driven by scroll(). We map frames 0-600 to a smooth continuous rotation.
  //
  // Phase 1 (frames 0-60): initial spring-in rotation — card enters with a
  // satisfying spring settling onto the diagonal axis.
  // Phase 2 (frames 60-600): continuous linear rotation, simulating scroll.

  const springVal = spring({
    fps: FPS,
    frame,
    config: {
      damping: 14,
      stiffness: 80,
      mass: 1,
    },
    durationInFrames: 90,
  });

  // After the spring settles (~90 frames), blend into continuous linear rotation.
  // The spring reaches -360deg. Then we continue smoothly from there.
  const continuousAngle = frame > 90
    ? -360 + ((frame - 90) / 510) * -720
    : 0;

  // Blend: spring dominates early, continuous takes over
  const blendT = interpolate(frame, [60, 90], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const springAngle = springVal * -360;
  const totalRotation = frame <= 60
    ? springAngle
    : springAngle * (1 - blendT) + (springAngle + continuousAngle) * blendT;

  const tiltDeg = 1;

  // Shadow — morphs with card rotation
  const rotNorm = ((totalRotation % 360) + 360) % 360;
  const shadowRad = (rotNorm * Math.PI) / 180;

  const shadowRotation = rotNorm;
  const shadowSkew = interpolate(
    Math.sin(shadowRad),
    [-1, 0, 1],
    [-90, 0, 90],
  );
  const shadowOpacity = interpolate(
    Math.abs(Math.cos(shadowRad / 2)),
    [0, 1],
    [0, 0.2],
  );

  // Lighting — simulates light sweeping across as card turns
  const lightAngle = totalRotation % 360;
  const lightRad = (lightAngle * Math.PI) / 180;
  const lightFrontOpacity = interpolate(
    Math.sin(lightRad),
    [-1, 0, 1],
    [0.7, 0, 0],
  );
  const lightBackOpacity = interpolate(
    Math.sin(lightRad),
    [-1, 0, 1],
    [0, 0, 0.3],
  );

  // Scroll indicator
  const bobY = Math.sin((frame / FPS) * Math.PI * 2 * (1 / 1.2)) * r(1);
  const textOpacity = interpolate(frame, [54, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scrollProgress = frame > 60 ? (frame - 60) / 540 : 0;
  const arrowFlip = interpolate(scrollProgress, [0, 1], [1, -1]);

  return (
    <AbsoluteFill
      style={{
        background: BODY,
        overflow: "hidden",
      }}
    >
      {/* Background radial gradient */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background: `radial-gradient(#BD243F, ${BODY})`,
          backgroundSize: "100% 75%",
        }}
      />

      {/* Card container */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          perspective: r(200),
          transformStyle: "preserve-3d",
        }}
      >
        {/* Shadow */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: r(70),
            height: r(100),
            marginLeft: r(-35),
            background: BODY,
            borderRadius: r(10),
            transform: `translate3d(0, ${r(90)}px, ${r(-50)}px) rotateX(90deg) rotate(${shadowRotation}deg) skewY(${shadowSkew}deg)`,
            opacity: shadowOpacity,
            boxShadow: `0 0 2vmin ${BODY}, 0 0 5vmin ${BODY}`,
          }}
        />

        {/* Card */}
        <div
          style={{
            position: "relative",
            top: r(6),
            width: CARD_W,
            height: CARD_H,
            background: "#fff",
            borderRadius: r(5),
            transformStyle: "preserve-3d",
            transform: `rotate3d(1, 1, 0, ${totalRotation}deg) rotate(${tiltDeg}deg)`,
            marginTop: 80,
          }}
        >
          {/* Lighting overlay — front */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: "100%",
              height: "100%",
              borderRadius: r(5),
              transform: `translateZ(${r(0.2)}px)`,
              backgroundImage: `linear-gradient(to right bottom, rgba(25,13,35,0.2), transparent, rgba(255,255,255,0.1), transparent, rgba(25,13,35,0.3))`,
              backgroundColor: `rgba(245,227,227,${lightFrontOpacity})`,
              pointerEvents: "none",
              zIndex: 10,
            }}
          />
          {/* Lighting overlay — back */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: "100%",
              height: "100%",
              borderRadius: r(5),
              transform: `translateZ(${r(-0.2)}px) rotateY(180deg)`,
              backgroundImage: `linear-gradient(to right bottom, rgba(25,13,35,0.2), transparent, rgba(255,255,255,0.1), transparent, rgba(25,13,35,0.3))`,
              boxShadow: `inset 0 0 ${r(1)}px rgba(25,13,35,0.5)`,
              backgroundColor: `rgba(25,13,35,${lightBackOpacity})`,
              pointerEvents: "none",
              zIndex: 10,
            }}
          />

          <CardFront />
          <CardBack />
        </div>
      </div>

      {/* "Scroll" text indicator */}
      <div
        style={{
          position: "absolute",
          right: r(6),
          bottom: r(6),
          color: CARD,
          fontFamily: "'Courier New', monospace",
          fontSize: r(12),
          opacity: textOpacity,
        }}
      >
        Scroll{" "}
        <span
          style={{
            display: "inline-block",
            transform: `translateY(${bobY}px) scaleY(${arrowFlip})`,
          }}
        >
          {"\u2193"}
        </span>
      </div>
    </AbsoluteFill>
  );
};
