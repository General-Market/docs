// 1:1 port of the original CSS hover-card demo. Three travel cards
// (Pyramids / Stonehenge / Tower of Pisa). Resting transform is
// rotateX(60deg) scale(0.7); "hover" flattens to rotate(0) scale(1)
// translateY(10px) with a deeper shadow and z-index lift. Since this is
// frame-driven we cycle hover c0 -> c1 -> c2 across the scene with
// eased entries and exits.

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";

const BG = "#eee";

interface Card {
  bgFrom: string;
  bgTo: string;
  imageGradient: string;
  storyGradient: string;
  cityFill: string;
  title: string;
  body: string;
  art: "pyramids" | "stonehenge" | "pisa";
}

const CARDS: Card[] = [
  {
    bgFrom: "#eba65b",
    bgTo: "#d99267",
    // #i0 — linear-gradient(to top, #eba65b 30%, #d99267 100%)
    imageGradient: "linear-gradient(to top, #eba65b 30%, #d99267 100%)",
    // #s0 — linear-gradient(to bottom, #eba65b 0%, #d99267 40%)
    storyGradient: "linear-gradient(to bottom, #eba65b 0%, #d99267 40%)",
    cityFill: "#f8c56f",
    title: "Pyramids",
    body: "Built during a time when Egypt was one of the richest and most powerful civilizations in the world. Their massive scale reflects the unique role that the pharaoh played in ancient Egyptian society.",
    art: "pyramids",
  },
  {
    bgFrom: "#59476f",
    bgTo: "#7b88d1",
    // #i1 — linear-gradient(to bottom, #59476f 30%, #7b88d1 100%)
    imageGradient: "linear-gradient(to bottom, #59476f 30%, #7b88d1 100%)",
    // #s1 — linear-gradient(to top, #5b62a2 0%, #7b88d1 100%)
    storyGradient: "linear-gradient(to top, #5b62a2 0%, #7b88d1 100%)",
    cityFill: "#fff",
    title: "Stonehenge",
    body: "Stonehenge is a prehistoric monument in Wiltshire, England. It was constructed in several stages between 3000 and 1500 B.C., spanning to the Bronze Age.",
    art: "stonehenge",
  },
  {
    bgFrom: "#59476f",
    bgTo: "#7b88d1",
    // #i2 — linear-gradient(to bottom, #59476f 30%, #7b88d1 100%)
    imageGradient: "linear-gradient(to bottom, #59476f 30%, #7b88d1 100%)",
    // #s2 — linear-gradient(to top, #5b62a2 0%, #7b88d1 120%)
    storyGradient: "linear-gradient(to top, #5b62a2 0%, #7b88d1 120%)",
    cityFill: "#c5a7e5",
    title: "Tower of Pisa",
    body: "The Leaning Tower of Pisa or simply the Tower of Pisa is the campanile, or freestanding bell tower, of the cathedral of the Italian city of Pisa, known worldwide for its unintended tilt",
    art: "pisa",
  },
];

const ease = Easing.bezier(0.4, 0, 0.2, 1);

// ---------- Art panels ----------

