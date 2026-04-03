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
// 600 frames at 60fps = 10s. One full rotation every ~4s, with the
// card flipping between front and back.

import React, { CSSProperties } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
} from "remotion";

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
const CARD_W = 64.5 * REM; // ~484px
const CARD_H = 96 * REM; // ~720px

// ── Easing helpers ──

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

// ── Keyframe helpers ──

// ── Sub-components ──

const abs = (extra?: CSSProperties): CSSProperties => ({
  position: "absolute",
  left: 0,
  top: 0,
  display: "block",
  boxSizing: "border-box",
  ...extra,
});

const rem = (n: number) => n * REM;

/** Heart shape built from CSS (circle + circle + rotated square). */
const Heart: React.FC<{
  size: number;
  color: string;
  style?: CSSProperties;
}> = ({ size, color, style }) => {
  const r = size / 2;
  return (
    <div
      style={{
        ...abs(),
        width: size * 1.4,
        height: size * 1.4,
        ...style,
      }}
    >
      {/* Left circle */}
      <div
        style={{
          ...abs(),
          width: size,
          height: size,
          borderRadius: "50%",
          background: color,
          transform: `translate(0, 0)`,
        }}
      />
      {/* Right circle */}
      <div
        style={{
          ...abs(),
          width: size,
          height: size,
          borderRadius: "50%",
          background: color,
          transform: `translate(${r}px, 0)`,
        }}
      />
      {/* Bottom diamond */}
      <div
        style={{
          ...abs(),
          width: size,
          height: size,
          background: color,
          transform: `translate(${r * 0.5}px, ${r * 0.5}px) rotate(45deg)`,
        }}
      />
    </div>
  );
};

/** The suit symbol — a small heart for King of Hearts corner pip. */
const CornerPip: React.FC<{ flipped?: boolean }> = ({ flipped }) => (
  <div
    style={{
      ...abs({
        transform: flipped
          ? `translate(${rem(2)}px, ${rem(13)}px) scaleX(0.7) rotate(180deg)`
          : `translate(${rem(2)}px, ${rem(13)}px) scaleX(0.7)`,
      }),
    }}
  >
    <Heart size={rem(4)} color={RED} />
    <div
      style={{
        ...abs(),
        color: RED,
        fontFamily: "'Courier New', monospace",
        fontSize: rem(12),
        fontWeight: 700,
        transform: `translate(0, ${rem(-12)}px)`,
        lineHeight: 1,
      }}
    >
      K
    </div>
  </div>
);

/** Crown — the yellow diamond with cutout arcs. */
const Crown: React.FC = () => (
  <div
    style={{
      ...abs(),
      width: rem(30),
      height: rem(30),
      background: YELLOW,
      boxShadow: `inset 0 0 0 ${rem(0.1)}px #fff, inset 0 0 0 ${rem(0.6)}px ${BLUE}`,
      transform: `translate(${rem(7)}px, ${rem(-23)}px) rotate(37deg) skewY(20deg)`,
      overflow: "hidden",
    }}
  >
    {/* White arc cutout */}
    <div
      style={{
        ...abs(),
        width: rem(40),
        height: rem(10),
        borderRadius: "50%",
        background: "#fff",
        transform: `translate(${rem(4)}px, ${rem(25.5)}px) rotate(-50deg)`,
        boxShadow: `0 0 0 ${rem(1.5)}px ${BODY}`,
      }}
    />
    {/* Crown points (box-shadow dots) */}
    <div
      style={{
        ...abs(),
        width: rem(1.5),
        height: rem(1.5),
        background: BODY,
        borderRadius: "50%",
        transform: `translate(${rem(16.5)}px, ${rem(26.5)}px) rotate(-1deg)`,
        boxShadow: [
          `0 0 0 ${rem(1.5)}px ${YELLOW}`,
          `0 0 0 ${rem(2)}px ${BODY}`,
          `${rem(5)}px ${rem(-5)}px 0 ${BODY}`,
          `${rem(5)}px ${rem(-5)}px 0 ${rem(1.5)}px ${YELLOW}`,
          `${rem(5)}px ${rem(-5)}px 0 ${rem(2)}px ${BODY}`,
          `${rem(10)}px ${rem(-10)}px 0 ${BODY}`,
          `${rem(10)}px ${rem(-10)}px 0 ${rem(1.5)}px ${YELLOW}`,
          `${rem(10)}px ${rem(-10)}px 0 ${rem(2)}px ${BODY}`,
        ].join(", "),
      }}
    />
  </div>
);

