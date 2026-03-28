import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Sequence,
  Easing,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", {
  subsets: ["latin"],
  weights: ["300", "400", "500", "600", "700", "800"],
});

const BLUE = "#042FF3";
const WHITE = "#FFFFFF";

// Audio beats for sync (first 10s): 0.55, 0.7, 1.1, 1.35, 1.5, 1.7, 1.75, 1.85, 2.5, 2.6
// At 29fps: frames 16, 20, 32, 39, 44, 49, 51, 54, 73, 75

// Film grain overlay — subtle noise texture
const FilmGrain: React.FC<{ opacity?: number }> = ({ opacity = 0.04 }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      zIndex: 999,
      opacity,
      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
      backgroundSize: "256px 256px",
      mixBlendMode: "overlay",
    }}
  />
);

// Stock ticker data — single column, right-aligned as in reference
const TICKERS = [
  { price: "567,10", dir: "up", pct: "+2,45%" },
  { price: "250.10", dir: "up", pct: "+1.25%" },
  { price: "413.12", dir: "down", pct: "-0.06%" },
  { price: "871.56", dir: "up", pct: "+2.73%" },
  { price: "517.94", dir: "down", pct: "-1.04%" },
  { price: "328.63", dir: "up", pct: "+0.15%" },
  { price: "699.46", dir: "up", pct: "+0.91%" },
  { price: "735.00", dir: "up", pct: "+1.39%" },
  { price: "964.25", dir: "down", pct: "-0.52%" },
  { price: "452.89", dir: "up", pct: "+3.01%" },
  { price: "573.36", dir: "down", pct: "-0.29%" },
  { price: "240.21", dir: "up", pct: "+1.48%" },
];

/**
 * Segment 1: "Sometimes investing can feel →" with stock tickers
 * Reference: frame_001–004
 * Words appear left-of-center with overshoot spring.
 * Tickers in a single column, right-of-center, vertically distributed.
 */
const SometimesSegment: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const words = ["Sometimes", "investing", "can", "feel"];
  // Beat-synced word starts: "Sometimes" at beat 0.55s (frame 16),
  // "investing" at 0.7s (f20), "can" at 1.1s (f32), "feel" at 1.35s (f39)
  const wordStartFrames = [0, Math.round(fps * 0.4), Math.round(fps * 0.85), Math.round(fps * 1.15)];

  // Overall fade out — dissolve transition at 2.336s
  const segmentOpacity = interpolate(frame, [fps * 1.7, fps * 2.1], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Ticker columns fade in after first word appears
  const tickerOpacity = interpolate(frame, [fps * 0.3, fps * 0.6], [0, 0.35], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Subtle ticker scroll
  const tickerScrollY = interpolate(frame, [0, fps * 2], [10, -10], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity: segmentOpacity }}>
      <FilmGrain opacity={0.035} />

      {/* Stock tickers — single column, right side, matching reference layout */}
      <div
        style={{
          position: "absolute",
          top: 40,
          right: 260,
          opacity: tickerOpacity,
          transform: `translateY(${tickerScrollY}px)`,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {TICKERS.map((t, i) => {
          const stagger = interpolate(
            frame,
            [fps * 0.3 + i * 1.5, fps * 0.5 + i * 1.5],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );
          return (
            <div
              key={i}
              style={{
                fontFamily,
                fontSize: 15,
                fontWeight: 300,
                color: "rgba(255,255,255,0.5)",
                whiteSpace: "nowrap",
                letterSpacing: 1.2,
                opacity: stagger,
                textAlign: "right",
              }}
            >
              {t.price}&nbsp;&nbsp;{t.dir === "up" ? "↑" : "↓"}&nbsp;{t.pct}
            </div>
          );
        })}
      </div>

      {/* Main text — positioned left-of-center as in reference */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-58%, -50%)",
          display: "flex",
          flexWrap: "nowrap",
          gap: 12,
          alignItems: "baseline",
          whiteSpace: "nowrap",
        }}
      >
        {words.map((word, i) => {
          // Use spring with overshoot (ease_out_back_overshoot detected)
          const wordSpring = spring({
            frame: Math.max(0, frame - wordStartFrames[i]),
            fps,
            config: {
              damping: 12,
              mass: 0.8,
              stiffness: 120,
            },
          });
          const wordOpacity = interpolate(
            frame,
            [wordStartFrames[i], wordStartFrames[i] + Math.round(fps * 0.08)],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );
          // Slight upward motion
          const wordY = (1 - wordSpring) * 18;
          return (
            <span
              key={word}
              style={{
                fontFamily,
                fontSize: word === "investing" ? 58 : 50,
                fontWeight: word === "investing" ? 700 : 400,
                color: WHITE,
                opacity: wordOpacity,
                transform: `translateY(${wordY}px)`,
                letterSpacing: -0.5,
              }}
            >
              {word}
            </span>
          );
        })}
        {/* Arrow after "feel" */}
        <span
          style={{
            fontFamily,
            fontSize: 42,
            fontWeight: 300,
            color: WHITE,
            opacity: interpolate(
              frame,
              [wordStartFrames[3] + Math.round(fps * 0.15), wordStartFrames[3] + Math.round(fps * 0.25)],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            ),
            transform: `translateX(${interpolate(
              frame,
              [wordStartFrames[3] + Math.round(fps * 0.15), wordStartFrames[3] + Math.round(fps * 0.35)],
              [-8, 0],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            )}px)`,
          }}
        >
          →
        </span>
      </div>
    </AbsoluteFill>
  );
};

