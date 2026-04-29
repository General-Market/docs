import React from "react";
import { AbsoluteFill } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { useGsapProxy } from "../standrew/gsapUtils";
import { DynamicBlue, DynamicDark, DynamicSolidBlue, HexGridOverlay, ZoomedBg } from "./dynamics";

const { fontFamily } = loadFont("normal", { subsets: ["latin"], weights: ["400", "700", "800"] });

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
  gap: 30,
  justifyContent: "center",
  whiteSpace: "nowrap",
};

/* ═══════════════════════════════════════════════════════
   Scene 01 — Hook  (84 frames = 3.5s @ 24fps)
   "You spent 10,000 hours" → "perfecting your trading strategies."
   ═══════════════════════════════════════════════════════ */

const SCENE01_DURATION = 84;
const SCENE01_PHRASE_A = ["You", "spent", "10,000", "hours"] as const;
const SCENE01_PHRASE_B = ["perfecting", "your", "trading", "strategies"] as const;

function buildScene01Proxies() {
  const init: Record<string, Record<string, number>> = {
    phraseA: { opacity: 1 },
    phraseB: { opacity: 0 },
  };
  SCENE01_PHRASE_A.forEach((_, i) => {
    init[`a_${i}`] = { opacity: i === 0 ? 1 : 0, y: i === 0 ? 0 : 15 };
  });
  SCENE01_PHRASE_B.forEach((_, i) => {
    init[`b_${i}`] = { opacity: 0, y: 15 };
  });
  return init;
}

const scene01Init = buildScene01Proxies();