const PyramidsArt: React.FC<{ fill: string }> = ({ fill }) => (
  <svg viewBox="0 0 300 225" style={{ width: "100%", height: "100%" }} preserveAspectRatio="xMidYMid meet">
    {/* Sun halos */}
    <ellipse cx="170.5" cy="124.75" rx="37.5" ry="37.5" fill={fill} opacity={0.4} />
    <ellipse cx="170.5" cy="124.75" rx="27.5" ry="27.5" fill={fill} opacity={0.4} />
    {/* Big pyramid (left/center) */}
    <polygon points="-0.301,224.5 74.849,149.5 150,224.5" fill="#cd775c" />
    <polygon points="108,224.5 74.849,149.5 150,224.5" fill="#a25a62" />
    {/* Small pyramid (right) */}
    <polygon points="207.256,225.5 253.849,179 300.443,225.5" fill="#cd775c" />
    <polygon points="274.403,225.5 253.849,179 300.443,225.5" fill="#a25a62" />
    {/* Camel / line glyphs near the small pyramid */}
    <line x1="179" y1="202" x2="179" y2="226" stroke="#a25a62" strokeWidth={2} />
    <line x1="179" y1="207" x2="190" y2="207" stroke="#a25a62" strokeWidth={2} />
    <line x1="172" y1="214" x2="180" y2="214" stroke="#a25a62" strokeWidth={2} />
    <line x1="190" y1="202" x2="190" y2="207" stroke="#a25a62" strokeWidth={2} />
    <line x1="172" y1="207" x2="172" y2="214" stroke="#a25a62" strokeWidth={2} />
    {/* Stars */}
    {[
      [87.5, 98.5, 1.5],
      [24.5, 68.5, 2.5],
      [219.5, 18.5, 1.5],
      [272.5, 3.5, 2],
      [144.5, 12.5, 1],
      [107.5, 28.5, 1.5],
      [19.5, 128.5, 1.5],
      [72.5, 113.5, 2],
      [174.5, 92.5, 1],
    ].map(([cx, cy, r], i) => (
      <circle key={i} cx={cx} cy={cy} r={r} fill="#fff" opacity={0.3} />
    ))}
  </svg>
);

const StonehengeArt: React.FC<{ fill: string }> = ({ fill }) => (
  <svg viewBox="0 0 300 225" style={{ width: "100%", height: "100%" }} preserveAspectRatio="xMidYMid meet">
    {/* Moon halos */}
    <ellipse cx="150.5" cy="224.75" rx="77.5" ry="77.5" fill={fill} opacity={0.3} />
    <ellipse cx="150.5" cy="224.75" rx="57.5" ry="57.5" fill={fill} opacity={0.5} />
    <ellipse cx="150.5" cy="224.75" rx="37.5" ry="37.5" fill={fill} />
    {/* Left trilithon */}
    <path
      d="M68.955,225H47.93l8.333-53.171c0.213-1.361,1.386-2.364,2.763-2.364h6.202c1.464,0,2.68,1.129,2.789,2.588l3.727,49.942C71.865,223.617,70.581,225,68.955,225z"
      fill="#59476f"
    />
    <polygon points="111.754,225 90.203,225 96.005,169.465 103.051,169.465" fill="#59476f" />
    <path
      d="M112.233,175.682H50.767c-3.855,0-6.981-3.125-6.981-6.981v-3.182c0-3.796,3.033-6.896,6.827-6.979l61.466-1.351c3.914-0.086,7.134,3.064,7.134,6.979v4.533C119.214,172.556,116.089,175.682,112.233,175.682z"
      fill="#59476f"
    />
    {/* Right trilithon */}
    <path
      d="M202.538,225h-15.319c-2.837,0-5.444,0.24-5.005-2.25l8.296-47.01c0.352-1.997,2.289-3.468,4.565-3.468h3.721c2.419,0,4.428,1.656,4.608,3.798l3.741,44.52C207.346,222.971,205.225,225,202.538,225z"
      fill="#59476f"
    />
    <polygon points="245.98,225 223.157,225 231.421,172.272 242.045,172.272" fill="#59476f" />
    <polygon points="283.798,225 262.163,225 267.988,169.25 275.061,169.25" fill="#59476f" />
    <path
      d="M275.011,178.032h-84.307c-4.478,0-8.107-3.63-8.107-8.107v-8.817c0-4.669,3.933-8.373,8.593-8.093l84.307,5.064c4.281,0.257,7.621,3.804,7.621,8.093v3.754C283.118,174.403,279.489,178.032,275.011,178.032z"
      fill="#59476f"
    />
    {/* Stars */}
    {[
      [24.5, 68.5, 2.5],
      [219.5, 28.5, 1.5],
      [272.5, 103.5, 2],
      [144.5, 92.5, 1],
      [4.5, 88.5, 2.5],
      [29.5, 38.5, 1.5],
      [222.5, 143.5, 2],
      [114.5, 42.5, 1],
    ].map(([cx, cy, r], i) => (
      <circle key={i} cx={cx} cy={cy} r={r} fill="#fff" opacity={0.3} />
    ))}
  </svg>
);

