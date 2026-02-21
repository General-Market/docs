/**
 * ABI definitions for Morpho Protocol contracts
 *
 * Based on:
 * - Morpho Blue (contracts/lib/morpho-blue/src/Morpho.sol)
 * - MetaMorpho (contracts/lib/metamorpho/src/MetaMorpho.sol)
 */

/**
 * Morpho Blue core contract ABI
 * Only includes functions needed for the lending frontend
 */
export const MORPHO_ABI = [
  // ============ Position Queries ============
  {
    inputs: [
      { name: 'id', type: 'bytes32' },
      { name: 'user', type: 'address' },
    ],
    name: 'position',
    outputs: [
      { name: 'supplyShares', type: 'uint256' },
      { name: 'borrowShares', type: 'uint128' },
      { name: 'collateral', type: 'uint128' },
    ],
    stateMutability: 'view',
    type: 'function',
  },

  // ============ Market Queries ============
  {
    inputs: [{ name: 'id', type: 'bytes32' }],
    name: 'market',
    outputs: [
      { name: 'totalSupplyAssets', type: 'uint128' },
      { name: 'totalSupplyShares', type: 'uint128' },
      { name: 'totalBorrowAssets', type: 'uint128' },
      { name: 'totalBorrowShares', type: 'uint128' },
      { name: 'lastUpdate', type: 'uint128' },
      { name: 'fee', type: 'uint128' },
    ],
    stateMutability: 'view',
    type: 'function',
  },

  // ============ Market Params ============
  {
    inputs: [{ name: 'id', type: 'bytes32' }],
    name: 'idToMarketParams',
    outputs: [
      { name: 'loanToken', type: 'address' },
      { name: 'collateralToken', type: 'address' },
      { name: 'oracle', type: 'address' },
      { name: 'irm', type: 'address' },
      { name: 'lltv', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },

  // ============ Supply Collateral ============
  {
    inputs: [
      {
        name: 'marketParams',
        type: 'tuple',
        components: [
          { name: 'loanToken', type: 'address' },
          { name: 'collateralToken', type: 'address' },
          { name: 'oracle', type: 'address' },
          { name: 'irm', type: 'address' },
          { name: 'lltv', type: 'uint256' },
        ],
      },
      { name: 'assets', type: 'uint256' },
      { name: 'onBehalf', type: 'address' },
      { name: 'data', type: 'bytes' },
    ],
    name: 'supplyCollateral',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },

  // ============ Withdraw Collateral ============
  {
    inputs: [
      {
        name: 'marketParams',
        type: 'tuple',
        components: [
          { name: 'loanToken', type: 'address' },
          { name: 'collateralToken', type: 'address' },
          { name: 'oracle', type: 'address' },
          { name: 'irm', type: 'address' },
          { name: 'lltv', type: 'uint256' },
        ],
      },
      { name: 'assets', type: 'uint256' },
      { name: 'onBehalf', type: 'address' },
      { name: 'receiver', type: 'address' },
    ],
    name: 'withdrawCollateral',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },

  // ============ Borrow ============
  {
    inputs: [
      {
        name: 'marketParams',
        type: 'tuple',
        components: [
          { name: 'loanToken', type: 'address' },
          { name: 'collateralToken', type: 'address' },
          { name: 'oracle', type: 'address' },
          { name: 'irm', type: 'address' },
          { name: 'lltv', type: 'uint256' },
        ],
      },
      { name: 'assets', type: 'uint256' },
      { name: 'shares', type: 'uint256' },
      { name: 'onBehalf', type: 'address' },
      { name: 'receiver', type: 'address' },
    ],
    name: 'borrow',
    outputs: [
      { name: 'assetsBorrowed', type: 'uint256' },
      { name: 'sharesBorrowed', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },

  // ============ Repay ============
  {
    inputs: [
      {
        name: 'marketParams',
        type: 'tuple',
        components: [
          { name: 'loanToken', type: 'address' },
          { name: 'collateralToken', type: 'address' },
          { name: 'oracle', type: 'address' },
          { name: 'irm', type: 'address' },
          { name: 'lltv', type: 'uint256' },
        ],
      },
      { name: 'assets', type: 'uint256' },
      { name: 'shares', type: 'uint256' },
      { name: 'onBehalf', type: 'address' },
      { name: 'data', type: 'bytes' },
    ],
    name: 'repay',
    outputs: [
      { name: 'assetsRepaid', type: 'uint256' },
      { name: 'sharesRepaid', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },

  // ============ Events ============
  {
    type: 'event',
    name: 'Borrow',
    inputs: [
      { name: 'id', type: 'bytes32', indexed: true },
      { name: 'caller', type: 'address', indexed: false },
      { name: 'onBehalf', type: 'address', indexed: true },
      { name: 'receiver', type: 'address', indexed: true },
      { name: 'assets', type: 'uint256', indexed: false },
      { name: 'shares', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Repay',
    inputs: [
      { name: 'id', type: 'bytes32', indexed: true },
      { name: 'caller', type: 'address', indexed: false },
      { name: 'onBehalf', type: 'address', indexed: true },
      { name: 'assets', type: 'uint256', indexed: false },
      { name: 'shares', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'SupplyCollateral',
    inputs: [
      { name: 'id', type: 'bytes32', indexed: true },
      { name: 'caller', type: 'address', indexed: false },
      { name: 'onBehalf', type: 'address', indexed: true },
      { name: 'assets', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'WithdrawCollateral',
    inputs: [
      { name: 'id', type: 'bytes32', indexed: true },
      { name: 'caller', type: 'address', indexed: false },
      { name: 'onBehalf', type: 'address', indexed: true },
      { name: 'receiver', type: 'address', indexed: false },
      { name: 'assets', type: 'uint256', indexed: false },
    ],
  },

  // ============ Accrue Interest ============
  {
    inputs: [
      {
        name: 'marketParams',
        type: 'tuple',
        components: [
          { name: 'loanToken', type: 'address' },
          { name: 'collateralToken', type: 'address' },
          { name: 'oracle', type: 'address' },
          { name: 'irm', type: 'address' },
          { name: 'lltv', type: 'uint256' },
        ],
      },
    ],
    name: 'accrueInterest',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

/**
 * MetaMorpho Vault ABI (ERC4626)
 * For USDC lenders to deposit and earn yield
 */
export const METAMORPHO_VAULT_ABI = [
  // ============ ERC4626 Standard ============
  {
    inputs: [],
    name: 'asset',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalAssets',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'assets', type: 'uint256' }],
    name: 'convertToShares',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'shares', type: 'uint256' }],
    name: 'convertToAssets',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'receiver', type: 'address' }],
    name: 'maxDeposit',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'maxWithdraw',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'assets', type: 'uint256' }],
    name: 'previewDeposit',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'shares', type: 'uint256' }],
    name: 'previewWithdraw',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },

  // ============ Deposit ============
  {
    inputs: [
      { name: 'assets', type: 'uint256' },
      { name: 'receiver', type: 'address' },
    ],
    name: 'deposit',
    outputs: [{ name: 'shares', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },

  // ============ Withdraw ============
  {
    inputs: [
      { name: 'assets', type: 'uint256' },
      { name: 'receiver', type: 'address' },
      { name: 'owner', type: 'address' },
    ],
    name: 'withdraw',
    outputs: [{ name: 'shares', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },

  // ============ Redeem ============
  {
    inputs: [
      { name: 'shares', type: 'uint256' },
      { name: 'receiver', type: 'address' },
      { name: 'owner', type: 'address' },
    ],
    name: 'redeem',
    outputs: [{ name: 'assets', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },

  // ============ Balance Queries ============
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },

  // ============ Allowance ============
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },

  // ============ ERC20 Metadata ============
  {
    inputs: [],
    name: 'name',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

