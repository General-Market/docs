/**
 * Vision.sol ABI — round-based model.
 * Direct USDC in via joinBatchDirect(), direct USDC out via settleBatch().
 * No dual-balance, no claimRewards, no deposit/withdraw balance pool.
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
          { name: 'tickDuration', type: 'uint256' },
          { name: 'lockOffset', type: 'uint256' },
          { name: 'createdAtTick', type: 'uint256' },
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
    name: 'joinBatchDirect',
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
          { name: 'deposit', type: 'uint256' },
          { name: 'joinTimestamp', type: 'uint256' },
          { name: 'totalDeposited', type: 'uint256' },
          { name: 'totalClaimed', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },

  // ============ SETTLEMENT ============
  {
    inputs: [
      { name: 'batchId', type: 'uint256' },
      { name: 'players', type: 'address[]' },
      { name: 'payouts', type: 'uint256[]' },
      { name: 'blsSignature', type: 'bytes' },
      { name: 'referenceNonce', type: 'uint256' },
      { name: 'signersBitmask', type: 'uint256' },
    ],
    name: 'settleBatch',
    outputs: [],
    stateMutability: 'nonpayable',
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

  // ============ ADMIN ============
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
      { indexed: false, name: 'deposit', type: 'uint256' },
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
      { indexed: false, name: 'payout', type: 'uint256' },
    ],
    name: 'PlayerSettled',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'batchId', type: 'uint256' },
    ],
    name: 'BatchSettled',
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
