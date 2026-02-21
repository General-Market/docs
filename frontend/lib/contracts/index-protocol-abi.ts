/**
 * ABI definitions for Index Protocol contracts
 * Based on actual BridgeProxy.sol contract
 */

// BridgeProxy ABI - for creating ITPs via bridge
export const BRIDGE_PROXY_ABI = [
  // Request ITP creation (user calls this)
  {
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'symbol', type: 'string' },
      { name: 'weights', type: 'uint256[]' },
      { name: 'assets', type: 'address[]' },
      { name: 'prices', type: 'uint256[]' },
      {
        name: 'metadata',
        type: 'tuple',
        components: [
          { name: 'description', type: 'string' },
          { name: 'websiteUrl', type: 'string' },
          { name: 'videoUrl', type: 'string' },
        ],
      },
    ],
    name: 'requestCreateItp',
    outputs: [{ name: 'nonce', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Get pending creation details
  {
    inputs: [{ name: 'nonce', type: 'uint256' }],
    name: 'getPendingCreation',
    outputs: [
      { name: 'admin', type: 'address' },
      { name: 'name', type: 'string' },
      { name: 'symbol', type: 'string' },
      { name: 'weights', type: 'uint256[]' },
      { name: 'assets', type: 'address[]' },
      { name: 'prices', type: 'uint256[]' },
      { name: 'createdAt', type: 'uint64' },
      { name: 'completed', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  // Check if pending
  {
    inputs: [{ name: 'nonce', type: 'uint256' }],
    name: 'isPending',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Next creation nonce
  {
    inputs: [],
    name: 'nextCreationNonce',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Signer threshold
  {
    inputs: [],
    name: 'signerThreshold',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Get admin nonce
  {
    inputs: [{ name: 'admin', type: 'address' }],
    name: 'getAdminItpCreationNonce',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Constants
  {
    inputs: [],
    name: 'MAX_ASSETS',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'MIN_WEIGHT',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'WEIGHT_SUM',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Get Arbitrum bridged ITP address from orbit ITP ID
  {
    inputs: [{ name: 'orbitItpId', type: 'bytes32' }],
    name: 'orbitToArbitrum',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Get orbit ITP ID from Arbitrum bridged ITP address
  {
    inputs: [{ name: 'bridgedItp', type: 'address' }],
    name: 'getOrbitItpId',
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Get BridgedItpFactory address
  {
    inputs: [],
    name: 'bridgedItpFactory',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  // requestRebalance (permissionless, event-only)
  {
    inputs: [
      { name: 'itpId', type: 'bytes32' },
      { name: 'removeIndices', type: 'uint256[]' },
      { name: 'addAssets', type: 'address[]' },
      { name: 'newWeights', type: 'uint256[]' },
      { name: 'note', type: 'string' },
    ],
    name: 'requestRebalance',
    outputs: [{ name: 'nonce', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'admin', type: 'address' },
      { indexed: true, name: 'nonce', type: 'uint256' },
      { indexed: false, name: 'name', type: 'string' },
      { indexed: false, name: 'symbol', type: 'string' },
      { indexed: false, name: 'weights', type: 'uint256[]' },
      { indexed: false, name: 'assets', type: 'address[]' },
    ],
    name: 'CreateItpRequested',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'orbitItpId', type: 'bytes32' },
      { indexed: true, name: 'bridgedItpAddress', type: 'address' },
      { indexed: true, name: 'nonce', type: 'uint256' },
      { indexed: false, name: 'admin', type: 'address' },
    ],
    name: 'ItpCreated',
    type: 'event',
  },
  // Set ITP metadata (deployer-only)
  {
    inputs: [
      { name: 'itpId', type: 'bytes32' },
      { name: 'description', type: 'string' },
      { name: 'websiteUrl', type: 'string' },
      { name: 'videoUrl', type: 'string' },
    ],
    name: 'setItpMetadata',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Get ITP metadata
  {
    inputs: [{ name: 'itpId', type: 'bytes32' }],
    name: 'getItpMetadata',
    outputs: [
      { name: 'description', type: 'string' },
      { name: 'websiteUrl', type: 'string' },
      { name: 'videoUrl', type: 'string' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  // ItpMetadataUpdated event
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'itpId', type: 'bytes32' },
      { indexed: true, name: 'deployer', type: 'address' },
      { indexed: false, name: 'description', type: 'string' },
      { indexed: false, name: 'websiteUrl', type: 'string' },
      { indexed: false, name: 'videoUrl', type: 'string' },
    ],
    name: 'ItpMetadataUpdated',
    type: 'event',
  },
  // Set deployer display name
  {
    inputs: [{ name: 'name', type: 'string' }],
    name: 'setDeployerName',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Get deployer display name
  {
    inputs: [{ name: 'deployer', type: 'address' }],
    name: 'getDeployerName',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Get ITP deployer address
  {
    inputs: [{ name: 'itpId', type: 'bytes32' }],
    name: 'itpDeployer',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

// ArbBridgeCustody ABI - for buying ITPs from Arbitrum
export const ARB_CUSTODY_ABI = [
  // Buy ITP from Arbitrum (requires USDC approval first)
  {
    inputs: [
      { name: 'itpId', type: 'bytes32' },
      { name: 'usdcAmount', type: 'uint256' },
      { name: 'limitPrice', type: 'uint256' },
      { name: 'slippageTier', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
    name: 'buyITPFromArbitrum',
    outputs: [{ name: 'orderId', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Get next order ID
  {
    inputs: [],
    name: 'nextOrderId',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // CrossChainOrderCreated event
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'orderId', type: 'uint256' },
      { indexed: true, name: 'itpId', type: 'bytes32' },
      { indexed: true, name: 'user', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
    ],
    name: 'CrossChainOrderCreated',
    type: 'event',
  },
  // Get cross-chain order details
  {
    inputs: [{ name: 'orderId', type: 'uint256' }],
    name: 'getCrossChainOrder',
    outputs: [
      {
        components: [
          { name: 'itpId', type: 'bytes32' },
          { name: 'user', type: 'address' },
          { name: 'amount', type: 'uint256' },
          { name: 'limitPrice', type: 'uint256' },
          { name: 'slippageTier', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
          { name: 'createdAt', type: 'uint256' },
        ],
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  // Cross-chain order ID counter
  {
    inputs: [],
    name: 'crossChainOrderId',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

// ERC20 ABI for USDC approval
export const ERC20_ABI = [
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
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
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

// Index.sol ABI - for order submission, querying, and events
export const INDEX_ABI = [
  // Submit an order (BUY or SELL)
  {
    inputs: [
      { name: 'itpId', type: 'bytes32' },
      { name: 'side', type: 'uint8' },
      { name: 'amount', type: 'uint256' },
      { name: 'limitPrice', type: 'uint256' },
      { name: 'slippageTier', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
    name: 'submitOrder',
    outputs: [{ name: 'orderId', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Get order details
  {
    inputs: [{ name: 'orderId', type: 'uint256' }],
    name: 'getOrder',
    outputs: [
      {
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'user', type: 'address' },
          { name: 'pairId', type: 'bytes32' },
          { name: 'side', type: 'uint8' },
          { name: 'amount', type: 'uint256' },
          { name: 'limitPrice', type: 'uint256' },
          { name: 'slippageTier', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
          { name: 'itpId', type: 'bytes32' },
          { name: 'timestamp', type: 'uint256' },
          { name: 'status', type: 'uint8' },
        ],
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  // Query user's ITP shares
  {
    inputs: [
      { name: 'itpId', type: 'bytes32' },
      { name: 'user', type: 'address' },
    ],
    name: 'getUserShares',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Next order ID
  {
    inputs: [],
    name: 'nextOrderId',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // OrderSubmitted event
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'orderId', type: 'uint256' },
      { indexed: true, name: 'user', type: 'address' },
      { indexed: true, name: 'itpId', type: 'bytes32' },
      { indexed: false, name: 'pairId', type: 'bytes32' },
      { indexed: false, name: 'side', type: 'uint8' },
      { indexed: false, name: 'amount', type: 'uint256' },
      { indexed: false, name: 'limitPrice', type: 'uint256' },
      { indexed: false, name: 'slippageTier', type: 'uint256' },
      { indexed: false, name: 'deadline', type: 'uint256' },
    ],
    name: 'OrderSubmitted',
    type: 'event',
  },
  // FillConfirmed event
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'orderId', type: 'uint256' },
      { indexed: true, name: 'cycleNumber', type: 'uint256' },
      { indexed: false, name: 'fillPrice', type: 'uint256' },
      { indexed: false, name: 'fillAmount', type: 'uint256' },
    ],
    name: 'FillConfirmed',
    type: 'event',
  },
  // getITPState view
  {
    inputs: [{ name: 'itpId', type: 'bytes32' }],
    name: 'getITPState',
    outputs: [
      { name: 'creator', type: 'address' },
      { name: 'totalSupply', type: 'uint256' },
      { name: 'nav', type: 'uint256' },
      { name: 'assets', type: 'address[]' },
      { name: 'weights', type: 'uint256[]' },
      { name: 'inventory', type: 'uint256[]' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  // requestRebalance (event-only, permissionless)
  {
    inputs: [
      { name: 'itpId', type: 'bytes32' },
      { name: 'removeIndices', type: 'uint256[]' },
      { name: 'addAssets', type: 'address[]' },
      { name: 'newWeights', type: 'uint256[]' },
      { name: 'note', type: 'string' },
    ],
    name: 'requestRebalance',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // rebalance (BLS-verified, bypassed in dev)
  {
    inputs: [
      { name: 'itpId', type: 'bytes32' },
      { name: 'removeIndices', type: 'uint256[]' },
      { name: 'addAssets', type: 'address[]' },
      { name: 'newWeights', type: 'uint256[]' },
      { name: 'prices', type: 'uint256[]' },
      { name: 'blsSignature', type: 'bytes' },
    ],
    name: 'rebalance',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Public storage getters for system status
  {
    inputs: [],
    name: 'lastProcessedCycleNumber',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'pendingOrderCount',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // BatchConfirmed event
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'cycleNumber', type: 'uint256' },
      { indexed: false, name: 'orderIds', type: 'uint256[]' },
      { indexed: false, name: 'blsSignature', type: 'bytes' },
    ],
    name: 'BatchConfirmed',
    type: 'event',
  },
] as const

// BridgedItpFactory ABI - to look up deployed ITP addresses
export const BRIDGED_ITP_FACTORY_ABI = [
  // Get deployed ITP address by orbit ITP ID
  {
    inputs: [{ name: 'orbitItpId', type: 'bytes32' }],
    name: 'deployedItps',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

// BridgedITP (ERC20) ABI
export const BRIDGED_ITP_ABI = [
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
    name: 'totalSupply',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const