const PisaArt: React.FC<{ fill: string }> = ({ fill }) => (
  <svg viewBox="0 0 300 225" style={{ width: "100%", height: "100%" }} preserveAspectRatio="xMidYMid meet">
    {/* Moon halos */}
    <ellipse cx="150.5" cy="224.75" rx="77.5" ry="77.5" fill="#fff" opacity={0.3} />
    <ellipse cx="150.5" cy="224.75" rx="57.5" ry="57.5" fill="#fff" opacity={0.5} />
    <ellipse cx="150.5" cy="224.75" rx="37.5" ry="37.5" fill="#fff" />
    {/* Story layers — bottom to top */}
    {[
      "69.807,224.719 72.715,209.374 71.974,203.342 120.42,211.753 118.199,217.581 115.799,232.384",
      "77.295,204.276 79.544,191.37 78.827,186.294 119.809,193.405 118.277,198.349 116.264,210.769",
      "80.163,186.582 82.413,173.676 81.696,168.6 122.677,175.711 121.146,180.655 119.132,193.075",
      "83.032,168.888 85.282,155.982 84.565,150.906 125.546,158.017 124.015,162.961 122.001,175.381",
      "85.901,151.194 88.151,138.288 87.433,133.212 128.415,140.323 126.884,145.267 124.87,157.687",
      "88.77,133.5 91.019,120.594 90.302,115.518 131.284,122.629 129.752,127.573 127.739,139.993",
      "91.638,115.806 93.888,102.9 93.171,97.824 134.152,104.935 132.621,109.879 130.607,122.299",
    ].map((pts, i) => (
      <polygon key={i} points={pts} fill={fill} stroke="#222" />
    ))}
    {/* Top cap */}
    <path
      d="M127.114,103.327L99.59,98.865l2.466-15.208c0.608-3.75,4.14-6.296,7.89-5.688l13.452,2.181c4.022,0.652,6.754,4.441,6.102,8.463L127.114,103.327z"
      fill={fill}
      stroke="#222"
    />
    {/* Diagonal "shadow" stripes through the tower */}
    {[
      [109.946, 77.968, 84.783, 226.86],
      [115.708, 79.915, 90.545, 228.807],
      [120.804, 79.728, 95.641, 228.62],
      [125.739, 80.529, 100.577, 229.421],
      [100.502, 98.724, 75.339, 247.616],
      [128.141, 103.205, 102.978, 252.097],
    ].map(([x1, y1, x2, y2], i) => (
      <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#212121" opacity={0.5} />
    ))}
  </svg>
);

const renderArt = (art: Card["art"], fill: string) => {
  if (art === "pyramids") return <PyramidsArt fill={fill} />;
  if (art === "stonehenge") return <StonehengeArt fill={fill} />;
  return <PisaArt fill={fill} />;
};

// ---------- Scene ----------