export const Scene01_Hook: React.FC = () => {
  const s = useGsapProxy(
    (tl, p) => {
      SCENE01_PHRASE_A.forEach((_, i) => {
        if (i === 0) return;
        tl.to(p[`a_${i}`], { opacity: 1, y: 0, duration: 0.18, ease: "power2.out" }, 0.2 + i * 0.22);
      });

      tl.to(p.phraseA, { opacity: 0, duration: 0.22, ease: "power2.in" }, 1.7);

      tl.to(p.phraseB, { opacity: 1, duration: 0.18, ease: "power2.out" }, 1.95);
      SCENE01_PHRASE_B.forEach((_, i) => {
        tl.to(p[`b_${i}`], { opacity: 1, y: 0, duration: 0.18, ease: "power2.out" }, 1.95 + i * 0.24);
      });
    },
    scene01Init,
  );

  return (
    <AbsoluteFill>
      <ZoomedBg duration={SCENE01_DURATION}>
        <DynamicBlue />
      </ZoomedBg>

      <div style={{ ...center, opacity: s.phraseA.opacity }}>
        {SCENE01_PHRASE_A.map((word, i) => {
          const proxy = s[`a_${i}`];
          const isNumber = word === "10,000";
          return (
            <span
              key={i}
              style={{
                ...baseText,
                fontSize: isNumber ? 165 : 125,
                color: "#fff",
                opacity: proxy.opacity,
                transform: `translateY(${proxy.y}px)`,
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
      <div style={{ ...center, opacity: s.phraseB.opacity, gap: 24 }}>
        {SCENE01_PHRASE_B.map((word, i) => {
          const proxy = s[`b_${i}`];
          return (
            <span
              key={i}
              style={{
                ...baseText,
                fontSize: 110,
                color: "#fff",
                opacity: proxy.opacity,
                transform: `translateY(${proxy.y}px)`,
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* ═══════════════════════════════════════════════════════
   Scene 02 — TryRainbows  (48 frames = 2s @ 24fps)
   Big italic question slides in over hex-grid dark and holds:
   "How rainbows improve / your gains?"
   ═══════════════════════════════════════════════════════ */

const SCENE02_DURATION = 48;

export const Scene02_TryRainbows: React.FC = () => {
  const s = useGsapProxy(
    (tl, p) => {
      tl.to(p.title, { opacity: 1, x: 0, duration: 0.5, ease: "power2.out" }, 0.1);
    },
    {
      title: { opacity: 0, x: 60 },
    },
  );

  return (
    <AbsoluteFill>
      <ZoomedBg duration={SCENE02_DURATION}>
        <DynamicDark />
        <HexGridOverlay color="rgba(255,255,255,0.16)" size={70} />
      </ZoomedBg>

      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "8%",
          transform: `translate(0, calc(-50% + 0px)) translateX(${s.title.x}px)`,
          opacity: s.title.opacity,
          maxWidth: "84%",
        }}
      >
        <span style={{ ...baseText, fontSize: 150, color: "#fff", display: "block" }}>
          How rainbows improve
        </span>
        <span style={{ ...baseText, fontSize: 150, color: "#fff", display: "block" }}>
          your gains?
        </span>
      </div>
    </AbsoluteFill>
  );
};

/* ═══════════════════════════════════════════════════════
   Scene 03 — CubeExplode  (72 frames = 3s @ 24fps)
   Silent visual beat — cube assembles, holds, explodes.
   Hex grid background.
   ═══════════════════════════════════════════════════════ */

const SCENE03_DURATION = 72;
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

type Scene03Proxies = {
  cube: { opacity: number; rotX: number; rotY: number };
  cubeFade: { opacity: number };
  [key: `shard${number}`]: { x: number; y: number; rotation: number; opacity: number };
};

function buildScene03Proxies(): Scene03Proxies {
  const base: Record<string, Record<string, number>> = {
    cube: { opacity: 0, rotX: 0, rotY: 0 },
    cubeFade: { opacity: 1 },
  };
  for (let i = 0; i < 10; i++) {
    base[`shard${i}`] = { x: 0, y: 0, rotation: 0, opacity: 0 };
  }
  return base as unknown as Scene03Proxies;
}

export const Scene03_CubeExplode: React.FC = () => {
  const s = useGsapProxy<Scene03Proxies>(
    (tl, p) => {
      tl.to(p.cube, { opacity: 1, duration: 0.15, ease: "power2.out" }, 0.3);
      tl.to(p.cube, { rotX: -30, rotY: 45, duration: 0.4, ease: "power2.out" }, 0.8);
      tl.to(p.cubeFade, { opacity: 0, duration: 0.15, ease: "power2.in" }, 1.4);

      for (let i = 0; i < 10; i++) {
        const target = EXPLOSION_TARGETS[i];
        const shard = p[`shard${i}` as keyof Scene03Proxies] as { x: number; y: number; rotation: number; opacity: number };
        const offset = 1.5 + i * 0.02;
        tl.to(shard, { opacity: 1, duration: 0.08 }, offset);
        tl.to(shard, { x: target.x, y: target.y, rotation: target.rot, duration: 1.0, ease: "power2.out" }, offset);
        tl.to(shard, { opacity: 0, duration: 0.3, ease: "power2.in" }, offset + 0.8);
      }
    },
    buildScene03Proxies(),
  );

  const showBigCube = s.cube.opacity > 0.01 && s.cubeFade.opacity > 0.01;

  return (
    <AbsoluteFill>
      <ZoomedBg duration={SCENE03_DURATION}>
        <DynamicSolidBlue />
        <HexGridOverlay color="rgba(255,255,255,0.13)" size={70} />
      </ZoomedBg>

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
          const shard = s[`shard${i}` as keyof Scene03Proxies] as { x: number; y: number; rotation: number; opacity: number };
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

export const sceneMetasA = [
  { id: "RB-Scene01-Hook", component: Scene01_Hook, durationInFrames: SCENE01_DURATION },
  { id: "RB-Scene02-TryRainbows", component: Scene02_TryRainbows, durationInFrames: SCENE02_DURATION },
  { id: "RB-Scene03-CubeExplode", component: Scene03_CubeExplode, durationInFrames: SCENE03_DURATION },
];
