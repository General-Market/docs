import { createPublicClient, http, keccak256, stringToHex } from 'viem'
const VISION = '0x36a28967544c301a3C66dcFB6c6c90e548412693'
const c = createPublicClient({ chain: { id: 111222333, name: 'L3', nativeCurrency: { name: 'GM', symbol: 'GM', decimals: 18 }, rpcUrls: { default: { http: ['https://rpc.generalmarket.io/'] } } }, transport: http('https://rpc.generalmarket.io/') })
const ABI = [{ type: 'function', name: 'latestBatchForSource', stateMutability: 'view', inputs: [{ type: 'bytes32' }], outputs: [{ type: 'uint256' }] }, { type: 'function', name: 'getBatch', stateMutability: 'view', inputs: [{ type: 'uint256' }], outputs: [{ type: 'tuple', components: [{ name: 'creator', type: 'address' }, { name: 'sourceId', type: 'bytes32' }, { name: 'configHash', type: 'bytes32' }, { name: 'tickDuration', type: 'uint256' }, { name: 'lockOffset', type: 'uint256' }, { name: 'settlementGrace', type: 'uint256' }, { name: 'createdAtTick', type: 'uint256' }, { name: 'paused', type: 'bool' }, { name: 'settled', type: 'bool' }] }] }]
const sid = keccak256(stringToHex('defi_v2'))
console.log('defi sourceId:', sid)
const batchId = await c.readContract({ address: VISION, abi: ABI, functionName: 'latestBatchForSource', args: [sid] })
console.log('latestBatchForSource:', batchId)
const b = await c.readContract({ address: VISION, abi: ABI, functionName: 'getBatch', args: [batchId] })
console.log('batch:', b)
const expiration = (b.createdAtTick + 1n) * b.tickDuration + b.settlementGrace
const now = BigInt(Math.floor(Date.now() / 1000))
console.log('expiration:', expiration, 'now:', now, 'expired?', now >= expiration)
