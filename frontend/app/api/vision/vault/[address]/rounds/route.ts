// Per-vault round history. Vision vaults trade parimutuel batches, not ITP
// orders, so /portfolio/trades is the wrong source — that table only catches
// ITP fills. The truthful history lives in the chain's PlayerJoined,
// PlayerSettled, and PlayerRefunded events.
//
// Four-state taxonomy: pending | settled | refundable | refunded.
// Stuck is no longer a category — past expirationTime, deposits become
// refundable. The UI surfaces a CTA, the keeper fires the rescue, the round
// resolves one way or another.

import { NextResponse } from 'next/server'
import { createPublicClient, http, parseAbiItem, formatUnits, getAddress } from 'viem'
import deployment from '@/lib/contracts/deployment.json'

const L3_RPC =
  process.env['L3_RPC_URL'] || process.env['NEXT_PUBLIC_L3_RPC_URL'] || 'http://159.195.79.153/'
const VISION_ADDRESS = (deployment as any).contracts?.Vision as `0x${string}`
// Was 86_400 (~24h). Bumped to 7 days so a vault's full week of rounds shows
// up — the previous window made stuck rounds disappear into the past, which
// is its own form of lying.
const LOOKBACK_BLOCKS = 604_800n

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
const playerRefundedEvent = parseAbiItem(
  'event PlayerRefunded(uint256 indexed batchId, address indexed player, uint256 amount)',
)
const batchExpirationTimeFn = parseAbiItem(
  'function batchExpirationTime(uint256 batchId) view returns (uint256)',
)

export const dynamic = 'force-dynamic'

type RoundStatus = 'pending' | 'settled' | 'refundable' | 'refunded'

interface Round {
  batchId: string
  joinBlock: number
  joinTime: number  // unix seconds — when the join landed on chain
  resolveBlock: number | null  // settle or refund block, or null if still in flight
  resolveTime: number | null   // unix seconds — when settle/refund landed
  status: RoundStatus
  deposit: number
  payout: number | null
  pnl: number | null
  expirationTime: number | null  // unix seconds, null if lookup failed
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
    const headBlock = await client.getBlock({ blockNumber: head })
    const nowSec = Number(headBlock.timestamp)

    const [joinedLogs, settledLogs, refundedLogs] = await Promise.all([
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
      client.getLogs({
        address: VISION_ADDRESS,
        event: playerRefundedEvent,
        args: { player: vault },
        fromBlock,
        toBlock: head,
      }),
    ])

    // Resolve block → unix timestamp by reading distinct block headers.
    // Pull every relevant block once instead of per-row.
    const blockNumbers = new Set<bigint>()
    for (const log of [...joinedLogs, ...settledLogs, ...refundedLogs]) {
      if (log.blockNumber != null) blockNumbers.add(log.blockNumber)
    }
    const blockTimes = new Map<bigint, number>()
    if (blockNumbers.size > 0) {
      const results = await Promise.allSettled(
        Array.from(blockNumbers).map((bn) => client.getBlock({ blockNumber: bn })),
      )
      let i = 0
      for (const bn of blockNumbers) {
        const r = results[i++]
        if (r.status === 'fulfilled') blockTimes.set(bn, Number(r.value.timestamp))
      }
    }
    const tsForBlock = (bn: bigint | null) => (bn !== null ? blockTimes.get(bn) ?? 0 : 0)

    const settledByBatch = new Map<string, { payout: bigint; blockNumber: bigint }>()
    for (const log of settledLogs) {
      settledByBatch.set(String(log.args.batchId ?? 0n), {
        payout: log.args.payout ?? 0n,
        blockNumber: log.blockNumber ?? 0n,
      })
    }

    const refundedByBatch = new Map<string, { amount: bigint; blockNumber: bigint }>()
    for (const log of refundedLogs) {
      refundedByBatch.set(String(log.args.batchId ?? 0n), {
        amount: log.args.amount ?? 0n,
        blockNumber: log.blockNumber ?? 0n,
      })
    }

