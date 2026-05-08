// Minimal Vision + Vault ABIs. Only what the keeper touches.
// Source of truth: contracts/src/interfaces/IVision.sol, IVisionVault.sol.

export const VISION_ABI = [
  {
    type: 'function',
    name: 'getBatch',
    stateMutability: 'view',
    inputs: [{ name: 'batchId', type: 'uint256' }],
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
          { name: 'settlementGrace', type: 'uint256' },
          { name: 'createdAtTick', type: 'uint256' },
          { name: 'paused', type: 'bool' },
          { name: 'settled', type: 'bool' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'getPosition',
    stateMutability: 'view',
    inputs: [
      { name: 'batchId', type: 'uint256' },
      { name: 'player', type: 'address' },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'bitmapHash', type: 'bytes32' },
          { name: 'configHash', type: 'bytes32' },
          { name: 'joinTimestamp', type: 'uint256' },
          { name: 'totalDeposited', type: 'uint256' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'batchExpirationTime',
    stateMutability: 'view',
    inputs: [{ name: 'batchId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'claimRefundFor',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'batchId', type: 'uint256' },
      { name: 'player', type: 'address' },
    ],
    outputs: [],
  },
  {
    type: 'event',
    name: 'BatchCreated',
    inputs: [
      { name: 'batchId', type: 'uint256', indexed: true },
      { name: 'sourceId', type: 'bytes32', indexed: true },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'configHash', type: 'bytes32', indexed: false },
      { name: 'tickDuration', type: 'uint256', indexed: false },
      { name: 'lockOffset', type: 'uint256', indexed: false },
      { name: 'settlementGrace', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'PlayerJoined',
    inputs: [
      { name: 'batchId', type: 'uint256', indexed: true },
      { name: 'player', type: 'address', indexed: true },
      { name: 'deposit', type: 'uint256', indexed: false },
      { name: 'bitmapHash', type: 'bytes32', indexed: false },
      { name: 'configHash', type: 'bytes32', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'BatchSettled',
    inputs: [
      { name: 'batchId', type: 'uint256', indexed: true },
      { name: 'playerCount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'PlayerRefunded',
    inputs: [
      { name: 'batchId', type: 'uint256', indexed: true },
      { name: 'player', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const;

export const VISION_VAULT_ABI = [
  {
    type: 'function',
    name: 'refundStuckBatch',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'batchId', type: 'uint256' }],
    outputs: [],
  },
] as const;

export const VISION_VAULT_FACTORY_ABI = [
  {
    type: 'function',
    name: 'getAllVaults',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address[]' }],
  },
  {
    type: 'function',
    name: 'isRegisteredVault',
    stateMutability: 'view',
    inputs: [{ name: 'vault', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;
