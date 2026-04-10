/**
 * Central SFX mapping for the Tutorial composition.
 *
 * Every sound used in the video is defined here by SEMANTIC ROLE.
 * Components import roles, never raw filenames, never volume numbers.
 * To swap a sound or adjust loudness: change it here, once.
 *
 * Naming: BASE = normal, _BG = background/scene-level, _ACCENT = prominent.
 * All files must be whitelisted in public/sfx/sfx-review.json.
 */

export interface SfxDef {
  file: string;  // filename without path or extension
  vol: number;   // volume 0-1
}

// ── Plob family ────────────────────────────────────────────────────────
// comedy-plop at three loudness tiers

/** Small repetitive plob — rows, cascading items */
export const PLOB: SfxDef = { file: "comedy-plop", vol: 0.2 };

/** Prominent plob — pills, named panels, explicit items */
export const PLOB_ACCENT: SfxDef = { file: "comedy-plop", vol: 0.25 };

/** Background plob — scene transitions, barely audible */
export const PLOB_BG: SfxDef = { file: "comedy-plop", vol: 0.13 };

// ── Text family ────────────────────────────────────────────────────────

/** Text/title appearing on screen */
export const TEXT_IN: SfxDef = { file: "text-appear-blip", vol: 0.3 };

/** Text appearing during scene transitions — quiet */
export const TEXT_IN_BG: SfxDef = { file: "text-appear-blip", vol: 0.15 };

/** Text wiping out / disappearing */
export const TEXT_OUT: SfxDef = { file: "cut-fast-swish", vol: 0.3 };

// ── Data/progress family ───────────────────────────────────────────────

/** Data ticking in — charts, progress bars, timelines */
export const TICK: SfxDef = { file: "scroll-tick", vol: 0.3 };

/** Quiet tick — cascading bars, background data */
export const TICK_SOFT: SfxDef = { file: "scroll-tick", vol: 0.2 };

/** Numbers counting up */
export const COUNT: SfxDef = { file: "metric-count-up", vol: 0.3 };

/** Money/financial amounts counting */
export const MONEY: SfxDef = { file: "money-count", vol: 0.3 };

// ── Landing family ─────────────────────────────────────────────────────

/** Card/panel landing into place */
export const LAND: SfxDef = { file: "shape-drop-bounce", vol: 0.25 };

/** Quiet panel landing — background quadrants */
export const LAND_SOFT: SfxDef = { file: "shape-drop-bounce", vol: 0.2 };

// ── Impact family ──────────────────────────────────────────────────────

/** Medium reveal — insert cards, diagrams */
export const REVEAL: SfxDef = { file: "dramatic-reveal", vol: 0.35 };

/** Heavy impact — key statements, punchlines */
export const IMPACT: SfxDef = { file: "impact-kick", vol: 0.4 };

/** Big cinematic boom */
export const BOOM: SfxDef = { file: "boom-cinematic", vol: 0.4 };

// ── Completion family ──────────────────────────────────────────────────

/** Completion / checkmark / unlock */
export const UNLOCK: SfxDef = { file: "metal-latch-unlock", vol: 0.4 };

/** Terminal / code ready */
export const COMPILE: SfxDef = { file: "code-compile-success", vol: 0.5 };

// ── Transition family ──────────────────────────────────────────────────

/** Scene transition swoosh — layout changes */
export const SWOOSH: SfxDef = { file: "cut-fast-swish", vol: 0.12 };

/** Scene transition whoosh — heavier */
export const WHOOSH: SfxDef = { file: "whoosh-scene-grid", vol: 0.3 };

/** Spinning/zooming entrance */
export const SPIN: SfxDef = { file: "whoosh-spin-fast", vol: 0.35 };

// ── Accents ────────────────────────────────────────────────────────────

/** Logo / end card stinger */
export const STINGER: SfxDef = { file: "stinger-logo-reveal", vol: 0.5 };

/** Rapid sequence — multiple items popping in fast */
export const RAPID_POP: SfxDef = { file: "text-pop-rapid-sequence", vol: 0.25 };

/** Soft click — checkboxes, toggles */
export const CLICK: SfxDef = { file: "cursor-click-soft", vol: 0.25 };
