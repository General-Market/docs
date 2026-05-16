import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { font } from "../../common/fonts";
import { FPS, H, W, colors, toFrames } from "./theme";
import { ParallaxText } from "./transitions";
import { RevealChars } from "./vibe";
import { SPIKE_ENDCARD_LOCAL } from "./beats";

const SCENE_SECONDS = 9.0;

// Sequential phases inside the end card. Each beat does ONE thing —
// no compound motion that fights itself.
//   Phase 1 (0 → P2):           wordmark small at top, headline
//                                 "Trading is easy with an Anti-Cheat(g)".
//   Phase 2 (P2 → SLIDE_AT):    headline swaps to "Only available for
//                                 trading bots". Wordmark unchanged.
//   Phase 3a (SLIDE_AT → ZOOM_AT): wordmark glides from top to centre.
//                                  Scale unchanged. Just position.
//   Phase 3b (ZOOM_AT → SOURCES_AT): wordmark scales up. Position
//                                  held at centre. Just zoom.
//   Phase 4 (SOURCES_AT → end): article-source sub-block fades in
//                                 under the footnote paragraph. The
//                                 music has died; the card holds for
//                                 reading time.
const PHASE_2_AT  = toFrames(1.8);  // ~54f  — title 2 takes over
const SLIDE_AT    = toFrames(3.0);  // ~90f  — wordmark begins slide
const ZOOM_AT     = toFrames(4.2);  // ~126f — slide done, zoom begins
const SUBLINE_AT  = toFrames(0.45); // first headline reveal
const FOOTNOTES_AT = toFrames(0.9); // footnote paragraph fades in

const SLIDE_LEN = ZOOM_AT - SLIDE_AT;
const ZOOM_LEN  = toFrames(1.0);    // 30f zoom duration

// Settle: after the spike fires, the wordmark eases back from its
// scale punch over SETTLE_LEN frames. The music is dying, anything
// else would shout into silence.
const SETTLE_LEN = 28;

// Wordmark geometry — small-top vs. centre-zoom.
const WORDMARK_TOP_Y = 168;       // y of the small wordmark, top phase
const WORDMARK_CENTER_Y = H / 2;  // y of the zoomed wordmark, phase 3
const WORDMARK_SCALE_SMALL = 0.42;
const WORDMARK_SCALE_BIG = 1.10;

// Footnotes — every lettered marker in the film resolves here.
// (a)–(d) scapegoat dockets, (e) Polymarket source, (f) Switch
// testnet caveat, (g) Anti-Cheat availability disclaimer.
const FOOTNOTES: { letter: string; text: string }[] = [
  {
    letter: "a",
    text: "Drew Niv (FXCM co-founder, CEO 1999–2017). CFTC order 17-04, 6 Feb 2017: $7M civil penalty and lifetime US retail-forex registration ban for the Effex Capital scheme that took the other side of customer stops.",
  },
  {
    letter: "b",
    text: "Kenneth Griffin (Citadel Securities). FINRA AWC 2014041859202 (2020): $700K fine for trading ahead of customer OTC orders, 2012–2014. Griffin not personally charged.",
  },
  {
    letter: "c",
    text: "Michael Nowak (head of JPMorgan's global precious-metals desk, 2012–2019). Convicted 10 Aug 2022 in N.D. Ill. on spoofing, wire fraud, commodities fraud and attempted price manipulation across gold and silver futures 2008–2016; one year and a day in prison + $35K fine; conviction affirmed on appeal 2025. JPMorgan paid $920M to settle the parent matter (DOJ + CFTC + SEC, Sept 2020).",
  },
  {
    letter: "d",
    text: "Joe Lewis. Pleaded guilty 24 Jan 2024 in SDNY to one count of conspiracy to commit securities fraud and two counts of securities fraud. $50M penalty via Broad Bay Ltd. Pardoned by Donald Trump, Nov 2025 — plea stands.",
  },
  {
    letter: "e",
    text: "Polymarket trader profit distribution, 2024. Top 0.04% captured ~$3.7B in profits while 70% of traders lost money. Sources: CryptoNews, Yellow.com, Yahoo Finance.",
  },
  {
    letter: "f",
    text: "Based on General Market testnet data. Indicative comparison under favorable market conditions. Net of fees and slippage. Past performance does not guarantee future returns.",
  },
];

