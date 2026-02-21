'use client'

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react'
import { DATA_NODE_URL } from '@/lib/config'

// ── System status types (previously in useSystemStatusSSE.ts) ──

export interface IssuerNodeSSE {
  id: number
  addr: string
  ip: string
  bls_pubkey_short: string
  status: number
  registered_at: number
}

export interface RecentOrderSSE {
  order_id: number
  user: string
  itp_id: string
  side: number
  amount: string
  block_number: number
  block_timestamp: number
  status: 'pending' | 'filled'
  fill_time_seconds: number | null
  fill_cycle: number | null
}

export interface VaultAssetSSE {
  symbol: string
  usd_value: number
}

export interface SystemSnapshot {
  is_healthy: boolean
  active_issuers: number
  total_issuers: number
  total_orders: number
  last_cycle_number: number
  pending_orders: number
  l3_block_number: number
  avg_fill_time_seconds: number
  nodes: IssuerNodeSSE[]
  recent_orders: RecentOrderSSE[]
  vault_assets: VaultAssetSSE[]
  vault_usd_total: number
}

// ── Type definitions matching data-node chain_cache.rs ──

export interface NavSnapshot {
  itp_id: string
  nav_per_share: number
  total_supply: string
  aum_usd: number
  arb_address: string | null
}

export interface OracleSnapshot {
  price: string
  last_updated: number
  last_cycle: number
  borrow_rate_ray: string
}

export interface UserBalances {
  usdc_l3: string
  usdc_arb: string
  itp_shares: string
  bridged_itp: string
  itp_nonce: number
}

export interface UserAllowances {
  usdc_l3_to_index: string
  usdc_arb_to_custody: string
  itp_to_morpho: string
}

export interface UserOrder {
  order_id: number
  user: string
  side: number
  amount: string
  limit_price: string
  itp_id: string
  timestamp: number
  status: number
  fill_price: string | null
  fill_amount: string | null
  fill_cycle: number | null
}

export interface MorphoPositionSnapshot {
  supply_shares: string
  borrow_shares: string
  collateral: string
}

export interface FillRecord {
  order_id: number
  side: number
  fill_price: string
  fill_amount: string
  limit_price: string
}

export interface UserCostBasis {
  total_cost: string
  total_shares_bought: string
  avg_cost_per_share: string
  total_sell_proceeds: string
  total_shares_sold: string
  realized_pnl: string
  fills: FillRecord[]
}

// ── SSE state ──

export type SSEConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error'

export interface SSEData {
  itpNav: NavSnapshot[]
  oraclePrices: OracleSnapshot | null
  systemStatus: SystemSnapshot | null
  userBalances: UserBalances | null
  userAllowances: UserAllowances | null
  userOrders: UserOrder[]
  userPositions: MorphoPositionSnapshot | null
  userCostBasis: UserCostBasis | null
}

export interface SSEContextValue {
  data: SSEData
  connectionState: SSEConnectionState
}

const INITIAL_DATA: SSEData = {
  itpNav: [],
  oraclePrices: null,
  systemStatus: null,
  userBalances: null,
  userAllowances: null,
  userOrders: [],
  userPositions: null,
  userCostBasis: null,
}

const SSEContext = createContext<SSEContextValue>({
  data: INITIAL_DATA,
  connectionState: 'disconnected',
})

// ── SSEProvider ──

const MAX_BACKOFF_MS = 30_000
const BASE_DELAY_MS = 1_000

interface SSEProviderProps {
  children: ReactNode
  topics: string[]
  address?: string
}

