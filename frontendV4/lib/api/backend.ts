const BASE_URL = process.env.NEXT_PUBLIC_DATA_NODE_URL || 'http://localhost:8200'

export interface UserState {
  usdc_balance: string
  usdc_allowance_custody: string
  usdc_allowance_morpho: string
  bridged_itp_address: string
  bridged_itp_balance: string
  bridged_itp_allowance_custody: string
  bridged_itp_allowance_morpho: string
  bridged_itp_name: string
  bridged_itp_symbol: string
  bridged_itp_total_supply: string
}

export interface MorphoPosition {
  collateral: string
  borrow_shares: string
  debt_amount: string
  oracle_price: string
  health_factor: string
  max_borrow: string
  max_withdraw: string
  market: {
    total_supply_assets: string
    total_supply_shares: string
    total_borrow_assets: string
    total_borrow_shares: string
  }
}

export interface OrderFill {
  fill_price: string
  fill_amount: string
  cycle_number: string
}

export interface OrderData {
  id: number
  user: string
  side: number
  amount: string
  limit_price: string
  itp_id: string
  timestamp: string
  status: number
  fill: OrderFill | null
}

export interface VaultAsset {
  address: string
  symbol: string
  balance: string
  price: string
  usd_value: number
}

export interface VaultBalances {
  assets: VaultAsset[]
  total_usd: number
  token_count: number
}

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export async function fetchUserState(user: string, itpId: string): Promise<UserState | null> {
  return fetchJson<UserState>(`/user-state?user=${user}&itp_id=${itpId}`)
}

export async function fetchMorphoPosition(user: string): Promise<MorphoPosition | null> {
  return fetchJson<MorphoPosition>(`/morpho-position?user=${user}`)
}

export async function fetchOrder(orderId: bigint): Promise<OrderData | null> {
  return fetchJson<OrderData>(`/order?id=${orderId.toString()}`)
}

export async function fetchVaultBalances(): Promise<VaultBalances | null> {
  return fetchJson<VaultBalances>(`/vault-balances`)
}
