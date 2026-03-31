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
import { posthog } from '@/lib/posthog'

// ── System status types (previously in useSystemStatusSSE.ts) ──

export interface OracleNodeSSE {
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
  active_oracles: number
  total_oracles: number
  total_orders: number
  last_cycle_number: number
  pending_orders: number
  l3_block_number: number
  avg_fill_time_seconds: number
  nodes: OracleNodeSSE[]
  recent_orders: RecentOrderSSE[]
  vault_assets: VaultAssetSSE[]
  vault_usd_total: number
}

// ── Type definitions matching data-node chain_cache.rs ──

export interface NavSnapshot {
  itp_id: string
  name: string
  symbol: string
  nav_per_share: number
  total_supply: string
  aum_usd: number
  settlement_address: string | null
  vault_address: string | null
}

export interface OracleSnapshot {
  price: string
  last_updated: number
  last_cycle: number
  borrow_rate_ray: string
}

export interface UserBalances {
  usdc_l3: string
  usdc_settlement: string
  /** Per-ITP shares: itp_id hex -> balance string (wei) */
  itp_shares: Record<string, string>
  bridged_itp: string
  itp_nonce: number
  vision_balance: string
  native_gas_balance: string
  vault_shares: string
}

export interface UserAllowances {
  usdc_l3_to_index: string
  usdc_settlement_to_custody: string
  itp_to_morpho: string
  usdc_l3_to_vault: string
  usdc_l3_to_vision: string
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

export interface MorphoMarketSSE {
  market_id: string
  collateral_token: string
  loan_token: string
  irm: string
  total_supply_assets: string
  total_borrow_assets: string
  total_supply_shares: string
  total_borrow_shares: string
  borrow_rate_per_second: string
  lltv: string
  oracle: string
  last_update: number
}

export interface MorphoVaultSSE {
  total_assets: string
  total_supply: string
  name: string
  symbol: string
  decimals: number
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
  morphoMarkets: MorphoMarketSSE[]
  morphoVault: MorphoVaultSSE | null
  userBalances: UserBalances | null
  userAllowances: UserAllowances | null
  userOrders: UserOrder[]
  userPositions: Record<string, MorphoPositionSnapshot> | null
  userCostBasis: UserCostBasis | null
}

export interface SSEContextValue {
  data: SSEData
  connectionState: SSEConnectionState
}

// ── Per-slice contexts (prevents cross-topic re-render cascades) ──

const SSENavContext = createContext<NavSnapshot[]>([])
const SSEOracleContext = createContext<OracleSnapshot | null>(null)
const SSESystemContext = createContext<SystemSnapshot | null>(null)
const SSEMorphoMarketsContext = createContext<MorphoMarketSSE[]>([])
const SSEMorphoVaultContext = createContext<MorphoVaultSSE | null>(null)
const SSEUserBalancesContext = createContext<UserBalances | null>(null)
const SSEUserAllowancesContext = createContext<UserAllowances | null>(null)
const SSEUserOrdersContext = createContext<UserOrder[]>([])
const SSEUserPositionsContext = createContext<Record<string, MorphoPositionSnapshot> | null>(null)
const SSEUserCostBasisContext = createContext<UserCostBasis | null>(null)
const SSEConnectionContext = createContext<SSEConnectionState>('disconnected')

// ── SSEProvider ──

const MAX_BACKOFF_MS = 30_000
const BASE_DELAY_MS = 1_000

interface SSEProviderProps {
  children: ReactNode
  topics: string[]
  address?: string
}

export function SSEProvider({ children, topics, address }: SSEProviderProps) {
  const [itpNav, setItpNav] = useState<NavSnapshot[]>([])
  const [oraclePrices, setOraclePrices] = useState<OracleSnapshot | null>(null)
  const [systemStatus, setSystemStatus] = useState<SystemSnapshot | null>(null)
  const [morphoMarkets, setMorphoMarkets] = useState<MorphoMarketSSE[]>([])
  const [morphoVault, setMorphoVault] = useState<MorphoVaultSSE | null>(null)
  const [userBalances, setUserBalances] = useState<UserBalances | null>(null)
  const [userAllowances, setUserAllowances] = useState<UserAllowances | null>(null)
  const [userOrders, setUserOrders] = useState<UserOrder[]>([])
  const [userPositions, setUserPositions] = useState<Record<string, MorphoPositionSnapshot> | null>(null)
  const [userCostBasis, setUserCostBasis] = useState<UserCostBasis | null>(null)
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
      setUserBalances(null)
      setUserAllowances(null)
      setUserOrders([])
      setUserPositions(null)
      setUserCostBasis(null)
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
      const jitter = Math.random() * 1000
      return Math.min(BASE_DELAY_MS * Math.pow(2, attempt), MAX_BACKOFF_MS) + jitter
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

        let sseFirstEvent = true

        es.addEventListener('itp-nav', (event: MessageEvent) => {
          try {
            const parsed: NavSnapshot[] = JSON.parse(event.data)
            setItpNav(parsed)
            setConnectionState('connected')
            reconnectAttemptRef.current = 0
            if (sseFirstEvent) {
              sseFirstEvent = false
              posthog.capture('sse_connected', { topic: topicsKey })
            }
          } catch (e) { console.error('[SSEProvider] malformed SSE event:', e) }
        })

        es.addEventListener('itp-nav-delta', (event: MessageEvent) => {
          try {
            const delta: NavSnapshot[] = JSON.parse(event.data)
            setItpNav(prev => {
              const navMap = new Map(prev.map(s => [s.itp_id, s]))
              delta.forEach(s => navMap.set(s.itp_id, s))
              return Array.from(navMap.values())
            })
            setConnectionState('connected')
            reconnectAttemptRef.current = 0
          } catch (e) { console.error('[SSEProvider] malformed SSE event:', e) }
        })

        es.addEventListener('oracle-prices', (event: MessageEvent) => {
          try {
            const parsed: OracleSnapshot = JSON.parse(event.data)
            setOraclePrices(parsed)
            setConnectionState('connected')
            reconnectAttemptRef.current = 0
            if (sseFirstEvent) { sseFirstEvent = false; posthog.capture('sse_connected', { topic: topicsKey }) }
          } catch (e) { console.error('[SSEProvider] malformed SSE event:', e) }
        })

        es.addEventListener('system-status', (event: MessageEvent) => {
          try {
            const parsed: SystemSnapshot = JSON.parse(event.data)
            setSystemStatus(parsed)
            setConnectionState('connected')
            reconnectAttemptRef.current = 0
            if (sseFirstEvent) { sseFirstEvent = false; posthog.capture('sse_connected', { topic: topicsKey }) }
          } catch (e) { console.error('[SSEProvider] malformed SSE event:', e) }
        })

        es.addEventListener('morpho-markets', (event: MessageEvent) => {
          try {
            const parsed: MorphoMarketSSE[] = JSON.parse(event.data)
            setMorphoMarkets(parsed)
            setConnectionState('connected')
            reconnectAttemptRef.current = 0
            if (sseFirstEvent) { sseFirstEvent = false; posthog.capture('sse_connected', { topic: topicsKey }) }
          } catch (e) { console.error('[SSEProvider] malformed SSE event:', e) }
        })

        es.addEventListener('morpho-vault', (event: MessageEvent) => {
          try {
            const parsed: MorphoVaultSSE = JSON.parse(event.data)
            setMorphoVault(parsed)
            setConnectionState('connected')
            reconnectAttemptRef.current = 0
            if (sseFirstEvent) { sseFirstEvent = false; posthog.capture('sse_connected', { topic: topicsKey }) }
          } catch (e) { console.error('[SSEProvider] malformed SSE event:', e) }
        })

        es.addEventListener('user-balances', (event: MessageEvent) => {
          try {
            const parsed: UserBalances = JSON.parse(event.data)
            setUserBalances(parsed)
            setConnectionState('connected')
            reconnectAttemptRef.current = 0
            if (sseFirstEvent) { sseFirstEvent = false; posthog.capture('sse_connected', { topic: topicsKey }) }
          } catch (e) { console.error('[SSEProvider] malformed SSE event:', e) }
        })

        es.addEventListener('user-allowances', (event: MessageEvent) => {
          try {
            const parsed: UserAllowances = JSON.parse(event.data)
            setUserAllowances(parsed)
            setConnectionState('connected')
            reconnectAttemptRef.current = 0
            if (sseFirstEvent) { sseFirstEvent = false; posthog.capture('sse_connected', { topic: topicsKey }) }
          } catch (e) { console.error('[SSEProvider] malformed SSE event:', e) }
        })

        es.addEventListener('user-orders', (event: MessageEvent) => {
          try {
            const parsed: UserOrder[] = JSON.parse(event.data)
            setUserOrders(parsed)
            setConnectionState('connected')
            reconnectAttemptRef.current = 0
            if (sseFirstEvent) { sseFirstEvent = false; posthog.capture('sse_connected', { topic: topicsKey }) }
          } catch (e) { console.error('[SSEProvider] malformed SSE event:', e) }
        })

        es.addEventListener('user-positions', (event: MessageEvent) => {
          try {
            const parsed: Record<string, MorphoPositionSnapshot> = JSON.parse(event.data)
            setUserPositions(parsed)
            setConnectionState('connected')
            reconnectAttemptRef.current = 0
            if (sseFirstEvent) { sseFirstEvent = false; posthog.capture('sse_connected', { topic: topicsKey }) }
          } catch (e) { console.error('[SSEProvider] malformed SSE event:', e) }
        })

        es.addEventListener('user-cost-basis', (event: MessageEvent) => {
          try {
            const parsed: UserCostBasis = JSON.parse(event.data)
            setUserCostBasis(parsed)
            setConnectionState('connected')
            reconnectAttemptRef.current = 0
            if (sseFirstEvent) { sseFirstEvent = false; posthog.capture('sse_connected', { topic: topicsKey }) }
          } catch (e) { console.error('[SSEProvider] malformed SSE event:', e) }
        })

        es.onerror = () => {
          setConnectionState('error')
          posthog.capture('sse_disconnected', { topic: topicsKey, reconnect_attempt: reconnectAttemptRef.current })
          es.close()
          eventSourceRef.current = null

          const attempt = ++reconnectAttemptRef.current
          reconnectTimeoutRef.current = setTimeout(connect, backoffDelay(attempt))
        }
      } catch (e) {
        console.error('[SSEProvider] EventSource connection failed:', e)
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

  return (
    <SSEConnectionContext.Provider value={connectionState}>
    <SSENavContext.Provider value={itpNav}>
    <SSEOracleContext.Provider value={oraclePrices}>
    <SSESystemContext.Provider value={systemStatus}>
    <SSEMorphoMarketsContext.Provider value={morphoMarkets}>
    <SSEMorphoVaultContext.Provider value={morphoVault}>
    <SSEUserBalancesContext.Provider value={userBalances}>
    <SSEUserAllowancesContext.Provider value={userAllowances}>
    <SSEUserOrdersContext.Provider value={userOrders}>
    <SSEUserPositionsContext.Provider value={userPositions}>
    <SSEUserCostBasisContext.Provider value={userCostBasis}>
      {children}
    </SSEUserCostBasisContext.Provider>
    </SSEUserPositionsContext.Provider>
    </SSEUserOrdersContext.Provider>
    </SSEUserAllowancesContext.Provider>
    </SSEUserBalancesContext.Provider>
    </SSEMorphoVaultContext.Provider>
    </SSEMorphoMarketsContext.Provider>
    </SSESystemContext.Provider>
    </SSEOracleContext.Provider>
    </SSENavContext.Provider>
    </SSEConnectionContext.Provider>
  )
}

// ── Consumer hooks — each reads from its own context (no cross-topic re-renders) ──

export function useSSE(): SSEContextValue {
  const itpNav = useContext(SSENavContext)
  const oraclePrices = useContext(SSEOracleContext)
  const systemStatus = useContext(SSESystemContext)
  const morphoMarkets = useContext(SSEMorphoMarketsContext)
  const morphoVault = useContext(SSEMorphoVaultContext)
  const userBalances = useContext(SSEUserBalancesContext)
  const userAllowances = useContext(SSEUserAllowancesContext)
  const userOrders = useContext(SSEUserOrdersContext)
  const userPositions = useContext(SSEUserPositionsContext)
  const userCostBasis = useContext(SSEUserCostBasisContext)
  const connectionState = useContext(SSEConnectionContext)
  return {
    data: { itpNav, oraclePrices, systemStatus, morphoMarkets, morphoVault, userBalances, userAllowances, userOrders, userPositions, userCostBasis },
    connectionState,
  }
}

export function useSSENav(): NavSnapshot[] {
  return useContext(SSENavContext)
}

export function useSSEBalances(): UserBalances | null {
  return useContext(SSEUserBalancesContext)
}

export function useSSEAllowances(): UserAllowances | null {
  return useContext(SSEUserAllowancesContext)
}

export function useSSEOrders(): UserOrder[] {
  return useContext(SSEUserOrdersContext)
}

export function useSSEPositions(): Record<string, MorphoPositionSnapshot> | null {
  return useContext(SSEUserPositionsContext)
}

/** Look up a single market's position from the SSE positions map by market ID. */
export function useSSEPositionForMarket(marketId: string | undefined): MorphoPositionSnapshot | null {
  const positions = useContext(SSEUserPositionsContext)
  if (!marketId || !positions) return null
  return positions[marketId] ?? null
}

export function useSSECostBasis(): UserCostBasis | null {
  return useContext(SSEUserCostBasisContext)
}

export function useSSESystem(): SystemSnapshot | null {
  return useContext(SSESystemContext)
}

export function useSSEOracle(): OracleSnapshot | null {
  return useContext(SSEOracleContext)
}

export function useSSEMorphoMarkets(): MorphoMarketSSE[] {
  return useContext(SSEMorphoMarketsContext)
}

export function useSSEMorphoVault(): MorphoVaultSSE | null {
  return useContext(SSEMorphoVaultContext)
}

export function useSSEConnectionState(): SSEConnectionState {
  return useContext(SSEConnectionContext)
}