/** Face — simplified version of the king's face with eyes, nose, beard. */
const Face: React.FC = () => (
  <div
    style={{
      ...abs(),
      width: rem(40),
      height: rem(20),
      transform: `translate(${rem(-0.5)}px, ${rem(6.5)}px)`,
      borderRadius: "50%",
      overflow: "hidden",
    }}
  >
    {/* Hair / Head shape */}
    <div
      style={{
        ...abs(),
        width: rem(3),
        height: rem(14),
        borderRadius: rem(2),
        transform: `translate(${rem(15)}px, ${rem(-4)}px) rotate(25deg)`,
        boxShadow: [
          `${rem(0.4)}px ${rem(0.4)}px 0 ${BLUE}`,
          `${rem(1)}px ${rem(0.8)}px 0 #fff`,
          `${rem(1.4)}px ${rem(1.2)}px 0 ${BLUE}`,
          `${rem(2)}px ${rem(1.6)}px 0 #fff`,
          `${rem(2.4)}px ${rem(2)}px 0 ${BLUE}`,
          `${rem(3)}px ${rem(2.4)}px 0 #fff`,
          `${rem(3.4)}px ${rem(2.8)}px 0 ${BLUE}`,
          `${rem(4)}px ${rem(2.3)}px 0 #fff`,
          `${rem(4.4)}px ${rem(2.6)}px 0 ${BLUE}`,
          `${rem(5)}px ${rem(2)}px 0 #fff`,
          `${rem(5.4)}px ${rem(2.1)}px 0 ${BLUE}`,
        ].join(", "),
      }}
    >
      {/* Face shape */}
      <div
        style={{
          ...abs(),
          background: "#fff",
          width: rem(10.8),
          height: rem(12),
          borderRadius: `${rem(5)}px 0 60% ${rem(2)}px / ${rem(1.25)}px 0 60% ${rem(5)}px`,
          transform: `translate(${rem(1.5)}px, ${rem(1)}px) rotate(-29deg)`,
          boxShadow: `${rem(-0.4)}px ${rem(-0.3)}px 0 ${BLUE}`,
        }}
      />
      {/* Big beardy bit */}
      <div
        style={{
          ...abs(),
          width: rem(7),
          height: rem(10),
          borderRadius: rem(2.5),
          transform: `translate(${rem(6.5)}px, ${rem(4)}px) rotate(-55deg)`,
          border: `${rem(0.4)}px solid #fff`,
          boxShadow: [
            `0 0 0 ${rem(0.4)}px ${BLUE}`,
            `inset 0 0 0 ${rem(0.4)}px ${BLUE}`,
            `inset ${rem(0.5)}px 0 0 ${rem(0.4)}px #fff`,
            `inset ${rem(0.9)}px 0 0 ${rem(0.4)}px ${BLUE}`,
            `inset ${rem(1.4)}px ${rem(0.2)}px 0 ${rem(0.4)}px #fff`,
            `inset ${rem(1.8)}px ${rem(0.2)}px 0 ${rem(0.4)}px ${BLUE}`,
            `inset ${rem(2.3)}px ${rem(0.4)}px 0 ${rem(0.4)}px #fff`,
            `inset ${rem(2.7)}px ${rem(0.4)}px 0 ${rem(0.4)}px ${BLUE}`,
            `inset ${rem(3.2)}px ${rem(0.8)}px 0 ${rem(0.4)}px #fff`,
            `inset ${rem(3.6)}px ${rem(0.8)}px 0 ${rem(0.4)}px ${BLUE}`,
            `inset ${rem(-0.5)}px 0 0 ${rem(0.4)}px #fff`,
            `inset ${rem(-0.9)}px 0 0 ${rem(0.4)}px ${BLUE}`,
            `inset ${rem(-1.4)}px ${rem(0.2)}px 0 ${rem(0.4)}px #fff`,
            `inset ${rem(-1.8)}px ${rem(0.2)}px 0 ${rem(0.4)}px ${BLUE}`,
            `inset ${rem(-2.3)}px ${rem(0.4)}px 0 ${rem(0.4)}px #fff`,
            `inset ${rem(-2.7)}px ${rem(0.4)}px 0 ${rem(0.4)}px ${BLUE}`,
          ].join(", "),
        }}
      />
    </div>
    {/* Spiral curl */}
    <div
      style={{
        ...abs(),
        width: rem(1),
        height: rem(1),
        background: "#fff",
        borderRadius: "50%",
        transform: `translate(${rem(13.35)}px, ${rem(7.85)}px)`,
        boxShadow: [
          `${rem(0.4)}px 0 0 ${BLUE}`,
          `${rem(0.4)}px ${rem(0.4)}px 0 ${rem(0.3)}px #fff`,
          `${rem(0.1)}px ${rem(0.4)}px 0 ${rem(0.6)}px ${BLUE}`,
        ].join(", "),
      }}
    />
    {/* More curls */}
    <div
      style={{
        ...abs(),
        width: rem(1.5),
        height: rem(1.5),
        background: "#fff",
        borderRadius: "50%",
        transform: `translate(${rem(25)}px, ${rem(10.65)}px)`,
        boxShadow: [
          `${rem(0.4)}px 0 0 ${BLUE}`,
          `${rem(0.4)}px ${rem(0.4)}px 0 ${rem(0.4)}px #fff`,
          `${rem(0.1)}px ${rem(0.4)}px 0 ${rem(0.6)}px ${BLUE}`,
        ].join(", "),
      }}
    />
    {/* Eyebrow */}
    <div
      style={{
        ...abs(),
        width: rem(3),
        height: rem(1),
        borderRadius: "50%",
        borderTop: `${rem(0.4)}px solid ${BLUE}`,
        transform: `translate(${rem(21)}px, ${rem(1)}px)`,
        boxShadow: `${rem(-5)}px ${rem(0.4)}px 0 #fff, ${rem(-5.5)}px 0 0 ${BLUE}`,
      }}
    />
    {/* Eye 1 */}
    <div
      style={{
        ...abs(),
        width: rem(0.6),
        height: rem(0.6),
        background: BLUE,
        borderRadius: "50%",
        boxShadow: `0 0 0 ${rem(0.5)}px #fff, 0 0 0 ${rem(0.8)}px ${BLUE}`,
        transform: `translate(${rem(21.5)}px, ${rem(3)}px) rotate(5deg)`,
      }}
    />
    {/* Eye 2 */}
    <div
      style={{
        ...abs(),
        width: rem(0.6),
        height: rem(0.6),
        background: BLUE,
        borderRadius: "50%",
        boxShadow: `0 0 0 ${rem(0.5)}px #fff, 0 0 0 ${rem(0.8)}px ${BLUE}`,
        transform: `translate(${rem(16.6)}px, ${rem(2.75)}px) rotate(5deg)`,
      }}
    />
    {/* Nose */}
    <div
      style={{
        ...abs(),
        width: rem(2),
        height: rem(1.25),
        background: "#fff",
        borderRadius: "50%",
        boxShadow: `${rem(0.3)}px 0 0 0 ${BLUE}`,
        transform: `translate(${rem(18.75)}px, ${rem(6)}px) rotate(45deg)`,
      }}
    />
    {/* Mouth */}
    <div
      style={{
        ...abs(),
        width: rem(0.6),
        height: rem(0.6),
        background: BLUE,
        borderRadius: "50%",
        boxShadow: `${rem(1)}px 0 0 0 ${BLUE}, ${rem(0.5)}px ${rem(0.3)}px 0 0 ${BLUE}`,
        transform: `translate(${rem(18.75)}px, ${rem(8.5)}px)`,
      }}
    />
  </div>
);

