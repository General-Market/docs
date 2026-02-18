/**
 * Bridge to on-chain AgiArena operations via viem.
 *
 * Supports both live and dry-run modes. In dry-run mode, write operations
 * log their intent and return mocked data without touching the chain.
 * Read operations always go to the RPC regardless of mode.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  encodePacked,
  keccak256,
  type PublicClient,
  type WalletClient,
  type Address,
  type Hash,
  type Chain,
  type Transport,
} from 'viem'
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts'

// ---------------------------------------------------------------------------
// ABI definitions (mirrored from frontend/lib/contracts/abi.ts)
// ---------------------------------------------------------------------------

const agiArenaCoreAbi = [
  {
    type: 'function',
    name: 'placeBet',
    stateMutability: 'nonpayable' as const,
    inputs: [
      { name: 'betHash', type: 'bytes32' as const },
      { name: 'jsonStorageRef', type: 'string' as const },
      { name: 'amount', type: 'uint256' as const },
    ],
    outputs: [{ name: 'betId', type: 'uint256' as const }],
  },
  {
    type: 'function',
    name: 'matchBet',
    stateMutability: 'nonpayable' as const,
    inputs: [
      { name: 'betId', type: 'uint256' as const },
      { name: 'fillAmount', type: 'uint256' as const },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'cancelBet',
    stateMutability: 'nonpayable' as const,
    inputs: [{ name: 'betId', type: 'uint256' as const }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'getBetState',
    stateMutability: 'view' as const,
    inputs: [{ name: 'betId', type: 'uint256' as const }],
    outputs: [
      {
        name: '',
        type: 'tuple' as const,
        components: [
          { name: 'betHash', type: 'bytes32' as const },
          { name: 'jsonStorageRef', type: 'string' as const },
          { name: 'amount', type: 'uint256' as const },
          { name: 'matchedAmount', type: 'uint256' as const },
          { name: 'creator', type: 'address' as const },
          { name: 'status', type: 'uint8' as const },
          { name: 'createdAt', type: 'uint256' as const },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'nextBetId',
    stateMutability: 'view' as const,
    inputs: [],
    outputs: [{ name: '', type: 'uint256' as const }],
  },
] as const

const erc20Abi = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view' as const,
    inputs: [{ name: 'account', type: 'address' as const }],
    outputs: [{ name: '', type: 'uint256' as const }],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable' as const,
    inputs: [
      { name: 'spender', type: 'address' as const },
      { name: 'amount', type: 'uint256' as const },
    ],
    outputs: [{ name: '', type: 'bool' as const }],
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view' as const,
    inputs: [
      { name: 'owner', type: 'address' as const },
      { name: 'spender', type: 'address' as const },
    ],
    outputs: [{ name: '', type: 'uint256' as const }],
  },
] as const

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChainBridgeConfig {
  rpcUrl: string
  chainId: number
  privateKey?: string
  agiArenaCoreAddress: Address
  windTokenAddress: Address
  dryRun?: boolean
}

export interface OnChainBetState {
  betHash: `0x${string}`
  jsonStorageRef: string
  amount: bigint
  matchedAmount: bigint
  creator: Address
  status: number
  createdAt: bigint
}

export interface PlaceBetResult {
  txHash: Hash
  betId: bigint
}

export interface MatchBetResult {
  txHash: Hash
}

// ---------------------------------------------------------------------------
// Helper: compute bet hash
// ---------------------------------------------------------------------------

/**
 * Compute the keccak256 hash of encoded positions, matching the contract's
 * hashing scheme: keccak256(abi.encodePacked(marketId1, position1, ...))
 */
export function computeBetHash(
  positions: { marketId: string; position: string }[]
): `0x${string}` {
  // Build parallel arrays of types and values for encodePacked
  const types: ('string' | 'string')[] = []
  const values: string[] = []

  for (const pos of positions) {
    types.push('string', 'string')
    values.push(pos.marketId, pos.position)
  }

  const packed = encodePacked(
    types as readonly ('string')[],
    values as readonly string[]
  )
  return keccak256(packed)
}

// ---------------------------------------------------------------------------
// Chain bridge
// ---------------------------------------------------------------------------

export class ChainBridge {
  private readonly publicClient: PublicClient<Transport, Chain>
  private readonly walletClient: WalletClient | null
  private readonly account: PrivateKeyAccount | null
  private readonly coreAddress: Address
  private readonly windAddress: Address
  private readonly dryRun: boolean
  private readonly chain: Chain

  constructor(config: ChainBridgeConfig) {
    this.coreAddress = config.agiArenaCoreAddress
    this.windAddress = config.windTokenAddress
    this.dryRun = config.dryRun ?? false

    this.chain = {
      id: config.chainId,
      name: 'Index L3',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: {
        default: { http: [config.rpcUrl] },
      },
    } as const satisfies Chain

    this.publicClient = createPublicClient({
      chain: this.chain,
      transport: http(config.rpcUrl),
    }) as PublicClient<Transport, Chain>

    if (config.privateKey) {
      const key = config.privateKey.startsWith('0x')
        ? (config.privateKey as `0x${string}`)
        : (`0x${config.privateKey}` as `0x${string}`)
      this.account = privateKeyToAccount(key)
      this.walletClient = createWalletClient({
        account: this.account,
        chain: this.chain,
        transport: http(config.rpcUrl),
      })
    } else {
      this.account = null
      this.walletClient = null
    }
  }

