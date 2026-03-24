import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadInter("normal", { subsets: ["latin"], weights: ["400", "700", "900"] });

export interface QuestionStackItem {
  text: string;
  color: string;
  icon?: string; // emoji or symbol prefix
}

interface Props {
  items: QuestionStackItem[];
  /** How many items to show (1-indexed). Items beyond this are hidden. */
  activeCount: number;
}

export const QuestionStack: React.FC<Props> = ({ items, activeCount }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const visibleItems = items.slice(0, activeCount);

  return (
    <div
      style={{
        position: "absolute",
        top: 520,
        left: 0,
        right: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 18,
        padding: "0 60px",
        zIndex: 12,
        pointerEvents: "none",
      }}
    >
      {visibleItems.map((item, idx) => {
        // The newest item (last one) animates in; older ones are already settled
        const isNew = idx === activeCount - 1;

        const progress = spring({
          frame: isNew ? frame : frame + 30, // older items appear instantly
          fps,
          config: { damping: 12, stiffness: 180, mass: 0.6 },
          durationInFrames: 12,
        });

        const scale = isNew ? 0.8 + 0.2 * progress : 1;
        const opacity = isNew ? progress : 1;
        const translateY = isNew ? (1 - progress) * 30 : 0;

        return (
          <div
            key={idx}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              transform: `scale(${scale}) translateY(${translateY}px)`,
              opacity,
              background: `linear-gradient(135deg, rgba(15,15,25,0.92) 0%, rgba(8,8,12,0.96) 100%)`,
              borderLeft: `5px solid ${item.color}`,
              border: `1.5px solid ${item.color}33`,
              borderLeftWidth: 5,
              borderLeftColor: item.color,
              borderRadius: 14,
              padding: "18px 28px",
              maxWidth: 920,
              width: "100%",
              backdropFilter: "blur(12px)",
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 24px rgba(0,0,0,0.6)`,
            }}
          >
            {item.icon && (
              <span style={{ fontSize: 40, lineHeight: 1 }}>{item.icon}</span>
            )}
            <span
              style={{
                fontFamily,
                fontSize: 48,
                fontWeight: 900,
                color: "#FFFFFF",
                lineHeight: 1.2,
                textShadow: "0 2px 8px rgba(0,0,0,0.8)",
              }}
            >
              {item.text}
            </span>
          </div>
        );
      })}
    </div>
  );
};
