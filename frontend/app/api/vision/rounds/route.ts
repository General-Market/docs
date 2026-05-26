import { keccak256, toHex, createPublicClient, http, parseAbiItem } from 'viem'
import { getIssuerVisionUrl } from '@/lib/config'
import { isHiddenSourceId } from '@/lib/vision/hidden-sources'
import sourcesDisplay from '@/data/sources-display.json'
import deployment from '@/lib/contracts/deployment.json'
import { indexL3 } from '@/lib/wagmi'

// PlayerJoined event — the source of truth for player count and TVL.
// The Vision contract's Batch struct does NOT expose playerCount or totalDeposited,
// so the only way to count players is to count PlayerJoined events for a batchId.
const playerJoinedEvent = parseAbiItem(
  'event PlayerJoined(uint256 indexed batchId, address indexed player, uint256 deposit, bytes32 bitmapHash, bytes32 configHash)'
)
// Look back ~30 minutes — covers join + tick window for every source
// (twitch's 60s tick to ECB's 86400s tick still has joins land within the
// first few minutes of round creation).
const ENRICH_LOOKBACK_BLOCKS = 1800n

// Build reverse mapping: internal sourceId → display sourceId, and keccak hashes
const INTERNAL_TO_DISPLAY: Record<string, string> = {}
const DISPLAY_HASHES: Record<string, Set<string>> = {}
for (const s of (sourcesDisplay as any).sources) {
  const displayId = s.sourceId as string
  // Sources that own a curated sub-source batch (batchSubsourceKey) get a
  // dedicated on-chain batch keyed by that string — the oracle stores its
  // source_id as the subsource key. Recognise it as a valid identifier
  // alongside the legacy internalIds firehose. Without this, the
  // /vision/rounds API filter would miss rounds for defillama-bridges and
  // its 16 siblings because their internalIds only list "defi".
  const subKey = s.batchSubsourceKey as string | undefined
  const baseIds: string[] = s.internalIds ?? [displayId]
  const ids: string[] = subKey ? [subKey, ...baseIds] : baseIds
  const hashes = new Set<string>()
  for (const iid of ids) {
    INTERNAL_TO_DISPLAY[iid.toLowerCase()] = displayId
    for (const suffix of ['', '_v1', '_v2', '_v3', '_v4', '_v5']) {
      const hash = keccak256(toHex(iid + suffix)).toLowerCase()
      INTERNAL_TO_DISPLAY[hash] = displayId
      hashes.add(hash)
    }
    hashes.add(iid.toLowerCase())
  }
  DISPLAY_HASHES[displayId.toLowerCase()] = hashes
}

const GET_BATCH_ABI = [{
  inputs: [{ name: 'batchId', type: 'uint256' }],
  name: 'getBatch',
  outputs: [{
    name: '', type: 'tuple',
    components: [
      { name: 'sourceId', type: 'bytes32' },
      { name: 'creator', type: 'address' },
      { name: 'configHash', type: 'bytes32' },
      { name: 'marketIds', type: 'bytes32[]' },
      { name: 'resolutionTypes', type: 'uint8[]' },
      { name: 'tickDuration', type: 'uint32' },
      { name: 'currentTick', type: 'uint32' },
      { name: 'playerCount', type: 'uint32' },
      { name: 'totalDeposited', type: 'uint256' },
      { name: 'paused', type: 'bool' },
    ],
  }],
  stateMutability: 'view',
  type: 'function',
}] as const

// Cache verified batch IDs (30s TTL) — shared across requests
let verifiedCache: { alive: Set<number>; dead: Set<number>; ts: number } = {
  alive: new Set(), dead: new Set(), ts: 0,
}

