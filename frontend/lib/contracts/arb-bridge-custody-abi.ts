/**
 * ArbBridgeCustody.sol ABI — Arbitrum-side contract for cross-chain deposits to Vision.
 *
 * Users call depositToVision() on Arbitrum to lock USDC (6 dec).
 * Issuers observe the event and call Vision.creditBalance() on L3 (18 dec).
 * After crediting, issuers call completeVisionDeposit() to mark the order done.
 * If crediting fails, issuers can call refundVisionDeposit() to return USDC.
 */

export const ARB_BRIDGE_CUSTODY_ABI = [
  // ============ USER OPERATIONS ============
  {
    inputs: [{ name: 'usdcAmount', type: 'uint256' }],
    name: 'depositToVision',
    outputs: [{ name: 'orderId', type: 'bytes32' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },

  // ============ ISSUER OPERATIONS ============
  {
    inputs: [
      { name: 'orderId', type: 'bytes32' },
      { name: 'blsSignature', type: 'bytes' },
      { name: 'referenceNonce', type: 'uint256' },
      { name: 'signersBitmask', type: 'uint256' },
    ],
    name: 'completeVisionDeposit',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'orderId', type: 'bytes32' },
      { name: 'blsSignature', type: 'bytes' },
      { name: 'referenceNonce', type: 'uint256' },
      { name: 'signersBitmask', type: 'uint256' },
    ],
    name: 'refundVisionDeposit',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },

  // ============ READ ============
  {
    inputs: [{ name: 'orderId', type: 'bytes32' }],
    name: 'visionDeposits',
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'user', type: 'address' },
          { name: 'amount', type: 'uint256' },
          { name: 'timestamp', type: 'uint256' },
          { name: 'status', type: 'uint8' },
        ],
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },

  // ============ EVENTS ============
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'orderId', type: 'bytes32' },
      { indexed: true, name: 'user', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
    ],
    name: 'VisionDepositCreated',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'orderId', type: 'bytes32' },
    ],
    name: 'VisionDepositCompleted',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'orderId', type: 'bytes32' },
    ],
    name: 'VisionDepositRefunded',
    type: 'event',
  },
] as const
