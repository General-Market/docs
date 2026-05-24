// Panel timeline — one merged source of truth for the side-panel rig.
//
// The visual layer used to drop every schematic and article fullscreen over
// the talking head. Now the camera shifts to one side and the schematic lives
// in the freed CONTENT AREA beside it — the Tutorial look.
//
// This module merges the two timing arrays (OVERLAYS = section titles +
// schematics + venue subcharts, ARTICLE_OVERLAYS = the court-case proofs) into
// one ordered list of PANEL events. Each event carries:
//   at / duration   the same play-time it always had (never re-synced here)
//   side            which side the schematic sits on (camera moves the other way)
//   kind            "schematic" (blue diagram, pixel-dissolves) or "article"
//   render          the node to draw inside the content panel
//
// Side assignment walks the merged list in time order and flips on each
// mechanism boundary (a TitleSlide), so a mechanism and its schematic + venue
// chart share one side, and the next mechanism takes the other. Articles take
// the side OPPOSITE the schematic active in their section, so proof and chart
// never crowd the same edge across a section.

import React from "react";
import { OVERLAYS, type OverlaySlot } from "./overlays/timeline";
import { ARTICLE_OVERLAYS, ArticleFlash, type ArticleSlot } from "./overlays/articles";

export type PanelSide = "left" | "right";

export type PanelEvent = {
  at: number;
  duration: number;
  side: PanelSide;
  kind: "schematic" | "article";
  /** Pixel-dissolve entrance (schematics) vs plain fade (titles, charts, articles). */
  pixel: boolean;
  /** Native canvas the rig scales from. Defaults to 1920×1080; tall charts
   *  declare a panel-aspect canvas (via panelSrcW/H statics) so they fill the
   *  content area top-to-bottom instead of letterboxing. */
  srcW?: number;
  srcH?: number;
  /** The full-bleed node, scaled into the panel by the rig. */
  render: React.ReactNode;
};

// A TitleSlide marks a mechanism boundary — the overlay component is built by
// timeline.tsx's `titleCard()`, which names its inner function "Title".
const isTitle = (slot: OverlaySlot): boolean => slot.component.name === "Title";

// Build the merged, side-assigned timeline once at module load.
function build(): PanelEvent[] {
  // 1. Schematics + titles + venue charts, in time order. Flip the side on
  //    every mechanism boundary; the opener (MechanismsOverview) starts left.
  const schematic: (PanelEvent & { isBoundary: boolean })[] = [];
  let side: PanelSide = "left";
  let started = false;

  const sortedOverlays = [...OVERLAYS].sort((a, b) => a.at - b.at);
  for (const slot of sortedOverlays) {
    const boundary = isTitle(slot);
    if (boundary) {
      // Flip for every new mechanism after the first.
      side = started ? (side === "left" ? "right" : "left") : "left";
      started = true;
    }
    const Component = slot.component as React.FC & {
      panelSrcW?: number;
      panelSrcH?: number;
    };
    schematic.push({
      at: slot.at,
      duration: slot.duration,
      side,
      kind: "schematic",
      pixel: Boolean(slot.pixel),
      isBoundary: boundary,
      srcW: Component.panelSrcW,
      srcH: Component.panelSrcH,
      render: React.createElement(Component),
    });
  }

  // 2. Articles take the side opposite whatever schematic side is current in
  //    their section. Find the side of the nearest preceding schematic event.
  const articleEvents: PanelEvent[] = ARTICLE_OVERLAYS.map((slot: ArticleSlot) => {
    let near: PanelSide = "left";
    for (const s of schematic) {
      if (s.at <= slot.at) near = s.side;
      else break;
    }
    const opposite: PanelSide = near === "left" ? "right" : "left";
    return {
      at: slot.at,
      duration: slot.duration,
      side: opposite,
      kind: "article" as const,
      pixel: false,
      render: React.createElement(ArticleFlash, {
        slot,
        durationInFrames: Math.round(slot.duration * 30),
      }),
    };
  });

  const schematicEvents: PanelEvent[] = schematic.map((s) => ({
    at: s.at,
    duration: s.duration,
    side: s.side,
    kind: s.kind,
    pixel: s.pixel,
    srcW: s.srcW,
    srcH: s.srcH,
    render: s.render,
  }));

  const all = [...schematicEvents, ...articleEvents].sort((a, b) => a.at - b.at);

  return all;
}

export const PANEL_EVENTS: PanelEvent[] = build();

// The active panel event at a given second, if any. Overlaps are rare (the two
// arrays were de-conflicted upstream); if they happen, the latest-started wins.
export function activePanel(sec: number): PanelEvent | null {
  let hit: PanelEvent | null = null;
  for (const e of PANEL_EVENTS) {
    if (sec >= e.at && sec < e.at + e.duration) {
      if (!hit || e.at > hit.at) hit = e;
    }
  }
  return hit;
}
