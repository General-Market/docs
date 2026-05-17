import { defineChain } from 'viem'

export const L3_CHAIN_ID = 111_222_333

export const L3 = defineChain({
  id: L3_CHAIN_ID,
  name: 'Index L3',
  nativeCurrency: { name: 'GM', symbol: 'GM', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.generalmarket.io/'] },
  },
})

// All lowercase to bypass viem's EIP-55 checksum check. viem accepts
// all-lower or all-upper or properly-checksummed; mixed-case must match.
// Morpho/MetaMorpho can be overridden via env to swap stacks if the live
// deployment moves.
export const ADDR = {
  Index: (process.env.INDEX_ADDR ?? '0x3eb3bbbad5aa815d408fc06fb44ff2011b99c4ba').toLowerCase() as `0x${string}`,
  USDC: (process.env.USDC_ADDR ?? '0xaddb799bc1499b224dc4368e92b9042a54908553').toLowerCase() as `0x${string}`,
  Morpho: (process.env.MORPHO_ADDR ?? '0x315d11f6a9e586d67a9621db47448f0bcc5e9389').toLowerCase() as `0x${string}`,
  MetaMorphoUSDC: (process.env.METAMORPHO_ADDR ?? '0x5ac44c5078ecd210a603b066e888484f067212d2').toLowerCase() as `0x${string}`,
} as const

// Default to the public frontend proxy (works from anywhere). VPS-internal hosts
// can override via DATA_NODE_URL=https://api.generalmarket.io/data-node.
export const DATA_NODE_URL = process.env.DATA_NODE_URL ?? 'https://generalmarket.io/api/dn'

export const TICK_INTERVAL_MS = 4 * 60 * 1000
export const TICK_JITTER_MS = 60 * 1000

export const HEALTH_PORT = Number(process.env.HEALTH_PORT ?? 8090)

export const KEYS_PATH = process.env.KEYS_PATH ?? './keys.json'
export const KEYRING_SIZE = Number(process.env.KEYRING_SIZE ?? 5)

export const DRY_RUN = process.argv.includes('--dry-run')

export const BUY_USDC_MIN = 5
export const BUY_USDC_MAX = 50
export const LEND_USDC_MIN = 1
export const LEND_USDC_MAX = 20

// Comma-separated extra Morpho marketIds the bot should consider for borrow,
// on top of whatever the data-node SSE returns. Used to surface markets the
// SSE pipeline hasn't picked up (or to override phantom ones).
export const EXTRA_MORPHO_MARKETS = (process.env.EXTRA_MORPHO_MARKETS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter((s): s is `0x${string}` => /^0x[0-9a-fA-F]{64}$/.test(s)) as `0x${string}`[]
