// Selection helpers. Pure. The store holds the Selection; these functions
// read or compute the next one.

import type { Selection } from "../project/store";

export function isClipSelected(sel: Selection, clipId: string): boolean {
  return sel.kind === "clips" && sel.ids.includes(clipId);
}

export function isTextSelected(sel: Selection, textId: string): boolean {
  return sel.kind === "texts" && sel.ids.includes(textId);
}

/**
 * Cmd-click semantics: toggle the clip in the selection. If the current
 * selection is not a clip selection, start a new one with this id.
 */
export function extendClipSelection(sel: Selection, clipId: string): Selection {
  if (sel.kind !== "clips") {
    return { kind: "clips", ids: [clipId] };
  }
  const has = sel.ids.includes(clipId);
  const ids = has ? sel.ids.filter((id) => id !== clipId) : [...sel.ids, clipId];
  if (ids.length === 0) return { kind: "none" };
  return { kind: "clips", ids };
}

export function rangeSelection(from: number, to: number): Selection {
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  return { kind: "range", from: lo, to: hi };
}

export function clearSelection(): Selection {
  return { kind: "none" };
}

export function selectedClipIds(sel: Selection): string[] {
  return sel.kind === "clips" ? sel.ids : [];
}
