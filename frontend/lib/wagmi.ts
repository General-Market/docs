import { createConfig, http, fallback } from 'wagmi'
import { type Chain } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'

// RPC URL from environment - defaults to localhost for local dev
const envRpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'http://localhost:8546'

// Chain definition — frontend connects to Arbitrum only; L3 bridging is backend-side
export const indexL3: Chain = {
  id: Number(process.env.NEXT_PUBLIC_CHAIN_ID) || 421611337,
  name: 'Index Arbitrum',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [envRpcUrl] },
    public: { http: [envRpcUrl] },
  },
  testnet: true,
}

// RPC configuration with fallback support
const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'http://localhost:8546'
const fallbackRpcUrl = process.env.NEXT_PUBLIC_RPC_FALLBACK_URL

// Build transport with fallback if configured
const chainTransport = fallbackRpcUrl
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

// Plain wagmi config with injected connector (MetaMask, etc.)
export const wagmiConfig = createConfig({
  chains: [indexL3],
  connectors: [injected()],
  transports: {
    [indexL3.id]: chainTransport,
  },
})

// Export the active chain for use in components
export const activeChain = indexL3
export const activeChainId = indexL3.id