/** Large heart pip in the picture area. */
const BigHeart: React.FC = () => (
  <div
    style={{
      ...abs(),
      transform: `translate(${rem(0.5)}px, ${rem(2.5)}px) scaleX(0.7)`,
    }}
  >
    <Heart size={rem(8)} color={RED} />
  </div>
);

/** Body — the striped torso with coat of arms. */
const Body: React.FC = () => (
  <div
    style={{
      ...abs(),
      border: `${rem(0.5)}px solid ${BLUE}`,
      transform: `translate(${rem(-6.5)}px, ${rem(16)}px)`,
      width: rem(56),
      height: rem(43),
      borderRadius: "50% 48%",
      boxShadow: [
        `inset 0 0 0 ${rem(1)}px ${YELLOW}`,
        `inset 0 0 0 ${rem(4.5)}px ${BLUE}`,
        `inset 0 0 0 ${rem(5)}px ${YELLOW}`,
        `inset 0 0 0 ${rem(5.5)}px ${BLUE}`,
      ].join(", "),
      background: `repeating-linear-gradient(${RED}, ${RED} 50%, #fff 50%, #fff)`,
      backgroundSize: `100% ${rem(1)}px`,
      overflow: "hidden",
    }}
  >
    {/* Inner shirt section */}
    <div
      style={{
        ...abs(),
        width: rem(16),
        height: rem(53),
        transform: `translate(${rem(20)}px, 0)`,
        overflow: "hidden",
      }}
    >
      {/* Red triangle */}
      <div
        style={{
          ...abs(),
          height: rem(20),
          width: rem(35),
          background: RED,
          transform: `translate(${rem(-10)}px, ${rem(-10)}px) rotate(-45deg)`,
        }}
      />
      {/* White sash with pattern */}
      <div
        style={{
          ...abs(),
          height: rem(5),
          width: rem(30),
          background: "#fff",
          transform: `translate(${rem(-10)}px, ${rem(10)}px) rotate(-45deg)`,
          border: `${rem(0.5)}px solid #fff`,
          boxShadow: `inset 0 0 0 ${rem(0.4)}px ${BLUE}, 0 0 0 ${rem(0.4)}px ${BLUE}`,
          backgroundImage: [
            `radial-gradient(${RED} 25%, ${YELLOW} 35%, ${BODY} 45%, transparent 0)`,
            `radial-gradient(${RED} 25%, ${YELLOW} 35%, ${BODY} 45%, transparent 0)`,
          ].join(", "),
          backgroundSize: `${rem(6)}px ${rem(6)}px`,
          backgroundPosition: `0 0, ${rem(3)}px ${rem(3)}px`,
        }}
      />
      {/* Blue belt */}
      <div
        style={{
          ...abs(),
          transform: `translate(0, ${rem(18)}px)`,
          background: BLUE,
          height: rem(5),
          width: rem(20),
        }}
      >
        {/* Lower red triangle */}
        <div
          style={{
            ...abs(),
            height: rem(20),
            width: rem(35),
            background: RED,
            transform: `translate(${rem(-10)}px, ${rem(15)}px) rotate(-45deg)`,
          }}
        />
        {/* Lower sash with pattern */}
        <div
          style={{
            ...abs(),
            height: rem(5),
            width: rem(30),
            background: "#fff",
            transform: `translate(${rem(-10)}px, ${rem(12)}px) rotate(-45deg)`,
            border: `${rem(0.5)}px solid #fff`,
            boxShadow: `inset 0 0 0 ${rem(0.4)}px ${BLUE}, 0 0 0 ${rem(0.4)}px ${BLUE}`,
            backgroundImage: [
              `radial-gradient(${RED} 25%, ${YELLOW} 35%, ${BODY} 45%, transparent 0)`,
              `radial-gradient(${RED} 25%, ${YELLOW} 35%, ${BODY} 45%, transparent 0)`,
            ].join(", "),
            backgroundSize: `${rem(6)}px ${rem(6)}px`,
            backgroundPosition: `0 0, ${rem(3)}px ${rem(3)}px`,
          }}
        />
      </div>
    </div>
    {/* Right sleeve / circle section */}
    <div
      style={{
        ...abs(),
        width: rem(50),
        height: rem(60),
        border: `${rem(5)}px solid #fff`,
        borderLeftWidth: rem(3),
        transform: `translate(${rem(30)}px, ${rem(-9)}px)`,
        boxShadow: `inset 0 0 0 ${rem(0.5)}px ${BLUE}, 0 0 0 ${rem(0.5)}px ${BLUE}`,
        borderRadius: "50%",
        overflow: "hidden",
      }}
    >
      {/* Red upper section with blue inset */}
      <div
        style={{
          ...abs(),
          width: rem(40),
          height: rem(31),
          background: RED,
          boxShadow: `inset ${rem(5)}px ${rem(14)}px 0 0 ${BLUE}, inset 0 ${rem(14.9)}px 0 0 ${YELLOW}, inset 0 ${rem(15.3)}px 0 0 ${BLUE}`,
        }}
      />
      {/* Yellow stripe */}
      <div
        style={{
          ...abs(),
          width: rem(2),
          background: YELLOW,
          height: rem(30),
          transform: `translate(${rem(10.5)}px, 0)`,
          border: `solid ${rem(0.5)}px ${BLUE}`,
        }}
      />
    </div>
    {/* Dotted circle decoration */}
    <div
      style={{
        ...abs(),
        width: rem(50),
        height: rem(60),
        border: `${rem(2)}px dotted ${BLUE}`,
        transform: `translate(${rem(31)}px, ${rem(-9)}px)`,
        borderRadius: "50%",
      }}
    />
    {/* Yellow buttons on the body */}
    <div
      style={{
        ...abs(),
        width: rem(2),
        height: rem(2),
        background: YELLOW,
        transform: `translate(${rem(45.75)}px, ${rem(31.4)}px)`,
        boxShadow: `${rem(-2.5)}px ${rem(2)}px 0 0 ${YELLOW}, ${rem(-5.5)}px ${rem(4)}px 0 0 ${YELLOW}`,
      }}
    />
  </div>
);

