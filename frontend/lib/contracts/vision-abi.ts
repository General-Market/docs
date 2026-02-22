/**
 * Vision.sol ABI — derived from IVision.sol interface
 * Used for createBatch and other P2Pool contract interactions.
 */

export const VISION_ABI = [
  // ============ BATCH MANAGEMENT ============
  {
    inputs: [
      { name: 'marketIds', type: 'bytes32[]' },
      { name: 'resolutionTypes', type: 'uint8[]' },
      { name: 'tickDuration', type: 'uint256' },
      { name: 'customThresholds', type: 'uint256[]' },
    ],
    name: 'createBatch',
    outputs: [{ name: 'batchId', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'batchId', type: 'uint256' },
      { name: 'marketIds', type: 'bytes32[]' },
      { name: 'resolutionTypes', type: 'uint8[]' },
      { name: 'blsSig', type: 'bytes' },
    ],
    name: 'updateBatchMarkets',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'batchId', type: 'uint256' }],
    name: 'getBatch',
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'creator', type: 'address' },
          { name: 'marketIds', type: 'bytes32[]' },
          { name: 'resolutionTypes', type: 'uint8[]' },
          { name: 'tickDuration', type: 'uint256' },
          { name: 'customThresholds', type: 'uint256[]' },
          { name: 'createdAtTick', type: 'uint256' },
          { name: 'paused', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },

  // ============ PLAYER OPERATIONS ============
  {
    inputs: [
      { name: 'batchId', type: 'uint256' },
      { name: 'depositAmount', type: 'uint256' },
      { name: 'stakePerTick', type: 'uint256' },
      { name: 'bitmapHash', type: 'bytes32' },
    ],
    name: 'joinBatch',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'batchId', type: 'uint256' },
      { name: 'newBitmapHash', type: 'bytes32' },
    ],
    name: 'updateBitmap',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'batchId', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'deposit',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'batchId', type: 'uint256' },
      { name: 'fromTick', type: 'uint256' },
      { name: 'toTick', type: 'uint256' },
      { name: 'newBalance', type: 'uint256' },
      { name: 'blsSignature', type: 'bytes' },
    ],
    name: 'claimRewards',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'batchId', type: 'uint256' },
      { name: 'finalBalance', type: 'uint256' },
      { name: 'blsSignature', type: 'bytes' },
    ],
    name: 'withdraw',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'batchId', type: 'uint256' },
      { name: 'player', type: 'address' },
    ],
    name: 'getPosition',
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'bitmapHash', type: 'bytes32' },
          { name: 'stakePerTick', type: 'uint256' },
          { name: 'startTick', type: 'uint256' },
          { name: 'balance', type: 'uint256' },
          { name: 'lastClaimedTick', type: 'uint256' },
          { name: 'joinTimestamp', type: 'uint256' },
          { name: 'totalDeposited', type: 'uint256' },
          { name: 'totalClaimed', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },

  // ============ BOT REGISTRY ============
  {
    inputs: [
      { name: 'endpoint', type: 'string' },
      { name: 'pubkeyHash', type: 'bytes32' },
    ],
    name: 'registerBot',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'deregisterBot',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getAllActiveBots',
    outputs: [
      { name: '', type: 'address[]' },
      {
        name: '',
        type: 'tuple[]',
        components: [
          { name: 'endpoint', type: 'string' },
          { name: 'pubkeyHash', type: 'bytes32' },
          { name: 'stakedAmount', type: 'uint256' },
          { name: 'registeredAt', type: 'uint256' },
          { name: 'isActive', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },

  // ============ FEE MANAGEMENT ============
  {
    inputs: [],
    name: 'collectFees',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },

  // ============ ISSUER OPERATIONS ============
  {
    inputs: [
      { name: 'batchId', type: 'uint256' },
      { name: 'blsSignature', type: 'bytes' },
    ],
    name: 'pause',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'batchId', type: 'uint256' },
      { name: 'blsSignature', type: 'bytes' },
    ],
    name: 'unpause',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'batchId', type: 'uint256' },
      { name: 'player', type: 'address' },
      { name: 'finalBalance', type: 'uint256' },
      { name: 'blsSignature', type: 'bytes' },
    ],
    name: 'forceWithdraw',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },

  // ============ CONSTANTS / STATE ============
  {
    inputs: [],
    name: 'USDC',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'WIND',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'MIN_STAKE_PER_TICK',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'nextBatchId',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'accumulatedFees',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },

  // ============ EVENTS ============
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'batchId', type: 'uint256' },
      { indexed: true, name: 'creator', type: 'address' },
      { indexed: false, name: 'tickDuration', type: 'uint256' },
    ],
    name: 'BatchCreated',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'batchId', type: 'uint256' },
      { indexed: true, name: 'player', type: 'address' },
      { indexed: false, name: 'stakePerTick', type: 'uint256' },
      { indexed: false, name: 'bitmapHash', type: 'bytes32' },
    ],
    name: 'PlayerJoined',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'batchId', type: 'uint256' },
      { indexed: true, name: 'player', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
    ],
    name: 'PlayerDeposited',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'batchId', type: 'uint256' },
      { indexed: true, name: 'player', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
    ],
    name: 'RewardsClaimed',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'batchId', type: 'uint256' },
      { indexed: true, name: 'player', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
    ],
    name: 'PlayerWithdrawn',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'batchId', type: 'uint256' },
      { indexed: true, name: 'player', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
    ],
    name: 'ForceWithdrawn',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [{ indexed: true, name: 'batchId', type: 'uint256' }],
    name: 'BatchMarketsUpdated',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [{ indexed: true, name: 'batchId', type: 'uint256' }],
    name: 'BatchPausedEvent',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [{ indexed: true, name: 'batchId', type: 'uint256' }],
    name: 'BatchUnpaused',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'bot', type: 'address' },
      { indexed: false, name: 'endpoint', type: 'string' },
    ],
    name: 'BotRegistered',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [{ indexed: true, name: 'bot', type: 'address' }],
    name: 'BotDeregistered',
    type: 'event',
  },
] as const
