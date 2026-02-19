/**
 * ABI definitions for smart contracts used by the frontend
 */

/**
 * AgiArenaCore contract ABI
 * Contract handles portfolio bets with off-chain JSON storage
 */
export const agiArenaCoreAbi = [
  // ============ Events ============
  {
    type: 'event',
    name: 'BetPlaced',
    inputs: [
      { name: 'betId', type: 'uint256', indexed: true },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'betHash', type: 'bytes32', indexed: false },
      { name: 'jsonStorageRef', type: 'string', indexed: false },
      { name: 'amount', type: 'uint256', indexed: false }
    ]
  },
  {
    type: 'event',
    name: 'BetMatched',
    inputs: [
      { name: 'betId', type: 'uint256', indexed: true },
      { name: 'filler', type: 'address', indexed: true },
      { name: 'fillAmount', type: 'uint256', indexed: false },
      { name: 'remaining', type: 'uint256', indexed: false }
    ]
  },
  {
    type: 'event',
    name: 'BetCancelled',
    inputs: [
      { name: 'betId', type: 'uint256', indexed: true },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'refundAmount', type: 'uint256', indexed: false }
    ]
  },

  // ============ Write Functions ============
  {
    type: 'function',
    name: 'placeBet',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'betHash', type: 'bytes32' },
      { name: 'jsonStorageRef', type: 'string' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: 'betId', type: 'uint256' }]
  },
  {
    type: 'function',
    name: 'matchBet',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'betId', type: 'uint256' },
      { name: 'fillAmount', type: 'uint256' }
    ],
    outputs: []
  },
  {
    type: 'function',
    name: 'cancelBet',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'betId', type: 'uint256' }],
    outputs: []
  },

  // ============ View Functions ============
  {
    type: 'function',
    name: 'getBetState',
    stateMutability: 'view',
    inputs: [{ name: 'betId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'betHash', type: 'bytes32' },
          { name: 'jsonStorageRef', type: 'string' },
          { name: 'amount', type: 'uint256' },
          { name: 'matchedAmount', type: 'uint256' },
          { name: 'creator', type: 'address' },
          { name: 'status', type: 'uint8' },
          { name: 'createdAt', type: 'uint256' }
        ]
      }
    ]
  },
  {
    type: 'function',
    name: 'getBetFills',
    stateMutability: 'view',
    inputs: [{ name: 'betId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple[]',
        components: [
          { name: 'filler', type: 'address' },
          { name: 'amount', type: 'uint256' },
          { name: 'filledAt', type: 'uint256' }
        ]
      }
    ]
  },
  {
    type: 'function',
    name: 'getBetFillCount',
    stateMutability: 'view',
    inputs: [{ name: 'betId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    type: 'function',
    name: 'nextBetId',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    type: 'function',
    name: 'USDC',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }]
  },
  {
    type: 'function',
    name: 'FEE_RECIPIENT',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }]
  },
  {
    type: 'function',
    name: 'PLATFORM_FEE_BPS',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }]
  }
] as const

/**
 * ERC20 ABI for USDC token interactions
 * Only includes functions needed for approve and allowance
 */
export const erc20Abi = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }]
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' }
    ],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }]
  },
  {
    type: 'function',
    name: 'symbol',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }]
  }
] as const

/**
 * Bet status enum matching contract BetStatus
 */
export enum BetStatus {
  Pending = 0,
  PartiallyMatched = 1,
  FullyMatched = 2,
  Cancelled = 3,
  Settling = 4,
  Settled = 5
}

/**
 * Bet struct type matching contract Bet struct
 */
export interface Bet {
  betHash: `0x${string}`
  jsonStorageRef: string
  amount: bigint
  matchedAmount: bigint
  creator: `0x${string}`
  status: BetStatus
  createdAt: bigint
}

/**
 * Fill struct type matching contract Fill struct
 */
export interface Fill {
  filler: `0x${string}`
  amount: bigint
  filledAt: bigint
}
