import React from "react";
import { AbsoluteFill } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { BlueGradient, LightGradient, DarkBg, SolidBlue, GridOverlay } from "./backgrounds";
import { useGsapProxy } from "./gsapUtils";

const { fontFamily } = loadFont("normal", { subsets: ["latin"], weights: ["400", "700", "800"] });
const BLUE = "#0040FF";

const baseText: React.CSSProperties = {
  fontFamily,
  fontWeight: 800,
  fontStyle: "italic",
  lineHeight: 1.15,
  display: "inline-block",
};

const center: React.CSSProperties = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  display: "flex",
  gap: 48,
  justifyContent: "center",
  whiteSpace: "nowrap",
};

/* ═══════════════════════════════════════════════════════
   Scene 01 — Intro  (48 frames = 2s @ 24fps)
   "What if" cross-fades to "using Base felt"
   ═══════════════════════════════════════════════════════ */

export const Scene01_Intro: React.FC = () => {
  const s = useGsapProxy(
    (tl, p) => {
      // "What" already visible at 0s
      // "if" fades in at 0.3s
      tl.to(p.if_, { opacity: 1, y: 0, duration: 0.15, ease: "power2.out" }, 0.3);
      // phraseA fades out at 0.7s over 0.2s
      tl.to(p.phraseA, { opacity: 0, duration: 0.2, ease: "power2.in" }, 0.7);
      // phraseB fades in at 0.8s, words stagger
      tl.to(p.phraseB, { opacity: 1, duration: 0.15, ease: "power2.out" }, 0.8);
      tl.to(p.using, { opacity: 1, y: 0, duration: 0.15, ease: "power2.out" }, 0.8);
      tl.to(p.base, { opacity: 1, y: 0, duration: 0.15, ease: "power2.out" }, 1.1);
      tl.to(p.felt, { opacity: 1, y: 0, duration: 0.15, ease: "power2.out" }, 1.4);
    },
    {
      phraseA: { opacity: 1 },
      what: { opacity: 1, y: 0 },
      if_: { opacity: 0, y: 15 },
      phraseB: { opacity: 0 },
      using: { opacity: 0, y: 15 },
      base: { opacity: 0, y: 15 },
      felt: { opacity: 0, y: 15 },
    },
  );

  return (
    <AbsoluteFill>
      <BlueGradient />
      <div style={{ ...center, opacity: s.phraseA.opacity }}>
        <span style={{ ...baseText, fontSize: 200, color: "#fff", opacity: s.what.opacity, transform: `translateY(${s.what.y}px)` }}>
          What
        </span>
        <span style={{ ...baseText, fontSize: 200, color: "#fff", opacity: s.if_.opacity, transform: `translateY(${s.if_.y}px)` }}>
          if
        </span>
      </div>
      <div style={{ ...center, opacity: s.phraseB.opacity }}>
        <span style={{ ...baseText, fontSize: 200, color: "#fff", opacity: s.using.opacity, transform: `translateY(${s.using.y}px)` }}>
          using
        </span>
        <span style={{ ...baseText, fontSize: 200, color: "#fff", opacity: s.base.opacity, transform: `translateY(${s.base.y}px)` }}>
          Base
        </span>
        <span style={{ ...baseText, fontSize: 200, color: "#fff", opacity: s.felt.opacity, transform: `translateY(${s.felt.y}px)` }}>
          felt
        </span>
      </div>
    </AbsoluteFill>
  );
};

/* ═══════════════════════════════════════════════════════
   Scene 02 — Numbers  (48 frames = 2s @ 24fps)
   2 → 10 → "times" → "faster"
   ═══════════════════════════════════════════════════════ */

export const Scene02_Numbers: React.FC = () => {
  const s = useGsapProxy(
    (tl, p) => {
      // "2" visible at start, snaps to 10
      tl.to(p.num, { value: 10, duration: 0.15, snap: { value: 1 } }, 0.0);
      // num fades out
      tl.to(p.num, { opacity: 0, duration: 0.08, ease: "power2.in" }, 0.15);
      // "times" fades in
      tl.to(p.word, { opacity: 1, y: 0, duration: 0.12, ease: "power2.out" }, 0.2);
      // "times" fades out
      tl.to(p.word, { opacity: 0, duration: 0.1, ease: "power2.in" }, 0.8);
      // switch text flag then "faster" fades in
      tl.to(p.wordText, { v: 1, duration: 0.01 }, 0.85);
      tl.to(p.word, { opacity: 1, y: 0, duration: 0.12, ease: "power2.out" }, 0.9);
    },
    {
      num: { value: 2, opacity: 1, scale: 1 },
      word: { opacity: 0, y: 15 },
      wordText: { v: 0 },
    },
  );

  const showNum = s.num.opacity > 0.01;
  const wordLabel = s.wordText.v < 0.5 ? "times" : "faster";
  const isFaster = s.wordText.v >= 0.5;

  return (
    <AbsoluteFill>
      <LightGradient />
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}>
        {showNum && (
          <span
            style={{
              ...baseText,
              position: "absolute",
              left: "50%",
              transform: "translate(-50%, 0)",
              fontSize: 340,
              color: BLUE,
              opacity: s.num.opacity,
              whiteSpace: "nowrap",
            }}
          >
            {Math.round(s.num.value)}
          </span>
        )}
        {s.word.opacity > 0.01 && (
          <span
            style={{
              ...baseText,
              position: "absolute",
              left: "50%",
              transform: `translate(-50%, ${s.word.y}px)`,
              fontSize: isFaster ? 315 : 290,
              fontStyle: isFaster ? "italic" : "italic",
              color: BLUE,
              opacity: s.word.opacity,
              whiteSpace: "nowrap",
            }}
          >
            {wordLabel}
          </span>
        )}
      </div>
    </AbsoluteFill>
  );
};

