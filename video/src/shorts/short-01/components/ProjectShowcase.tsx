import React from "react";
import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from "remotion";

// 7 projects showcased in this short — each has a background screenshot
// that scrolls down in a small card, plus a token logo
interface ProjectCard {
  name: string;
  src: string; // Background image filename
  logo: string; // Token logo filename in logos/
  color: string; // Accent color for card border
}

const PROJECTS: ProjectCard[] = [
  { name: "ZAMA", src: "zama_homepage.png", logo: "zama.png", color: "#00D4FF" },
  { name: "JUSD", src: "jusd_homepage.png", logo: "jusd.png", color: "#6366f1" },
  { name: "BITLAYER", src: "bitlayer_homepage.png", logo: "bitlayer.png", color: "#FF8800" },
  { name: "AZTEC", src: "aztec_homepage.png", logo: "aztec.png", color: "#00FF88" },
  { name: "GMRT", src: "gmrt_homepage.png", logo: "gmrt.png", color: "#FF3333" },
  { name: "9BIT", src: "9bit_homepage.png", logo: "9bit.png", color: "#FFE500" },
  { name: "USDu", src: "usdu_homepage.png", logo: "usdu.png", color: "#f59e0b" },
];

// Card layout: 7 cards arranged in a 2-column grid
const CARD_W = 420;
const CARD_H = 210;
const GAP = 22;

interface Props {
  assetDir: string;
  instant?: boolean;
}

export const ProjectShowcase: React.FC<Props> = ({ assetDir, instant }) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const bgDir = `${assetDir}/backgrounds`;
  const logoDir = `${assetDir}/logos`;

  // The overall camera is coming from above — combined with cameraVerticalDrift
  // Cards stagger in from top with spring animations
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {PROJECTS.map((proj, i) => {
        // Stagger entrance: each card enters 8 frames after the previous
        const staggerDelay = instant ? 0 : i * 8;
        const localFrame = Math.max(0, frame - staggerDelay);

        const enterProgress = instant
          ? 1
          : spring({
              frame: localFrame,
              fps,
              config: { damping: 14, stiffness: 180, mass: 0.7 },
              durationInFrames: 20,
            });

        // Exit: all cards fade out together near end
        const fadeOut = interpolate(frame, [100, 130], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        // Card position: centered column, offset vertically
        const col = i % 2;
        const row = Math.floor(i / 2);
        const totalRows = Math.ceil(PROJECTS.length / 2);
        const totalHeight = totalRows * (CARD_H + GAP) - GAP;
        const startY = (H - totalHeight) / 2 + 160;

        const cardX =
          col === 0
            ? (W / 2 - CARD_W - GAP / 2)
            : (W / 2 + GAP / 2);
        // Last card (odd) centers
        const isLastOdd = i === PROJECTS.length - 1 && PROJECTS.length % 2 === 1;
        const finalX = isLastOdd ? (W - CARD_W) / 2 : cardX;
        const cardY = startY + row * (CARD_H + GAP);

        // Scroll the background image within the card — varied speed per card
        const scrollSpeeds = [25, 40, 18, 35, 22, 30, 28];
        const scrollAmount = scrollSpeeds[i] ?? 30;
        const scrollProgress = interpolate(frame, [staggerDelay, staggerDelay + 120], [0, scrollAmount], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        const opacity = enterProgress * fadeOut;
        if (opacity < 0.01) return null;

        return (
          <div
            key={proj.name}
            style={{
              position: "absolute",
              left: finalX,
              top: cardY,
              width: CARD_W,
              height: CARD_H,
              borderRadius: 14,
              overflow: "hidden",
              opacity,
              transform: `translateY(${(1 - enterProgress) * 60}px) scale(${0.85 + enterProgress * 0.15})`,
              border: `2px solid ${proj.color}44`,
              boxShadow: `0 4px 24px rgba(0,0,0,0.6), 0 0 20px ${proj.color}15`,
            }}
          >
            {/* Background screenshot scroll */}
            {proj.src ? (
              <Img
                src={staticFile(`${bgDir}/${proj.src}`)}
                style={{
                  position: "absolute",
                  width: "100%",
                  height: "auto",
                  top: 0,
                  left: 0,
                  transform: `translateY(-${scrollProgress}%)`,
                  transformOrigin: "top center",
                  filter: "brightness(0.5)",
                }}
              />
            ) : (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: `linear-gradient(135deg, ${proj.color}22, #0a0a0a)`,
                }}
              />
            )}
            {/* Dark overlay */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.7) 100%)",
              }}
            />
            {/* Token logo + Project name */}
            <div
              style={{
                position: "absolute",
                bottom: 12,
                left: 14,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  overflow: "hidden",
                  flexShrink: 0,
                  border: `2px solid ${proj.color}55`,
                  boxShadow: `0 0 12px ${proj.color}30`,
                }}
              >
                <Img
                  src={staticFile(`${logoDir}/${proj.logo}`)}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              </div>
              <div
                style={{
                  color: "white",
                  fontSize: 26,
                  fontWeight: 800,
                  fontFamily: "Inter, sans-serif",
                  letterSpacing: 2,
                  textShadow: `0 0 12px ${proj.color}80, 0 2px 8px rgba(0,0,0,0.8)`,
                }}
              >
                {proj.name}
              </div>
            </div>
            {/* Accent line at bottom */}
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: 3,
                background: `linear-gradient(90deg, ${proj.color}, transparent)`,
                opacity: 0.7,
              }}
            />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