    // For unresolved rounds we need the expirationTime to decide between
    // pending and refundable. Batched multicall would be cleaner, but the
    // unresolved set is usually small — one read per batch is fine.
    const unresolvedBatchIds: bigint[] = []
    for (const log of joinedLogs) {
      const id = log.args.batchId ?? 0n
      const key = String(id)
      if (settledByBatch.has(key) || refundedByBatch.has(key)) continue
      unresolvedBatchIds.push(id)
    }

    const expirationByBatch = new Map<string, number>()
    if (unresolvedBatchIds.length > 0) {
      const results = await Promise.allSettled(
        unresolvedBatchIds.map((id) =>
          client.readContract({
            address: VISION_ADDRESS,
            abi: [batchExpirationTimeFn],
            functionName: 'batchExpirationTime',
            args: [id],
          }) as Promise<bigint>,
        ),
      )
      for (let i = 0; i < results.length; i++) {
        const r = results[i]
        if (r.status === 'fulfilled') {
          expirationByBatch.set(String(unresolvedBatchIds[i]), Number(r.value))
        }
      }
    }

    const rounds: Round[] = []
    for (const log of joinedLogs) {
      const batchId = String(log.args.batchId ?? 0n)
      const depositWei = log.args.deposit ?? 0n
      const deposit = parseFloat(formatUnits(depositWei, 18))
      const joinBlock = Number(log.blockNumber ?? 0n)
      const joinTime = tsForBlock(log.blockNumber ?? null)

      const settled = settledByBatch.get(batchId)
      if (settled) {
        const payout = parseFloat(formatUnits(settled.payout, 18))
        rounds.push({
          batchId,
          joinBlock,
          joinTime,
          resolveBlock: Number(settled.blockNumber),
          resolveTime: tsForBlock(settled.blockNumber),
          status: 'settled',
          deposit,
          payout,
          pnl: payout - deposit,
          expirationTime: null,
        })
        continue
      }

      const refunded = refundedByBatch.get(batchId)
      if (refunded) {
        rounds.push({
          batchId,
          joinBlock,
          joinTime,
          resolveBlock: Number(refunded.blockNumber),
          resolveTime: tsForBlock(refunded.blockNumber),
          status: 'refunded',
          deposit,
          payout: parseFloat(formatUnits(refunded.amount, 18)),
          pnl: 0,
          expirationTime: null,
        })
        continue
      }

      const expiration = expirationByBatch.get(batchId) ?? null
      const status: RoundStatus =
        expiration !== null && nowSec >= expiration ? 'refundable' : 'pending'
      rounds.push({
        batchId,
        joinBlock,
        joinTime,
        resolveBlock: null,
        resolveTime: null,
        status,
        deposit,
        payout: null,
        pnl: null,
        expirationTime: expiration,
      })
    }

    // Newest first — sort by resolve block when present, else join block.
    // This collapses the apples-and-oranges sort the previous version had.
    const sortKey = (r: Round) => r.resolveBlock ?? r.joinBlock
    rounds.sort((a, b) => sortKey(b) - sortKey(a))
    const trimmed = rounds.slice(0, 200)

    const totals = {
      joined: rounds.length,
      settled: rounds.filter((r) => r.status === 'settled').length,
      refunded: rounds.filter((r) => r.status === 'refunded').length,
      refundable: rounds.filter((r) => r.status === 'refundable').length,
      pending: rounds.filter((r) => r.status === 'pending').length,
    }

    return NextResponse.json(
      {
        vault,
        lookbackBlocks: Number(LOOKBACK_BLOCKS),
        headBlock: Number(head),
        nowSec,
        total: rounds.length,
        totals,
        rounds: trimmed,
      },
      { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=30' } },
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'unknown'
    console.error('[api/vision/vault/rounds]', message)
    return NextResponse.json({ error: 'Failed', message }, { status: 500 })
  }
}
