/**
 * Vision.sol ABI — matches hash-based contract (sourceId + configHash design).
 * Derived from IVision.sol interface after 3-round review fixes.
 */

export const VISION_ABI = [
  // ============ BATCH MANAGEMENT ============
  {
    inputs: [
      { name: 'sourceId', type: 'bytes32' },
      { name: 'configHash', type: 'bytes32' },
      { name: 'tickDuration', type: 'uint256' },
      { name: 'lockOffset', type: 'uint256' },
      { name: 'blsSignature', type: 'bytes' },
      { name: 'referenceNonce', type: 'uint256' },
      { name: 'signersBitmask', type: 'uint256' },
    ],
    name: 'createBatch',
    outputs: [{ name: 'batchId', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'sourceId', type: 'bytes32' },
      { name: 'configHash', type: 'bytes32' },
      { name: 'tickDuration', type: 'uint256' },
      { name: 'lockOffset', type: 'uint256' },
      { name: 'blsSignature', type: 'bytes' },
      { name: 'referenceNonce', type: 'uint256' },
      { name: 'signersBitmask', type: 'uint256' },
      { name: 'depositAmount', type: 'uint256' },
      { name: 'stakePerTick', type: 'uint256' },
      { name: 'bitmapHash', type: 'bytes32' },
    ],
    name: 'createBatchAndJoin',
    outputs: [{ name: 'batchId', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'batchId', type: 'uint256' },
      { name: 'configHash', type: 'bytes32' },
      { name: 'lockOffset', type: 'uint256' },
      { name: 'blsSignature', type: 'bytes' },
      { name: 'referenceNonce', type: 'uint256' },
      { name: 'signersBitmask', type: 'uint256' },
    ],
    name: 'updateBatchConfig',
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
          { name: 'sourceId', type: 'bytes32' },
          { name: 'configHash', type: 'bytes32' },
          { name: 'nextConfigHash', type: 'bytes32' },
          { name: 'tickDuration', type: 'uint256' },
          { name: 'lockOffset', type: 'uint256' },
          { name: 'nextLockOffset', type: 'uint256' },
          { name: 'createdAtTick', type: 'uint256' },
          { name: 'lastPromotionTick', type: 'uint256' },
          { name: 'paused', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'sourceId', type: 'bytes32' }],
    name: 'getBatchIdBySourceId',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'batchId', type: 'uint256' }],
    name: 'currentTickId',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'sourceId', type: 'bytes32' }],
    name: 'sourceIdToBatchId',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'sourceId', type: 'bytes32' }],
    name: 'sourceIdHasBatch',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },

  // ============ PLAYER OPERATIONS ============
  {
    inputs: [
      { name: 'batchId', type: 'uint256' },
      { name: 'configHash', type: 'bytes32' },
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
      { name: 'configHash', type: 'bytes32' },
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
          { name: 'configHash', type: 'bytes32' },
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
      { name: 'referenceNonce', type: 'uint256' },
      { name: 'signersBitmask', type: 'uint256' },
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
      { name: 'referenceNonce', type: 'uint256' },
      { name: 'signersBitmask', type: 'uint256' },
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
      { name: 'referenceNonce', type: 'uint256' },
      { name: 'signersBitmask', type: 'uint256' },
    ],
    name: 'forceWithdraw',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },

  // ============ METADATA ============
  {
    inputs: [
      { name: 'batchId', type: 'uint256' },
      { name: 'name', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'websiteUrl', type: 'string' },
      { name: 'videoUrl', type: 'string' },
      { name: 'imageUrl', type: 'string' },
    ],
    name: 'setBatchMetadata',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'batchId', type: 'uint256' }],
    name: 'getBatchMetadata',
    outputs: [
      { name: '', type: 'string' },
      { name: '', type: 'string' },
      { name: '', type: 'string' },
      { name: '', type: 'string' },
      { name: '', type: 'string' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'name', type: 'string' }],
    name: 'setDeployerName',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'deployer', type: 'address' }],
    name: 'getDeployerName',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
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
      { indexed: true, name: 'sourceId', type: 'bytes32' },
      { indexed: true, name: 'creator', type: 'address' },
      { indexed: false, name: 'configHash', type: 'bytes32' },
      { indexed: false, name: 'tickDuration', type: 'uint256' },
      { indexed: false, name: 'lockOffset', type: 'uint256' },
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
    inputs: [
      { indexed: true, name: 'batchId', type: 'uint256' },
      { indexed: false, name: 'configHash', type: 'bytes32' },
      { indexed: false, name: 'lockOffset', type: 'uint256' },
    ],
    name: 'BatchConfigUpdated',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'batchId', type: 'uint256' },
      { indexed: false, name: 'oldConfigHash', type: 'bytes32' },
      { indexed: false, name: 'newConfigHash', type: 'bytes32' },
      { indexed: false, name: 'tick', type: 'uint256' },
    ],
    name: 'BatchConfigPromoted',
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
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'batchId', type: 'uint256' },
      { indexed: true, name: 'creator', type: 'address' },
    ],
    name: 'BatchMetadataUpdated',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'deployer', type: 'address' },
      { indexed: false, name: 'name', type: 'string' },
    ],
    name: 'DeployerNameUpdated',
    type: 'event',
  },
] as const
