// Per-vault round history. Vision vaults trade parimutuel batches, not ITP
// orders, so /portfolio/trades is the wrong source — that table only catches
// ITP fills. The truthful history lives in the chain's PlayerJoined +
// PlayerSettled events, which the /stats endpoint already aggregates. Here
// we return them row by row instead of folded into win/loss totals, so the
// vault page can render an actual log of what the bot did.

import { NextResponse } from 'next/server'
import { createPublicClient, http, parseAbiItem, formatUnits, getAddress } from 'viem'
import deployment from '@/lib/contracts/deployment.json'

const L3_RPC =
  process.env['L3_RPC_URL'] || process.env['NEXT_PUBLIC_L3_RPC_URL'] || 'http://159.195.79.153/'
const VISION_ADDRESS = (deployment as any).contracts?.Vision as `0x${string}`
const LOOKBACK_BLOCKS = 86_400n // ~24h at 1s/block; matches the stats route

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

interface Round {
  batchId: string
  blockNumber: number
  status: 'open' | 'settled'
  deposit: number
  payout: number | null
  pnl: number | null
}

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

    const [joinedLogs, settledLogs] = await Promise.all([
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

    // Index settlements by batchId for the merge.
    const settledByBatch = new Map<
      string,
      { payout: bigint; blockNumber: bigint }
    >()
    for (const log of settledLogs) {
      const batchId = String(log.args.batchId ?? 0n)
      settledByBatch.set(batchId, {
        payout: log.args.payout ?? 0n,
        blockNumber: log.blockNumber ?? 0n,
      })
    }

    const rounds: Round[] = []
    for (const log of joinedLogs) {
      const batchId = String(log.args.batchId ?? 0n)
      const depositWei = log.args.deposit ?? 0n
      const deposit = parseFloat(formatUnits(depositWei, 18))
      const settled = settledByBatch.get(batchId)
      if (settled) {
        const payout = parseFloat(formatUnits(settled.payout, 18))
        rounds.push({
          batchId,
          blockNumber: Number(settled.blockNumber),
          status: 'settled',
          deposit,
          payout,
          pnl: payout - deposit,
        })
      } else {
        rounds.push({
          batchId,
          blockNumber: Number(log.blockNumber ?? 0n),
          status: 'open',
          deposit,
          payout: null,
          pnl: null,
        })
      }
    }

    // Newest first — settled rounds first by their settlement block, then any
    // still-open joins. Cap the response so a long-lived vault doesn't blow
    // the JSON budget.
    rounds.sort((a, b) => b.blockNumber - a.blockNumber)
    const trimmed = rounds.slice(0, 200)

    return NextResponse.json(
      {
        vault,
        lookbackBlocks: Number(LOOKBACK_BLOCKS),
        headBlock: Number(head),
        total: rounds.length,
        rounds: trimmed,
      },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' } },
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'unknown'
    console.error('[api/vision/vault/rounds]', message)
    return NextResponse.json({ error: 'Failed', message }, { status: 500 })
  }
}