async function isBatchAlive(batchId: number): Promise<boolean> {
  // Check cache
  if (Date.now() - verifiedCache.ts < 30_000) {
    if (verifiedCache.alive.has(batchId)) return true
    if (verifiedCache.dead.has(batchId)) return false
  } else {
    // Cache expired — reset
    verifiedCache = { alive: new Set(), dead: new Set(), ts: Date.now() }
  }

  const visionAddress = (deployment as any).contracts?.Vision
  if (!visionAddress || visionAddress === '0x0000000000000000000000000000000000000000') return true

  try {
    const client = createPublicClient({
      chain: indexL3,
      transport: http(indexL3.rpcUrls.default.http[0]),
    })
    const result = await client.readContract({
      address: visionAddress as `0x${string}`,
      abi: GET_BATCH_ABI,
      functionName: 'getBatch',
      args: [BigInt(batchId)],
    })
    const players = Number(result.playerCount ?? 0)
    const deposited = BigInt(result.totalDeposited ?? 0n)
    const alive = players > 0 || deposited > 0n
    if (alive) verifiedCache.alive.add(batchId)
    else verifiedCache.dead.add(batchId)
    return alive
  } catch {
    verifiedCache.dead.add(batchId)
    return false
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const sourceFilter = searchParams.get('source')

    const res = await fetch(`${getIssuerVisionUrl()}/vision/rounds/active`, {
      next: { revalidate: 5 },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) throw new Error(`Oracle API ${res.status}`)
    const data = await res.json()
    let rounds = data.rounds ?? (Array.isArray(data) ? data : [])

    // Resolve oracle internal sourceIds to display sourceIds
    for (const r of rounds) {
      const sid = (r.source_id ?? r.sourceId ?? '').toLowerCase()
      const display = INTERNAL_TO_DISPLAY[sid]
      if (display) {
        r.source_id = display
        r.sourceId = display
      }
    }

    // Drop disabled/hidden sources (data-node DISABLED_SOURCES — dead/rate-
    // limited feeds). Their legacy batches still resolve on-chain, but no
    // rounds-driven surface (the floor, pulse feed) may show them as live.
    // The detail page already 404s via isHiddenSource; this closes the
    // rounds-feed leak so a frozen $4k ghost round never reaches the UI.
    rounds = rounds.filter((r: any) => !isHiddenSourceId((r.source_id ?? r.sourceId ?? '')))

    // Filter by display sourceId
    if (sourceFilter && rounds.length > 0) {
      const filterLower = sourceFilter.toLowerCase()
      const matchHashes = DISPLAY_HASHES[filterLower] ?? new Set<string>()
      rounds = rounds.filter((r: any) => {
        const sid = (r.source_id ?? r.sourceId ?? '').toLowerCase()
        return sid === filterLower || matchHashes.has(sid)
      })
    }

    // Enrich each round with fresh on-chain player count and TVL by counting
    // PlayerJoined events directly. The oracle's lifecycle table lags behind
    // the chain by tens of seconds, so a freshly-joined round (especially for
    // short-tick sources like twitch) shows playerCount=0 and tvl="0" until
    // the oracle catches up. The Vision contract has no playerCount getter,
    // so events are the only fresh source. ONE getLogs call covers all rounds.
    const visionAddress = (deployment as any).contracts?.Vision
    if (visionAddress && rounds.length > 0) {
      try {
        const client = createPublicClient({
          chain: indexL3,
          transport: http(indexL3.rpcUrls.default.http[0]),
        })
        const blockNumber = await client.getBlockNumber()
        const fromBlock =
          blockNumber > ENRICH_LOOKBACK_BLOCKS ? blockNumber - ENRICH_LOOKBACK_BLOCKS : 0n
        const logs = await client.getLogs({
          address: visionAddress as `0x${string}`,
          event: playerJoinedEvent,
          fromBlock,
          toBlock: blockNumber,
        })
        // Group joins by batchId: count unique players, sum deposits.
        const stats = new Map<string, { players: Set<string>; deposit: bigint }>()
        for (const log of logs) {
          const bid = String(log.args.batchId ?? '')
          if (!bid) continue
          const player = (log.args.player ?? '0x0').toLowerCase()
          let entry = stats.get(bid)
          if (!entry) {
            entry = { players: new Set(), deposit: 0n }
            stats.set(bid, entry)
          }
          entry.players.add(player)
          entry.deposit += log.args.deposit ?? 0n
        }
        for (const r of rounds) {
          const bid = String(r.batchId ?? r.batch_id ?? r.id ?? '')
          const entry = stats.get(bid)
          if (!entry) continue
          // Only overwrite when on-chain is non-zero — preserves oracle's
          // value for batches whose joins are outside our lookback window.
          if (entry.players.size > 0) r.playerCount = entry.players.size
          if (entry.deposit > 0n) r.tvl = entry.deposit.toString()
        }
      } catch (e) {
        // RPC failure → keep oracle's stale-but-best-effort values.
        console.warn('Round enrichment via getLogs failed:', e)
      }
    }

    return Response.json({ rounds })
  } catch (e) {
    console.error('Vision rounds proxy error:', e)
    return Response.json({ rounds: [] }, { status: 502 })
  }
}
