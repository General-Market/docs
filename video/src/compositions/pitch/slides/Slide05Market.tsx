import React from "react";
import { Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { SlideFrame } from "../SlideFrame";
import { COLOR, FONT, SLIDE_COUNT } from "../tokens";

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
  const cy = 540;
  const rx = 720;
  const ry = 320;
  const revSeconds = 60;
  const revFrames = fps * revSeconds;
  const cardSize = 116;
  const logoSize = 72;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 0,
      }}
    >
      {ORBIT_LOGOS.map((src, i) => {
        const baseAngle = (i / ORBIT_LOGOS.length) * Math.PI * 2;
        const orbitAngle = baseAngle + (frame / revFrames) * Math.PI * 2;
        const ox = cx + Math.cos(orbitAngle) * rx;
        const oy = cy + Math.sin(orbitAngle) * ry;

        const bobY = Math.sin((frame + i * 32) / 70) * 14;
        const bobX = Math.cos((frame + i * 47) / 90) * 10;
        const tilt = Math.sin((frame + i * 19) / 110) * 3;

        return (
          <div
            key={src}
            style={{
              position: "absolute",
              left: ox + bobX - cardSize / 2,
              top: oy + bobY - cardSize / 2,
              width: cardSize,
              height: cardSize,
              borderRadius: 22,
              background: "#FFFFFF",
              boxShadow: "0 14px 36px rgba(15, 15, 15, 0.08), 0 2px 6px rgba(15, 15, 15, 0.05)",
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
    </div>
  );
};

export const Slide05Market: React.FC = () => {
  return (
    <SlideFrame eyebrow="Market" pageNumber={5} pageTotal={SLIDE_COUNT}>
      <FloatingLogos />
      <div style={{ position: "relative", zIndex: 1 }}>
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
      <p
        style={{
          position: "absolute",
          bottom: 64,
          left: 192,
          fontFamily: FONT.sans,
          fontSize: 14,
          color: COLOR.muted,
          margin: 0,
          zIndex: 1,
        }}
      >
        TRM Labs prediction-market volume report, 2026 · CoinDesk Q1 2026.
      </p>
    </SlideFrame>
  );
};
