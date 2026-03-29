import { NextRequest, NextResponse } from 'next/server'
import { createWalletClient, createPublicClient, http, parseUnits, parseEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

/**
 * Testnet faucet — mints L3 WUSDC and optionally drips Sonic testnet gas.
 * Uses the deployer key for both chains.
 *
 * POST /api/faucet { address: "0x...", amount?: "1000", gas?: true }
 *
 * - Default: mints L3 USDC only (reads USDC address from Vision contract)
 * - gas=true: also sends 0.5 S (Sonic testnet native token) for settlement txs
 */

import { getL3RpcServer, SETTLEMENT_RPC_URL } from '@/lib/config'

const DEPLOYER_KEY = '0x107e200b197dc889feba0a1e0538bf51b97b2fc87f27f82783d5d59789dc3537' as const

import _deployment from '@/lib/contracts/deployment.json'
const VISION_ADDRESS = (_deployment.contracts.Vision || '0x0000000000000000000000000000000000000000') as `0x${string}`
const L3_WUSDC_FALLBACK = (_deployment.contracts.L3_WUSDC || '0x0511c61c551280cd2598d5a7380f8e9658f4b7db') as `0x${string}`
const L3_CHAIN_ID = _deployment.chainId || 111222333
const SETTLEMENT_CHAIN_ID = Number(process.env.NEXT_PUBLIC_SETTLEMENT_CHAIN_ID) || 421611337
const SETTLEMENT_USDC = (_deployment.contracts.SETTLEMENT_USDC || '0x2775bA795A292A1FfcD91d227d1a1B0889282190') as `0x${string}`
const MAX_MINT = 10_000 // max 10k USDC per request
const GAS_DRIP_AMOUNT = '0.5' // 0.5 S per drip

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
    const { address, amount: amountStr, gas: wantGas } = body

    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json({ error: 'Invalid address' }, { status: 400 })
    }

    const amount = Math.min(parseFloat(amountStr || '100'), MAX_MINT)
    if (amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    const account = privateKeyToAccount(DEPLOYER_KEY)
    const results: Record<string, any> = {}

    // 1. Mint L3 USDC — read actual USDC address from Vision contract
    const parsedAmount = parseUnits(String(amount), 18) // L3 USDC = 18 decimals
    const l3Chain = {
      id: L3_CHAIN_ID,
      name: 'Index L3',
      nativeCurrency: { name: 'GM', symbol: 'GM', decimals: 18 },
      rpcUrls: { default: { http: [getL3RpcServer()] } },
    } as const

    const l3Wallet = createWalletClient({
      account,
      chain: l3Chain,
      transport: http(getL3RpcServer()),
    })

    const l3Public = createPublicClient({
      chain: l3Chain,
      transport: http(getL3RpcServer()),
    })

    // Read Vision's USDC address from the contract, fall back to deployment JSON
    let l3Usdc = L3_WUSDC_FALLBACK
    if (VISION_ADDRESS !== '0x0000000000000000000000000000000000000000') {
      try {
        const usdcFromVision = await l3Public.readContract({
          address: VISION_ADDRESS,
          abi: [{ inputs: [], name: 'USDC', outputs: [{ name: '', type: 'address' }], stateMutability: 'view', type: 'function' }],
          functionName: 'USDC',
        })
        if (usdcFromVision) l3Usdc = usdcFromVision as `0x${string}`
      } catch {
        // Vision not deployed or USDC() missing — use fallback
      }
    }

    const mintHash = await l3Wallet.writeContract({
      address: l3Usdc,
      abi: MINT_ABI,
      functionName: 'mint',
      args: [address as `0x${string}`, parsedAmount],
    })

    await l3Public.waitForTransactionReceipt({ hash: mintHash, timeout: 30_000 })
    results.usdc = { hash: mintHash, amount: `${amount} USDC` }

    // 1b. Drip L3 GM (native gas) — 1 GM covers ~20 txs
    const L3_GAS_DRIP = parseEther('1')
    try {
      const l3DeployerBalance = await l3Public.getBalance({ address: account.address })
      if (l3DeployerBalance > L3_GAS_DRIP * 2n) {
        const l3GasHash = await l3Wallet.sendTransaction({
          to: address as `0x${string}`,
          value: L3_GAS_DRIP,
        })
        await l3Public.waitForTransactionReceipt({ hash: l3GasHash, timeout: 30_000 })
        results.l3Gas = { hash: l3GasHash, amount: '10 GM' }
      } else {
        results.l3Gas = { error: 'Deployer low on GM' }
      }
    } catch (e: any) {
      results.l3Gas = { error: e.message }
    }

    // 2. Settlement chain: gas drip + settlement USDC mint
    if (wantGas) {
      try {
        const settlementChain = {
          id: SETTLEMENT_CHAIN_ID,
          name: 'Sonic Testnet',
          nativeCurrency: { name: 'Sonic', symbol: 'S', decimals: 18 },
          rpcUrls: { default: { http: [SETTLEMENT_RPC_URL] } },
        } as const

        const settlementWallet = createWalletClient({
          account,
          chain: settlementChain,
          transport: http(SETTLEMENT_RPC_URL),
        })

        const settlementPublic = createPublicClient({
          chain: settlementChain,
          transport: http(SETTLEMENT_RPC_URL),
        })

        // Gas drip
        const deployerBalance = await settlementPublic.getBalance({ address: account.address })
        const dripAmount = parseEther(GAS_DRIP_AMOUNT)

        if (deployerBalance > dripAmount * 2n) {
          const gasHash = await settlementWallet.sendTransaction({
            to: address as `0x${string}`,
            value: dripAmount,
          })
          await settlementPublic.waitForTransactionReceipt({ hash: gasHash, timeout: 30_000 })
          results.gas = { hash: gasHash, amount: `${GAS_DRIP_AMOUNT} S` }
        } else {
          results.gas = { error: 'Faucet deployer low on S — please try again later' }
        }

        // Mint settlement USDC (6 decimals) for ITP buying
        try {
          const settlementAmount = parseUnits(String(amount), 6)
          const settlementMintHash = await settlementWallet.writeContract({
            address: SETTLEMENT_USDC,
            abi: MINT_ABI,
            functionName: 'mint',
            args: [address as `0x${string}`, settlementAmount],
          })
          await settlementPublic.waitForTransactionReceipt({ hash: settlementMintHash, timeout: 30_000 })
          results.settlementUsdc = { hash: settlementMintHash, amount: `${amount} USDC (settlement)` }
        } catch (e: any) {
          results.settlementUsdc = { error: e.message }
        }
      } catch (e: any) {
        results.gas = { error: e.message }
      }
    }

    return NextResponse.json({
      success: true,
      to: address,
      ...results,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
