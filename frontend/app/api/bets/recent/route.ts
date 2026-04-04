import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, http, parseAbiItem, formatUnits } from 'viem'

const L3_RPC = process.env['L3_RPC_URL'] || process.env['NEXT_PUBLIC_L3_RPC_URL'] || 'http://142.132.164.24/'
const VISION_ADDRESS = '0x821D7c212344dd4E5EB837B01B0FFfE3BcAc1649' as const

const l3Chain = {
  id: 111222333,
  name: 'Index L3',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [L3_RPC] } },
} as const

const client = createPublicClient({
  chain: l3Chain,
  transport: http(L3_RPC),
})

const playerJoinedEvent = parseAbiItem(
  'event PlayerJoined(uint256 indexed batchId, address indexed player, uint256 deposit, bytes32 bitmapHash)'
)
const playerSettledEvent = parseAbiItem(
  'event PlayerSettled(uint256 indexed batchId, address indexed player, uint256 payout)'
)

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10) || 20, 1), 100)

  try {
    const blockNumber = await client.getBlockNumber()
    const fromBlock = blockNumber > 200n ? blockNumber - 200n : 0n

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

    // Collect unique block numbers for timestamp lookups
    const blockNumbers = new Set<bigint>()
    for (const log of [...joinedLogs, ...settledLogs]) {
      if (log.blockNumber) blockNumbers.add(log.blockNumber)
    }

    const blockTimestamps = new Map<bigint, bigint>()
    await Promise.all(
      [...blockNumbers].map(async (bn) => {
        const block = await client.getBlock({ blockNumber: bn })
        blockTimestamps.set(bn, block.timestamp)
      })
    )

    type BetEvent = {
      betId: string
      walletAddress: string
      eventType: 'placed' | 'won' | 'lost'
      portfolioSize: number
      amount: string
      oddsBps?: number
      result: string | null
      timestamp: string
      blockNumber: bigint
      logIndex: number
    }

    const events: BetEvent[] = []

    for (const log of joinedLogs) {
      const bn = log.blockNumber ?? 0n
      const ts = blockTimestamps.get(bn) ?? 0n
      events.push({
        betId: String(log.args.batchId),
        walletAddress: log.args.player ?? '0x0',
        eventType: 'placed',
        portfolioSize: 0,
        amount: formatUnits(log.args.deposit ?? 0n, 18),
        result: null,
        timestamp: new Date(Number(ts) * 1000).toISOString(),
        blockNumber: bn,
        logIndex: log.logIndex ?? 0,
      })
    }

    // Build a deposit lookup for settled events (to determine win/loss)
    const depositByPlayer = new Map<string, bigint>()
    for (const log of joinedLogs) {
      const key = `${log.args.batchId}-${log.args.player?.toLowerCase()}`
      depositByPlayer.set(key, log.args.deposit ?? 0n)
    }

    for (const log of settledLogs) {
      const bn = log.blockNumber ?? 0n
      const ts = blockTimestamps.get(bn) ?? 0n
      const payout = log.args.payout ?? 0n
      const key = `${log.args.batchId}-${log.args.player?.toLowerCase()}`
      const deposit = depositByPlayer.get(key) ?? 0n
      const eventType = payout > deposit ? 'won' : 'lost'

      events.push({
        betId: String(log.args.batchId),
        walletAddress: log.args.player ?? '0x0',
        eventType,
        portfolioSize: 0,
        amount: formatUnits(deposit, 18),
        result: formatUnits(payout, 18),
        timestamp: new Date(Number(ts) * 1000).toISOString(),
        blockNumber: bn,
        logIndex: log.logIndex ?? 0,
      })
    }

    // Sort newest first (by block number desc, then log index desc)
    events.sort((a, b) => {
      if (a.blockNumber !== b.blockNumber) return a.blockNumber > b.blockNumber ? -1 : 1
      return b.logIndex - a.logIndex
    })

    // Strip internal fields and limit
    const result = events.slice(0, limit).map(({ blockNumber: _bn, logIndex: _li, ...rest }) => rest)

    return NextResponse.json({ events: result })
  } catch (err) {
    console.error('[api/bets/recent] Failed to fetch on-chain events:', err)
    return NextResponse.json(
      { error: 'Failed to fetch recent bets', events: [] },
      { status: 500 }
    )
  }
}
