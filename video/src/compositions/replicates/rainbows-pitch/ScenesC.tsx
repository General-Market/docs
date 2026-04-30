import React from "react";
import { AbsoluteFill } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { SolidBlue, LightGradient, BlueGradient, GridOverlay } from "./backgrounds";
import { useGsapProxy } from "./gsapUtils";

const { fontFamily } = loadFont("normal", { subsets: ["latin"], weights: ["400", "700", "800"] });
const BLUE = "#0040FF";

/* ═══════════════════════════════════════════════════════
   Scene 09 — Experience
   "experience" in serif italic + expanding concentric circles
   48 frames (2s @ 24fps)
   ═══════════════════════════════════════════════════════ */

export const Scene09_Experience: React.FC = () => {
  const s = useGsapProxy(
    (tl, p) => {
      // text visible immediately — already opacity 1

      // 6 concentric circles, staggered expansion
      const circles = [p.c0, p.c1, p.c2, p.c3, p.c4, p.c5];
      const maxSizes = [90, 262, 434, 606, 778, 950];

      circles.forEach((c, i) => {
        const start = i * 0.15;
        tl.to(c, { opacity: 0.4, duration: 0.01 }, start);
        tl.to(c, { size: maxSizes[i], duration: 1.6, ease: "power1.out" }, start);
      });
    },
    {
      text: { opacity: 1 },
      c0: { size: 0, opacity: 0 },
      c1: { size: 0, opacity: 0 },
      c2: { size: 0, opacity: 0 },
      c3: { size: 0, opacity: 0 },
      c4: { size: 0, opacity: 0 },
      c5: { size: 0, opacity: 0 },
    },
  );

  const circles = [s.c0, s.c1, s.c2, s.c3, s.c4, s.c5];

  return (
    <AbsoluteFill>
      <SolidBlue />

      {circles.map((c, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: c.size,
            height: c.size,
            transform: "translate(-50%, -50%)",
            borderRadius: "50%",
            border: "3px solid rgba(255,255,255,0.4)",
            opacity: c.opacity,
          }}
        />
      ))}

      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          opacity: s.text.opacity,
        }}
      >
        <span
          style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontWeight: 400,
            fontStyle: "italic",
            fontSize: 160,
            color: "#fff",
            lineHeight: 1.15,
          }}
        >
          experience
        </span>
      </div>
    </AbsoluteFill>
  );
};

/* ═══════════════════════════════════════════════════════
   Scene 10 — LiveTestnet
   Phase 1: "Flashblocks are live on" word-by-word
   Phase 2: "Testnet" title + subtitle word-by-word
   84 frames (3.5s @ 24fps)
   ═══════════════════════════════════════════════════════ */

const SUBTITLE_WORDS = ["(with", "mainnet", "coming", "this", "summer)"];

