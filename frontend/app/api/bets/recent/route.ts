import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, http, parseAbiItem, formatUnits } from 'viem'

const L3_RPC = process.env['L3_RPC_URL'] || process.env['NEXT_PUBLIC_L3_RPC_URL'] || 'http://142.132.164.24/'
const VISION_ADDRESS = '0x821D7c212344dd4E5EB837B01B0FFfE3BcAc1649' as const
const BLOCK_TIME_MS = 1000 // ~1s per block on Orbit L3

const l3Chain = {
  id: 111222333,
  name: 'Index L3',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [L3_RPC] } },
} as const

const client = createPublicClient({
  chain: l3Chain,
  transport: http(L3_RPC, { timeout: 8_000 }),
})

const playerJoinedEvent = parseAbiItem(
  'event PlayerJoined(uint256 indexed batchId, address indexed player, uint256 deposit, bytes32 bitmapHash, bytes32 configHash)'
)
const playerSettledEvent = parseAbiItem(
  'event PlayerSettled(uint256 indexed batchId, address indexed player, uint256 payout, uint256 fee)'
)

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10) || 20, 1), 100)

  try {
    const blockNumber = await client.getBlockNumber()
    const fromBlock = blockNumber > 100n ? blockNumber - 100n : 0n
    const nowMs = Date.now()

    const [joinedLogs, settledLogs] = await Promise.all([
      client.getLogs({
        address: VISION_ADDRESS,
        event: playerJoinedEvent,
        fromBlock,
        toBlock: blockNumber,
      }),
      client.getLogs({
        address: VISION_ADDRESS,
        event: playerSettledEvent,
        fromBlock,
        toBlock: blockNumber,
      }),
    ])

    // Estimate timestamp from block offset (avoids N individual getBlock calls)
    const estimateTs = (bn: bigint) =>
      new Date(nowMs - Number(blockNumber - bn) * BLOCK_TIME_MS).toISOString()

    type BetEvent = {
      betId: string
      walletAddress: string
      eventType: 'placed' | 'won' | 'lost'
      portfolioSize: number
      amount: string
      result: string | null
      timestamp: string
      _sort: bigint
    }

    const events: BetEvent[] = []

    for (const log of joinedLogs) {
      const bn = log.blockNumber ?? 0n
      events.push({
        betId: String(log.args.batchId),
        walletAddress: log.args.player ?? '0x0',
        eventType: 'placed',
        portfolioSize: 0,
        amount: formatUnits(log.args.deposit ?? 0n, 18),
        result: null,
        timestamp: estimateTs(bn),
        _sort: bn * 10000n + BigInt(log.logIndex ?? 0),
      })
    }

    // Deposit lookup for win/loss determination
    const depositByKey = new Map<string, bigint>()
    for (const log of joinedLogs) {
      depositByKey.set(
        `${log.args.batchId}-${log.args.player?.toLowerCase()}`,
        log.args.deposit ?? 0n,
      )
    }

    for (const log of settledLogs) {
      const bn = log.blockNumber ?? 0n
      const payout = log.args.payout ?? 0n
      const key = `${log.args.batchId}-${log.args.player?.toLowerCase()}`
      const deposit = depositByKey.get(key) ?? 0n

      events.push({
        betId: String(log.args.batchId),
        walletAddress: log.args.player ?? '0x0',
        eventType: payout > deposit ? 'won' : 'lost',
        portfolioSize: 0,
        amount: formatUnits(deposit, 18),
        result: formatUnits(payout, 18),
        timestamp: estimateTs(bn),
        _sort: bn * 10000n + BigInt(log.logIndex ?? 0),
      })
    }

    // Newest first
    events.sort((a, b) => (a._sort > b._sort ? -1 : 1))

    const result = events.slice(0, limit).map(({ _sort, ...rest }) => rest)
    return NextResponse.json({ events: result })
  } catch (err: any) {
    console.error('[api/bets/recent]', err?.message || err)
    return NextResponse.json({ error: 'Failed', events: [] }, { status: 500 })
  }
}
