import React from "react";
import { Img, staticFile, useCurrentFrame } from "remotion";
import { noise2D } from "@remotion/noise";
import { seededPick, seededRandom } from "../../utils/random";

interface EmojiEvent {
  frame: number;
  emojis?: string[];
  stickers?: string[]; // SVG filenames from public/shared/stickers/
  count?: number; // 8-15
  duration?: number; // 30 frames
  accentColor?: string; // color for SVG stickers
}

interface Props {
  events: EmojiEvent[];
  width?: number;
  height?: number;
  useSvgStickers?: boolean;
  stickerColor?: string;
}

export type { EmojiEvent };

// IndexMaker DA — Lucide-inspired line stickers
const DEFAULT_STICKERS = [
  "lightning.svg", "sparkles.svg", "rocket.svg", "flame.svg", "star.svg",
  "check-circle.svg", "trending-up.svg", "target.svg", "heart.svg", "trophy.svg",
];

// Legacy Unicode fallback
const DEFAULT_EMOJIS = [
  "\u{1F525}", "\u{1F60D}", "\u{1F4AF}", "\u{2728}", "\u{1F680}",
  "\u{1F389}", "\u{26A1}", "\u{1F4A5}", "\u{1F3AF}", "\u{1F60E}",
];

export const EmojiRain: React.FC<Props> = ({
  events,
  width = 1080,
  height = 1920,
  useSvgStickers = true,
  stickerColor = "#2470ff",
}) => {
  const frame = useCurrentFrame();

  const activeItems: Array<{
    content: string;
    isSvg: boolean;
    x: number;
    y: number;
    opacity: number;
    scale: number;
    color: string;
  }> = [];

  for (const e of events) {
    const dur = e.duration ?? 30;
    const count = e.count ?? 12;
    const color = e.accentColor ?? stickerColor;

    if (frame >= e.frame && frame < e.frame + dur) {
      const progress = (frame - e.frame) / dur;
      for (let i = 0; i < count; i++) {
        const seed = e.frame * 100 + i;
        const x =
          seededRandom(seed) * width +
          noise2D(`ex${i}`, frame * 0.05, seed) * 40;
        const startY = -50 + seededRandom(seed + 1) * -200;
        const y = startY + progress * (height + 300);
        const opacity = progress < 0.8 ? 1 : (1 - progress) * 5;

        if (useSvgStickers) {
          const stickerSet = e.stickers ?? DEFAULT_STICKERS;
          activeItems.push({
            content: seededPick(seed + 2, stickerSet),
            isSvg: true,
            x,
            y,
            opacity: Math.max(0, opacity),
            scale: 0.8 + seededRandom(seed + 3) * 0.6,
            color,
          });
        } else {
          const emojiSet = e.emojis ?? DEFAULT_EMOJIS;
          activeItems.push({
            content: seededPick(seed + 2, emojiSet),
            isSvg: false,
            x,
            y,
            opacity: Math.max(0, opacity),
            scale: 0.8 + seededRandom(seed + 3) * 0.6,
            color,
          });
        }
      }
    }
  }

  if (activeItems.length === 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 12,
      }}
    >
      {activeItems.map((item, i) =>
        item.isSvg ? (
          <Img
            key={i}
            src={staticFile(`shared/stickers/${item.content}`)}
            style={{
              position: "absolute",
              left: item.x,
              top: item.y,
              width: 48 * item.scale,
              height: 48 * item.scale,
              opacity: item.opacity,
              filter: `brightness(0) saturate(100%) invert(1)`,
            }}
          />
        ) : (
          <span
            key={i}
            style={{
              position: "absolute",
              left: item.x,
              top: item.y,
              fontSize: 48 * item.scale,
              opacity: item.opacity,
            }}
          >
            {item.content}
          </span>
        ),
      )}
    </div>
  );
};