export const Scene10_LiveTestnet: React.FC = () => {
  const s = useGsapProxy(
    (tl, p) => {
      // Phase 1 words — visible immediately, staggered
      tl.to(p.flash, { opacity: 1, y: 0, duration: 0.15, ease: "power2.out" }, 0.0);
      tl.to(p.are, { opacity: 1, y: 0, duration: 0.15, ease: "power2.out" }, 0.15);
      tl.to(p.live, { opacity: 1, y: 0, duration: 0.15, ease: "power2.out" }, 0.3);
      tl.to(p.on, { opacity: 1, y: 0, duration: 0.15, ease: "power2.out" }, 0.45);

      // Phase 1 fade out
      tl.to(p.phase1, { opacity: 0, duration: 0.2 }, 1.0);

      // Phase 2: Testnet
      tl.to(p.testnet, { opacity: 1, scale: 1, duration: 0.3, ease: "back.out(1.4)" }, 1.2);

      // Subtitle words one at a time
      const subKeys = [p.sw0, p.sw1, p.sw2, p.sw3, p.sw4];
      subKeys.forEach((sw, i) => {
        tl.to(sw, { opacity: 1, y: 0, duration: 0.12, ease: "power2.out" }, 1.6 + i * 0.1);
      });
    },
    {
      flash: { opacity: 0, y: 15 },
      are: { opacity: 0, y: 15 },
      live: { opacity: 0, y: 15 },
      on: { opacity: 0, y: 15 },
      phase1: { opacity: 1 },
      testnet: { opacity: 0, scale: 0.92 },
      sw0: { opacity: 0, y: 10 },
      sw1: { opacity: 0, y: 10 },
      sw2: { opacity: 0, y: 10 },
      sw3: { opacity: 0, y: 10 },
      sw4: { opacity: 0, y: 10 },
    },
  );

  const phase1Words = [
    { proxy: s.flash, word: "Flashblocks" },
    { proxy: s.are, word: "are" },
    { proxy: s.live, word: "live" },
    { proxy: s.on, word: "on" },
  ];

  const subProxies = [s.sw0, s.sw1, s.sw2, s.sw3, s.sw4];

  return (
    <AbsoluteFill>
      <LightGradient />

      {/* Phase 1 */}
      <div
        style={{
          position: "absolute",
          top: "42%",
          left: "6%",
          display: "flex",
          flexWrap: "wrap",
          gap: "0 16px",
          maxWidth: "88%",
          opacity: s.phase1.opacity,
        }}
      >
        {phase1Words.map(({ proxy, word }) => (
          <span
            key={word}
            style={{
              fontFamily,
              fontSize: 160,
              fontWeight: 700,
              fontStyle: "italic",
              color: BLUE,
              opacity: proxy.opacity,
              transform: `translateY(${proxy.y}px)`,
              display: "inline-block",
              lineHeight: 1.15,
            }}
          >
            {word}
          </span>
        ))}
      </div>

      {/* Phase 2: Testnet */}
      <div
        style={{
          position: "absolute",
          top: "40%",
          left: "50%",
          transform: `translate(-50%, 0) scale(${s.testnet.scale})`,
          opacity: s.testnet.opacity,
          textAlign: "center",
        }}
      >
        <span
          style={{
            fontFamily,
            fontSize: 200,
            fontWeight: 700,
            color: BLUE,
            display: "block",
            lineHeight: 1.15,
          }}
        >
          Testnet
        </span>

        <div
          style={{
            marginTop: 16,
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "0 8px",
          }}
        >
          {SUBTITLE_WORDS.map((word, i) => (
            <span
              key={i}
              style={{
                fontFamily,
                fontSize: 72,
                fontWeight: 400,
                fontStyle: "italic",
                color: BLUE,
                opacity: subProxies[i].opacity,
                transform: `translateY(${subProxies[i].y}px)`,
                display: "inline-block",
                lineHeight: 1.4,
              }}
            >
              {word}
            </span>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ═══════════════════════════════════════════════════════
   Scene 11 — NewSpeed
   "is" → "new" → "new speed"
   48 frames (2s @ 24fps)
   ═══════════════════════════════════════════════════════ */

export const Scene11_NewSpeed: React.FC = () => {
  const s = useGsapProxy(
    (tl, p) => {
      // "is" visible immediately
      tl.set(p.is, { opacity: 1 });
      // "is" fades out at 0.35s
      tl.to(p.is, { opacity: 0, duration: 0.05 }, 0.35);

      // "new" fades in at 0.4s
      tl.to(p.new_, { opacity: 1, y: 0, duration: 0.15, ease: "power2.out" }, 0.4);

      // "speed" fades in at 0.6s
      tl.to(p.speed, { opacity: 1, y: 0, duration: 0.15, ease: "power2.out" }, 0.6);
    },
    {
      is: { opacity: 0, y: 0 },
      new_: { opacity: 0, y: 12 },
      speed: { opacity: 0, y: 12 },
    },
  );

  const showIs = s.is.opacity > 0.01;
  const showNewSpeed = s.new_.opacity > 0.01 || s.speed.opacity > 0.01;

  const textStyle: React.CSSProperties = {
    fontFamily,
    fontWeight: 700,
    fontStyle: "italic",
    color: "#fff",
    fontSize: 145,
    display: "inline-block",
    lineHeight: 1.15,
  };

  return (
    <AbsoluteFill>
      <BlueGradient />
      <GridOverlay color="rgba(255,255,255,0.18)" />

      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          display: "flex",
          gap: 18,
          justifyContent: "center",
          whiteSpace: "nowrap",
        }}
      >
        {showIs && (
          <span style={{ ...textStyle, opacity: s.is.opacity }}>
            is
          </span>
        )}

        {showNewSpeed && (
          <>
            <span
              style={{
                ...textStyle,
                opacity: s.new_.opacity,
                transform: `translateY(${s.new_.y}px)`,
              }}
            >
              new
            </span>
            <span
              style={{
                ...textStyle,
                opacity: s.speed.opacity,
                transform: `translateY(${s.speed.y}px)`,
              }}
            >
              speed
            </span>
          </>
        )}
      </div>
    </AbsoluteFill>
  );
};

/* ═══════════════════════════════════════════════════════
   Scene 12 — Finale
   "Flashblocks" + tagline + dark fade
   173 frames (7.2s @ 24fps)
   ═══════════════════════════════════════════════════════ */

export const Scene12_Finale: React.FC = () => {
  const s = useGsapProxy(
    (tl, p) => {
      // Title fades in 0.0-0.3s
      tl.to(p.title, { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" }, 0.0);

      // Tagline appears at 2.0s
      tl.to(p.tagline, { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" }, 2.0);

      // Dark overlay 3.5s-5.5s
      tl.to(p.darkOverlay, { opacity: 0.85, duration: 2.0, ease: "power1.in" }, 3.5);

      // Text fades 3.5s-5.5s
      tl.to(p.textFade, { opacity: 0.4, duration: 2.0, ease: "power1.in" }, 3.5);
    },
    {
      title: { opacity: 0, y: 10 },
      tagline: { opacity: 0, y: 15 },
      darkOverlay: { opacity: 0 },
      textFade: { opacity: 1 },
    },
  );

  return (
    <AbsoluteFill>
      <BlueGradient />

      {/* text layer */}
      <div
        style={{
          position: "absolute",
          top: "42%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          textAlign: "center",
          zIndex: 2,
          opacity: s.textFade.opacity,
        }}
      >
        <span
          style={{
            fontFamily,
            fontSize: 200,
            fontWeight: 800,
            fontStyle: "normal",
            color: "#fff",
            display: "block",
            lineHeight: 1.15,
            opacity: s.title.opacity,
            transform: `translateY(${s.title.y}px)`,
          }}
        >
          Flashblocks
        </span>

        <span
          style={{
            fontFamily,
            fontSize: 95,
            fontWeight: 400,
            fontStyle: "italic",
            color: "#fff",
            display: "block",
            lineHeight: 1.3,
            marginTop: 20,
            opacity: s.tagline.opacity,
            transform: `translateY(${s.tagline.y}px)`,
          }}
        >
          fast just got faster
        </span>
      </div>

      {/* dark overlay */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: `rgba(0, 10, 30, ${s.darkOverlay.opacity})`,
          zIndex: 1,
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};

/* ── Meta ── */

export const sceneCMetas = [
  { id: "RP-Scene09", component: Scene09_Experience, durationInFrames: 48 },
  { id: "RP-Scene10", component: Scene10_LiveTestnet, durationInFrames: 84 },
  { id: "RP-Scene11", component: Scene11_NewSpeed, durationInFrames: 48 },
  { id: "RP-Scene12", component: Scene12_Finale, durationInFrames: 173 },
];
