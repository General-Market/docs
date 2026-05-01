import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { SolidBlue, LightGradient, BlueGradient, GridOverlay } from "./backgrounds";
import { useGsapProxy } from "./gsapUtils";

const { fontFamily } = loadFont("normal", { subsets: ["latin"], weights: ["400", "700", "800"] });
const BLUE = "#000000";

/* ═══════════════════════════════════════════════════════
   Scene 09 — Concentric circles + "gain more"
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
          display: "flex",
          gap: 28,
          whiteSpace: "nowrap",
        }}
      >
        <span
          style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontWeight: 400,
            fontStyle: "italic",
            fontSize: 175,
            color: "#fff",
            lineHeight: 1.15,
          }}
        >
          gain
        </span>
        <span
          style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontWeight: 400,
            fontStyle: "italic",
            fontSize: 175,
            color: "#fff",
            lineHeight: 1.15,
          }}
        >
          more
        </span>
      </div>
    </AbsoluteFill>
  );
};

/* ═══════════════════════════════════════════════════════
   Scene 10 — Cascade → title  (84 frames = 3.5s @ 24fps)
   Phase 1: "Leaving / the / same / profits" word cascade
   Phase 2: "to fewer honest traders" title slides in
   ═══════════════════════════════════════════════════════ */

const SCENE10_PHASE1 = ["Leaving", "the", "same", "profits"] as const;
const SCENE10_PHASE2 = ["to", "fewer", "honest", "traders"] as const;

function buildScene10Proxies() {
  const init: Record<string, Record<string, number>> = {
    phase1: { opacity: 1 },
    title: { opacity: 0, scale: 0.92 },
  };
  SCENE10_PHASE1.forEach((w) => { init[`p1_${w}`] = { opacity: 0, y: 15 }; });
  SCENE10_PHASE2.forEach((w) => { init[`p2_${w}`] = { opacity: 0, y: 12 }; });
  return init;
}

