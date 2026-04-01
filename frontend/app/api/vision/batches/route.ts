import { keccak256, toHex, createPublicClient, http } from 'viem'
import { getIssuerVisionUrl } from '@/lib/config'
import visionBatchesJson from '@/lib/contracts/vision-batches.json'
import sourcesDisplay from '@/data/sources-display.json'
import deployment from '@/lib/contracts/deployment.json'
import { indexL3 } from '@/lib/wagmi'

// Static deploy configHash fallback: patches zero hashes from oracle
const BATCH_ID_TO_CONFIG_HASH: Record<number, string> = {}
for (const [, val] of Object.entries(visionBatchesJson.batches)) {
  const v = val as any
  if (v.configHash) BATCH_ID_TO_CONFIG_HASH[v.batchId] = v.configHash
}

// Build keccak hash → display sourceId lookup
const HASH_TO_SOURCE: Record<string, string> = {}
for (const s of (sourcesDisplay as any).sources) {
  const ids: string[] = s.internalIds ?? [s.sourceId]
  for (const iid of ids) {
    for (const suffix of ['', '_v1', '_v2', '_v3', '_v4', '_v5']) {
      const hash = keccak256(toHex(iid + suffix)).toLowerCase()
      HASH_TO_SOURCE[hash] = s.sourceId
    }
    HASH_TO_SOURCE[iid.toLowerCase()] = s.sourceId
  }
}

function resolveSourceId(rawId: string): string {
  const lower = rawId.toLowerCase()
  return HASH_TO_SOURCE[lower] ?? rawId
}

const GET_BATCH_ABI = {
  inputs: [{ name: 'batchId', type: 'uint256' as const }],
  name: 'getBatch',
  outputs: [{
    name: '',
    type: 'tuple' as const,
    components: [
      { name: 'creator', type: 'address' as const },
      { name: 'sourceId', type: 'bytes32' as const },
      { name: 'configHash', type: 'bytes32' as const },
      { name: 'tickDuration', type: 'uint256' as const },
      { name: 'lockOffset', type: 'uint256' as const },
      { name: 'createdAtTick', type: 'uint256' as const },
      { name: 'paused', type: 'bool' as const },
    ],
  }],
  stateMutability: 'view' as const,
  type: 'function' as const,
} as const

// Cache on-chain verification results (30s TTL)
let verifiedCache: { alive: Set<number>; ts: number } = { alive: new Set(), ts: 0 }

async function getAliveBatchIds(batchIds: number[]): Promise<Set<number>> {
  if (batchIds.length === 0) return new Set()

  // Return cache if fresh
  if (Date.now() - verifiedCache.ts < 30_000 && verifiedCache.alive.size > 0) {
    return verifiedCache.alive
  }

  const visionAddress = (deployment as any).contracts?.Vision
  if (!visionAddress || visionAddress === '0x0000000000000000000000000000000000000000') {
    // Can't verify — return all as alive (fail open)
    return new Set(batchIds)
  }

  try {
    const client = createPublicClient({
      chain: indexL3,
      transport: http(indexL3.rpcUrls.default.http[0], { timeout: 8_000 }),
    })

    // L3 has no multicall3 — fire individual calls in parallel.
    // Each call checks if the batch exists and has real activity.
    const alive = new Set<number>()
    let rpcErrors = 0
    const checks = batchIds.map(async (id) => {
      try {
        await client.readContract({
          address: visionAddress as `0x${string}`,
          abi: [GET_BATCH_ABI],
          functionName: 'getBatch',
          args: [BigInt(id)],
        })
        // Call succeeded (no revert) — batch exists on-chain.
        // A ghost batch (wrong contract / deleted) would revert.
        alive.add(id)
      } catch {
        // Revert = batch doesn't exist on this contract.
        // RPC timeout/network error also lands here.
        rpcErrors++
      }
    })

    await Promise.all(checks)

    // Fail open: if ALL calls failed (RPC down, wrong contract address,
    // contract redeployed) return all candidates. The verification exists
    // to filter ghost batches, not to block all data when L3 is unreachable.
    if (alive.size === 0 && rpcErrors === batchIds.length) {
      console.warn(`[Vision batches] All ${rpcErrors} on-chain checks failed — returning all candidates (fail open)`)
      return new Set(batchIds)
    }

    verifiedCache = { alive, ts: Date.now() }
    return alive
  } catch {
    // RPC failure — return all as alive (fail open)
    return new Set(batchIds)
  }
}

export async function GET() {
  try {
    const res = await fetch(`${getIssuerVisionUrl()}/vision/batches`, {
      next: { revalidate: 10 },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) throw new Error(`Issuer API ${res.status}`)
    const data = await res.json()

    // Patch zero config hashes from static deploy output
    for (const batch of (data.batches ?? [])) {
      const isZeroHash = !batch.config_hash || batch.config_hash === '0x' + '0'.repeat(64)
      if (isZeroHash && BATCH_ID_TO_CONFIG_HASH[batch.id]) {
        batch.config_hash = BATCH_ID_TO_CONFIG_HASH[batch.id]
      }
    }

    // Resolve keccak hashes to display names
    for (const batch of (data.batches ?? [])) {
      batch.source_id = resolveSourceId(batch.source_id ?? '')
    }

    // Deduplicate: keep latest NON-PAUSED batch per source
    const latestPerSource = new Map<string, any>()
    for (const batch of (data.batches ?? []).filter((b: any) => !b.paused)) {
      const existing = latestPerSource.get(batch.source_id)
      if (!existing || batch.id > existing.id) {
        latestPerSource.set(batch.source_id, batch)
      }
    }

    const candidates = Array.from(latestPerSource.values())

    // Verify on-chain: filter out ghost batches (contract redeployed, batch deleted, etc.)
    const aliveIds = await getAliveBatchIds(candidates.map((b: any) => b.id))
    const verified = candidates.filter((b: any) => aliveIds.has(b.id))

    return new Response(JSON.stringify({ batches: verified }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=30, stale-while-revalidate=60',
      },
    })
  } catch (e) {
    console.error('Vision batches proxy error:', e)
    return Response.json({ batches: [] }, { status: 502 })
  }
}
