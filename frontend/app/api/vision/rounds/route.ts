import { keccak256, toHex, createPublicClient, http } from 'viem'
import { getIssuerVisionUrl } from '@/lib/config'
import sourcesDisplay from '@/data/sources-display.json'
import deployment from '@/lib/contracts/deployment.json'
import { indexL3 } from '@/lib/wagmi'

// Build reverse mapping: internal sourceId → display sourceId, and keccak hashes
const INTERNAL_TO_DISPLAY: Record<string, string> = {}
const DISPLAY_HASHES: Record<string, Set<string>> = {}
for (const s of (sourcesDisplay as any).sources) {
  const displayId = s.sourceId as string
  const ids: string[] = s.internalIds ?? [displayId]
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

    // Filter by display sourceId
    if (sourceFilter && rounds.length > 0) {
      const filterLower = sourceFilter.toLowerCase()
      const matchHashes = DISPLAY_HASHES[filterLower] ?? new Set<string>()
      rounds = rounds.filter((r: any) => {
        const sid = (r.source_id ?? r.sourceId ?? '').toLowerCase()
        return sid === filterLower || matchHashes.has(sid)
      })
    }

    // No on-chain filtering for rounds — they are ephemeral and start with
    // playerCount=0 before bots join. The oracle is authoritative for live
    // round state. Zombie filtering belongs in /api/vision/batches (source cards)
    // and /api/vision/source/*/history (round history), not here.

    return Response.json({ rounds })
  } catch (e) {
    console.error('Vision rounds proxy error:', e)
    return Response.json({ rounds: [] }, { status: 502 })
  }
}
