import React from "react";
import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
  interpolate,
} from "remotion";
import { noise2D } from "@remotion/noise";

const W = 1080;
const H = 1920;

// Token logos available in shorts/short-03/logos/
const TOKEN_FILES = [
  "bitcoin.png",
  "ethereum.png",
  "solana.png",
  "cardano.png",
  "chainlink.png",
  "avalanche-2.png",
  "cosmos.png",
  "arbitrum.png",
  "sui.png",
  "celestia.png",
  "polkadot.png",
  "optimism.png",
];

/** Seeded PRNG (mulberry32) */
function seededRandom(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface LogoItem {
  file: string;
  x: number;
  y: number;
  size: number; // 80-160px
  speed: number;
  rotationBase: number;
  alpha: number;
  noiseSeed: number;
}

function buildLogos(): LogoItem[] {
  const rng = seededRandom(314);
  return TOKEN_FILES.map((file, i) => ({
    file,
    x: 60 + rng() * (W - 200),
    y: 100 + rng() * (H - 400),
    size: 90 + rng() * 90, // 90-180px — big!
    speed: 0.3 + rng() * 0.6,
    rotationBase: rng() * 360,
    alpha: 0.25 + rng() * 0.35,
    noiseSeed: i * 137,
  }));
}

interface Props {
  assetDir: string;
  opacity?: number;
}

export const FloatingCryptoLogos: React.FC<Props> = ({
  assetDir,
  opacity = 1,
}) => {
  const frame = useCurrentFrame();
  const logos = React.useMemo(() => buildLogos(), []);

  // Global fade in
  const fadeIn = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity: fadeIn * opacity, pointerEvents: "none" }}>
      {logos.map((logo, i) => {
        // Noise-based drift
        const dx =
          noise2D("lx" + i, frame * 0.005, logo.noiseSeed * 0.01) * 60;
        const dy =
          noise2D("ly" + i, frame * 0.005, logo.noiseSeed * 0.02) * 60;
        // Slow vertical float
        const floatY = Math.sin(frame * 0.02 * logo.speed + i * 1.7) * 25;
        // Subtle rotation oscillation
        const rot =
          Math.sin(frame * 0.015 + i * 2.3) * 8;
        // Size pulse
        const pulse = 1 + 0.06 * Math.sin(frame * 0.03 + i * 1.1);

        const x = logo.x + dx;
        const y = logo.y + dy + floatY;
        const sz = logo.size * pulse;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x - sz / 2,
              top: y - sz / 2,
              width: sz,
              height: sz,
              borderRadius: "50%",
              overflow: "hidden",
              opacity: logo.alpha,
              transform: `rotate(${rot}deg)`,
              filter: "drop-shadow(0 0 20px rgba(255,255,255,0.15))",
              pointerEvents: "none",
            }}
          >
            <Img
              src={staticFile(`${assetDir}/logos/${logo.file}`)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