export function SSEProvider({ children, topics, address }: SSEProviderProps) {
  const [data, setData] = useState<SSEData>(INITIAL_DATA)
  const [connectionState, setConnectionState] = useState<SSEConnectionState>('disconnected')

  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptRef = useRef(0)

  // Stable serialised topics key for the effect dependency
  const topicsKey = useMemo(() => topics.slice().sort().join(','), [topics])

  // Reset user-specific data whenever address changes
  const prevAddressRef = useRef(address)
  useEffect(() => {
    if (prevAddressRef.current !== address) {
      prevAddressRef.current = address
      setData(prev => ({
        ...prev,
        userBalances: null,
        userAllowances: null,
        userOrders: [],
        userPositions: null,
        userCostBasis: null,
      }))
    }
  }, [address])

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
  }, [])

  useEffect(() => {
    function backoffDelay(attempt: number): number {
      return Math.min(BASE_DELAY_MS * Math.pow(2, attempt), MAX_BACKOFF_MS)
    }

    function connect() {
      cleanup()
      setConnectionState('connecting')

      // Build SSE URL
      const params = new URLSearchParams()
      params.set('topics', topicsKey)
      if (address) params.set('address', address)
      const url = `${DATA_NODE_URL}/sse/stream?${params.toString()}`

      try {
        const es = new EventSource(url)
        eventSourceRef.current = es

        // ── Event listeners for each topic ──

        es.addEventListener('itp-nav', (event: MessageEvent) => {
          try {
            const parsed: NavSnapshot[] = JSON.parse(event.data)
            setData(prev => ({ ...prev, itpNav: parsed }))
            setConnectionState('connected')
            reconnectAttemptRef.current = 0
          } catch { /* ignore malformed */ }
        })

        es.addEventListener('oracle-prices', (event: MessageEvent) => {
          try {
            const parsed: OracleSnapshot = JSON.parse(event.data)
            setData(prev => ({ ...prev, oraclePrices: parsed }))
            setConnectionState('connected')
            reconnectAttemptRef.current = 0
          } catch { /* ignore malformed */ }
        })

        es.addEventListener('system-status', (event: MessageEvent) => {
          try {
            const parsed: SystemSnapshot = JSON.parse(event.data)
            setData(prev => ({ ...prev, systemStatus: parsed }))
            setConnectionState('connected')
            reconnectAttemptRef.current = 0
          } catch { /* ignore malformed */ }
        })

        es.addEventListener('user-balances', (event: MessageEvent) => {
          try {
            const parsed: UserBalances = JSON.parse(event.data)
            setData(prev => ({ ...prev, userBalances: parsed }))
            setConnectionState('connected')
            reconnectAttemptRef.current = 0
          } catch { /* ignore malformed */ }
        })

        es.addEventListener('user-allowances', (event: MessageEvent) => {
          try {
            const parsed: UserAllowances = JSON.parse(event.data)
            setData(prev => ({ ...prev, userAllowances: parsed }))
            setConnectionState('connected')
            reconnectAttemptRef.current = 0
          } catch { /* ignore malformed */ }
        })

        es.addEventListener('user-orders', (event: MessageEvent) => {
          try {
            const parsed: UserOrder[] = JSON.parse(event.data)
            setData(prev => ({ ...prev, userOrders: parsed }))
            setConnectionState('connected')
            reconnectAttemptRef.current = 0
          } catch { /* ignore malformed */ }
        })

        es.addEventListener('user-positions', (event: MessageEvent) => {
          try {
            const parsed: MorphoPositionSnapshot = JSON.parse(event.data)
            setData(prev => ({ ...prev, userPositions: parsed }))
            setConnectionState('connected')
            reconnectAttemptRef.current = 0
          } catch { /* ignore malformed */ }
        })

        es.addEventListener('user-cost-basis', (event: MessageEvent) => {
          try {
            const parsed: UserCostBasis = JSON.parse(event.data)
            setData(prev => ({ ...prev, userCostBasis: parsed }))
            setConnectionState('connected')
            reconnectAttemptRef.current = 0
          } catch { /* ignore malformed */ }
        })

        es.onerror = () => {
          setConnectionState('error')
          es.close()
          eventSourceRef.current = null

          const attempt = ++reconnectAttemptRef.current
          reconnectTimeoutRef.current = setTimeout(connect, backoffDelay(attempt))
        }
      } catch {
        setConnectionState('error')
        const attempt = ++reconnectAttemptRef.current
        reconnectTimeoutRef.current = setTimeout(connect, backoffDelay(attempt))
      }
    }

    connect()

    // Pause SSE when tab is hidden, resume when visible
    function handleVisibility() {
      if (document.hidden) {
        cleanup()
        setConnectionState('disconnected')
      } else {
        reconnectAttemptRef.current = 0
        connect()
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      cleanup()
      setConnectionState('disconnected')
    }
  }, [topicsKey, address, cleanup])

  const value = useMemo<SSEContextValue>(
    () => ({ data, connectionState }),
    [data, connectionState],
  )

  return <SSEContext.Provider value={value}>{children}</SSEContext.Provider>
}

// ── Consumer hooks — one per data slice ──

export function useSSE(): SSEContextValue {
  return useContext(SSEContext)
}

export function useSSENav(): NavSnapshot[] {
  const { data } = useContext(SSEContext)
  return data.itpNav
}

export function useSSEBalances(): UserBalances | null {
  const { data } = useContext(SSEContext)
  return data.userBalances
}

export function useSSEAllowances(): UserAllowances | null {
  const { data } = useContext(SSEContext)
  return data.userAllowances
}

export function useSSEOrders(): UserOrder[] {
  const { data } = useContext(SSEContext)
  return data.userOrders
}

export function useSSEPositions(): MorphoPositionSnapshot | null {
  const { data } = useContext(SSEContext)
  return data.userPositions
}

export function useSSECostBasis(): UserCostBasis | null {
  const { data } = useContext(SSEContext)
  return data.userCostBasis
}

export function useSSESystem(): SystemSnapshot | null {
  const { data } = useContext(SSEContext)
  return data.systemStatus
}

export function useSSEOracle(): OracleSnapshot | null {
  const { data } = useContext(SSEContext)
  return data.oraclePrices
}

export function useSSEConnectionState(): SSEConnectionState {
  const { connectionState } = useContext(SSEContext)
  return connectionState
}
