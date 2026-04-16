import { createConfig, http, fallback } from 'wagmi'
import { type Chain } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'
import { getExplorerBaseUrl } from '@/lib/utils/explorer'

// RPC URLs from environment.
// Browser always routes L3 through the same-origin /api/rpc proxy: avoids
// mixed-content on HTTPS and the upstream nginx's broken CORS preflight on
// HTTP. Server-side (SSR) uses the direct URL.
const envRpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'http://localhost:8546'
const envL3RpcUrl = typeof window !== 'undefined'
  ? '/api/rpc'
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

// RPC configuration — Settlement
const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'http://localhost:8546'
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
