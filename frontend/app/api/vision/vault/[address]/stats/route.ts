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
const LOOKBACK_BLOCKS = 86_400n

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

    // For each settled batch with a known deposit, record the realized pnl
    // and the absolute win/loss amount for averaging.
    let wins = 0
    let losses = 0
    let winSum = 0
    let lossSum = 0
    let totalPnl = 0
    let settledTrades = 0

    for (const log of settled) {
      const batchId = String(log.args.batchId ?? 0n)
      const deposit = depositByBatch.get(batchId)
      if (deposit === undefined) continue // join is outside the window
      const payout = log.args.payout ?? 0n
      const pnlWei = payout - deposit
      const pnl = parseFloat(formatUnits(pnlWei, 18))
      totalPnl += pnl
      settledTrades += 1
      if (pnl > 0) {
        wins += 1
        winSum += pnl
      } else if (pnl < 0) {
        losses += 1
        lossSum += pnl
      }
    }

    const trades = joined.length
    const resolved = wins + losses
    const winRate = resolved > 0 ? wins / resolved : null
    const avgWin = wins > 0 ? winSum / wins : null
    const avgLoss = losses > 0 ? lossSum / losses : null

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
      },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' } },
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'unknown'
    console.error('[api/vision/vault/stats]', message)
    return NextResponse.json({ error: 'Failed', message }, { status: 500 })
  }
}