/** Arm — yellow sleeve with decorative elements. */
const Arm: React.FC = () => (
  <div
    style={{
      ...abs(),
      transform: `translate(${rem(30)}px, ${rem(13)}px)`,
      height: rem(20),
      width: rem(20),
      background: YELLOW,
    }}
  >
    {/* White circle cutout */}
    <div
      style={{
        ...abs(),
        borderRadius: "50%",
        background: "#fff",
        width: rem(10),
        height: rem(30),
        boxShadow: `${rem(-0.4)}px ${rem(0.4)}px 0 0 ${BLUE}, ${rem(-12.5)}px ${rem(-1)}px 0 0 #fff, ${rem(-12)}px ${rem(-1)}px 0 0 ${BLUE}`,
        transform: `translate(${rem(9)}px, ${rem(-22)}px)`,
      }}
    />
    {/* White background extension */}
    <div
      style={{
        ...abs(),
        background: "#fff",
        width: rem(30),
        height: rem(20),
        transform: `translate(0, ${rem(-20)}px)`,
      }}
    />
    {/* Red/yellow diamond ornament */}
    <div
      style={{
        ...abs(),
        background: RED,
        border: `${rem(0.5)}px solid ${BLUE}`,
        transform: `translate(${rem(5)}px, ${rem(9)}px) rotate(-40deg) skewY(-30deg)`,
        width: rem(10),
        height: rem(10),
        boxShadow: `0 0 0 ${rem(1)}px ${YELLOW}, 0 0 0 ${rem(1.5)}px ${BLUE}`,
        zIndex: -1,
        borderRadius: "50% 0",
      }}
    />
  </div>
);

