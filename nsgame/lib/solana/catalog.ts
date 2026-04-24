/**
 * Frozen launch catalog. Cam markets only — Types F and G from
 * `data-node/data/tube-rate-tests/MARKETS_LIST.md`. The other six market
 * types live in the roadmap, not in production. Tube signals are served by
 * the independent nsgame data-node; ambition belongs elsewhere.
 *
 * See `nsgame/PLAN.md` for the full roadmap and
 * `nsgame/docs/source-id-mapping.md` for the on-chain source-id layout.
 *
 * `thresholdBps` is repurposed from its bps origins:
 *   - For over/under integer markets (G1–G10, G12, G15) it carries the
 *     absolute integer target N. Not basis points. The name persists out
 *     of stubbornness.
 *   - For binary presence / rank-survival markets (F1–F20, G11, G13, G14),
 *     it is set to 1 by convention. The settlement logic is "current
 *     state at T+N equals baseline state at T."
 *
 * Bounds enforced by the program (mirrored here for UI validation):
 *   threshold_bps != 0, |threshold_bps| <= 10_000
 *   close_time - now >= 10
 *   settlement_time - close_time >= 10
 *   settlement_time - now <= 30 days
 *
 * Note: G-series thresholds may exceed the bps cap once the program lifts
 * its 10_000 ceiling for tube sources. Track in PLAN.md.
 */

export interface CatalogEntry {
  /** Opaque handle for the frontend; stable across deployments. */
  id: string
  /** Admin-registered Source.source_id on chain. */
  sourceId: number
  /** Human-readable label for the Source. Cosmetic only. */
  sourceName: string
  /** Signed bps threshold — positive = YES on rise, negative = YES on drop.
   * Repurposed for integer O/U targets and binary presence (see header). */
  thresholdBps: number
  /** Seconds from click-time until the Market stops accepting bets. */
  closeOffsetSecs: number
  /** Seconds from click-time until the Market becomes resolvable. */
  settleOffsetSecs: number
  /** Catalog-card label. */
  label: string
  /** One-liner describing what YES means. */
  description: string
}

const CB_SOURCE_ID = 4
const CB_SOURCE_NAME = 'tubes_cb'

const F_CLOSE = 300
const F_SETTLE = 600
const G_CLOSE = 150
const G_SETTLE = 300

function topNOnlineEntry(rank: number): CatalogEntry {
  return {
    id: `tubes_cb_online_top${rank}_10min`,
    sourceId: CB_SOURCE_ID,
    sourceName: CB_SOURCE_NAME,
    thresholdBps: 1,
    closeOffsetSecs: F_CLOSE,
    settleOffsetSecs: F_SETTLE,
    label: `Top-${rank} cam model still online in 10 min`,
    description: `YES pays if the rank-${rank} cam model at click-time is still in the online-rooms list at T+10min with viewers ≥ 1.`,
  }
}