// Article sources for the Rigged scene (≈ video t=4–10s). Each line is
// the published evidence behind one of the six exchange-is-rigged
// flashes. Citations resolve at SOURCES_AT, on the silent hold after
// the music has ended — reading time.
const SOURCES: { label: string; text: string }[] = [
  {
    label: "Binance",
    text: "Daniel Kuhn, The Block, 'Binance post confirming insider trading sends \"year of the yellow fruit\" meme token higher,' 8 Dec 2025.",
  },
  {
    label: "Robinhood",
    text: "PYMNTS, 'Robinhood blocks some prediction markets over insider-trading worries,' 12 Apr 2026.",
  },
  {
    label: "Polymarket",
    text: "Shaurya Malwa, CoinDesk, 'Polymarket bettors appear to have insider-traded on a market designed to catch insider traders,' 27 Feb 2026.",
  },
  {
    label: "pump.fun",
    text: "James G., Cointribune, 'Solana memecoin lawsuit advances as investors cite insider-trading claims,' 22 Dec 2025.",
  },
  {
    label: "Kalshi",
    text: "Tara Suter, The Hill, 'Kalshi, Polymarket strengthen insider-trading bans,' 24 Mar 2026.",
  },
  {
    label: "Coinbase",
    text: "U.S. SEC press release 2022-127, 'SEC charges former Coinbase manager and two others in crypto-asset insider-trading action,' 21 Jul 2022.",
  },
];

// The endcard inverts. Solid Base blue field, white wordmark.
// A light dot grid laid over blue gives the same texture vocabulary as
// the rest of the film, but the relationship is flipped.

