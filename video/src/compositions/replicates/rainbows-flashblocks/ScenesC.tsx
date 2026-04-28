import React from "react";
import { AbsoluteFill } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { SolidBlue, LightGradient, BlueGradient, GridOverlay } from "../standrew/backgrounds";
import { useGsapProxy } from "../standrew/gsapUtils";

const { fontFamily } = loadFont("normal", { subsets: ["latin"], weights: ["400", "700", "800"] });
const BLUE = "#0040FF";

/* ═══════════════════════════════════════════════════════
   Scene 09 — "Now."
   Concentric circles + serif italic word
   48 frames (2s @ 24fps)
   ═══════════════════════════════════════════════════════ */

export const Scene09_Experience: React.FC = () => {
  const s = useGsapProxy(
    (tl, p) => {
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
            fontSize: 200,
            color: "#fff",
            lineHeight: 1.15,
          }}
        >
          Now.
        </span>
      </div>
    </AbsoluteFill>
  );
};

/* ═══════════════════════════════════════════════════════
   Scene 10 — LiveTestnet reskin
   Phase 1: "only you, with the market" word-by-word
   Phase 2: big italic "the best odds of winning"
   84 frames (3.5s @ 24fps)
   ═══════════════════════════════════════════════════════ */

const SCENE10_PHASE1 = ["only", "you,", "with", "the", "market"] as const;
const SCENE10_PHASE2 = ["giving", "you", "the", "best", "odds", "of", "winning"] as const;

function buildScene10Proxies() {
  const init: Record<string, Record<string, number>> = {
    phase1: { opacity: 1 },
    phase2Wrap: { opacity: 0, scale: 0.92 },
  };
  SCENE10_PHASE1.forEach((_, i) => { init[`p1_${i}`] = { opacity: 0, y: 15 }; });
  SCENE10_PHASE2.forEach((_, i) => { init[`p2_${i}`] = { opacity: 0, y: 15 }; });
  return init;
}

const scene10Init = buildScene10Proxies();