/* ═══════════════════════════════════════════════════════
   Scene 03 — DarkGrid  (84 frames = 3.5s @ 24fps)
   Phase 1: single words flash. Phase 2: title slides in.
   ═══════════════════════════════════════════════════════ */

export const Scene03_DarkGrid: React.FC = () => {
  const s = useGsapProxy(
    (tl, p) => {
      // Phase 1: word flashes — each replaces the previous
      // "say" visible immediately, exits at 0.35s
      tl.to(p.say, { opacity: 0, duration: 0.08, ease: "power2.in" }, 0.35);
      // "hello" enters at 0.35s
      tl.to(p.hello, { opacity: 1, y: 0, duration: 0.1, ease: "power2.out" }, 0.35);
      tl.to(p.hello, { opacity: 0, duration: 0.08, ease: "power2.in" }, 0.7);
      // "to" enters at 0.7s
      tl.to(p.to, { opacity: 1, y: 0, duration: 0.1, ease: "power2.out" }, 0.7);
      tl.to(p.to, { opacity: 0, duration: 0.08, ease: "power2.in" }, 1.0);
      // "Flashblocks" enters at 1.0s
      tl.to(p.flash, { opacity: 1, y: 0, duration: 0.12, ease: "power2.out" }, 1.0);
      // Phase 1 cross-fades out at 1.5s
      tl.to(p.phase1, { opacity: 0, duration: 0.15, ease: "power2.in" }, 1.5);
      // Phase 2: title slides in from right at 1.6s
      tl.to(p.phase2, { opacity: 1, duration: 0.15, ease: "power2.out" }, 1.6);
      tl.to(p.title, { x: 0, duration: 0.4, ease: "power2.out" }, 1.6);
    },
    {
      phase1: { opacity: 1 },
      say: { opacity: 1, y: 0 },
      hello: { opacity: 0, y: 15 },
      to: { opacity: 0, y: 15 },
      flash: { opacity: 0, y: 15 },
      phase2: { opacity: 0 },
      title: { x: 50 },
    },
  );

  return (
    <AbsoluteFill>
      <DarkBg />
      <GridOverlay color="rgba(255,255,255,0.18)" cols={10} rows={7} />

      {/* Phase 1 — single words, centered */}
      <div style={{ ...center, opacity: s.phase1.opacity }}>
        {s.say.opacity > 0.01 && (
          <span style={{ ...baseText, fontStyle: "normal", position: "absolute", left: "50%", transform: `translate(-50%, ${s.say.y}px)`, fontSize: 145, color: "#fff", opacity: s.say.opacity, whiteSpace: "nowrap" }}>
            say
          </span>
        )}
        {s.hello.opacity > 0.01 && (
          <span style={{ ...baseText, fontStyle: "normal", position: "absolute", left: "50%", transform: `translate(-50%, ${s.hello.y}px)`, fontSize: 145, color: "#fff", opacity: s.hello.opacity, whiteSpace: "nowrap" }}>
            hello
          </span>
        )}
        {s.to.opacity > 0.01 && (
          <span style={{ ...baseText, fontStyle: "normal", position: "absolute", left: "50%", transform: `translate(-50%, ${s.to.y}px)`, fontSize: 145, color: "#fff", opacity: s.to.opacity, whiteSpace: "nowrap" }}>
            to
          </span>
        )}
        {s.flash.opacity > 0.01 && (
          <span style={{ ...baseText, fontStyle: "normal", position: "absolute", left: "50%", transform: `translate(-50%, ${s.flash.y}px)`, fontSize: 175, color: "#fff", opacity: s.flash.opacity, whiteSpace: "nowrap" }}>
            Flashblocks
          </span>
        )}
      </div>

      {/* Phase 2 — title card, left-aligned */}
      <div
        style={{
          position: "absolute",
          top: "55%",
          left: "8%",
          transform: `translateX(${s.title.x}px)`,
          opacity: s.phase2.opacity,
          maxWidth: "80%",
        }}
      >
        <span style={{ ...baseText, fontSize: 215, color: "#fff" }}>
          What are Flashblocks?
        </span>
      </div>
    </AbsoluteFill>
  );
};

