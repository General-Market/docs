import { createPublicClient, createWalletClient, http, type PrivateKeyAccount, type PublicClient, type WalletClient } from 'viem'
import { L3 } from './config.js'

export function makePublic(): PublicClient {
  return createPublicClient({ chain: L3, transport: http(L3.rpcUrls.default.http[0]) })
}

export function makeWallet(account: PrivateKeyAccount): WalletClient {
  return createWalletClient({ chain: L3, account, transport: http(L3.rpcUrls.default.http[0]) })
}
