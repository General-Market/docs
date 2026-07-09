// clsnet lane barrel — RootReplicas.tsx imports ONLY this file.
// Comp ids stay stable: ClsNet-Replicate, ClsNet-SideBySide, CrxNetting.
// Ref: public/clsnet-original.mp4 (1920×1080, 25fps, 4168 frames, 166.72s).
import { clsNetMeta } from "./ClsNetComposition";
import { clsNetSideBySideMetaInner } from "./ClsNetSideBySide";
import { crxNettingMetaInner } from "./CrxNetting";

export const clsNetReplicateMeta = clsNetMeta;
export const clsNetSideBySideMeta = clsNetSideBySideMetaInner;
export const crxNettingMeta = crxNettingMetaInner;