  /** The signer address, or null if no private key was provided. */
  get signerAddress(): Address | null {
    return this.account?.address ?? null
  }

  // -----------------------------------------------------------------------
  // Read operations (always hit the chain)
  // -----------------------------------------------------------------------

  /** Read the WIND ERC-20 balance for an address (raw 18-decimal bigint). */
  async getWindBalance(address: string): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.windAddress,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [address as Address],
    })
  }

  /** Read on-chain bet state by ID. */
  async getBetState(betId: bigint): Promise<OnChainBetState> {
    const result = await this.publicClient.readContract({
      address: this.coreAddress,
      abi: agiArenaCoreAbi,
      functionName: 'getBetState',
      args: [betId],
    })

    return {
      betHash: result.betHash,
      jsonStorageRef: result.jsonStorageRef,
      amount: result.amount,
      matchedAmount: result.matchedAmount,
      creator: result.creator,
      status: result.status,
      createdAt: result.createdAt,
    }
  }

  /** Read the next bet ID that will be assigned by the contract. */
  async getNextBetId(): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.coreAddress,
      abi: agiArenaCoreAbi,
      functionName: 'nextBetId',
    })
  }

  // -----------------------------------------------------------------------
  // Write operations (dry-run aware)
  // -----------------------------------------------------------------------

  /**
   * Place a new bet on-chain.
   *
   * In dry-run mode, logs the intent and returns mocked data.
   */
  async placeBet(
    betHash: `0x${string}`,
    jsonStorageRef: string,
    amount: bigint
  ): Promise<PlaceBetResult> {
    if (this.dryRun) {
      console.log('[DRY RUN] placeBet:', {
        betHash,
        jsonStorageRef,
        amount: amount.toString(),
      })
      return {
        txHash: '0x' + '0'.repeat(64) as Hash,
        betId: 0n,
      }
    }

    this.requireWallet()

    // Ensure WIND allowance
    await this.ensureAllowance(amount)

    const { request } = await this.publicClient.simulateContract({
      account: this.account!,
      address: this.coreAddress,
      abi: agiArenaCoreAbi,
      functionName: 'placeBet',
      args: [betHash, jsonStorageRef, amount],
    })

    const txHash = await this.walletClient!.writeContract(request)
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash })

    // Parse betId from BetPlaced event log (first indexed topic after event sig)
    let betId = 0n
    for (const log of receipt.logs) {
      // BetPlaced event: betId is the first indexed param (topic[1])
      if (log.topics.length >= 2 && log.topics[1]) {
        betId = BigInt(log.topics[1])
        break
      }
    }

    return { txHash, betId }
  }

  /**
   * Match (fill) an existing bet on-chain.
   *
   * In dry-run mode, logs the intent and returns a mocked tx hash.
   */
  async matchBet(betId: bigint, fillAmount: bigint): Promise<MatchBetResult> {
    if (this.dryRun) {
      console.log('[DRY RUN] matchBet:', {
        betId: betId.toString(),
        fillAmount: fillAmount.toString(),
      })
      return { txHash: '0x' + '0'.repeat(64) as Hash }
    }

    this.requireWallet()

    // Ensure WIND allowance
    await this.ensureAllowance(fillAmount)

    const { request } = await this.publicClient.simulateContract({
      account: this.account!,
      address: this.coreAddress,
      abi: agiArenaCoreAbi,
      functionName: 'matchBet',
      args: [betId, fillAmount],
    })

    const txHash = await this.walletClient!.writeContract(request)
    await this.publicClient.waitForTransactionReceipt({ hash: txHash })

    return { txHash }
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  /** Ensure the AgiArenaCore contract has sufficient WIND allowance. */
  private async ensureAllowance(requiredAmount: bigint): Promise<void> {
    const currentAllowance = await this.publicClient.readContract({
      address: this.windAddress,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [this.account!.address, this.coreAddress],
    })

    if (currentAllowance >= requiredAmount) return

    // Approve max uint256 to avoid repeated approvals
    const maxApproval = 2n ** 256n - 1n

    const { request } = await this.publicClient.simulateContract({
      account: this.account!,
      address: this.windAddress,
      abi: erc20Abi,
      functionName: 'approve',
      args: [this.coreAddress, maxApproval],
    })

    const txHash = await this.walletClient!.writeContract(request)
    await this.publicClient.waitForTransactionReceipt({ hash: txHash })
    console.log(`[ChainBridge] WIND approval tx: ${txHash}`)
  }

  /** Throw if no wallet client is configured. */
  private requireWallet(): void {
    if (!this.walletClient || !this.account) {
      throw new ChainBridgeError(
        'No private key configured. Write operations require a private key.'
      )
    }
  }
}

// ---------------------------------------------------------------------------
// Custom error
// ---------------------------------------------------------------------------

export class ChainBridgeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ChainBridgeError'
  }
}