export const Scene10_LiveTestnet: React.FC = () => {
  const s = useGsapProxy(
    (tl, p) => {
      // Phase 1 — five words stagger
      SCENE10_PHASE1.forEach((_, i) => {
        tl.to(p[`p1_${i}`], { opacity: 1, y: 0, duration: 0.15, ease: "power2.out" }, i * 0.15);
      });

      // Phase 1 fade out
      tl.to(p.phase1, { opacity: 0, duration: 0.2 }, 1.1);

      // Phase 2 wrap entrance
      tl.to(p.phase2Wrap, { opacity: 1, scale: 1, duration: 0.3, ease: "back.out(1.4)" }, 1.3);

      // Phase 2 words stagger
      SCENE10_PHASE2.forEach((_, i) => {
        tl.to(p[`p2_${i}`], { opacity: 1, y: 0, duration: 0.15, ease: "power2.out" }, 1.5 + i * 0.13);
      });
    },
    scene10Init,
  );

  return (
    <AbsoluteFill>
      <LightGradient />

      {/* Phase 1 — "only you, with the market" */}
      <div
        style={{
          position: "absolute",
          top: "42%",
          left: "6%",
          display: "flex",
          flexWrap: "wrap",
          gap: "0 22px",
          maxWidth: "88%",
          opacity: s.phase1.opacity,
        }}
      >
        {SCENE10_PHASE1.map((word, i) => {
          const proxy = s[`p1_${i}`];
          return (
            <span
              key={i}
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
          );
        })}
      </div>

      {/* Phase 2 — "the best odds of winning" */}
      <div
        style={{
          position: "absolute",
          top: "40%",
          left: "50%",
          transform: `translate(-50%, 0) scale(${s.phase2Wrap.scale})`,
          opacity: s.phase2Wrap.opacity,
          textAlign: "center",
          maxWidth: "92%",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "0 24px",
          }}
        >
          {SCENE10_PHASE2.map((word, i) => {
            const proxy = s[`p2_${i}`];
            return (
              <span
                key={i}
                style={{
                  fontFamily,
                  fontSize: 140,
                  fontWeight: 700,
                  fontStyle: "italic",
                  color: BLUE,
                  display: "inline-block",
                  lineHeight: 1.15,
                  opacity: proxy.opacity,
                  transform: `translateY(${proxy.y}px)`,
                }}
              >
                {word}
              </span>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ═══════════════════════════════════════════════════════
   Scene 11 — "and" → "the assets" → "you always traded."
   48 frames (2s @ 24fps)
   ═══════════════════════════════════════════════════════ */

export const Scene11_NewSpeed: React.FC = () => {
  const s = useGsapProxy(
    (tl, p) => {
      // "and" visible immediately
      tl.set(p.and, { opacity: 1 });
      // "and" fades out at 0.4s
      tl.to(p.and, { opacity: 0, duration: 0.06 }, 0.4);

      // "the assets" fades in at 0.45s
      tl.to(p.assets, { opacity: 1, y: 0, duration: 0.15, ease: "power2.out" }, 0.45);
      // "the assets" fades out at 1.1s
      tl.to(p.assets, { opacity: 0, duration: 0.06 }, 1.1);

      // "you always traded." fades in at 1.15s, holds through end
      tl.to(p.traded, { opacity: 1, y: 0, duration: 0.18, ease: "power2.out" }, 1.15);
    },
    {
      and: { opacity: 0, y: 0 },
      assets: { opacity: 0, y: 12 },
      traded: { opacity: 0, y: 12 },
    },
  );

  const showAnd = s.and.opacity > 0.01;
  const showAssets = s.assets.opacity > 0.01;
  const showTraded = s.traded.opacity > 0.01;

  const textStyle: React.CSSProperties = {
    fontFamily,
    fontWeight: 700,
    fontStyle: "italic",
    color: "#fff",
    fontSize: 145,
    display: "inline-block",
    lineHeight: 1.15,
    whiteSpace: "nowrap",
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
        {showAnd && (
          <span style={{ ...textStyle, opacity: s.and.opacity }}>
            and
          </span>
        )}
        {showAssets && (
          <span
            style={{
              ...textStyle,
              opacity: s.assets.opacity,
              transform: `translateY(${s.assets.y}px)`,
            }}
          >
            the assets
          </span>
        )}
        {showTraded && (
          <span
            style={{
              ...textStyle,
              opacity: s.traded.opacity,
              transform: `translateY(${s.traded.y}px)`,
            }}
          >
            you always traded.
          </span>
        )}
      </div>
    </AbsoluteFill>
  );
};

/* ═══════════════════════════════════════════════════════
   Scene 12 — Finale
   "rainbows" + "the only trade that's actually yours." + dark fade
   173 frames (7.2s @ 24fps)
   ═══════════════════════════════════════════════════════ */

export const Scene12_Finale: React.FC = () => {
  const s = useGsapProxy(
    (tl, p) => {
      // Title fades in
      tl.to(p.title, { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" }, 0.0);

      // Tagline at 2.0s
      tl.to(p.tagline, { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" }, 2.0);

      // Dark overlay
      tl.to(p.darkOverlay, { opacity: 0.85, duration: 2.0, ease: "power1.in" }, 3.5);

      // Text fades down
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
            fontSize: 260,
            fontWeight: 800,
            fontStyle: "italic",
            color: "#fff",
            display: "block",
            lineHeight: 1.15,
            opacity: s.title.opacity,
            transform: `translateY(${s.title.y}px)`,
          }}
        >
          rainbows
        </span>

        <span
          style={{
            fontFamily,
            fontSize: 78,
            fontWeight: 400,
            fontStyle: "italic",
            color: "#fff",
            display: "block",
            lineHeight: 1.3,
            marginTop: 24,
            opacity: s.tagline.opacity,
            transform: `translateY(${s.tagline.y}px)`,
          }}
        >
          the only trade that&apos;s actually yours.
        </span>
      </div>

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

export const sceneMetasC = [
  { id: "RB-Scene09", component: Scene09_Experience, durationInFrames: 48 },
  { id: "RB-Scene10", component: Scene10_LiveTestnet, durationInFrames: 84 },
  { id: "RB-Scene11", component: Scene11_NewSpeed, durationInFrames: 48 },
  { id: "RB-Scene12", component: Scene12_Finale, durationInFrames: 173 },
];