/** Sword — handle, blade, and guard. */
const Sword: React.FC = () => (
  <>
    {/* Blade guard */}
    <div
      style={{
        ...abs(),
        transform: `translate(${rem(31.25)}px, ${rem(6)}px)`,
        border: `${rem(0.5)}px solid ${BLUE}`,
        width: rem(3),
        height: rem(3),
        boxShadow: `inset 0 0 0 ${rem(0.5)}px #fff, inset 0 0 0 ${rem(1)}px ${BLUE}, ${rem(-3)}px 0 0 0 ${BLUE}`,
      }}
    >
      {/* Pommel */}
      <div
        style={{
          ...abs(),
          transform: `translate(${rem(4)}px, ${rem(5)}px)`,
          width: rem(3.5),
          height: rem(1.5),
          borderRadius: "50%",
          boxShadow: `0 0 0 ${rem(0.5)}px ${BLUE}`,
          background: YELLOW,
        }}
      />
    </div>
    {/* Handle */}
    <div
      style={{
        ...abs(),
        transform: `translate(${rem(35.25)}px, ${rem(6.5)}px)`,
        border: `${rem(0.5)}px solid ${BLUE}`,
        width: rem(4.75),
        height: rem(5.5),
        borderRadius: "50%",
        background: "#fff",
      }}
    >
      {/* Guard circle */}
      <div
        style={{
          ...abs(),
          transform: `translate(${rem(4)}px, ${rem(-0.1)}px)`,
          width: rem(2),
          height: rem(2),
          borderRadius: "100%",
          boxShadow: `0 0 0 ${rem(0.5)}px ${BLUE}, inset 0 ${rem(-0.25)}px 0 ${rem(0.5)}px ${YELLOW}, inset 0 ${rem(-0.5)}px 0 ${rem(1)}px ${BLUE}`,
          background: YELLOW,
        }}
      />
      {/* Grip */}
      <div
        style={{
          ...abs(),
          transform: `translate(${rem(-1.5)}px, ${rem(-3)}px)`,
          width: rem(1),
          height: rem(7),
          borderRadius: rem(0.5),
          boxShadow: `0 0 0 ${rem(0.5)}px ${BLUE}`,
          background: YELLOW,
        }}
      />
    </div>
    {/* Hand */}
    <div
      style={{
        ...abs(),
        transform: `translate(${rem(36)}px, ${rem(5)}px)`,
        border: `${rem(0.3)}px solid ${BLUE}`,
        width: rem(2),
        height: rem(3.85),
        borderRadius: rem(1),
        background: "#fff",
        boxShadow: [
          `${rem(0.75)}px ${rem(0.3)}px 0 ${rem(-0.3)}px #fff`,
          `${rem(0.75)}px ${rem(0.3)}px 0 ${BLUE}`,
          `${rem(1.75)}px ${rem(0.5)}px 0 ${rem(-0.5)}px #fff`,
          `${rem(1.75)}px ${rem(0.5)}px 0 ${rem(-0.2)}px ${BLUE}`,
          `${rem(2.65)}px ${rem(0.6)}px 0 ${rem(-0.8)}px #fff`,
          `${rem(2.65)}px ${rem(0.6)}px 0 ${rem(-0.4)}px ${BLUE}`,
        ].join(", "),
      }}
    >
      {/* Thumb */}
      <div
        style={{
          ...abs(),
          transform: `translate(${rem(-1)}px, ${rem(-0.75)}px)`,
          border: `${rem(0.5)}px solid ${BLUE}`,
          borderBottom: "none",
          width: rem(1.65),
          height: rem(4),
          borderRadius: `${rem(1)}px ${rem(1)}px 0 0`,
          background: "#fff",
        }}
      />
    </div>
  </>
);

