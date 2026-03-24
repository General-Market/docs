/**
 * CompoundingList — animated bullet-point list that compounds (stacks up).
 * Each shot adds a new item; old items stay visible with a "locked in" feel.
 * Title-font styling with accent colors and staggered spring entrance.
 */

import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { useLayout } from "../../../engine/FormatContext";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadInter("normal", { subsets: ["latin"], weights: ["400", "700", "900"] });

export interface CompoundingItem {
  text: string;
  color: string;
  icon?: string;
}

interface Props {
  items: CompoundingItem[];
  activeCount: number;
}

const ITEM_HEIGHT = 88;
const GAP = 16;

/** Hex to rgba helper */
const hexRgba = (hex: string, alpha: number): string => {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

export const CompoundingList: React.FC<Props> = ({ items, activeCount }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const layout = useLayout();

  const visibleItems = items.slice(0, activeCount);

  // Total block height for vertical centering
  const totalHeight = visibleItems.length * ITEM_HEIGHT + (visibleItems.length - 1) * GAP;

  return (
    <div
      style={{
        position: "absolute",
        top: layout.contentTop,
        left: layout.contentPadX,
        right: layout.contentPadX,
        height: totalHeight,
        display: "flex",
        flexDirection: "column",
        gap: GAP,
        zIndex: 8,
        pointerEvents: "none",
      }}
    >
      {visibleItems.map((item, i) => {
        const isNewest = i === activeCount - 1;

        // Newest item animates in; older items are already settled
        const enterProgress = isNewest
          ? spring({
              frame,
              fps,
              config: { damping: 10, stiffness: 180, mass: 0.8 },
              durationInFrames: 18,
            })
          : 1;

        const slideX = interpolate(enterProgress, [0, 1], [80, 0]);
        const opacity = interpolate(enterProgress, [0, 0.3], [0, 1], {
          extrapolateRight: "clamp",
        });
        const scale = interpolate(enterProgress, [0, 1], [0.85, 1]);

        // Settled items get a subtle "locked" bar pulse
        const barWidth = isNewest
          ? interpolate(enterProgress, [0, 1], [0, 100])
          : 100;

        // Glow pulse on newest item
        const glowIntensity = isNewest
          ? interpolate(enterProgress, [0.5, 1], [0, 10], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
          : 4 + Math.sin(frame * 0.08 + i * 1.5) * 2;

        const padNum = String(i + 1).padStart(2, "0");

        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
              height: ITEM_HEIGHT,
              paddingLeft: 22,
              paddingRight: 22,
              borderRadius: 16,
              background: `linear-gradient(135deg, ${hexRgba(item.color, 0.22)} 0%, ${hexRgba(item.color, 0.12)} 40%, rgba(8,8,16,0.97) 100%)`,
              border: `2px solid ${hexRgba(item.color, 0.5)}`,
              boxShadow: `0 0 ${glowIntensity}px ${hexRgba(item.color, 0.35)}, inset 0 1px 0 rgba(255,255,255,0.1), 0 8px 24px rgba(0,0,0,0.7)`,
              backdropFilter: "blur(16px)",
              transform: `translateX(${slideX}px) scale(${scale})`,
              opacity,
              overflow: "hidden",
              position: "relative",
            }}
          >
            {/* Accent bar on left */}
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: 5,
                height: `${barWidth}%`,
                background: `linear-gradient(180deg, ${item.color} 0%, ${hexRgba(item.color, 0.6)} 100%)`,
                borderRadius: "0 2px 2px 0",
                boxShadow: `0 0 12px ${hexRgba(item.color, 0.6)}`,
              }}
            />

            {/* Number badge */}
            <div
              style={{
                minWidth: 44,
                height: 44,
                borderRadius: 10,
                backgroundColor: hexRgba(item.color, 0.15),
                border: `2px solid ${hexRgba(item.color, 0.5)}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily,
                fontSize: 20,
                fontWeight: 900,
                color: item.color,
                marginLeft: 8,
                textShadow: `0 0 8px ${hexRgba(item.color, 0.4)}`,
              }}
            >
              {padNum}
            </div>

            {/* Text */}
            <span
              style={{
                fontFamily,
                fontSize: 38,
                fontWeight: 800,
                color: "#FFFFFF",
                letterSpacing: 1.5,
                textTransform: "uppercase",
                textShadow: `0 0 14px ${hexRgba(item.color, 0.4)}, 0 2px 6px rgba(0,0,0,0.9), 0 0 30px rgba(0,0,0,0.5)`,
                whiteSpace: "nowrap",
                lineHeight: 1.1,
              }}
            >
              <span style={{ color: item.color, fontWeight: 900 }}>
                {item.text.split(" ")[0]}
              </span>{" "}
              {item.text.split(" ").slice(1).join(" ")}
            </span>

            {/* Checkmark for settled items */}
            {!isNewest && (
              <div
                style={{
                  marginLeft: "auto",
                  fontSize: 24,
                  opacity: 0.7,
                  color: item.color,
                  fontWeight: 900,
                }}
              >
                ✓
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
