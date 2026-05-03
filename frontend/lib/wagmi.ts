import { createConfig, http, fallback } from 'wagmi'
import { type Chain } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'
import { getExplorerBaseUrl } from '@/lib/utils/explorer'

// RPC URLs from environment.
// Browser always routes L3 and Settlement through same-origin proxies: avoids
// mixed-content on HTTPS and CORS failures on upstream RPCs that don't answer
// preflight (the L3 nginx, Sonic's public testnet RPC). SSR uses direct URLs.
// The browser path resolves to an absolute URL — mobile MetaMask refuses
// relative URLs in `wallet_addEthereumChain` and dies with a chain-switch error.
const envRpcUrl = typeof window !== 'undefined'
  ? `${window.location.origin}/api/settlement-rpc`
  : (process.env.NEXT_PUBLIC_RPC_URL || 'http://localhost:8546')
const envL3RpcUrl = typeof window !== 'undefined'
  ? `${window.location.origin}/api/rpc`
  : (process.env.NEXT_PUBLIC_L3_RPC_URL || 'http://localhost:8545')

// Chain definition — L3 (Index Orbit chain where Vision.sol lives)
export const indexL3: Chain = {
  id: Number(process.env.NEXT_PUBLIC_L3_CHAIN_ID) || Number(process.env.NEXT_PUBLIC_CHAIN_ID) || 111222333,
  name: 'Index L3',
  nativeCurrency: { name: 'General Market', symbol: 'GM', decimals: 18 },
  rpcUrls: {
    default: { http: [envL3RpcUrl] },
    public: { http: [envL3RpcUrl] },
  },
  blockExplorers: {
    default: { name: 'L3 Explorer', url: getExplorerBaseUrl('l3') || '' },
  },
  // No multicall3 declared: the canonical address is empty on this L3.
  // viem batches readContract through multicall3 when it sees one configured;
  // without a real contract there, batched calls return 0x and decoding dies
  // with "Cannot decode zero data". Individual eth_calls work fine.
  testnet: true,
}

// Chain definition — Settlement (for cross-chain deposits via SettlementBridgeCustody)
// Native currency and explorer are env-driven: Sonic testnet uses S, local Anvil uses ETH.
const settlementNativeName = process.env.NEXT_PUBLIC_SETTLEMENT_NATIVE_NAME || 'Sonic'
const settlementNativeSymbol = process.env.NEXT_PUBLIC_SETTLEMENT_NATIVE_SYMBOL || 'S'
const settlementExplorer = getExplorerBaseUrl('settlement')

export const settlementChain: Chain = {
  id: Number(process.env.NEXT_PUBLIC_SETTLEMENT_CHAIN_ID) || 421611337,
  name: process.env.NEXT_PUBLIC_SETTLEMENT_CHAIN_NAME || 'Sonic Testnet',
  nativeCurrency: { name: settlementNativeName, symbol: settlementNativeSymbol, decimals: 18 },
  rpcUrls: {
    default: { http: [envRpcUrl] },
    public: { http: [envRpcUrl] },
  },
  blockExplorers: {
    default: { name: 'Sonic Explorer', url: settlementExplorer },
  },
  testnet: true,
}

// RPC configuration with fallback support — L3
const l3RpcUrl = envL3RpcUrl
const l3FallbackRpcUrl = process.env.NEXT_PUBLIC_L3_RPC_FALLBACK_URL

// L3 has no multicall3 deployed (canonical address is empty). Without it,
// useReadContracts fans out one HTTP POST per call — 32 for a single vault
// page, more for the global lists. The orbit-proxy in front of the L3 chain
// doesn't pool keep-alive connections well and starts handing back 502s once
// a few requests arrive concurrently. JSON-RPC batching collapses the burst
// into a single POST containing a JSON array, which the proxy handles fine.
const L3_BATCH = { batchSize: 64, wait: 16 } as const

const l3Transport = l3FallbackRpcUrl
  ? fallback([
      http(l3RpcUrl, {
        batch: L3_BATCH,
        timeout: 5_000,
        retryCount: 2,
        retryDelay: 1_000
      }),
      http(l3FallbackRpcUrl, {
        batch: L3_BATCH,
        timeout: 5_000,
        retryCount: 2,
        retryDelay: 1_000
      })
    ])
  : http(l3RpcUrl, {
      batch: L3_BATCH,
      timeout: 10_000,
      retryCount: 3,
      retryDelay: 1_000
    })

// RPC configuration — Settlement
const rpcUrl = envRpcUrl
const fallbackRpcUrl = process.env.NEXT_PUBLIC_RPC_FALLBACK_URL

const settlementTransport = fallbackRpcUrl
  ? fallback([
      http(rpcUrl, {
        timeout: 5_000,
        retryCount: 2,
        retryDelay: 1_000
      }),
      http(fallbackRpcUrl, {
        timeout: 5_000,
        retryCount: 2,
        retryDelay: 1_000
      })
    ])
  : http(rpcUrl, {
      timeout: 10_000,
      retryCount: 3,
      retryDelay: 1_000
    })

// Multi-chain wagmi config: L3 (primary) + Settlement (for deposits)
export const wagmiConfig = createConfig({
  chains: [indexL3, settlementChain],
  connectors: [injected()],
  transports: {
    [indexL3.id]: l3Transport,
    [settlementChain.id]: settlementTransport,
  },
  ssr: true,
})