/** The picture area — a blue-bordered rectangle containing the illustration. */
const PictureArea: React.FC = () => (
  <div
    style={{
      ...abs(),
      border: `${rem(0.5)}px solid ${BLUE}`,
      width: "68%",
      height: "79.5%",
      bottom: 0,
      right: 0,
      margin: "auto",
      borderRadius: rem(0.5),
      overflow: "hidden",
    }}
  >
    <Crown />
    <BigHeart />
    <Face />
    <Body />
    <Arm />
    <Sword />
  </div>
);

/** One half of the card face (the king is mirrored top-bottom). */
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

/** Card front face — the King illustration. */
const CardFront: React.FC = () => (
  <div
    style={{
      ...abs(),
      width: "100%",
      height: "100%",
      transform: `translateZ(${rem(0.1)}px)`,
      backfaceVisibility: "hidden",
    }}
  >
    <KingHalf />
    <KingHalf flipped />
  </div>
);

/** Card back — traditional cross-hatch pattern in blue on cream. */
const CardBack: React.FC = () => (
  <div
    style={{
      ...abs(),
      transform: `translateZ(${rem(-0.1)}px) rotateY(180deg)`,
      width: "100%",
      height: "100%",
      backfaceVisibility: "hidden",
      borderRadius: rem(5),
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
        boxShadow: `0 0 0 ${rem(1)}px ${BLUE}, inset 0 0 0 ${rem(1)}px ${BLUE}, inset 0 0 0 ${rem(2)}px ${CARD}`,
        borderRadius: rem(1),
        border: `${rem(2)}px solid transparent`,
        backgroundPosition: `${rem(0.9)}px ${rem(0.99)}px`,
        backgroundImage: [
          `repeating-linear-gradient(45deg, transparent, transparent ${rem(0.99)}px, ${BLUE} ${rem(0.99)}px, ${BLUE} ${rem(1.98)}px)`,
          `repeating-linear-gradient(-45deg, transparent, transparent ${rem(0.99)}px, ${BLUE} ${rem(0.99)}px, ${BLUE} ${rem(1.98)}px)`,
        ].join(", "),
      }}
    />
  </div>
);