export const CATALOG: readonly CatalogEntry[] = [
  // Type F — cam-online survival, 20 markets
  topNOnlineEntry(1),
  topNOnlineEntry(2),
  topNOnlineEntry(3),
  topNOnlineEntry(4),
  topNOnlineEntry(5),
  topNOnlineEntry(6),
  topNOnlineEntry(7),
  topNOnlineEntry(8),
  topNOnlineEntry(9),
  topNOnlineEntry(10),
  topNOnlineEntry(11),
  topNOnlineEntry(12),
  topNOnlineEntry(13),
  topNOnlineEntry(14),
  topNOnlineEntry(15),
  topNOnlineEntry(16),
  topNOnlineEntry(17),
  topNOnlineEntry(18),
  topNOnlineEntry(19),
  topNOnlineEntry(20),

  // Type G — viewer over/under + composite, 15 markets
  {
    id: 'tubes_cb_viewers_top1_ou3000_5min',
    sourceId: CB_SOURCE_ID,
    sourceName: CB_SOURCE_NAME,
    thresholdBps: 3000,
    closeOffsetSecs: G_CLOSE,
    settleOffsetSecs: G_SETTLE,
    label: 'Top-1 cam viewers over 3,000 in 5 min',
    description: 'YES pays if the current #1 cam model has > 3,000 viewers at T+5min.',
  },
  {
    id: 'tubes_cb_viewers_top1_ou5000_5min',
    sourceId: CB_SOURCE_ID,
    sourceName: CB_SOURCE_NAME,
    thresholdBps: 5000,
    closeOffsetSecs: G_CLOSE,
    settleOffsetSecs: G_SETTLE,
    label: 'Top-1 cam viewers over 5,000 in 5 min',
    description: 'YES pays if the current #1 cam model has > 5,000 viewers at T+5min.',
  },
  {
    id: 'tubes_cb_viewers_top1_ou8000_5min',
    sourceId: CB_SOURCE_ID,
    sourceName: CB_SOURCE_NAME,
    thresholdBps: 8000,
    closeOffsetSecs: G_CLOSE,
    settleOffsetSecs: G_SETTLE,
    label: 'Top-1 cam viewers over 8,000 in 5 min',
    description: 'YES pays if the current #1 cam model has > 8,000 viewers at T+5min.',
  },
  {
    id: 'tubes_cb_viewers_top1_ou10000_5min',
    sourceId: CB_SOURCE_ID,
    sourceName: CB_SOURCE_NAME,
    thresholdBps: 10000,
    closeOffsetSecs: G_CLOSE,
    settleOffsetSecs: G_SETTLE,
    label: 'Top-1 cam viewers over 10,000 in 5 min',
    description: 'YES pays if the current #1 cam model has > 10,000 viewers at T+5min.',
  },
  {
    id: 'tubes_cb_viewers_top3_combined_ou10000',
    sourceId: CB_SOURCE_ID,
    sourceName: CB_SOURCE_NAME,
    thresholdBps: 10000,
    closeOffsetSecs: G_CLOSE,
    settleOffsetSecs: G_SETTLE,
    label: 'Top-3 combined viewers over 10,000 in 5 min',
    description: 'YES pays if the summed viewer count of the top-3 cam models exceeds 10,000 at T+5min.',
  },
  {
    id: 'tubes_cb_viewers_top5_combined_ou15000',
    sourceId: CB_SOURCE_ID,
    sourceName: CB_SOURCE_NAME,
    thresholdBps: 15000,
    closeOffsetSecs: G_CLOSE,
    settleOffsetSecs: G_SETTLE,
    label: 'Top-5 combined viewers over 15,000 in 5 min',
    description: 'YES pays if the summed viewer count of the top-5 cam models exceeds 15,000 at T+5min.',
  },
  {
    id: 'tubes_cb_viewers_top10_combined_ou25000',
    sourceId: CB_SOURCE_ID,
    sourceName: CB_SOURCE_NAME,
    thresholdBps: 25000,
    closeOffsetSecs: G_CLOSE,
    settleOffsetSecs: G_SETTLE,
    label: 'Top-10 combined viewers over 25,000 in 5 min',
    description: 'YES pays if the summed viewer count of the top-10 cam models exceeds 25,000 at T+5min.',
  },
  {
    id: 'tubes_cb_models_online_count_ou150',
    sourceId: CB_SOURCE_ID,
    sourceName: CB_SOURCE_NAME,
    thresholdBps: 150,
    closeOffsetSecs: G_CLOSE,
    settleOffsetSecs: G_SETTLE,
    label: 'Rooms with >50 viewers — over 150 in 5 min',
    description: 'YES pays if the number of cam rooms with > 50 concurrent viewers exceeds 150 at T+5min.',
  },
  {
    id: 'tubes_cb_models_online_count_ou200',
    sourceId: CB_SOURCE_ID,
    sourceName: CB_SOURCE_NAME,
    thresholdBps: 200,
    closeOffsetSecs: G_CLOSE,
    settleOffsetSecs: G_SETTLE,
    label: 'Rooms with >50 viewers — over 200 in 5 min',
    description: 'YES pays if the number of cam rooms with > 50 concurrent viewers exceeds 200 at T+5min.',
  },
  {
    id: 'tubes_cb_models_online_count_ou300',
    sourceId: CB_SOURCE_ID,
    sourceName: CB_SOURCE_NAME,
    thresholdBps: 300,
    closeOffsetSecs: G_CLOSE,
    settleOffsetSecs: G_SETTLE,
    label: 'Rooms with >50 viewers — over 300 in 5 min',
    description: 'YES pays if the number of cam rooms with > 50 concurrent viewers exceeds 300 at T+5min.',
  },
  {
    id: 'tubes_cb_top_model_up_or_down_5min',
    sourceId: CB_SOURCE_ID,
    sourceName: CB_SOURCE_NAME,
    thresholdBps: 1,
    closeOffsetSecs: G_CLOSE,
    settleOffsetSecs: G_SETTLE,
    label: 'Top-1 viewer count rises in 5 min',
    description: 'YES pays if the current #1 cam model has more viewers at T+5min than at click-time.',
  },
  {
    id: 'tubes_cb_top1_vs_top2_gap_ou500',
    sourceId: CB_SOURCE_ID,
    sourceName: CB_SOURCE_NAME,
    thresholdBps: 500,
    closeOffsetSecs: G_CLOSE,
    settleOffsetSecs: G_SETTLE,
    label: 'Top-1 minus Top-2 viewer gap over 500 in 5 min',
    description: 'YES pays if (top-1 viewers − top-2 viewers) at T+5min exceeds 500.',
  },
  {
    id: 'tubes_cb_new_entrant_top10',
    sourceId: CB_SOURCE_ID,
    sourceName: CB_SOURCE_NAME,
    thresholdBps: 1,
    closeOffsetSecs: G_CLOSE,
    settleOffsetSecs: G_SETTLE,
    label: 'New entrant breaks into top-10 in 5 min',
    description: 'YES pays if at T+5min the top-10 cam roster contains a model that was not in the top-10 at click-time.',
  },
  {
    id: 'tubes_cb_top1_holds_5min',
    sourceId: CB_SOURCE_ID,
    sourceName: CB_SOURCE_NAME,
    thresholdBps: 1,
    closeOffsetSecs: G_CLOSE,
    settleOffsetSecs: G_SETTLE,
    label: 'Top-1 cam model holds rank in 5 min',
    description: 'YES pays if the cam model ranked #1 at click-time is still ranked #1 at T+5min.',
  },
  {
    id: 'tubes_cb_total_tokens_ou_proxy',
    sourceId: CB_SOURCE_ID,
    sourceName: CB_SOURCE_NAME,
    thresholdBps: 50000,
    closeOffsetSecs: G_CLOSE,
    settleOffsetSecs: G_SETTLE,
    label: 'Total cam users over 50,000 in 5 min',
    description: 'YES pays if the summed `num_users` across all online cam rooms exceeds 50,000 at T+5min — a rough activity proxy.',
  },
] as const

export function getCatalogEntry(id: string): CatalogEntry | null {
  return CATALOG.find(e => e.id === id) ?? null
}

/**
 * Resolves a catalog entry to concrete timestamps using the provided
 * `nowSecs` (unix seconds). Rounds to the nearest whole second.
 */
export function resolveWindow(
  entry: CatalogEntry,
  nowSecs: number,
): { closeTime: bigint; settlementTime: bigint } {
  const now = Math.floor(nowSecs)
  return {
    closeTime: BigInt(now + entry.closeOffsetSecs),
    settlementTime: BigInt(now + entry.settleOffsetSecs),
  }
}
