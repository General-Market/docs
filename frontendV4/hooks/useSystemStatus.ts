'use client'

import { useMemo } from 'react'
import { useSSESystem, useSSE, type SystemSnapshot } from '@/hooks/useSSE'

// ── Types ──

export interface IssuerNode {
  id: number
  addr: string
  ip: string
  blsPubkeyShort: string
  status: number        // 0=inactive, 1=active, 2=suspended
  registeredAt: number
}

export interface RecentOrder {
  orderId: bigint
  user: string
  itpId: string
  side: number
  amount: bigint
  blockNumber: bigint
  blockTimestamp: number
  status: 'pending' | 'filled'
  fillTimeSeconds?: number
  fillCycle?: bigint
}

export interface FillTimeBucket {
  label: string   // e.g. "#3"
  seconds: number // fill time in seconds
}

export interface VaultAssetBar {
  symbol: string
  usdValue: number
}

export interface UseSystemStatusReturn {
  isHealthy: boolean
  activeIssuers: number
  totalIssuers: number
  totalOrders: number
  lastCycleNumber: number
  pendingOrders: number
  l3BlockNumber: bigint
  avgFillTimeSeconds: number
  nodes: IssuerNode[]
  recentOrders: RecentOrder[]
  fillTimeBuckets: FillTimeBucket[]
  topVaultAssets: VaultAssetBar[]
  vaultUsdValue: number
  isLoading: boolean
}

// ── Transform SSE snapshot to hook return types ──

function snapshotToState(snap: SystemSnapshot): Omit<UseSystemStatusReturn, 'isLoading'> {
  const nodes: IssuerNode[] = snap.nodes.map(n => ({
    id: n.id,
    addr: n.addr,
    ip: n.ip || '—',
    blsPubkeyShort: n.bls_pubkey_short || '—',
    status: n.status,
    registeredAt: n.registered_at,
  }))

  const recentOrders: RecentOrder[] = snap.recent_orders.map(o => ({
    orderId: BigInt(o.order_id),
    user: o.user,
    itpId: o.itp_id,
    side: o.side,
    amount: BigInt(o.amount),
    blockNumber: BigInt(o.block_number),
    blockTimestamp: o.block_timestamp,
    status: o.status,
    fillTimeSeconds: o.fill_time_seconds ?? undefined,
    fillCycle: o.fill_cycle != null ? BigInt(o.fill_cycle) : undefined,
  }))

  const fillTimeBuckets: FillTimeBucket[] = recentOrders
    .filter(o => o.status === 'filled' && o.fillTimeSeconds != null)
    .slice(0, 10)
    .reverse()
    .map(o => ({ label: `#${o.orderId.toString()}`, seconds: o.fillTimeSeconds! }))

  const topVaultAssets: VaultAssetBar[] = snap.vault_assets.map(a => ({
    symbol: a.symbol,
    usdValue: a.usd_value,
  }))

  return {
    isHealthy: snap.is_healthy,
    activeIssuers: snap.active_issuers,
    totalIssuers: snap.total_issuers,
    totalOrders: snap.total_orders,
    lastCycleNumber: snap.last_cycle_number,
    pendingOrders: snap.pending_orders,
    l3BlockNumber: BigInt(snap.l3_block_number),
    avgFillTimeSeconds: snap.avg_fill_time_seconds,
    nodes,
    recentOrders,
    fillTimeBuckets,
    topVaultAssets,
    vaultUsdValue: snap.vault_usd_total,
  }
}

const EMPTY_STATE: Omit<UseSystemStatusReturn, 'isLoading'> = {
  isHealthy: false,
  activeIssuers: 0,
  totalIssuers: 0,
  totalOrders: 0,
  lastCycleNumber: 0,
  pendingOrders: 0,
  l3BlockNumber: 0n,
  avgFillTimeSeconds: 0,
  nodes: [],
  recentOrders: [],
  fillTimeBuckets: [],
  topVaultAssets: [],
  vaultUsdValue: 0,
}

// ── Hook ──

export function useSystemStatus(): UseSystemStatusReturn {
  const snapshot = useSSESystem()
  const { connectionState: sseState } = useSSE()

  const derived = useMemo(
    () => (snapshot ? snapshotToState(snapshot) : EMPTY_STATE),
    [snapshot],
  )

  const isLoading = snapshot === null && sseState !== 'error'

  return { ...derived, isLoading }
}
