import { NextRequest, NextResponse } from 'next/server'
import { createWalletClient, createPublicClient, http, parseUnits, encodeFunctionData } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

/**
 * Testnet USDC faucet — mints L3 WUSDC to any address.
 * Uses the deployer key to call mint() on the mock token.
 *
 * POST /api/faucet { address: "0x...", amount?: "1000" }
 */

const DEPLOYER_KEY = '0x107e200b197dc889feba0a1e0538bf51b97b2fc87f27f82783d5d59789dc3537' as const
const L3_RPC = process.env.L3_RPC_URL || process.env.NEXT_PUBLIC_L3_RPC_URL || 'http://142.132.164.24/'
const L3_WUSDC = '0xcb6C040bd4E1742840AD5542C6fDDaF74dB73AF6' as `0x${string}`
const CHAIN_ID = 111222333
const MAX_MINT = 10_000 // max 10k USDC per request

const MINT_ABI = [{
  name: 'mint',
  type: 'function',
  stateMutability: 'nonpayable',
  inputs: [
    { name: 'to', type: 'address' },
    { name: 'amount', type: 'uint256' },
  ],
  outputs: [],
}] as const

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { address, amount: amountStr } = body

    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json({ error: 'Invalid address' }, { status: 400 })
    }

    const amount = Math.min(parseFloat(amountStr || '100'), MAX_MINT)
    if (amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    const parsedAmount = parseUnits(String(amount), 18) // L3 USDC = 18 decimals

    const account = privateKeyToAccount(DEPLOYER_KEY)
    const chain = {
      id: CHAIN_ID,
      name: 'Index L3',
      nativeCurrency: { name: 'GM', symbol: 'GM', decimals: 18 },
      rpcUrls: { default: { http: [L3_RPC] } },
    } as const

    const walletClient = createWalletClient({
      account,
      chain,
      transport: http(L3_RPC),
    })

    const publicClient = createPublicClient({
      chain,
      transport: http(L3_RPC),
    })

    const hash = await walletClient.writeContract({
      address: L3_WUSDC,
      abi: MINT_ABI,
      functionName: 'mint',
      args: [address as `0x${string}`, parsedAmount],
    })

    const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 30_000 })

    return NextResponse.json({
      success: true,
      hash,
      amount: `${amount} USDC`,
      to: address,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
