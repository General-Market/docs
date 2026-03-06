import { createConfig, http, fallback } from 'wagmi'
import { type Chain } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'

// RPC URLs from environment
// On HTTPS pages, browser blocks HTTP RPC (mixed content).
// Use /rpc proxy (Next.js rewrite → L3 RPC) when running in browser on HTTPS.
const envRpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'http://localhost:8546'
const rawL3RpcUrl = process.env.NEXT_PUBLIC_L3_RPC_URL || 'http://localhost:8545'
const envL3RpcUrl = typeof window !== 'undefined' && window.location?.protocol === 'https:'
  ? '/rpc'
  : rawL3RpcUrl

// Chain definition — L3 (Index Orbit chain where Vision.sol lives)
export const indexL3: Chain = {
  id: Number(process.env.NEXT_PUBLIC_L3_CHAIN_ID) || Number(process.env.NEXT_PUBLIC_CHAIN_ID) || 111222333,
  name: 'Index L3',
  nativeCurrency: { name: 'General Market', symbol: 'GM', decimals: 18 },
  rpcUrls: {
    default: { http: [envL3RpcUrl] },
    public: { http: [envL3RpcUrl] },
  },
  testnet: true,
}

// Chain definition — Arbitrum (for cross-chain deposits via ArbBridgeCustody)
export const arbitrumChain: Chain = {
  id: Number(process.env.NEXT_PUBLIC_ARB_CHAIN_ID) || 421611337,
  name: 'Index Arbitrum',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [envRpcUrl] },
    public: { http: [envRpcUrl] },
  },
  testnet: true,
}

// RPC configuration with fallback support — L3
const l3RpcUrl = envL3RpcUrl
const l3FallbackRpcUrl = process.env.NEXT_PUBLIC_L3_RPC_FALLBACK_URL

const l3Transport = l3FallbackRpcUrl
  ? fallback([
      http(l3RpcUrl, {
        timeout: 5_000,
        retryCount: 2,
        retryDelay: 1_000
      }),
      http(l3FallbackRpcUrl, {
        timeout: 5_000,
        retryCount: 2,
        retryDelay: 1_000
      })
    ])
  : http(l3RpcUrl, {
      timeout: 10_000,
      retryCount: 3,
      retryDelay: 1_000
    })

// RPC configuration — Arbitrum
const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'http://localhost:8546'
const fallbackRpcUrl = process.env.NEXT_PUBLIC_RPC_FALLBACK_URL

const arbTransport = fallbackRpcUrl
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

// Multi-chain wagmi config: L3 (primary) + Arbitrum (for deposits)
export const wagmiConfig = createConfig({
  chains: [indexL3, arbitrumChain],
  connectors: [injected()],
  transports: {
    [indexL3.id]: l3Transport,
    [arbitrumChain.id]: arbTransport,
  },
  ssr: true,
})

// Export the active chain for use in components (L3 is the primary chain)
export const activeChain = indexL3
export const activeChainId = indexL3.id
export const arbChainId = arbitrumChain.id

// ---------------------------------------------------------------------------
// L3-defaulting hook wrappers
// Use these instead of raw wagmi hooks so chain reads always target L3
// (or Arb when explicitly overridden). This prevents reads from defaulting
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
