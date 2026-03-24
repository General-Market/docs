/**
 * FormatContext — provides format-aware layout values to compositions.
 *
 * Wrapping a composition in <FormatProvider> is optional.
 * Components call useLayout() to get pre-computed layout values
 * derived from useVideoConfig() dimensions.
 *
 * When no provider is present, useLayout() still works — it reads
 * dimensions from useVideoConfig() directly, so Short01 keeps working
 * without any wrapper.
 */

import React, { createContext, useMemo } from "react";
import { useVideoConfig } from "remotion";

// ---------------------------------------------------------------------------
// Layout values
// ---------------------------------------------------------------------------

export interface LayoutValues {
  /** Canvas width from composition config */
  W: number;
  /** Canvas height from composition config */
  H: number;
  /** True when width > height (16:9 etc.) */
  isLandscape: boolean;

  // Chibi
  chibiSize: number;
  /** Portrait: CSS left 50% + translateX(-50%). Landscape: CSS right 5%. */
  chibiAnchor: "center" | "right";

  // Captions
  captionMaxWidth: number;
  captionFontShout: number;
  captionFontQuiet: number;
  captionBottom: string;
  captionPadX: number;

  // Callout
  calloutTop: number;
  calloutMaxWidth: number;

  // Content panels (CompoundingList, QuestionStack)
  contentTop: number;
  contentPadX: number;

  // MiniPersona
  personaTopY: number;
  personaMidY: number;
  personaAvatarSize: number;
  personaBubbleMaxWidth: number;

  // Chibi entrance distances (scale proportionally)
  entranceBottom: number;
  entranceLeftRight: number;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const FormatContext = createContext<{ enabled: boolean }>({ enabled: false });

/** Wrap a composition to signal that FormatContext is active. */
export const FormatProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <FormatContext.Provider value={{ enabled: true }}>
      {children}
    </FormatContext.Provider>
  );
};

// ---------------------------------------------------------------------------
// useLayout hook
// ---------------------------------------------------------------------------

/**
 * Returns pre-computed layout values based on composition dimensions.
 * Works with or without FormatProvider — always reads from useVideoConfig().
 */
export function useLayout(): LayoutValues {
  const { width: W, height: H } = useVideoConfig();

  return useMemo(() => {
    const isLandscape = W > H;

    if (isLandscape) {
      return {
        W,
        H,
        isLandscape: true,

        chibiSize: 900,
        chibiAnchor: "right" as const,

        captionMaxWidth: 1400,
        captionFontShout: 56,
        captionFontQuiet: 34,
        captionBottom: "8%",
        captionPadX: 120,

        calloutTop: 200,
        calloutMaxWidth: 1200,

        contentTop: 180,
        contentPadX: 120,

        personaTopY: 180,
        personaMidY: 400,
        personaAvatarSize: 140,
        personaBubbleMaxWidth: 400,

        entranceBottom: 225,
        entranceLeftRight: 340,
      };
    }

    // Portrait (default — matches existing Short01 values)
    return {
      W,
      H,
      isLandscape: false,

      chibiSize: 1600,
      chibiAnchor: "center" as const,

      captionMaxWidth: 920,
      captionFontShout: 76,
      captionFontQuiet: 46,
      captionBottom: "12%",
      captionPadX: 80,

      calloutTop: 380,
      calloutMaxWidth: 900,

      contentTop: 520,
      contentPadX: 60,

      personaTopY: 300,
      personaMidY: 650,
      personaAvatarSize: 180,
      personaBubbleMaxWidth: 500,

      entranceBottom: 400,
      entranceLeftRight: 600,
    };
  }, [W, H]);
}