export const CityHoverCards: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Fade-in 0..20, fade-out last 20 frames.
  const fadeIn = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 20, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const opacity = fadeIn * fadeOut;

  // Cycle hover c0 -> c1 -> c2 across the scene. With 600f @ 60fps that's
  // 10s total — ~3.33s per card. Ease in 20% of the phase, hold, ease
  // out the last 20%.
  const totalSeconds = durationInFrames / fps;
  const phaseSeconds = totalSeconds / 3;
  const t = frame / fps;
  const phase = Math.min(2, Math.floor(t / phaseSeconds));
  const phaseProgress = (t - phase * phaseSeconds) / phaseSeconds;

  const hoverProgress = (i: number): number => {
    if (phase !== i) return 0;
    if (phaseProgress < 0.2) return ease(phaseProgress / 0.2);
    if (phaseProgress > 0.8) return ease((1 - phaseProgress) / 0.2);
    return 1;
  };

  // Card geometry. Original is 300x500 — scaled up for 1920x1080. Three
  // cards side by side, centered. cardW * 3 + gaps fits within 1920.
  const cardW = 460;
  const cardH = 760;
  const gap = 80;
  const stride = cardW + gap;

  // Base z-index from the original CSS: c0=300, c1=0, c2=0.
  const baseZ = [300, 0, 0];

  // Horizontal slots: -1, 0, +1 around center.
  const slot = [0, 1, -1];

  return (
    <AbsoluteFill
      style={{
        background: BG,
        fontFamily: "'Raleway','SF Pro Display',sans-serif",
        fontWeight: 200,
        opacity,
      }}
    >
      {/* Title — original h1 */}
      <h1
        style={{
          position: "absolute",
          top: 60,
          left: "50%",
          transform: "translateX(-50%)",
          color: "#111",
          letterSpacing: 2,
          fontSize: 56,
          margin: 0,
          fontWeight: 200,
          whiteSpace: "nowrap",
        }}
      >
        3 World places to visit this new year
      </h1>

      {/* Cards stage — perspective lives on this wrapper */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: stride * 3,
          height: cardH,
          transform: "translate(-50%, -50%)",
          perspective: 1800,
        }}
      >
        {CARDS.map((card, i) => {
          const hover = hoverProgress(i);
          // Original resting: rotateX(60deg) scale(0.7). Hover:
          // rotate(0deg) scale(1) translateY(10px).
          const rotateX = interpolate(hover, [0, 1], [60, 0]);
          const scale = interpolate(hover, [0, 1], [0.7, 1]);
          const translateY = interpolate(hover, [0, 1], [0, 10]);

          // box-shadow grows on hover. Original is 0px 20px 50px #555.
          const shadowBlur = 50 + hover * 40;
          const shadowSpread = 0;
          const shadowAlpha = 0.45 + hover * 0.15;

          const z = baseZ[i] + Math.floor(hover * 400);

          const leftPx = `calc(50% + ${slot[i] * stride}px - ${cardW / 2}px)`;

          return (
            <div
              key={i}
              style={{
                position: "absolute",
                top: 0,
                left: leftPx,
                width: cardW,
                height: cardH,
                background: `linear-gradient(to bottom, ${card.bgFrom} 30%, ${card.bgTo} 100%)`,
                boxShadow: `0px 20px ${shadowBlur}px ${shadowSpread}px rgba(85,85,85,${shadowAlpha})`,
                transform: `rotateX(${rotateX}deg) scale(${scale}) translateY(${translateY}px)`,
                transformOrigin: "center",
                zIndex: z,
              }}
            >
              {/* Image panel — top 45% */}
              <div
                style={{
                  position: "absolute",
                  top: "0%",
                  left: "0%",
                  width: "100%",
                  height: "45%",
                  background: card.imageGradient,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                <div style={{ width: "92%", height: "92%" }}>
                  {renderArt(card.art, card.cityFill)}
                </div>
              </div>

              {/* Story — bottom 55% */}
              <div
                style={{
                  position: "absolute",
                  top: "45%",
                  left: "0%",
                  width: "100%",
                  height: "55%",
                  background: card.storyGradient,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "stretch",
                  justifyContent: "flex-start",
                  paddingTop: 40,
                }}
              >
                <h3
                  style={{
                    textAlign: "center",
                    textShadow: "0px 0px 10px #eee",
                    color: "#eee",
                    letterSpacing: 2,
                    fontSize: 36,
                    fontWeight: 300,
                    margin: 0,
                    marginBottom: 24,
                  }}
                >
                  {card.title}
                </h3>
                <p
                  style={{
                    fontSize: 20,
                    color: "#fff",
                    padding: "0px 28px 28px 28px",
                    lineHeight: 1.5,
                    textAlign: "center",
                    letterSpacing: 1,
                    margin: 0,
                    fontWeight: 200,
                  }}
                >
                  {card.body}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom hint — original .page block: h4 + arrow list */}
      <div
        style={{
          position: "absolute",
          bottom: 80,
          left: "50%",
          transform: "translateX(-50%)",
          color: "#111",
          letterSpacing: 2,
          textAlign: "center",
          fontWeight: 200,
        }}
      >
        <h4
          style={{
            margin: 0,
            marginBottom: 16,
            fontSize: 28,
            fontWeight: 300,
            letterSpacing: 2,
          }}
        >
          Hover the card
        </h4>
        <div
          style={{
            display: "flex",
            gap: 60,
            justifyContent: "center",
            fontSize: 22,
            letterSpacing: 4,
          }}
        >
          <span>{"<<<"}</span>
          <span>{">>>"}</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