// ── Main Composition ──

export const Scene19: React.FC = () => {
  const frame = useCurrentFrame();

  // The animation has two layers:
  // 1. An initial "start" rotation (frames 0–60) that spins the card once
  // 2. A continuous "scroll" rotation (frames 60–600) driven by progress

  // Phase 1: Initial dramatic spin (first second)
  const introProgress = Math.min(frame / 60, 1);
  const introEased = easeInOutCubic(introProgress);

  // Phase 2: Continuous slow rotation (simulating scroll)
  const scrollProgress = frame > 60 ? (frame - 60) / 540 : 0;

  // Combine rotations — the original does rotate3d(1,1,0,-360deg)
  // which rotates around a diagonal axis. We replicate that.
  const totalRotation = frame <= 60
    ? introEased * -360
    : -360 + scrollProgress * -720; // Two more full rotations over the scroll phase

  // Card tilt (original has rotate(1deg) base)
  const tiltDeg = 1;

  // Shadow animation (morphs with rotation)
  const shadowRotation = frame <= 60
    ? introEased * 180
    : 180 + scrollProgress * 360;

  const shadowSkew = interpolate(
    Math.sin((shadowRotation * Math.PI) / 180),
    [-1, 0, 1],
    [-90, 0, 90],
  );

  const shadowOpacity = interpolate(
    Math.abs(Math.cos((shadowRotation * Math.PI) / 90)),
    [0, 1],
    [0, 0.2],
  );

  // Lighting effect — the before/after pseudo-elements simulate light
  // sweeping across the card surface as it rotates
  const lightAngle = totalRotation % 360;
  const lightFrontOpacity = interpolate(
    Math.sin((lightAngle * Math.PI) / 180),
    [-1, 0, 1],
    [0.7, 0, 0],
  );
  const lightBackOpacity = interpolate(
    Math.sin((lightAngle * Math.PI) / 180),
    [-1, 0, 1],
    [0, 0, 0.3],
  );

  // "Scroll" text bob animation
  const bobY = Math.sin((frame / 60) * Math.PI * 2 * (1 / 1.2)) * rem(1);

  // Text visibility — fades in over first second
  const textOpacity = interpolate(frame, [54, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Flip arrow direction (scaleY) driven by scroll progress
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
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background: `radial-gradient(#BD243F, ${BODY})`,
          backgroundSize: "100% 75%",
        }}
      />

      {/* Card container — centered */}
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
          perspective: rem(200),
          transformStyle: "preserve-3d",
        }}
      >
        {/* Shadow */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: rem(70),
            height: rem(100),
            marginLeft: rem(-35),
            background: BODY,
            borderRadius: rem(10),
            transform: `translate3d(0, ${rem(90)}px, ${rem(-50)}px) rotateX(90deg) rotate(${shadowRotation}deg) skewY(${shadowSkew}deg) scale(1)`,
            opacity: shadowOpacity,
            boxShadow: `0 0 2vmin ${BODY}, 0 0 5vmin ${BODY}`,
          }}
        />

        {/* Card */}
        <div
          style={{
            position: "relative",
            top: rem(6),
            width: CARD_W,
            height: CARD_H,
            background: "#fff",
            borderRadius: rem(5),
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
              borderRadius: rem(5),
              transform: `translateZ(${rem(0.2)}px)`,
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
              borderRadius: rem(5),
              transform: `translateZ(${rem(-0.2)}px) rotateY(180deg)`,
              backgroundImage: `linear-gradient(to right bottom, rgba(25,13,35,0.2), transparent, rgba(255,255,255,0.1), transparent, rgba(25,13,35,0.3))`,
              boxShadow: `inset 0 0 ${rem(1)}px rgba(25,13,35,0.5)`,
              backgroundColor: `rgba(25,13,35,${lightBackOpacity})`,
              pointerEvents: "none",
              zIndex: 10,
            }}
          />

          {/* Card front */}
          <CardFront />
          {/* Card back */}
          <CardBack />
        </div>
      </div>

      {/* "Scroll" text indicator */}
      <div
        style={{
          position: "absolute",
          right: rem(6),
          bottom: rem(6),
          color: CARD,
          fontFamily: "'Courier New', monospace",
          fontSize: rem(12),
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