/* ═══════════════════════════════════════════════════════
   Scene 04 — CubeExplode  (72 frames = 3s @ 24fps)
   Text word-by-word. White square → isometric cube → explosion.
   ═══════════════════════════════════════════════════════ */

const CUBE_SIZE = 500;
const SMALL_CUBE = 120;

function seededRand(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

const EXPLOSION_TARGETS = Array.from({ length: 10 }, (_, i) => {
  const angle = seededRand(i * 7 + 3) * Math.PI * 2;
  const dist = 300 + seededRand(i * 13 + 1) * 300;
  return {
    x: Math.cos(angle) * dist,
    y: Math.sin(angle) * dist * 0.8,
    rot: seededRand(i * 19 + 5) * 720 - 360,
  };
});

const CubeFace: React.FC<{ size: number; transform: string; shade: string }> = ({ size, transform, shade }) => (
  <div
    style={{
      position: "absolute",
      width: size,
      height: size,
      background: shade,
      border: "1.5px solid rgba(0,0,0,0.25)",
      transform,
      backfaceVisibility: "hidden",
    }}
  />
);

const IsoCube: React.FC<{ size: number; opacity?: number }> = ({ size, opacity = 1 }) => {
  const half = size / 2;
  return (
    <div
      style={{
        width: size,
        height: size,
        position: "relative",
        transformStyle: "preserve-3d",
        transform: "rotateX(-30deg) rotateY(45deg)",
        opacity,
      }}
    >
      <CubeFace size={size} transform={`translateZ(${half}px)`} shade="rgba(255,255,255,0.95)" />
      <CubeFace size={size} transform={`rotateX(90deg) translateZ(${half}px)`} shade="rgba(255,255,255,0.8)" />
      <CubeFace size={size} transform={`rotateY(90deg) translateZ(${half}px)`} shade="rgba(230,230,240,0.85)" />
    </div>
  );
};

type Scene04Proxies = {
  imagine: { opacity: number; y: number };
  breaking: { opacity: number; y: number };
  one: { opacity: number; y: number };
  full: { opacity: number; y: number };
  block: { opacity: number; y: number };
  into: { opacity: number; y: number };
  ten: { opacity: number; y: number };
  smaller: { opacity: number; y: number };
  ones: { opacity: number; y: number };
  cube: { opacity: number; rotX: number; rotY: number };
  cubeFade: { opacity: number };
  [key: `shard${number}`]: { x: number; y: number; rotation: number; opacity: number };
};

function buildScene04Proxies(): Scene04Proxies {
  const base: Record<string, Record<string, number>> = {
    imagine: { opacity: 0, y: 15 },
    breaking: { opacity: 0, y: 15 },
    one: { opacity: 0, y: 15 },
    full: { opacity: 0, y: 15 },
    block: { opacity: 0, y: 15 },
    into: { opacity: 0, y: 15 },
    ten: { opacity: 0, y: 15 },
    smaller: { opacity: 0, y: 15 },
    ones: { opacity: 0, y: 15 },
    cube: { opacity: 0, rotX: 0, rotY: 0 },
    cubeFade: { opacity: 1 },
  };
  for (let i = 0; i < 10; i++) {
    base[`shard${i}`] = { x: 0, y: 0, rotation: 0, opacity: 0 };
  }
  return base as unknown as Scene04Proxies;
}

export const Scene04_CubeExplode: React.FC = () => {
  const s = useGsapProxy<Scene04Proxies>(
    (tl, p) => {
      // Word-by-word text
      tl.to(p.imagine, { opacity: 1, y: 0, duration: 0.12, ease: "power2.out" }, 0.0);
      tl.to(p.breaking, { opacity: 1, y: 0, duration: 0.12, ease: "power2.out" }, 0.15);
      tl.to(p.one, { opacity: 1, y: 0, duration: 0.12, ease: "power2.out" }, 0.3);
      tl.to(p.full, { opacity: 1, y: 0, duration: 0.12, ease: "power2.out" }, 0.5);
      tl.to(p.block, { opacity: 1, y: 0, duration: 0.12, ease: "power2.out" }, 0.65);
      tl.to(p.into, { opacity: 1, y: 0, duration: 0.12, ease: "power2.out" }, 0.9);
      tl.to(p.ten, { opacity: 1, y: 0, duration: 0.12, ease: "power2.out" }, 1.0);
      tl.to(p.smaller, { opacity: 1, y: 0, duration: 0.12, ease: "power2.out" }, 1.1);
      tl.to(p.ones, { opacity: 1, y: 0, duration: 0.12, ease: "power2.out" }, 1.2);

      // White square appears at 0.3s
      tl.to(p.cube, { opacity: 1, duration: 0.15, ease: "power2.out" }, 0.3);
      // Morph to isometric cube from 0.8s–1.2s (stays flat until frame ~20)
      tl.to(p.cube, { rotX: -30, rotY: 45, duration: 0.4, ease: "power2.out" }, 0.8);
      // Big cube fades out as explosion starts
      tl.to(p.cubeFade, { opacity: 0, duration: 0.15, ease: "power2.in" }, 1.4);

      // Explosion at 1.5s — each shard flies out
      for (let i = 0; i < 10; i++) {
        const target = EXPLOSION_TARGETS[i];
        const shard = p[`shard${i}` as keyof Scene04Proxies] as { x: number; y: number; rotation: number; opacity: number };
        const offset = 1.5 + i * 0.02;
        tl.to(shard, { opacity: 1, duration: 0.08 }, offset);
        tl.to(shard, { x: target.x, y: target.y, rotation: target.rot, duration: 1.0, ease: "power2.out" }, offset);
        tl.to(shard, { opacity: 0, duration: 0.3, ease: "power2.in" }, offset + 0.8);
      }
    },
    buildScene04Proxies(),
  );

  const words = [
    { key: "imagine", proxy: s.imagine },
    { key: "breaking", proxy: s.breaking },
    { key: "one", proxy: s.one },
    { key: "full", proxy: s.full },
    { key: "block", proxy: s.block },
    { key: "into", proxy: s.into },
    { key: "ten", proxy: s.ten },
    { key: "smaller", proxy: s.smaller },
    { key: "ones", proxy: s.ones },
  ];

  const showBigCube = s.cube.opacity > 0.01 && s.cubeFade.opacity > 0.01;

  return (
    <AbsoluteFill>
      <SolidBlue />
      <GridOverlay color="rgba(255,255,255,0.12)" />

      {/* Sentence */}
      <div
        style={{
          position: "absolute",
          top: "12%",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "0 18px",
          maxWidth: "85%",
        }}
      >
        {words.map((w) => (
          <span
            key={w.key}
            style={{
              ...baseText,
              fontSize: 115,
              color: "#fff",
              opacity: w.proxy.opacity,
              transform: `translateY(${w.proxy.y}px)`,
            }}
          >
            {w.key}
          </span>
        ))}
      </div>

      {/* Big cube — morphs from flat square to isometric */}
      {showBigCube && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            perspective: 800,
            opacity: s.cube.opacity * s.cubeFade.opacity,
          }}
        >
          <div
            style={{
              width: CUBE_SIZE,
              height: CUBE_SIZE,
              position: "relative",
              transformStyle: "preserve-3d",
              transform: `rotateX(${s.cube.rotX}deg) rotateY(${s.cube.rotY}deg)`,
            }}
          >
            <CubeFace size={CUBE_SIZE} transform={`translateZ(${CUBE_SIZE / 2}px)`} shade="rgba(255,255,255,0.95)" />
            <CubeFace size={CUBE_SIZE} transform={`rotateX(90deg) translateZ(${CUBE_SIZE / 2}px)`} shade="rgba(255,255,255,0.8)" />
            <CubeFace size={CUBE_SIZE} transform={`rotateY(90deg) translateZ(${CUBE_SIZE / 2}px)`} shade="rgba(230,230,240,0.85)" />
          </div>
        </div>
      )}

      {/* Explosion — 10 small cubes */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          perspective: 800,
        }}
      >
        {EXPLOSION_TARGETS.map((_, i) => {
          const shard = s[`shard${i}` as keyof Scene04Proxies] as { x: number; y: number; rotation: number; opacity: number };
          if (shard.opacity < 0.01) return null;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: -SMALL_CUBE / 2,
                top: -SMALL_CUBE / 2,
                transform: `translate(${shard.x}px, ${shard.y}px) rotate(${shard.rotation}deg)`,
                opacity: shard.opacity,
              }}
            >
              <IsoCube size={SMALL_CUBE} />
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* ── Meta ── */

export const sceneAMetas = [
  { id: "RP-Scene01", component: Scene01_Intro, durationInFrames: 48 },
  { id: "RP-Scene02", component: Scene02_Numbers, durationInFrames: 48 },
  { id: "RP-Scene03", component: Scene03_DarkGrid, durationInFrames: 84 },
  { id: "RP-Scene04", component: Scene04_CubeExplode, durationInFrames: 72 },
];
