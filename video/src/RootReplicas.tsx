import React from "react";
import { Composition } from "remotion";
import { realistReplicateMeta } from "./compositions/replicates/realist/RealistComposition";
import { realistSideBySideMeta } from "./compositions/replicates/realist/RealistSideBySide";
import { irswapReplicateMeta } from "./compositions/replicates/irswap/IRSwapComposition";
import { irswapSideBySideMeta } from "./compositions/replicates/irswap/IRSwapSideBySide";
import { crxAnomaQAMeta } from "./compositions/replicates/anoma/CrxAnomaQA";
import { crxAnomaMeta } from "./compositions/replicates/anoma/CrxAnomaComposition";
import {
  clsDayReplicateMeta,
  clsDaySideBySideMeta,
  crxSettlementDayMeta,
} from "./compositions/replicates/cls-day/ClsDayComps";
import {
  clsNetReplicateMeta,
  clsNetSideBySideMeta,
  crxNettingMeta,
} from "./compositions/replicates/clsnet/ClsNetComps";
import {
  fnaLoopReplicateMeta,
  fnaLoopSideBySideMeta,
  crxLiquidityLoopMeta,
} from "./compositions/replicates/fna-loop/FnaLoopComps";
import {
  netGrowthReplicateMeta,
  netGrowthSideBySideMeta,
  crxGrowthLoopMeta,
} from "./compositions/replicates/netgrowth/NetGrowthComps";

// Replica-only entry (src/index-replicas.ts). The main src/index.ts bundles
// every composition, which (a) copies the full multi-GB public/ tree per
// render and (b) module-level-preloads other comps' GLB/FBX assets — both
// fatal on a tight disk. Render replicas against THIS entry with a slim
// --public-dir (see .claude/rounds/PROTOCOL.md):
//   npx remotion render src/index-replicas.ts Realist-Replicate out.mp4 \
//     --public-dir "$PWD/.claude/rounds/pubdir/realist"
export const RootReplicas: React.FC = () => (
  <>
    {[
      realistReplicateMeta,
      realistSideBySideMeta,
      irswapReplicateMeta,
      irswapSideBySideMeta,
      crxAnomaQAMeta,
      crxAnomaMeta,
      clsDayReplicateMeta,
      clsDaySideBySideMeta,
      crxSettlementDayMeta,
      clsNetReplicateMeta,
      clsNetSideBySideMeta,
      crxNettingMeta,
      fnaLoopReplicateMeta,
      fnaLoopSideBySideMeta,
      crxLiquidityLoopMeta,
      netGrowthReplicateMeta,
      netGrowthSideBySideMeta,
      crxGrowthLoopMeta,
    ].map((meta) => (
      <Composition key={meta.id} {...meta} />
    ))}
  </>
);
