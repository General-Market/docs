/**
 * ABI for MockBitgetVault read functions.
 * Source: contracts/src/mocks/MockBitgetVault.sol
 */
export const MOCK_BITGET_VAULT_ABI = [
  {
    inputs: [
      { name: 'startIndex', type: 'uint256' },
      { name: 'count', type: 'uint256' },
    ],
    name: 'getTradeHistory',
    outputs: [
      {
        name: 'tradeList',
        type: 'tuple[]',
        components: [
          { name: 'tradeId', type: 'uint256' },
          { name: 'sellToken', type: 'address' },
          { name: 'buyToken', type: 'address' },
          { name: 'sellAmount', type: 'uint256' },
          { name: 'buyAmount', type: 'uint256' },
          { name: 'trader', type: 'address' },
          { name: 'timestamp', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'tradeId', type: 'uint256' }],
    name: 'getFill',
    outputs: [
      {
        name: 'trade',
        type: 'tuple',
        components: [
          { name: 'tradeId', type: 'uint256' },
          { name: 'sellToken', type: 'address' },
          { name: 'buyToken', type: 'address' },
          { name: 'sellAmount', type: 'uint256' },
          { name: 'buyAmount', type: 'uint256' },
          { name: 'trader', type: 'address' },
          { name: 'timestamp', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'tradeCount',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'feeBps',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'token', type: 'address' }],
    name: 'accumulatedFees',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalFeeRevenue',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const