/**
 * Tangled ribbon path — figure-8 / pretzel loops matching reference.
 * The reference shows a glossy 3D tube with loops and self-crossings.
 * We approximate with layered SVG strokes + gradients + blur for depth.
 */
const TangledRibbon: React.FC<{ progress: number }> = ({ progress }) => {
  // Complex interlocking loop paths inspired by the reference
  const paths = [
    // Main figure-8 with tight self-crossing loops (like reference pretzel)
    "M 200,240 C 300,140 420,120 480,200 C 540,280 460,340 400,290 C 340,240 390,160 480,180 C 570,200 620,300 570,360 C 520,420 440,380 480,300 C 520,220 620,170 720,230 C 820,290 780,400 700,380",
    // Second crossing figure-8
    "M 280,320 C 360,200 480,170 560,260 C 640,350 560,420 490,360 C 420,300 470,210 570,230 C 670,250 740,370 680,430 C 620,490 520,430 570,340 C 620,250 740,200 840,280",
    // Tight inner knot
    "M 380,260 C 420,180 520,160 560,240 C 600,320 530,380 480,320 C 430,260 480,190 560,210 C 640,230 680,330 640,380 C 600,430 530,400 560,320 C 590,240 670,200 750,250",
    // Wide outer frame loop
    "M 160,300 C 260,140 440,100 560,210 C 680,320 600,440 480,400 C 360,360 330,240 440,180 C 550,120 720,160 800,280 C 880,400 780,480 660,420",
  ];

  const totalLength = 2600;

  return (
    <svg
      viewBox="0 0 1100 600"
      style={{
        position: "absolute",
        inset: -40,
        width: "calc(100% + 80px)",
        height: "calc(100% + 80px)",
      }}
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        {/* Glass-like gradient */}
        <linearGradient id="ribbonGlass1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(160,180,255,0.9)" />
          <stop offset="30%" stopColor="rgba(200,210,255,0.4)" />
          <stop offset="50%" stopColor="rgba(140,170,255,0.8)" />
          <stop offset="70%" stopColor="rgba(180,200,255,0.3)" />
          <stop offset="100%" stopColor="rgba(160,190,255,0.85)" />
        </linearGradient>
        <linearGradient id="ribbonGlass2" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(180,195,255,0.7)" />
          <stop offset="50%" stopColor="rgba(220,230,255,0.3)" />
          <stop offset="100%" stopColor="rgba(150,175,255,0.8)" />
        </linearGradient>
        {/* Glow filter */}
        <filter id="ribbonGlow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Shadow filter for depth */}
        <filter id="ribbonShadow">
          <feDropShadow dx="3" dy="5" stdDeviation="4" floodColor="rgba(0,20,100,0.3)" />
        </filter>
      </defs>

      {paths.map((path, i) => {
        const staggerDelay = i * 0.08;
        const localProgress = Math.max(0, Math.min(1, (progress - staggerDelay) / (1 - staggerDelay)));
        return (
          <React.Fragment key={i}>
            {/* Shadow layer */}
            <path
              d={path}
              fill="none"
              stroke="rgba(0,15,80,0.15)"
              strokeWidth={22 - i * 3}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={totalLength}
              strokeDashoffset={totalLength * (1 - localProgress)}
              transform="translate(4, 6)"
            />
            {/* Outer glow — subtle */}
            <path
              d={path}
              fill="none"
              stroke={`rgba(130,160,255,${0.18 - i * 0.03})`}
              strokeWidth={24 - i * 3}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={totalLength}
              strokeDashoffset={totalLength * (1 - localProgress)}
              filter="url(#ribbonGlow)"
            />
            {/* Main tube body — thicker, more solid */}
            <path
              d={path}
              fill="none"
              stroke={i % 2 === 0 ? "url(#ribbonGlass1)" : "url(#ribbonGlass2)"}
              strokeWidth={14 - i * 1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={totalLength}
              strokeDashoffset={totalLength * (1 - localProgress)}
            />
            {/* Edge highlight — top edge of tube */}
            <path
              d={path}
              fill="none"
              stroke={`rgba(200,215,255,${0.55 - i * 0.08})`}
              strokeWidth={6 - i * 0.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={totalLength}
              strokeDashoffset={totalLength * (1 - localProgress)}
            />
            {/* Specular center line */}
            <path
              d={path}
              fill="none"
              stroke={`rgba(240,245,255,${0.35 - i * 0.06})`}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={totalLength}
              strokeDashoffset={totalLength * (1 - localProgress)}
            />
          </React.Fragment>
        );
      })}
    </svg>
  );
};

/**
 * Segment 2: "all over the place" with tangled ribbon
 * Reference: frame_005–007
 * Huge text filling viewport, dashes between "all" and "over",
 * 3D ribbon loops tangled across the center.
 */
const AllOverSegment: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const exitOpacity = interpolate(frame, [fps * 1.1, fps * 1.4], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Words: "all" top-left, "over" top-right, "the" bottom-left, "place" bottom-right
  const words = [
    { text: "all", top: "2%", left: "4%", textAlign: "left" as const },
    { text: "over", top: "2%", right: "4%", textAlign: "right" as const },
    { text: "the", bottom: "8%", left: "4%", textAlign: "left" as const },
    { text: "place", bottom: "8%", right: "4%", textAlign: "right" as const },
  ];

  const wordDelays = [0, Math.round(fps * 0.06), Math.round(fps * 0.12), Math.round(fps * 0.18)];

  // Ribbon draws on quickly
  const ribbonProgress = interpolate(frame, [0, fps * 0.5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill style={{ opacity: exitOpacity }}>
      <FilmGrain opacity={0.03} />

      {/* Tangled ribbon behind text */}
      <TangledRibbon progress={ribbonProgress} />

      {/* Dashes connecting "all" to "over" — horizontal row at top */}
      <div
        style={{
          position: "absolute",
          top: "16%",
          left: "18%",
          width: "64%",
          display: "flex",
          gap: 14,
          alignItems: "center",
          justifyContent: "center",
          opacity: interpolate(frame, [Math.round(fps * 0.08), Math.round(fps * 0.2)], [0, 0.7], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 42,
              height: 4,
              background: "rgba(255,255,255,0.55)",
              borderRadius: 2,
            }}
          />
        ))}
      </div>

      {/* Big text: "all over the place" */}
      {words.map((w, i) => {
        const delay = wordDelays[i];
        const wordSpring = spring({
          frame: Math.max(0, frame - delay),
          fps,
          config: { damping: 12, mass: 0.7, stiffness: 100 },
        });
        const posStyle: React.CSSProperties = {
          position: "absolute",
          ...(w.top ? { top: w.top } : {}),
          ...(w.bottom ? { bottom: w.bottom } : {}),
          ...(w.left ? { left: w.left } : {}),
          ...(w.right ? { right: w.right } : {}),
          fontFamily,
          fontSize: 150,
          fontWeight: 700,
          color: WHITE,
          opacity: wordSpring,
          transform: `translateY(${(1 - wordSpring) * 35}px)`,
          lineHeight: 1.0,
          letterSpacing: -3,
          textShadow: "0 4px 20px rgba(0,0,0,0.15)",
        };
        return (
          <div key={w.text} style={posStyle}>
            {w.text}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/**
 * Segment 3: Phone mockup with public.com → tilts → isometric grid
 * Reference: frame_008–014
 * Phone enters centered, tilts with perspective, then zooms to isometric grid.
 */
const PhoneSegment: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phone slides up with spring
  const entrySpring = spring({
    frame,
    fps,
    config: { damping: 14, mass: 1.0, stiffness: 80 },
  });

  // Phone tilts after settling (~0.8s in)
  const tiltStart = Math.round(fps * 0.6);
  const tiltProgress = interpolate(
    frame,
    [tiltStart, tiltStart + Math.round(fps * 0.4)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }
  );

  // Transition to isometric view (~1.2s in)
  const isoStart = Math.round(fps * 1.2);
  const isoProgress = interpolate(frame, [isoStart, isoStart + Math.round(fps * 0.5)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  // Exit — hold the isometric view longer before fading
  const exitOpacity = interpolate(frame, [fps * 2.8, fps * 3.1], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const phoneY = interpolate(entrySpring, [0, 1], [600, 0]);

  // Tilt transforms — perspective-correct 3D rotation
  const tiltRotateY = interpolate(tiltProgress, [0, 1], [0, -18]);
  const tiltRotateX = interpolate(tiltProgress, [0, 1], [0, 5]);

  // Isometric transforms
  const phoneScale = interpolate(isoProgress, [0, 1], [1, 0.55]);
  const isoRotateX = interpolate(isoProgress, [0, 1], [tiltRotateX, 55]);
  const isoRotateZ = interpolate(isoProgress, [0, 1], [0, -45]);
  const isoRotateY = interpolate(isoProgress, [0, 1], [tiltRotateY, 0]);

  // Isometric card data — mimics various app screens
  const isoCards = [
    { label: "Treasury account", amount: "$5,585.00", hasChart: false, hasBar: true },
    { label: "Holdings", amount: "", hasChart: true, hasBar: false },
    { label: "About", amount: "", hasChart: false, hasBar: true },
    { label: "Statements", amount: "", hasChart: false, hasBar: true },
    { label: "Community", amount: "", hasChart: false, hasBar: false },
    { label: "Rating", amount: "", hasChart: false, hasBar: true },
    { label: "Buy", amount: "", hasChart: false, hasBar: true },
    { label: "$125,367.10", amount: "Today", hasChart: true, hasBar: false },
    { label: "Research", amount: "", hasChart: true, hasBar: false },
    { label: "Public Live", amount: "", hasChart: false, hasBar: false },
    { label: "Top holdings", amount: "13.7%", hasChart: false, hasBar: true },
    { label: "Watchlist", amount: "", hasChart: true, hasBar: false },
    { label: "Your position", amount: "", hasChart: false, hasBar: false },
    { label: "View all", amount: "", hasChart: false, hasBar: false },
    { label: "Let's Talk", amount: "", hasChart: false, hasBar: false },
  ];

  return (
    <AbsoluteFill style={{ opacity: exitOpacity }}>
      <FilmGrain opacity={0.03} />

      {/* Background app screen cards (isometric grid) */}
      {isoProgress > 0 && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: `translate(-50%, -50%) perspective(1200px) rotateX(55deg) rotateZ(-45deg)`,
            opacity: isoProgress,
            display: "grid",
            gridTemplateColumns: "repeat(5, 260px)",
            gridTemplateRows: "repeat(3, 440px)",
            gap: 24,
          }}
        >
          {isoCards.map((card, i) => {
            const isCenter = i === 7;
            const cardDelay = i * 0.02;
            const cardOpacity = interpolate(
              isoProgress,
              [cardDelay, cardDelay + 0.3],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );
            return (
              <div
                key={i}
                style={{
                  background: isCenter
                    ? "linear-gradient(145deg, #ffffff, #f6f8ff)"
                    : "linear-gradient(145deg, #fafbff, #eef1ff)",
                  borderRadius: 18,
                  border: isCenter
                    ? "2px solid rgba(80,140,255,0.3)"
                    : `1.5px solid rgba(${120 + (i * 17) % 60},${150 + (i * 23) % 50},${220 + (i * 11) % 35},0.2)`,
                  boxShadow: isCenter
                    ? "0 8px 40px rgba(0,0,80,0.14), 0 2px 8px rgba(0,0,80,0.08), inset 0 1px 0 rgba(255,255,255,0.8)"
                    : `0 4px 20px rgba(0,0,80,0.06), 0 0 0 1px rgba(${140 + (i * 13) % 80},${170 + (i * 19) % 60},255,0.08), inset 0 1px 0 rgba(255,255,255,0.6)`,
                  overflow: "hidden",
                  padding: 14,
                  opacity: cardOpacity,
                  position: "relative",
                }}
              >
                {/* Card label */}
                <div
                  style={{
                    fontFamily,
                    fontSize: 12,
                    fontWeight: 500,
                    color: "rgba(0,20,80,0.55)",
                    marginBottom: 8,
                    letterSpacing: 0.3,
                  }}
                >
                  {card.label}
                </div>
                {card.amount && (
                  <div
                    style={{
                      fontFamily,
                      fontSize: isCenter ? 22 : 16,
                      fontWeight: 700,
                      color: "rgba(0,20,80,0.8)",
                      marginBottom: 10,
                    }}
                  >
                    {card.amount}
                  </div>
                )}
                {/* Chart line */}
                {card.hasChart && (
                  <svg viewBox="0 0 100 25" style={{ width: "100%", height: 25, marginBottom: 6 }}>
                    <path
                      d={`M 0,${15 + (i % 5) * 2} C 20,${10 - (i % 3) * 3} 40,${18 + (i % 4)} 60,${8 - (i % 2) * 3} S 80,${16 + (i % 3)} 100,${12 - (i % 5)}`}
                      fill="none"
                      stroke={`rgba(4,47,243,${0.25 + (i % 3) * 0.08})`}
                      strokeWidth={1.2}
                    />
                  </svg>
                )}
                {/* Text skeleton lines */}
                <div style={{ width: "70%", height: 5, background: "rgba(4,47,243,0.08)", borderRadius: 2, marginBottom: 4 }} />
                <div style={{ width: "55%", height: 5, background: "rgba(4,47,243,0.06)", borderRadius: 2, marginBottom: 4 }} />
                <div style={{ width: "40%", height: 5, background: "rgba(4,47,243,0.04)", borderRadius: 2, marginBottom: 10 }} />
                {/* Bar chart */}
                {card.hasBar && (
                  <div style={{ display: "flex", gap: 4, alignItems: "flex-end", marginTop: 4 }}>
                    {[30, 50, 20, 65, 40, 55].map((h, j) => (
                      <div
                        key={j}
                        style={{
                          width: 10,
                          height: h * 0.4,
                          background: `rgba(4,47,243,${0.12 + j * 0.03})`,
                          borderRadius: 2,
                        }}
                      />
                    ))}
                  </div>
                )}
                {/* Blue action button on some cards */}
                {i % 5 === 0 && (
                  <div
                    style={{
                      marginTop: 12,
                      width: "55%",
                      height: 24,
                      background: BLUE,
                      borderRadius: 6,
                      opacity: 0.7,
                    }}
                  />
                )}
                {/* Green/red indicator */}
                {i % 4 === 1 && (
                  <div
                    style={{
                      position: "absolute",
                      top: 12,
                      right: 12,
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: i % 2 === 0 ? "#00c853" : "#ff1744",
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Main phone mockup */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: `translate(-50%, calc(-50% + ${phoneY}px)) perspective(1000px) rotateY(${isoRotateY}deg) rotateX(${isoRotateX}deg) rotateZ(${isoRotateZ}deg) scale(${phoneScale})`,
          transformStyle: "preserve-3d",
          width: 300,
          height: 600,
          background: "linear-gradient(160deg, #1a2040, #101830, #0a1020)",
          borderRadius: 44,
          padding: 7,
          boxShadow: `0 ${20 + isoProgress * 10}px ${60 + isoProgress * 20}px rgba(0,0,0,${0.3 + isoProgress * 0.1}), 0 4px 16px rgba(0,0,0,0.2)`,
          zIndex: 10,
        }}
      >
        {/* Screen */}
        <div
          style={{
            width: "100%",
            height: "100%",
            background: WHITE,
            borderRadius: 38,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {/* Dynamic Island */}
          <div
            style={{
              position: "absolute",
              top: 14,
              left: "50%",
              transform: "translateX(-50%)",
              width: 90,
              height: 24,
              background: "#101830",
              borderRadius: 12,
            }}
          />
          {/* Phone content — shows logo initially, then portfolio in iso mode */}
          {isoProgress < 0.3 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                <div style={{ width: 12, height: 12, borderRadius: "50%", background: BLUE }} />
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: BLUE }} />
              </div>
              <span style={{ fontFamily, fontSize: 22, fontWeight: 600, color: "#0a0a2e", letterSpacing: -0.5 }}>
                public.com
              </span>
            </div>
          ) : (
            <div style={{ width: "100%", padding: "50px 18px 18px", display: "flex", flexDirection: "column", gap: 6 }}>
              {/* Portfolio header */}
              <div style={{ fontFamily, fontSize: 11, fontWeight: 400, color: "rgba(0,20,60,0.5)" }}>Portfolio</div>
              <div style={{ fontFamily, fontSize: 24, fontWeight: 700, color: "#0a0a2e" }}>$125,367.10</div>
              <div style={{ fontFamily, fontSize: 10, fontWeight: 500, color: "#00c853" }}>Today +$1,432.50 (+1.15%)</div>
              {/* Mini chart */}
              <svg viewBox="0 0 240 60" style={{ width: "100%", height: 50, marginTop: 4 }}>
                <path d="M 0,45 C 30,40 60,35 80,30 S 120,20 150,25 S 200,15 240,10" fill="none" stroke="rgba(4,47,243,0.3)" strokeWidth={1.5} />
                <path d="M 0,45 C 30,40 60,35 80,30 S 120,20 150,25 S 200,15 240,10 L 240,60 L 0,60 Z" fill="rgba(4,47,243,0.05)" />
              </svg>
              {/* Tab bar */}
              <div style={{ display: "flex", gap: 12, marginTop: 4, borderBottom: "1px solid rgba(0,0,0,0.06)", paddingBottom: 6 }}>
                {["Portfolio", "Assets", "Activity"].map((tab, ti) => (
                  <div key={tab} style={{ fontFamily, fontSize: 9, fontWeight: ti === 0 ? 600 : 400, color: ti === 0 ? BLUE : "rgba(0,20,60,0.4)" }}>{tab}</div>
                ))}
              </div>
              {/* Holdings list */}
              {[
                { name: "AAPL", amount: "$24,500", pct: "+2.3%" },
                { name: "TSLA", amount: "$18,200", pct: "-1.1%" },
                { name: "BTC", amount: "$15,800", pct: "+4.5%" },
                { name: "SPY", amount: "$12,400", pct: "+0.8%" },
              ].map((h, hi) => (
                <div key={hi} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: "0.5px solid rgba(0,0,0,0.04)" }}>
                  <div>
                    <div style={{ fontFamily, fontSize: 10, fontWeight: 600, color: "#0a0a2e" }}>{h.name}</div>
                    <div style={{ fontFamily, fontSize: 8, fontWeight: 400, color: "rgba(0,20,60,0.4)" }}>{h.amount}</div>
                  </div>
                  <div style={{ fontFamily, fontSize: 9, fontWeight: 500, color: h.pct.startsWith("+") ? "#00c853" : "#ff1744" }}>{h.pct}</div>
                </div>
              ))}
              {/* Blue dot indicator */}
              <div style={{ position: "absolute", right: 16, top: "50%", width: 24, height: 24, borderRadius: "50%", background: BLUE, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "white" }} />
              </div>
            </div>
          )}
        </div>

        {/* Side buttons */}
        <div
          style={{
            position: "absolute",
            right: -3,
            top: 130,
            width: 3,
            height: 55,
            background: "#2a3050",
            borderRadius: "0 2px 2px 0",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: -3,
            top: 110,
            width: 3,
            height: 30,
            background: "#2a3050",
            borderRadius: "2px 0 0 2px",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: -3,
            top: 150,
            width: 3,
            height: 55,
            background: "#2a3050",
            borderRadius: "2px 0 0 2px",
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

/**
 * Segment 4: "One place" glass text + blue arrow box → slide → "invest in"
 * Reference: frame_015–018
 * "One" is enormous glass/iridescent text, "place" is bold blue below.
 * Arrow box on the right. Whole white panel slides left to reveal blue "invest in".
 */
const OnePlaceSegment: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // "One" appears with overshoot spring
  const oneSpring = spring({
    frame,
    fps,
    config: { damping: 12, mass: 0.8, stiffness: 100 },
  });

  // "place" appears slightly after
  const placeSpring = spring({
    frame: Math.max(0, frame - Math.round(fps * 0.12)),
    fps,
    config: { damping: 12, mass: 0.8, stiffness: 100 },
  });

  // Blue arrow box
  const arrowSpring = spring({
    frame: Math.max(0, frame - Math.round(fps * 0.25)),
    fps,
    config: { damping: 10, mass: 0.5, stiffness: 120 },
  });

  // Slide the whole white panel left
  const slideStart = Math.round(fps * 1.2);
  const slideProgress = interpolate(frame, [slideStart, slideStart + Math.round(fps * 0.45)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const slideX = slideProgress * -1300;

  // "invest in" text
  const investOpacity = interpolate(frame, [slideStart + Math.round(fps * 0.1), slideStart + Math.round(fps * 0.35)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Exit
  const exitOpacity = interpolate(frame, [fps * 2.2, fps * 2.5], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity: exitOpacity }}>
      {/* Blue background always behind */}
      <AbsoluteFill style={{ background: BLUE }}>
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "55%",
            transform: "translate(-50%, -50%)",
            opacity: investOpacity,
          }}
        >
          <span
            style={{
              fontFamily,
              fontSize: 52,
              fontWeight: 400,
              color: WHITE,
              letterSpacing: -0.5,
            }}
          >
            invest in
          </span>
        </div>
      </AbsoluteFill>

      {/* White panel with "One place" — slides left */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: WHITE,
          transform: `translateX(${slideX}px)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 30,
          paddingLeft: 60,
        }}
      >
        <FilmGrain opacity={0.02} />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
          }}
        >
          {/* "One" — glass/iridescent text effect */}
          <div
            style={{
              fontFamily,
              fontSize: 220,
              fontWeight: 200,
              lineHeight: 0.82,
              opacity: oneSpring,
              transform: `translateY(${(1 - oneSpring) * 60}px)`,
              color: "#a0a9cc",
              textShadow: "0 3px 12px rgba(80,100,170,0.15), 0 -1px 0 rgba(200,210,240,0.4), 0 2px 0 rgba(120,135,180,0.15)",
              filter: "drop-shadow(0 5px 18px rgba(60,80,160,0.15))",
              letterSpacing: -8,
              position: "relative",
            }}
          >
            One
            {/* Gradient variation overlay — adds iridescent shimmer */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                fontFamily,
                fontSize: 220,
                fontWeight: 200,
                lineHeight: 0.82,
                letterSpacing: -8,
                background:
                  "linear-gradient(160deg, rgba(200,160,240,0.3) 0%, rgba(150,200,250,0.15) 30%, transparent 50%, rgba(230,190,210,0.2) 70%, rgba(170,210,240,0.15) 90%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                mixBlendMode: "overlay",
                pointerEvents: "none",
              }}
            >
              One
            </div>
          </div>

          {/* "place" — bold blue, overlapping the glass text slightly */}
          <div
            style={{
              fontFamily,
              fontSize: 140,
              fontWeight: 800,
              lineHeight: 0.85,
              opacity: placeSpring,
              transform: `translateY(${(1 - placeSpring) * 35}px)`,
              color: BLUE,
              marginTop: -25,
              letterSpacing: -4,
              textShadow: "0 2px 15px rgba(4,47,243,0.15)",
            }}
          >
            place
          </div>
        </div>

        {/* Blue arrow box — positioned to the right */}
        <div
          style={{
            width: 100,
            height: 100,
            background: BLUE,
            borderRadius: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: arrowSpring,
            transform: `scale(${arrowSpring}) translateY(40px)`,
            boxShadow: "0 10px 35px rgba(4,47,243,0.3)",
          }}
        >
          <span style={{ color: WHITE, fontSize: 42, fontWeight: 300 }}>→</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/**
 * Segment 5: "everything" grid pattern
 * Reference: frame_019–020
 * Blue background, repeated "everything" in a grid, center one is bold white.
 * Remaining are dimmed blue-ish text.
 */
const EverythingSegment: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrySpring = spring({
    frame,
    fps,
    config: { damping: 12, mass: 0.5, stiffness: 120 },
  });

  const COLS = 5;
  const ROWS = 9;
  const centerRow = Math.floor(ROWS / 2);
  const centerCol = Math.floor(COLS / 2);

  // Slight scroll for motion
  const scrollY = interpolate(frame, [0, fps * 1.8], [12, -12], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Center word scale pulse
  const centerScale = interpolate(frame, [fps * 0.3, fps * 0.5], [0.9, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.back(1.4)),
  });

  return (
    <AbsoluteFill
      style={{
        background: BLUE,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <FilmGrain opacity={0.03} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${COLS}, 1fr)`,
          gridTemplateRows: `repeat(${ROWS}, 1fr)`,
          width: "115%",
          height: "95%",
          alignItems: "center",
          justifyItems: "center",
          opacity: entrySpring,
          transform: `translateY(${scrollY}px)`,
        }}
      >
        {Array.from({ length: ROWS * COLS }).map((_, i) => {
          const row = Math.floor(i / COLS);
          const col = i % COLS;
          const isCenter = row === centerRow && col === centerCol;
          // Distance from center for radial dimming
          const dist = Math.sqrt(
            Math.pow(row - centerRow, 2) + Math.pow(col - centerCol, 2)
          );
          const dimFactor = Math.max(0.1, 1 - dist * 0.18);

          return (
            <span
              key={i}
              style={{
                fontFamily,
                fontSize: isCenter ? 42 : 26,
                fontWeight: isCenter ? 800 : 400,
                color: isCenter
                  ? WHITE
                  : `rgba(80,120,255,${0.3 * dimFactor})`,
                letterSpacing: isCenter ? -1 : -0.3,
                whiteSpace: "nowrap",
                transform: isCenter ? `scale(${centerScale})` : undefined,
                textShadow: isCenter ? "0 0 20px rgba(255,255,255,0.15)" : undefined,
              }}
            >
              everything
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/**
 * Scene 01 — 0.0s to ~10.1s (301 frames at 29fps)
 *
 * Timeline aligned to deep analysis scene changes:
 * Scene 1: 0–2.34s (frames 0–68): "Sometimes investing can feel →"
 * Scene 2: 2.34–3.74s (frames 68–108): "all over the place" + ribbon
 * Scene 3: 3.74–4.2s (frames 108–122): transition to phone
 * Scene 4: 4.2–5.14s (frames 122–149): phone with public.com
 * Scene 5: 5.14–7.01s (frames 149–203): phone isometric grid
 * Scene 6: 7.01–8.41s (frames 203–244): "One place"
 * Scene 7: 8.41–10.28s (frames 244–298): "invest in" → "everything"
 */
export const Scene01: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: BLUE, fontFamily }}>
      {/* Segment 1: "Sometimes investing can feel →" */}
      <Sequence from={0} durationInFrames={70}>
        <SometimesSegment />
      </Sequence>

      {/* Segment 2: "all over the place" */}
      <Sequence from={64} durationInFrames={50}>
        <AllOverSegment />
      </Sequence>

      {/* Segment 3: Phone mockup → tilt → isometric */}
      <Sequence from={108} durationInFrames={105}>
        <PhoneSegment />
      </Sequence>

      {/* Segment 4: "One place" → "invest in" */}
      <Sequence from={195} durationInFrames={60}>
        <OnePlaceSegment />
      </Sequence>

      {/* Segment 5: "everything" grid */}
      <Sequence from={244} durationInFrames={57}>
        <EverythingSegment />
      </Sequence>
    </AbsoluteFill>
  );
};

export const scene01Meta = {
  id: "ReplicateScene01",
  component: Scene01,
  width: 1280,
  height: 720,
  fps: 29,
  durationInFrames: 301,
};
