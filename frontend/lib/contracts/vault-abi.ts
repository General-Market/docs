/**
 * VisionVault.sol + VisionVaultFactory.sol ABIs
 * Managed vaults — async deposit/redeem (ERC-7540 style), manager-driven batch allocation.
 */

export const VISION_VAULT_ABI = [
  // ── View ──
  {
    type: 'function',
    name: 'name',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'symbol',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'decimals',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'asset',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'manager',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'performanceFeeRate',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'highWaterMark',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalAssets',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalActiveCapital',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'idleUSDC',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalSupply',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'convertToShares',
    inputs: [{ name: 'assets', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'convertToAssets',
    inputs: [{ name: 'shares', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'pendingDepositRequest',
    inputs: [
      { name: '', type: 'uint256' },
      { name: 'controller', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'pendingRedeemRequest',
    inputs: [
      { name: '', type: 'uint256' },
      { name: 'controller', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },

  // ── Write ──
  {
    type: 'function',
    name: 'requestDeposit',
    inputs: [
      { name: 'assets', type: 'uint256' },
      { name: 'controller', type: 'address' },
      { name: 'owner', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'claimDeposit',
    inputs: [
      { name: 'receiver', type: 'address' },
      { name: 'controller', type: 'address' },
    ],
    outputs: [{ name: 'shares', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'requestRedeem',
    inputs: [
      { name: 'shares', type: 'uint256' },
      { name: 'controller', type: 'address' },
      { name: 'owner', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'claimRedeem',
    inputs: [
      { name: 'receiver', type: 'address' },
      { name: 'controller', type: 'address' },
    ],
    outputs: [{ name: 'assets', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'reconcile',
    inputs: [
      { name: 'batchId', type: 'uint256' },
      { name: 'settlementPayout', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },

  // ── Events ──
  {
    type: 'event',
    name: 'DepositRequest',
    inputs: [
      { name: 'controller', type: 'address', indexed: true },
      { name: 'owner', type: 'address', indexed: true },
      { name: 'requestId', type: 'uint256', indexed: false },
      { name: 'sender', type: 'address', indexed: false },
      { name: 'assets', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'DepositClaimed',
    inputs: [
      { name: 'receiver', type: 'address', indexed: true },
      { name: 'assets', type: 'uint256', indexed: false },
      { name: 'shares', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'RedeemRequest',
    inputs: [
      { name: 'controller', type: 'address', indexed: true },
      { name: 'owner', type: 'address', indexed: true },
      { name: 'requestId', type: 'uint256', indexed: false },
      { name: 'sender', type: 'address', indexed: false },
      { name: 'shares', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'WithdrawClaimed',
    inputs: [
      { name: 'receiver', type: 'address', indexed: true },
      { name: 'assets', type: 'uint256', indexed: false },
      { name: 'shares', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Reconciled',
    inputs: [
      { name: 'batchId', type: 'uint256', indexed: true },
      { name: 'pnl', type: 'int256', indexed: false },
      { name: 'feeSharesMinted', type: 'uint256', indexed: false },
      { name: 'withdrawalsFulfilled', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'BatchJoined',
    inputs: [
      { name: 'batchId', type: 'uint256', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },

  // ── Errors ──
  { type: 'error', name: 'NotManager', inputs: [] },
  { type: 'error', name: 'NothingToClaim', inputs: [] },
  { type: 'error', name: 'InsufficientIdleCapital', inputs: [] },
  { type: 'error', name: 'BatchAlreadyReconciled', inputs: [] },
] as const

export const VISION_VAULT_FACTORY_ABI = [
  {
    type: 'function',
    name: 'MAX_PERFORMANCE_FEE',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'createVault',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'symbol', type: 'string' },
      { name: 'performanceFeeRate', type: 'uint256' },
      { name: 'manager', type: 'address' },
    ],
    outputs: [{ name: 'vault', type: 'address' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getAllVaults',
    inputs: [],
    outputs: [{ name: '', type: 'address[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getVaultCount',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getVaultsByManager',
    inputs: [{ name: 'manager', type: 'address' }],
    outputs: [{ name: '', type: 'address[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'implementation',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isRegisteredVault',
    inputs: [{ name: 'vault', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'usdc',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'vision',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'VaultCreated',
    inputs: [
      { name: 'vault', type: 'address', indexed: true },
      { name: 'manager', type: 'address', indexed: true },
      { name: 'name', type: 'string', indexed: false },
      { name: 'symbol', type: 'string', indexed: false },
      { name: 'performanceFeeRate', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
  { type: 'error', name: 'FailedDeployment', inputs: [] },
  { type: 'error', name: 'FeeTooHigh', inputs: [] },
  {
    type: 'error',
    name: 'InsufficientBalance',
    inputs: [
      { name: 'balance', type: 'uint256' },
      { name: 'needed', type: 'uint256' },
    ],
  },
] as const
