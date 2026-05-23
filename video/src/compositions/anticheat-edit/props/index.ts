// AntiCheatEdit illustration props — the standard kit.
//
//   BlueField     the blue world + floating line grid + scan lines
//   PixelReveal   the chunky big-pixel dissolve (camera → scene)
//   FloatingItem  hover motion for any element
//   FloatingChip  the rounded white card a logo/flag sits in
//   SceneFrame    the standard stage: field + kicker/title + brandmark
//
// Build every mechanism illustration on these so all thirteen match.

export { BlueField } from "./BlueField";
export { PixelReveal } from "./PixelReveal";
export type { PixelRevealProps } from "./PixelReveal";
export { FloatingItem, FloatingChip } from "./FloatingItem";
export type { FloatingItemProps, FloatingChipProps } from "./FloatingItem";
export { SceneFrame } from "./SceneFrame";
export { scene, font, monoFont, BLUE_FIELD_GRADIENT, FPS, W, H } from "./tokens";
