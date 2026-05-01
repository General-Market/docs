import React from "react";
import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLOR, FONT, PAD, SLIDE_COUNT } from "../tokens";

const ORBIT_LOGOS = [
  "source-imgs/new-steam.webp",
  "source-imgs/new-reddit.webp",
  "source-imgs/new-polymarket.webp",
  "source-imgs/new-pumpfun.webp",
  "source-imgs/new-tmdb.svg",
  "source-imgs/new-twitch.webp",
  "source-imgs/new-dbtrains.svg",
  "source-imgs/new-coingecko.webp",
  "source-imgs/new-github.webp",
  "source-imgs/new-defillama.webp",
  "source-imgs/new-finnhub.webp",
  "source-imgs/new-hackernews.svg",
];

const FloatingLogos: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cx = 960;
  const cy = 560;
  const rx = 780;
  const ry = 360;
  const revFrames = fps * 6;
  const cardSize = 124;
  const logoSize = 76;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {ORBIT_LOGOS.map((src, i) => {
        const baseAngle = (i / ORBIT_LOGOS.length) * Math.PI * 2;
        const orbitAngle = baseAngle + (frame / revFrames) * Math.PI * 2;
        const ox = cx + Math.cos(orbitAngle) * rx;
        const oy = cy + Math.sin(orbitAngle) * ry;

        const bobY = Math.sin((frame + i * 28) / 22) * 22;
        const bobX = Math.cos((frame + i * 41) / 28) * 16;
        const tilt = Math.sin((frame + i * 17) / 34) * 5;

        return (
          <div
            key={src}
            style={{
              position: "absolute",
              left: ox + bobX - cardSize / 2,
              top: oy + bobY - cardSize / 2,
              width: cardSize,
              height: cardSize,
              borderRadius: 24,
              background: "#FFFFFF",
              boxShadow:
                "0 16px 40px rgba(15, 15, 15, 0.10), 0 2px 6px rgba(15, 15, 15, 0.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `rotate(${tilt}deg)`,
            }}
          >
            <Img
              src={staticFile(src)}
              style={{
                width: logoSize,
                height: logoSize,
                objectFit: "contain",
              }}
            />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export const Slide05Market: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: COLOR.bg }}>
      <FloatingLogos />

      <div
        style={{
          position: "absolute",
          top: 64,
          left: PAD.x,
          fontFamily: FONT.serif,
          fontSize: 22,
          color: COLOR.muted,
          letterSpacing: "-0.005em",
        }}
      >
        General Market
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 64,
          right: PAD.x,
          fontFamily: FONT.sans,
          fontSize: 20,
          color: COLOR.muted,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        05 / {String(SLIDE_COUNT).padStart(2, "0")}
      </div>

      <AbsoluteFill
        style={{
          padding: `${PAD.y}px ${PAD.x}px`,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
        }}
      >
        <div style={{ width: "100%", maxWidth: 1500, position: "relative" }}>
          <div
            style={{
              fontFamily: FONT.sans,
              fontSize: 18,
              fontWeight: 500,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: COLOR.muted,
              marginBottom: 56,
            }}
          >
            Market
          </div>

          <div
            style={{
              fontFamily: FONT.serif,
              fontSize: 200,
              fontWeight: 300,
              color: COLOR.ink,
              lineHeight: 0.95,
              letterSpacing: "-0.04em",
              marginBottom: 24,
            }}
          >
            500,000 markets
          </div>
          <p
            style={{
              fontFamily: FONT.serif,
              fontSize: 56,
              fontWeight: 300,
              fontStyle: "italic",
              color: COLOR.muted,
              lineHeight: 1.15,
              margin: 0,
              marginBottom: 48,
              maxWidth: 1500,
            }}
          >
            only tradable via rainbows.
          </p>
          <p
            style={{
              fontFamily: FONT.sans,
              fontSize: 28,
              fontWeight: 400,
              color: COLOR.ink,
              lineHeight: 1.4,
              margin: 0,
              marginBottom: 12,
              maxWidth: 1500,
            }}
          >
            Polymarket and Kalshi cleared $21B/month combined in Q1 2026 — across 2,500 markets.
          </p>
          <p
            style={{
              fontFamily: FONT.sans,
              fontSize: 28,
              fontWeight: 500,
              color: COLOR.ink,
              lineHeight: 1.4,
              margin: 0,
              maxWidth: 1500,
            }}
          >
            The next 200× of category growth is locked behind correlated-asset architecture.
          </p>
        </div>
      </AbsoluteFill>

      <p
        style={{
          position: "absolute",
          bottom: 64,
          left: PAD.x,
          fontFamily: FONT.sans,
          fontSize: 14,
          color: COLOR.muted,
          margin: 0,
        }}
      >
        TRM Labs prediction-market volume report, 2026 · CoinDesk Q1 2026.
      </p>
    </AbsoluteFill>
  );
};