export const Scene10_LiveTestnet: React.FC = () => {
  const s = useGsapProxy(
    (tl, p) => {
      // Phase 1 cascade
      SCENE10_PHASE1.forEach((w, i) => {
        tl.to(p[`p1_${w}`], { opacity: 1, y: 0, duration: 0.16, ease: "power2.out" }, i * 0.16);
      });
      // Phase 1 fades out
      tl.to(p.phase1, { opacity: 0, duration: 0.22 }, 1.05);

      // Phase 2 title
      tl.to(p.title, { opacity: 1, scale: 1, duration: 0.35, ease: "back.out(1.4)" }, 1.25);
      // Phase 2 word cascade
      SCENE10_PHASE2.forEach((w, i) => {
        tl.to(p[`p2_${w}`], { opacity: 1, y: 0, duration: 0.14, ease: "power2.out" }, 1.4 + i * 0.13);
      });
    },
    buildScene10Proxies(),
  );

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
          gap: "0 18px",
          maxWidth: "88%",
          opacity: s.phase1.opacity,
        }}
      >
        {SCENE10_PHASE1.map((word) => {
          const p = s[`p1_${word}`];
          return (
            <span
              key={word}
              style={{
                fontFamily,
                fontSize: 155,
                fontWeight: 700,
                fontStyle: "italic",
                color: BLUE,
                opacity: p.opacity,
                transform: `translateY(${p.y}px)`,
                display: "inline-block",
                lineHeight: 1.15,
              }}
            >
              {word}
            </span>
          );
        })}
      </div>

      {/* Phase 2 — title */}
      <div
        style={{
          position: "absolute",
          top: "42%",
          left: "50%",
          transform: `translate(-50%, 0) scale(${s.title.scale})`,
          opacity: s.title.opacity,
          textAlign: "center",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "0 22px",
          maxWidth: "92%",
        }}
      >
        {SCENE10_PHASE2.map((word) => {
          const p = s[`p2_${word}`];
          return (
            <span
              key={word}
              style={{
                fontFamily,
                fontSize: 175,
                fontWeight: 800,
                fontStyle: "italic",
                color: BLUE,
                opacity: p.opacity,
                transform: `translateY(${p.y}px)`,
                display: "inline-block",
                lineHeight: 1.15,
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
   Scene 13 — Pairs no exchange will list  (84 frames = 3.5s @ 24fps)
   Split-screen: same insider pairs, dead on the left (no rainbows),
   alive on the right (with rainbows). Lands after the 500k counter.
   ═══════════════════════════════════════════════════════ */

const RAINBOW_GRADIENT_C =
  "linear-gradient(90deg, #ff3b3b 0%, #ff8a00 18%, #ffd400 36%, #2cd36f 54%, #2dabff 72%, #7e3bff 88%, #ff3bd1 100%)";

const SCENE13_PAIRS = [
  "$WIF / $BONK",
  "ICE 247 — on time?",
  "Rain in Berlin tonight",
  "Whale wakes: 0xfa…",
] as const;

function buildScene13Proxies() {
  const init: Record<string, Record<string, number>> = {
    headline: { opacity: 0, y: 14 },
    leftLabel: { opacity: 0 },
    rightLabel: { opacity: 0 },
    rightBg: { opacity: 0 },
  };
  SCENE13_PAIRS.forEach((_, i) => {
    init[`l_${i}`] = { opacity: 0, x: -18, strike: 0 };
    init[`r_${i}`] = { opacity: 0, x: 18 };
  });
  return init;
}

export const Scene13_PairsCompare: React.FC = () => {
  const s = useGsapProxy(
    (tl, p) => {
      // Headline lands first.
      tl.to(p.headline, { opacity: 1, y: 0, duration: 0.28, ease: "power2.out" }, 0.0);

      // Left side — "without rainbows" cascade with strike-through.
      tl.to(p.leftLabel, { opacity: 0.65, duration: 0.18, ease: "power2.out" }, 0.32);
      SCENE13_PAIRS.forEach((_, i) => {
        const t = 0.42 + i * 0.12;
        tl.to(p[`l_${i}`], { opacity: 0.45, x: 0, duration: 0.18, ease: "power2.out" }, t);
        tl.to(p[`l_${i}`], { strike: 1, duration: 0.22, ease: "power2.out" }, t + 0.08);
      });

      // Right side — rainbow panel sweeps in, then glowing pairs cascade.
      tl.to(p.rightBg, { opacity: 1, duration: 0.32, ease: "power2.out" }, 1.18);
      tl.to(p.rightLabel, { opacity: 1, duration: 0.18, ease: "power2.out" }, 1.30);
      SCENE13_PAIRS.forEach((_, i) => {
        tl.to(p[`r_${i}`], { opacity: 1, x: 0, duration: 0.18, ease: "power2.out" }, 1.42 + i * 0.12);
      });
    },
    buildScene13Proxies(),
  );

  const headlineStyle: React.CSSProperties = {
    fontFamily,
    fontSize: 92,
    fontWeight: 800,
    fontStyle: "italic",
    color: "#fff",
    lineHeight: 1.1,
    whiteSpace: "nowrap",
  };

  const labelStyle: React.CSSProperties = {
    fontFamily,
    fontSize: 38,
    fontWeight: 400,
    fontStyle: "italic",
    color: "#fff",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  };

  const rowStyle: React.CSSProperties = {
    fontFamily,
    fontSize: 64,
    fontWeight: 700,
    fontStyle: "italic",
    color: "#fff",
    lineHeight: 1.5,
    whiteSpace: "nowrap",
  };

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0a", overflow: "hidden" }}>
      {/* Right-half rainbow panel */}
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: "50%",
          height: "100%",
          backgroundImage: RAINBOW_GRADIENT_C,
          opacity: s.rightBg.opacity * 0.85,
        }}
      />
      {/* Right-half soft veil so text reads */}
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: "50%",
          height: "100%",
          backgroundColor: "rgba(0,0,0,0.32)",
          opacity: s.rightBg.opacity,
        }}
      />
      {/* Vertical divider */}
      <div
        style={{
          position: "absolute",
          top: "18%",
          left: "50%",
          width: 1,
          height: "70%",
          backgroundColor: "rgba(255,255,255,0.18)",
          transform: "translateX(-0.5px)",
        }}
      />

      {/* Headline */}
      <div
        style={{
          position: "absolute",
          top: "8%",
          left: "50%",
          transform: `translate(-50%, ${s.headline.y}px)`,
          opacity: s.headline.opacity,
        }}
      >
        <span style={headlineStyle}>Pairs no exchange will list.</span>
      </div>

      {/* Left column — without rainbows */}
      <div
        style={{
          position: "absolute",
          top: "30%",
          left: "6%",
          width: "38%",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <span style={{ ...labelStyle, opacity: s.leftLabel.opacity }}>
          without rainbows
        </span>
        <div style={{ height: 24 }} />
        {SCENE13_PAIRS.map((pair, i) => {
          const p = s[`l_${i}`];
          return (
            <div
              key={pair}
              style={{
                opacity: p.opacity,
                transform: `translateX(${p.x}px)`,
              }}
            >
              <span style={{ position: "relative", display: "inline-block" }}>
                <span style={rowStyle}>{pair}</span>
                {/* Animated red strike — scales from 0 → 1 left-to-right */}
                <div
                  style={{
                    position: "absolute",
                    top: "55%",
                    left: 0,
                    right: 0,
                    height: 5,
                    backgroundColor: "#ff3b3b",
                    borderRadius: 2,
                    transformOrigin: "left center",
                    transform: `scaleX(${p.strike})`,
                    boxShadow: "0 0 8px rgba(255,59,59,0.55)",
                  }}
                />
              </span>
            </div>
          );
        })}
      </div>

      {/* Right column — with rainbows */}
      <div
        style={{
          position: "absolute",
          top: "30%",
          left: "56%",
          width: "38%",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <span style={{ ...labelStyle, opacity: s.rightLabel.opacity }}>
          with rainbows
        </span>
        <div style={{ height: 24 }} />
        {SCENE13_PAIRS.map((pair, i) => {
          const p = s[`r_${i}`];
          return (
            <div
              key={pair}
              style={{
                opacity: p.opacity,
                transform: `translateX(${p.x}px)`,
              }}
            >
              <span
                style={{
                  ...rowStyle,
                  textShadow: "0 0 18px rgba(255,255,255,0.45)",
                }}
              >
                {pair}
              </span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* ═══════════════════════════════════════════════════════
   Scene 11 — "while" → "trading" → "the same assets"
   48 frames (2s @ 24fps)
   ═══════════════════════════════════════════════════════ */

export const Scene11_NewSpeed: React.FC = () => {
  const s = useGsapProxy(
    (tl, p) => {
      tl.set(p.while_, { opacity: 1 });
      tl.to(p.while_, { opacity: 0, duration: 0.08 }, 0.4);

      tl.to(p.trading, { opacity: 1, y: 0, duration: 0.16, ease: "power2.out" }, 0.5);
      tl.to(p.trading, { opacity: 0, duration: 0.08 }, 1.0);

      tl.to(p.the_, { opacity: 1, y: 0, duration: 0.14, ease: "power2.out" }, 1.1);
      tl.to(p.same, { opacity: 1, y: 0, duration: 0.14, ease: "power2.out" }, 1.25);
      tl.to(p.assets, { opacity: 1, y: 0, duration: 0.14, ease: "power2.out" }, 1.4);
    },
    {
      while_: { opacity: 0, y: 0 },
      trading: { opacity: 0, y: 12 },
      the_: { opacity: 0, y: 12 },
      same: { opacity: 0, y: 12 },
      assets: { opacity: 0, y: 12 },
    },
  );

  const showWhile = s.while_.opacity > 0.01;
  const showTrading = s.trading.opacity > 0.01;
  const showFinal =
    s.the_.opacity > 0.01 || s.same.opacity > 0.01 || s.assets.opacity > 0.01;

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
          gap: 22,
          justifyContent: "center",
          whiteSpace: "nowrap",
        }}
      >
        {showWhile && (
          <span style={{ ...textStyle, opacity: s.while_.opacity }}>while</span>
        )}
        {showTrading && (
          <span
            style={{
              ...textStyle,
              opacity: s.trading.opacity,
              transform: `translateY(${s.trading.y}px)`,
            }}
          >
            trading
          </span>
        )}
        {showFinal && (
          <>
            <span
              style={{
                ...textStyle,
                opacity: s.the_.opacity,
                transform: `translateY(${s.the_.y}px)`,
              }}
            >
              the
            </span>
            <span
              style={{
                ...textStyle,
                opacity: s.same.opacity,
                transform: `translateY(${s.same.y}px)`,
              }}
            >
              same
            </span>
            <span
              style={{
                ...textStyle,
                opacity: s.assets.opacity,
                transform: `translateY(${s.assets.y}px)`,
              }}
            >
              assets
            </span>
          </>
        )}
      </div>
    </AbsoluteFill>
  );
};

/* ═══════════════════════════════════════════════════════
   Scene 12 — Finale  (173 frames = 7.2s @ 24fps)
   GM logo + "General" wordmark + "Markets for everything"
   ═══════════════════════════════════════════════════════ */

export const Scene12_Finale: React.FC = () => {
  const s = useGsapProxy(
    (tl, p) => {
      // Logo scales in
      tl.to(p.logo, { opacity: 1, scale: 1, duration: 0.55, ease: "back.out(1.4)" }, 0.0);
      tl.to(p.logoGlow, { opacity: 1, duration: 0.6, ease: "power2.out" }, 0.2);
      // Wordmark "General" appears
      tl.to(p.title, { opacity: 1, y: 0, duration: 0.45, ease: "power2.out" }, 0.7);
      // Tagline
      tl.to(p.tagline, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }, 1.7);
      // Dark overlay 4.5–6.8s
      tl.to(p.darkOverlay, { opacity: 0.88, duration: 2.3, ease: "power1.in" }, 4.5);
      tl.to(p.textFade, { opacity: 0.35, duration: 2.3, ease: "power1.in" }, 4.5);
    },
    {
      logo: { opacity: 0, scale: 0.7 },
      logoGlow: { opacity: 0 },
      title: { opacity: 0, y: 14 },
      tagline: { opacity: 0, y: 18 },
      darkOverlay: { opacity: 0 },
      textFade: { opacity: 1 },
    },
  );

  const LOGO_SIZE = 220;

  return (
    <AbsoluteFill>
      <BlueGradient />

      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          textAlign: "center",
          zIndex: 2,
          opacity: s.textFade.opacity,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 28,
        }}
      >
        {/* Logo with soft glow */}
        <div
          style={{
            position: "relative",
            width: LOGO_SIZE,
            height: LOGO_SIZE,
            opacity: s.logo.opacity,
            transform: `scale(${s.logo.scale})`,
          }}
        >
          {/* Glow plate behind logo */}
          <div
            style={{
              position: "absolute",
              inset: -40,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 65%)",
              opacity: s.logoGlow.opacity,
              filter: "blur(6px)",
            }}
          />
          <Img
            src={staticFile("gm-logo-white.svg")}
            style={{
              position: "relative",
              width: LOGO_SIZE,
              height: LOGO_SIZE,
              filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.25))",
            }}
          />
        </div>

        {/* Wordmark */}
        <span
          style={{
            fontFamily,
            fontSize: 180,
            fontWeight: 800,
            fontStyle: "italic",
            color: "#fff",
            display: "block",
            lineHeight: 1,
            letterSpacing: "-0.02em",
            opacity: s.title.opacity,
            transform: `translateY(${s.title.y}px)`,
            textShadow: "0 4px 28px rgba(0,0,0,0.25)",
          }}
        >
          General
        </span>

        {/* Tagline */}
        <span
          style={{
            fontFamily,
            fontSize: 78,
            fontWeight: 400,
            fontStyle: "italic",
            color: "rgba(255,255,255,0.85)",
            display: "block",
            lineHeight: 1.2,
            opacity: s.tagline.opacity,
            transform: `translateY(${s.tagline.y}px)`,
          }}
        >
          Markets for everything
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