export const AntiCheatEndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ─── Wordmark fade-in (small, top-positioned) ──────────────────────
  const wordmarkOpacity = interpolate(
    frame,
    [0, toFrames(0.18)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const punch = spring({
    frame: frame - toFrames(0.05),
    fps,
    config: { damping: 9, stiffness: 220, mass: 0.55 },
  });

  // ─── Music spike (kick lands at SPIKE_ENDCARD_LOCAL) ───────────────
  const spikeDelta = frame - SPIKE_ENDCARD_LOCAL;
  const spikeImpulse =
    spikeDelta < -3
      ? 0
      : spikeDelta <= 0
        ? (spikeDelta + 3) / 3
        : Math.max(0, 1 - spikeDelta / 24);
  const spikeKick = Math.pow(spikeImpulse, 1.6);

  const settleT = Math.max(
    0,
    Math.min(1, (frame - SPIKE_ENDCARD_LOCAL) / SETTLE_LEN),
  );
  const settleEased = 1 - Math.pow(1 - settleT, 3);
  const restRelief = settleEased * 0.012;

  // Wordmark punch — kept deliberately small so the end-card feels
  // restrained. Old values (0.06 sin + 0.085 spike) read as a flash.
  const wordmarkPunch =
    1 +
    Math.sin(Math.min(1, Math.max(0, punch)) * Math.PI) * 0.02 +
    spikeKick * 0.025 -
    restRelief;

  // ─── Phase 3a: slide top → centre (position only, no scale change) ─
  const slideT = Math.max(0, Math.min(1, (frame - SLIDE_AT) / SLIDE_LEN));
  const slideEased =
    slideT * slideT * slideT * (slideT * (slideT * 6 - 15) + 10);
  const wordmarkY = WORDMARK_TOP_Y +
    (WORDMARK_CENTER_Y - WORDMARK_TOP_Y) * slideEased;

  // ─── Phase 3b: zoom small → big (scale only, position held) ────────
  const zoomT = Math.max(0, Math.min(1, (frame - ZOOM_AT) / ZOOM_LEN));
  const zoomEased = zoomT * zoomT * zoomT * (zoomT * (zoomT * 6 - 15) + 10);
  const wordmarkScale =
    (WORDMARK_SCALE_SMALL +
      (WORDMARK_SCALE_BIG - WORDMARK_SCALE_SMALL) * zoomEased) *
    wordmarkPunch;

  // ─── Two title beats — Phase 1 then Phase 2, cross-fade ───────────
  // Phase 1: "Trading is easy with an Anti-Cheat" reveals at SUBLINE_AT,
  //          holds until PHASE_2_AT.
  // Phase 2: "Only available for trading bots" takes over at PHASE_2_AT,
  //          holds until SLIDE_AT.
  // Both share the same lift-in vocabulary so the swap reads like one
  // breath, not two scenes.
  const sublineLocal = frame - SUBLINE_AT;
  const phase1FadeIn = interpolate(
    sublineLocal,
    [0, toFrames(0.22)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const phase1FadeOut = interpolate(
    frame,
    [PHASE_2_AT - toFrames(0.18), PHASE_2_AT],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const phase1Op = phase1FadeIn * phase1FadeOut;

  const phase2FadeIn = interpolate(
    frame,
    [PHASE_2_AT, PHASE_2_AT + toFrames(0.22)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const phase2FadeOut = interpolate(
    frame,
    [SLIDE_AT - toFrames(0.18), SLIDE_AT],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const phase2Op = phase2FadeIn * phase2FadeOut;

  const sublineY = interpolate(
    sublineLocal,
    [0, toFrames(0.22)],
    [14, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // ─── Footnote paragraph (fades in early, holds) ────────────────────
  const footnotesLocal = frame - FOOTNOTES_AT;
  const footnotesOpacity = interpolate(
    footnotesLocal,
    [0, toFrames(0.22)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );


  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.accent,
        fontFamily: font,
      }}
    >
        <WhiteDotGrid />

        {/* Spike-anchored halo burst — much subtler now. The earlier
            1700px white bloom + 0.55 opacity at peak was reading as a
            full-screen flash on a card meant to feel like a press hold. */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: `${WORDMARK_TOP_Y}px`,
            width: 900,
            height: 900,
            transform: `translate(-50%, -50%) scale(${(0.55 + spikeKick * 0.20).toFixed(3)})`,
            background: `radial-gradient(circle at center, rgba(255,255,255,${(0.16 * spikeKick).toFixed(3)}) 0%, rgba(255,255,255,${(0.06 * spikeKick).toFixed(3)}) 22%, rgba(255,255,255,0) 58%)`,
            filter: "blur(40px)",
            opacity: spikeImpulse * 0.7,
            mixBlendMode: "screen",
            pointerEvents: "none",
          }}
        />

        {/* Wordmark — centred at (canvas-x-mid, wordmarkY); drifts down +
            scales up during Phase 3. */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: `${wordmarkY.toFixed(2)}px`,
            transform: `translate(-50%, -50%) scale(${wordmarkScale.toFixed(3)})`,
            transformOrigin: "center center",
            opacity: wordmarkOpacity,
            pointerEvents: "none",
            willChange: "transform",
          }}
        >
          <ParallaxText origin="center">
            <div
              style={{
                fontFamily: font,
                fontSize: 220,
                fontWeight: 800,
                letterSpacing: "-0.05em",
                color: "#FFFFFF",
                lineHeight: 0.95,
                display: "flex",
                alignItems: "center",
                gap: 30,
                whiteSpace: "nowrap",
                // Override the global 88px beat-glow textShadow inherited
                // from AntiCheatFull — at this scale (up to ~250pt) the
                // halo turned the wordmark into a smeared white blob.
                textShadow: "none",
              }}
            >
              <GeneralMark size={200} />
              <span>General</span>
            </div>
          </ParallaxText>
        </div>

        {/* Title beat 1 — "Trading is easy with an Anti-Cheat" */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: 0,
            right: 0,
            transform: `translateY(-50%) translateY(${sublineY.toFixed(2)}px)`,
            textAlign: "center",
            pointerEvents: "none",
            opacity: phase1Op,
            fontFamily: font,
            fontSize: 82,
            fontWeight: 700,
            letterSpacing: "-0.025em",
            color: "#FFFFFF",
            lineHeight: 1.05,
            padding: "0 96px",
          }}
        >
          <RevealChars
            text="Trading is easy with an Anti-Cheat"
            startFrame={SUBLINE_AT}
            stagger={0.55}
            duration={9}
            y={14}
            blur={3}
            scale={0.97}
          />
        </div>

        {/* Title beat 2 — "Only available for trading bots". Same
            treatment as beat 1; cross-fades in at PHASE_2_AT. */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: 0,
            right: 0,
            transform: `translateY(-50%) translateY(${sublineY.toFixed(2)}px)`,
            textAlign: "center",
            pointerEvents: "none",
            opacity: phase2Op,
            fontFamily: font,
            fontSize: 82,
            fontWeight: 700,
            letterSpacing: "-0.025em",
            color: "#FFFFFF",
            lineHeight: 1.05,
            padding: "0 96px",
          }}
        >
          Only available for trading bots
        </div>

      {/* Fine-print paragraph — Kalshi-style dense block.
          Footnotes (a)–(g) and the Rigged article sources are all in
          ONE wrapped paragraph. Fades in once at FOOTNOTES_AT and holds
          for the whole card. */}
      <div
        style={{
          position: "absolute",
          bottom: 60,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          padding: "0 120px",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 13,
            fontWeight: 400,
            letterSpacing: "-0.003em",
            color: "rgba(255,255,255,0.72)",
            lineHeight: 1.45,
            textAlign: "center",
            maxWidth: 1560,
            opacity: footnotesOpacity,
          }}
        >
          {FOOTNOTES.map((line) => (
            <React.Fragment key={line.letter}>
              <span style={{ color: "rgba(255,255,255,0.55)" }}>
                ({line.letter})
              </span>{" "}
              {line.text}{" "}
            </React.Fragment>
          ))}
          {SOURCES.map((s) => (
            <React.Fragment key={s.label}>
              <span style={{ color: "rgba(255,255,255,0.55)" }}>
                {s.label}:
              </span>{" "}
              {s.text}{" "}
            </React.Fragment>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── General mark — landing-page geometry, rounded square + single bar ─────
//
// Same SVG the dapp's homepage uses (frontend/public/logo.svg): a rounded
// square with one centred pill bar inside. Inverted for the endcard's
// blue field — square is white, the bar is cut in the accent colour so
// it reads as a horizontal carve through the mark.

const GeneralMark: React.FC<{ size: number }> = ({ size }) => {
  const cutout = colors.accent;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1024 1024"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }}
    >
      <rect width="1024" height="1024" rx="232" ry="232" fill="#FFFFFF" />
      <rect
        x="256"
        y="462"
        width="512"
        height="100"
        rx="50"
        ry="50"
        fill={cutout}
      />
    </svg>
  );
};

// ─── White dot grid for the inverted endcard ─────────────────────────────────
//
// Same two-layer recipe as DotGrid, but in white over the blue field. Inlined
// here because the fill color is the only difference.

// One shock event at scene start. Five concentric rings spawned in quick
// succession — a single impact, not a continuous loop. Each ring expands
// outward, brightens dots it passes through, and fades as it travels. After
// the rings die past the canvas edge, the field returns to the baseline
// dot grid for the rest of the scene.

const FINE_SPACING = 14;
const FINE_RADIUS = 1.6;
const FINE_ALPHA_BASE = 0.18;
const FINE_ALPHA_PEAK = 1.0;
const WHITE = "#FFFFFF";

const SHOCK_RING_COUNT = 5;          // number of concentric rings in the shock
const SHOCK_RING_SPACING_SEC = 0.10; // delay between successive ring spawns
const SHOCK_SPEED_PX = 1100;         // outward speed (faster than continuous)
const SHOCK_THICKNESS_PX = 80;       // width of each bright ring
const SHOCK_LIFETIME_SEC = 1.6;      // how long an individual ring stays alive
const SHOCK_START_SEC = 0.05;        // tiny delay so the shock lands with the punch
const SHOCK_INITIAL_RADIUS_PX = 130; // rings birth at the logo perimeter, not at a point

// The shock emanates from the General mark, which the layout puts to the
// left of canvas center (the wordmark text "General" extends to the right
// of the mark, so the centered row places the mark in the left half) and
// slightly above center (the centered content block has subline + tertiary
// pill below the wordmark row).
// Tuned for a 1920x1080 canvas with size=200 mark, 30px gap, 220pt wordmark.
const SHOCK_CX_FRAC = 0.29;
const SHOCK_CY_FRAC = 0.38;

type WaveFront = {
  radius: number;
  intensity: number;
};

const computeShockWaves = (timeSec: number): WaveFront[] => {
  const waves: WaveFront[] = [];
  for (let i = 0; i < SHOCK_RING_COUNT; i++) {
    const spawnAt = SHOCK_START_SEC + i * SHOCK_RING_SPACING_SEC;
    const age = timeSec - spawnAt;
    if (age < 0 || age > SHOCK_LIFETIME_SEC) continue;
    const lifeT = age / SHOCK_LIFETIME_SEC;
    // Bell curve over the ring's life: sharp ramp in, slow fade.
    const intensity =
      lifeT < 0.15
        ? lifeT / 0.15
        : Math.pow(1 - (lifeT - 0.15) / 0.85, 1.4);
    waves.push({
      radius: SHOCK_INITIAL_RADIUS_PX + age * SHOCK_SPEED_PX,
      intensity,
    });
  }
  return waves;
};

const WhiteDotGrid: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;

  const cx = W * SHOCK_CX_FRAC;
  const cy = H * SHOCK_CY_FRAC;

  const waves = computeShockWaves(t);

  const cols = Math.ceil(W / FINE_SPACING) + 2;
  const rows = Math.ceil(H / FINE_SPACING) + 2;

  const baseDots: React.ReactNode[] = [];
  const boostDots: React.ReactNode[] = [];

  for (let ry = 0; ry < rows; ry++) {
    const y = ry * FINE_SPACING - FINE_SPACING / 2;
    for (let rx = 0; rx < cols; rx++) {
      const x = rx * FINE_SPACING - FINE_SPACING / 2;
      const baseAlpha = FINE_ALPHA_BASE;
      const k = `${ry},${rx}`;

      baseDots.push(
        <circle
          key={`b${k}`}
          cx={x}
          cy={y}
          r={FINE_RADIUS}
          fill={WHITE}
          opacity={baseAlpha}
        />,
      );

      if (waves.length === 0) continue;

      const dist = Math.hypot(x - cx, y - cy);
      let boost = 0;
      for (const w of waves) {
        const distFromFront = Math.abs(dist - w.radius);
        if (distFromFront < SHOCK_THICKNESS_PX) {
          const local = 1 - distFromFront / SHOCK_THICKNESS_PX;
          const eased = local * local;
          boost = Math.max(boost, eased * w.intensity);
        }
      }

      if (boost > 0.04) {
        const peakAlpha =
          baseAlpha + (FINE_ALPHA_PEAK - baseAlpha) * boost;
        const radiusBoost = FINE_RADIUS * (1 + boost * 0.55);
        boostDots.push(
          <circle
            key={`w${k}`}
            cx={x}
            cy={y}
            r={radiusBoost}
            fill={WHITE}
            opacity={peakAlpha}
          />,
        );
      }
    }
  }

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
      }}
    >
      <g>{baseDots}</g>
      <g>{boostDots}</g>
    </svg>
  );
};

export const antiCheatEndCardMeta = {
  id: "AntiCheatEndCard",
  component: AntiCheatEndCard,
  durationInFrames: toFrames(SCENE_SECONDS),
  fps: FPS,
  width: W,
  height: H,
};
