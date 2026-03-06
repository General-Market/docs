import { NextRequest, NextResponse } from 'next/server'

import { DATA_NODE_SERVER, L3_RPC_SERVER } from '@/lib/config'
import deployment from '@/lib/contracts/deployment.json'

const DATA_NODE_URL = DATA_NODE_SERVER

// L3 chain (Orbit) — for on-chain NAV fallback
const L3_RPC = L3_RPC_SERVER
const INDEX_CONTRACT = deployment.contracts.Index

// getITPState(bytes32) selector
const GET_ITP_STATE_SELECTOR = '0x7bfb3953'

async function rpcCall(method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(L3_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(5_000),
  })
  const json = await res.json()
  if (json.error) throw new Error(json.error.message)
  return json.result
}

export async function GET(request: NextRequest) {
  const itpId = request.nextUrl.searchParams.get('itp_id')
  if (!itpId) {
    return NextResponse.json({ error: 'itp_id required' }, { status: 400 })
  }

  // Try data-node first (has live API prices → more accurate NAV)
  try {
    const res = await fetch(`${DATA_NODE_URL}/itp-price?itp_id=${encodeURIComponent(itpId)}`, {
      next: { revalidate: 2 },
      signal: AbortSignal.timeout(3_000),
    })
    if (res.ok) {
      const data = await res.json()
      if (data.nav && data.nav !== '0') {
        return NextResponse.json(data)
      }
    }
  } catch {
    // Data-node unavailable — fall through to on-chain
  }

  // Fallback: read NAV from on-chain Index contract via eth_call
  try {
    const itpIdPadded = itpId.replace('0x', '').padStart(64, '0')

    // Call getITPState(bytes32) → returns (address, uint256 totalSupply, uint256 nav, address[], uint256[], uint256[])
    const calldata = GET_ITP_STATE_SELECTOR + itpIdPadded
    const result = await rpcCall('eth_call', [
      { to: INDEX_CONTRACT, data: calldata },
      'latest',
    ]) as string

    if (!result || result === '0x' || result.length < 130) {
      throw new Error('Empty result')
    }

    // Decode: skip first 32 bytes (creator address), read totalSupply (offset 32), nav (offset 64)
    // ABI encoding: slot 0 = creator (padded address), slot 1 = totalSupply, slot 2 = nav,
    // then dynamic array offsets for assets, weights, inventory
    const hex = result.replace('0x', '')
    const navHex = hex.slice(128, 192) // 3rd word (offset 64-96 bytes)
    const nav = BigInt('0x' + navHex)

    // Count assets from the dynamic array
    // assets offset is at slot 3 (192-256), pointing to the array location
    const assetsOffsetHex = hex.slice(192, 256)
    const assetsOffset = Number(BigInt('0x' + assetsOffsetHex)) * 2 // bytes to hex chars
    const assetsLenHex = hex.slice(assetsOffset, assetsOffset + 64)
    const assetsCount = Number(BigInt('0x' + assetsLenHex))

    // Format NAV with 4 decimal places
    const navFloat = Number(nav) / 1e18
    const navDisplay = navFloat.toFixed(4)

    return NextResponse.json({
      nav: nav.toString(),
      nav_display: navDisplay,
      assets_priced: assetsCount,
      assets_total: assetsCount,
      source: 'onchain',
    })
  } catch {
    return NextResponse.json({ nav: '0', nav_display: '0', assets_priced: 0, assets_total: 0 }, { status: 502 })
  }
}
