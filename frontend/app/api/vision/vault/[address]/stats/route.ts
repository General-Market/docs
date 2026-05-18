import { NextResponse } from 'next/server'
import { createPublicClient, http, parseAbiItem, formatUnits, getAddress } from 'viem'
import deployment from '@/lib/contracts/deployment.json'

const L3_RPC =
  process.env['L3_RPC_URL'] || process.env['NEXT_PUBLIC_L3_RPC_URL'] || 'http://159.195.79.153/'
const VISION_ADDRESS = (deployment as any).contracts?.Vision as `0x${string}`
const BLOCK_TIME_MS = 1000
// 24 hours at ~1s/block. Long enough to catch most live vaults' recent
// trading activity without making get_logs rip through a day of history on
// every request. The data-node has per-round rows in vision_round_players
// that we'll eventually proxy through for full-lifetime stats.
const LOOKBACK_BLOCKS = 43_200n

const l3Chain = {
  id: 111222333,
  name: 'Index L3',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [L3_RPC] } },
} as const

const client = createPublicClient({
  chain: l3Chain,
  transport: http(L3_RPC, { timeout: 15_000 }),
})

const playerJoinedEvent = parseAbiItem(
  'event PlayerJoined(uint256 indexed batchId, address indexed player, uint256 deposit, bytes32 bitmapHash, bytes32 configHash)',
)
const playerSettledEvent = parseAbiItem(
  'event PlayerSettled(uint256 indexed batchId, address indexed player, uint256 payout, uint256 fee)',
)

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params
  let vault: `0x${string}`
  try {
    vault = getAddress(address)
  } catch {
    return NextResponse.json({ error: 'Invalid address' }, { status: 400 })
  }

  try {
    const head = await client.getBlockNumber()
    const fromBlock = head > LOOKBACK_BLOCKS ? head - LOOKBACK_BLOCKS : 0n

    const [joined, settled] = await Promise.all([
      client.getLogs({
        address: VISION_ADDRESS,
        event: playerJoinedEvent,
        args: { player: vault },
        fromBlock,
        toBlock: head,
      }),
      client.getLogs({
        address: VISION_ADDRESS,
        event: playerSettledEvent,
        args: { player: vault },
        fromBlock,
        toBlock: head,
      }),
    ])

    // batchId → deposit (18 dec wei)
    const depositByBatch = new Map<string, bigint>()
    for (const log of joined) {
      const batchId = String(log.args.batchId ?? 0n)
      depositByBatch.set(batchId, log.args.deposit ?? 0n)
    }

    // Per-trade returns rᵢ = (payoutᵢ − depositᵢ) / depositᵢ. This is the only
    // honest series for a discrete-bet vault: mark-to-market NAV between
    // resolutions is just noise re-priced by the orderbook. Sharpe/Sortino/
    // MaxDD computed on rᵢ describe the strategy; on NAV ticks they describe
    // the spread.
    const tradeReturns: number[] = []
    let wins = 0
    let losses = 0
    let winSum = 0
    let lossSum = 0
    let totalPnl = 0
    let settledTrades = 0

    // Sort settled logs by (block, logIndex) so the equity curve walks in
    // execution order. The RPC returns them sorted but we don't trust it.
    const settledSorted = [...settled].sort((a, b) => {
      const ab = (a.blockNumber ?? 0n) - (b.blockNumber ?? 0n)
      if (ab !== 0n) return ab > 0n ? 1 : -1
      return Number((a.logIndex ?? 0) - (b.logIndex ?? 0))
    })

    for (const log of settledSorted) {
      const batchId = String(log.args.batchId ?? 0n)
      const deposit = depositByBatch.get(batchId)
      if (deposit === undefined || deposit === 0n) continue
      const payout = log.args.payout ?? 0n
      const depositUsdc = parseFloat(formatUnits(deposit, 18))
      const payoutUsdc = parseFloat(formatUnits(payout, 18))
      if (!Number.isFinite(depositUsdc) || depositUsdc <= 0) continue
      const pnl = payoutUsdc - depositUsdc
      const ret = pnl / depositUsdc
      tradeReturns.push(ret)
      totalPnl += pnl
      settledTrades += 1
      if (pnl > 0) { wins += 1; winSum += pnl }
      else if (pnl < 0) { losses += 1; lossSum += pnl }
    }

    const trades = joined.length
    const resolved = wins + losses
    const winRate = resolved > 0 ? wins / resolved : null
    const avgWin = wins > 0 ? winSum / wins : null
    const avgLoss = losses > 0 ? lossSum / losses : null

    // Trades/year from observation window. Use the earliest join block as the
    // start so a fresh vault doesn't get scaled against the full lookback
    // (and inflate Sharpe by pretending it sat idle for 12h). Falls back to
    // the lookback window if for some reason the joined set is empty.
    let elapsedSecs = (Number(LOOKBACK_BLOCKS) * BLOCK_TIME_MS) / 1000
    if (joined.length > 0) {
      let earliestBlock = joined[0]!.blockNumber!
      for (const j of joined) {
        if ((j.blockNumber ?? 0n) < earliestBlock) earliestBlock = j.blockNumber!
      }
      try {
        const [headBlk, startBlk] = await Promise.all([
          client.getBlock({ blockNumber: head }),
          client.getBlock({ blockNumber: earliestBlock }),
        ])
        const span = Number(headBlk.timestamp - startBlk.timestamp)
        if (span > 0) elapsedSecs = span
      } catch {
        // fall through to lookback estimate
      }
    }

    const MIN_TRADES_FOR_RISK = 20
    const tradesPerYear = elapsedSecs > 0
      ? (settledTrades * 365 * 24 * 3600) / elapsedSecs
      : 0

    let sharpe: number | null = null
    let sortino: number | null = null
    let volatility: number | null = null
    let maxDrawdown: number | null = null
    let annualizedReturn: number | null = null

    if (settledTrades >= MIN_TRADES_FOR_RISK && tradesPerYear > 0) {
      const n = tradeReturns.length
      const mean = tradeReturns.reduce((a, r) => a + r, 0) / n
      const variance = tradeReturns.reduce((a, r) => a + (r - mean) ** 2, 0) / n
      const std = Math.sqrt(variance)

      const negs = tradeReturns.filter(r => r < 0)
      const downsideVar = negs.length > 0
        ? negs.reduce((a, r) => a + r * r, 0) / negs.length
        : 0
      const downsideStd = Math.sqrt(downsideVar)

      const annualise = Math.sqrt(tradesPerYear)
      if (std > 0) {
        sharpe = (mean / std) * annualise
        volatility = std * annualise
      }
      if (downsideStd > 0) sortino = (mean / downsideStd) * annualise
      annualizedReturn = mean * tradesPerYear

      // Max drawdown on the multiplicative equity curve, in trade-order.
      let equity = 1
      let peak = 1
      let dd = 0
      for (const r of tradeReturns) {
        equity *= 1 + r
        if (equity > peak) peak = equity
        const cur = (peak - equity) / peak
        if (cur > dd) dd = cur
      }
      maxDrawdown = dd > 0 ? -dd : null
    }

    return NextResponse.json(
      {
        vault,
        lookbackBlocks: Number(LOOKBACK_BLOCKS),
        trades,
        settledTrades,
        wins,
        losses,
        winRate,
        avgWin,
        avgLoss,
        totalPnl,
        headBlock: Number(head),
        // Trade-level risk metrics. All null until ≥ MIN_TRADES_FOR_RISK
        // settled trades — anything below that is a sample-size lie.
        sharpe,
        sortino,
        volatility,
        maxDrawdown,
        annualizedReturn,
        tradesPerYear,
        observationSecs: elapsedSecs,
        minTradesForRisk: MIN_TRADES_FOR_RISK,
      },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' } },
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'unknown'
    console.error('[api/vision/vault/stats]', message)
    return NextResponse.json({ error: 'Failed', message }, { status: 500 })
  }
}
