import { NextResponse } from 'next/server'
import { getIssuerVisionUrl } from '@/lib/config'
import { createPublicClient, http } from 'viem'
import { indexL3 } from '@/lib/wagmi'
import deployment from '@/lib/contracts/deployment.json'

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

async function verifyOpenBatch(batchId: number): Promise<boolean> {
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
    return players > 0 || deposited > 0n
  } catch {
    return false
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  const { sourceId } = await params
  const { searchParams } = new URL(request.url)
  const qs = searchParams.toString()
  try {
    const res = await fetch(
      `${getIssuerVisionUrl()}/vision/source/${encodeURIComponent(sourceId)}/history${qs ? `?${qs}` : ''}`,
      { cache: 'no-store', signal: AbortSignal.timeout(10000) }
    )
    if (!res.ok) return NextResponse.json({ batches: [] }, { status: res.status })
    const data = await res.json()

    // Verify "open" batches on-chain — oracle may report zombies
    const batches = data.batches ?? []
    const openBatches = batches.filter((b: any) => b.status === 'open')
    if (openBatches.length > 0) {
      const checks = await Promise.all(
        openBatches.map((b: any) => verifyOpenBatch(b.batchId))
      )
      for (let i = 0; i < openBatches.length; i++) {
        if (!checks[i]) {
          // Zombie — mark as settled so the UI doesn't show it as active
          openBatches[i].status = 'settled'
          openBatches[i].settledAt = openBatches[i].settledAt || new Date().toISOString()
        }
      }
    }

    const response = NextResponse.json(data)
    response.headers.set('Cache-Control', 's-maxage=30, stale-while-revalidate=60')
    return response
  } catch {
    return NextResponse.json({ batches: [] }, { status: 502 })
  }
}