// Export the active chain for use in components (L3 is the primary chain)
export const activeChain = indexL3
export const activeChainId = indexL3.id
export const settlementChainId = settlementChain.id

// What the wallet stores must be **stable across sessions**. EIP-3085 lets a
// dapp rewrite the wallet's stored RPC URL for an existing chainId on every
// `wallet_addEthereumChain` call — and OKX (at least) appears to invalidate
// or desynchronise its per-chain nonce cache when the URL rotates underneath
// it. Result: the wallet's pre-flight builds a tx with a nonce ahead of what
// the (now-different) RPC reports as pending, and refuses with "Nonce too
// high. Please adjust the nonce and try again."
//
// The dapp can still use a proxy internally (cheaper, avoids mixed-content,
// dodges CORS), but the wallet must always see the same canonical public URL.
// Hard-code those here. They never change. They never carry an origin prefix.
const WALLET_RPC_URLS: Record<number, string> = {
  111222333: 'https://rpc.generalmarket.io/',
  421611337: 'https://rpc.testnet.soniclabs.com',
}

export function getWalletRpcUrls(chain: Chain): string[] {
  const canonical = WALLET_RPC_URLS[chain.id]
  if (canonical) return [canonical]
  // Fallback: use whatever the chain config has, but only if absolute.
  // Never hand the wallet a relative URL — wallets reject those and cache
  // the rejection.
  const raw = chain.rpcUrls.default.http[0]
  if (raw && /^https?:\/\//i.test(raw)) return [raw]
  return []
}

// One-time forced rewrite of the wallet's stored RPC URL. Bumped only when
// the canonical URL changes (chain migration, host swap). Wallets that hold
// a stale URL across the cutover would otherwise call the dead host on every
// signed tx — there is no DNS to redirect bare-IP RPCs and no way to read the
// wallet's stored URL to know it's stale. So we push the canonical URL once
// per browser, key on this version, and never again. The stability that OKX
// needs for its nonce cache survives because the rewrite fires exactly once.
//
// Bump on the next migration. Format: "YYYY-MM-DD-<slug>".
export const WALLET_RPC_REWRITE_VERSION = '2026-05-03-netcup'
const WALLET_RPC_REWRITE_LS_KEY = 'gm-wallet-rpc-rewrite-version'

/**
 * Force the wallet to adopt the canonical RPC URL for a given chain, exactly
 * once per browser per WALLET_RPC_REWRITE_VERSION. No-op if the version flag
 * is already set, if no provider is connected, or if the chain has no
 * canonical URL configured. Safe to call eagerly on connect and before every
 * write — subsequent calls return immediately.
 */
export async function ensureWalletRpcRefreshed(chain: Chain): Promise<void> {
  if (typeof window === 'undefined') return
  const provider = (window as any).ethereum
  if (!provider) return
  // localStorage may throw in restricted contexts (private mode, sandboxed
  // iframes). Treat any access failure as "not yet rewritten" and fall back
  // to no-op rather than crashing the connect flow.
  try {
    if (window.localStorage.getItem(WALLET_RPC_REWRITE_LS_KEY) === WALLET_RPC_REWRITE_VERSION) {
      return
    }
  } catch {
    return
  }
  const canonical = WALLET_RPC_URLS[chain.id]
  if (!canonical) return
  const chainIdHex = `0x${chain.id.toString(16)}`
  try {
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: chainIdHex,
        chainName: chain.name,
        nativeCurrency: chain.nativeCurrency,
        rpcUrls: [canonical],
        ...(chain.blockExplorers?.default ? {
          blockExplorerUrls: [chain.blockExplorers.default.url],
        } : {}),
      }],
    })
    try { window.localStorage.setItem(WALLET_RPC_REWRITE_LS_KEY, WALLET_RPC_REWRITE_VERSION) } catch { /* ignore */ }
  } catch {
    // Wallet refused or user dismissed. Leave the flag unset so the next
    // session retries. The user's tx will fail with the dead URL until they
    // approve, but the dapp keeps trying without further intervention.
  }
}

// ---------------------------------------------------------------------------
// L3-defaulting hook wrappers
// Use these instead of raw wagmi hooks so chain reads always target L3
// (or Settlement when explicitly overridden). This prevents reads from defaulting
// to whatever chain the wallet happens to be connected to.
// ---------------------------------------------------------------------------
import {
  usePublicClient as _usePublicClient,
  useReadContract as _useReadContract,
  useReadContracts as _useReadContracts,
  useBalance as _useBalance,
} from 'wagmi'
import type { UsePublicClientParameters, UseReadContractParameters, UseBalanceParameters } from 'wagmi'

/** usePublicClient defaulting to L3 */
export function useL3PublicClient(params?: UsePublicClientParameters) {
  return _usePublicClient({ chainId: indexL3.id, ...params })
}

/** useReadContract defaulting to L3 */
export function useL3ReadContract(params: UseReadContractParameters<any, any, any>) {
  return _useReadContract({ chainId: indexL3.id, ...params } as any)
}

/** useBalance defaulting to L3 */
export function useL3Balance(params: UseBalanceParameters) {
  return _useBalance({ chainId: indexL3.id, ...params })
}
