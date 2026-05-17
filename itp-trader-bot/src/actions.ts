import { parseUnits, formatUnits, maxUint256, type Hex, type PublicClient } from 'viem'
import { ADDR, BUY_USDC_MAX, BUY_USDC_MIN, DRY_RUN, LEND_USDC_MAX, LEND_USDC_MIN } from './config.js'
import { ERC20_ABI, INDEX_ABI, METAMORPHO_ABI, MORPHO_ABI } from './abis.js'
import { listItps, listMorphoMarkets, pickOne, type Itp, type MorphoMarket } from './state.js'
import { makePublic, makeWallet } from './clients.js'
import { log } from './log.js'
import type { Keyring } from './keys.js'

const USDC_DEC = 18 // L3 USDC is 18 decimals (NOT 6 — see CLAUDE.md)
const SLIPPAGE_TIER = 2n
const DEADLINE_SECS = 30n * 60n

export type ActionKind = 'buy' | 'sell' | 'lend' | 'borrow'
export type ActionResult =
  | { kind: ActionKind; status: 'ok'; wallet: `0x${string}`; tx: Hex; note: string }
  | { kind: ActionKind; status: 'skip'; wallet: `0x${string}`; note: string }
  | { kind: ActionKind; status: 'error'; wallet: `0x${string}`; note: string }

function rngFloat(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function deadline(pub: PublicClient): Promise<bigint> {
  return pub.getBlock().then((b) => b.timestamp + DEADLINE_SECS)
}

async function ensureAllowance(
  pub: PublicClient,
  ring: Keyring[number],
  token: `0x${string}`,
  spender: `0x${string}`,
  amount: bigint,
): Promise<{ approved: boolean; tx?: Hex }> {
  const allowance = (await pub.readContract({
    address: token,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [ring.account.address, spender],
  })) as bigint
  if (allowance >= amount) return { approved: true }
  if (DRY_RUN) return { approved: true }
  const wallet = makeWallet(ring.account)
  const tx = await wallet.writeContract({
    chain: wallet.chain,
    account: ring.account,
    address: token,
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [spender, maxUint256],
  })
  await pub.waitForTransactionReceipt({ hash: tx, timeout: 60_000 })
  return { approved: true, tx }
}

// ── BUY ──────────────────────────────────────────────────────────────────────
export async function actBuy(ring: Keyring[number]): Promise<ActionResult> {
  const pub = makePublic()
  const usdcBal = (await pub.readContract({
    address: ADDR.USDC,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [ring.account.address],
  })) as bigint
  const minAmt = parseUnits(String(BUY_USDC_MIN), USDC_DEC)
  if (usdcBal < minAmt) {
    return { kind: 'buy', status: 'skip', wallet: ring.account.address, note: `usdc=${formatUnits(usdcBal, USDC_DEC)} < ${BUY_USDC_MIN}` }
  }
  const itps = await listItps()
  if (itps.length === 0) return { kind: 'buy', status: 'skip', wallet: ring.account.address, note: 'no itps' }
  const itp: Itp = pickOne(itps)
  const wantUsd = rngFloat(BUY_USDC_MIN, BUY_USDC_MAX)
  const amt = parseUnits(wantUsd.toFixed(6), USDC_DEC)
  const spend = amt > usdcBal ? usdcBal : amt

  await ensureAllowance(pub, ring, ADDR.USDC, ADDR.Index, spend)
  const dl = await deadline(pub)
  if (DRY_RUN) {
    return { kind: 'buy', status: 'ok', wallet: ring.account.address, tx: '0xdry' as Hex, note: `would buy ${formatUnits(spend, USDC_DEC)} USDC of ${itp.symbol}` }
  }
  const wallet = makeWallet(ring.account)
  const tx = await wallet.writeContract({
    chain: wallet.chain,
    account: ring.account,
    address: ADDR.Index,
    abi: INDEX_ABI,
    functionName: 'submitOrder',
    args: [itp.itpId, 0, spend, 0n, SLIPPAGE_TIER, dl],
  })
  return { kind: 'buy', status: 'ok', wallet: ring.account.address, tx, note: `buy ${formatUnits(spend, USDC_DEC)} USDC of ${itp.symbol}` }
}

// ── SELL ─────────────────────────────────────────────────────────────────────
export async function actSell(ring: Keyring[number]): Promise<ActionResult> {
  const pub = makePublic()
  const itps = await listItps()
  // Scan ALL ITPs in parallel for any holding. Sequential getUserShares calls
  // were too slow at 96 markets; Promise.all keeps the tick under one second.
  const shareList = await Promise.all(
    itps.map(async (itp) => {
      try {
        const shares = (await pub.readContract({
          address: ADDR.Index,
          abi: INDEX_ABI,
          functionName: 'getUserShares',
          args: [itp.itpId, ring.account.address],
        })) as bigint
        return { itp, shares }
      } catch {
        return { itp, shares: 0n }
      }
    }),
  )
  const held = shareList.filter((x) => x.shares > 0n)
  if (held.length === 0) return { kind: 'sell', status: 'skip', wallet: ring.account.address, note: `no shares held across ${itps.length} ITPs` }
  const pick = pickOne(held)
  const pct = rngFloat(0.01, 0.1)
  const sellAmt = (pick.shares * BigInt(Math.floor(pct * 10_000))) / 10_000n
  if (sellAmt === 0n) return { kind: 'sell', status: 'skip', wallet: ring.account.address, note: 'sell amount rounded to 0' }
  const dl = await deadline(pub)
  if (DRY_RUN) {
    return { kind: 'sell', status: 'ok', wallet: ring.account.address, tx: '0xdry' as Hex, note: `would sell ${formatUnits(sellAmt, USDC_DEC)} shares of ${pick.itp.symbol}` }
  }
  const wallet = makeWallet(ring.account)
  const tx = await wallet.writeContract({
    chain: wallet.chain,
    account: ring.account,
    address: ADDR.Index,
    abi: INDEX_ABI,
    functionName: 'submitOrder',
    args: [pick.itp.itpId, 1, sellAmt, 0n, SLIPPAGE_TIER, dl],
  })
  return { kind: 'sell', status: 'ok', wallet: ring.account.address, tx, note: `sell ${formatUnits(sellAmt, USDC_DEC)} shares of ${pick.itp.symbol}` }
}

// ── LEND (MetaMorpho deposit) ────────────────────────────────────────────────
export async function actLend(ring: Keyring[number]): Promise<ActionResult> {
  const pub = makePublic()
  const usdcBal = (await pub.readContract({
    address: ADDR.USDC,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [ring.account.address],
  })) as bigint
  const minAmt = parseUnits(String(LEND_USDC_MIN), USDC_DEC)
  if (usdcBal < minAmt) {
    return { kind: 'lend', status: 'skip', wallet: ring.account.address, note: `usdc=${formatUnits(usdcBal, USDC_DEC)} < ${LEND_USDC_MIN}` }
  }
  const wantUsd = rngFloat(LEND_USDC_MIN, LEND_USDC_MAX)
  let amt = parseUnits(wantUsd.toFixed(6), USDC_DEC)
  if (amt > usdcBal) amt = usdcBal
  const maxDep = (await pub.readContract({
    address: ADDR.MetaMorphoUSDC,
    abi: METAMORPHO_ABI,
    functionName: 'maxDeposit',
    args: [ring.account.address],
  })) as bigint
  if (amt > maxDep) amt = maxDep
  if (amt === 0n) return { kind: 'lend', status: 'skip', wallet: ring.account.address, note: 'vault maxDeposit=0' }
  await ensureAllowance(pub, ring, ADDR.USDC, ADDR.MetaMorphoUSDC, amt)
  if (DRY_RUN) {
    return { kind: 'lend', status: 'ok', wallet: ring.account.address, tx: '0xdry' as Hex, note: `would lend ${formatUnits(amt, USDC_DEC)} USDC to MetaMorpho` }
  }
  const wallet = makeWallet(ring.account)
  const tx = await wallet.writeContract({
    chain: wallet.chain,
    account: ring.account,
    address: ADDR.MetaMorphoUSDC,
    abi: METAMORPHO_ABI,
    functionName: 'deposit',
    args: [amt, ring.account.address],
  })
  return { kind: 'lend', status: 'ok', wallet: ring.account.address, tx, note: `lend ${formatUnits(amt, USDC_DEC)} USDC` }
}

// ── BORROW (Morpho borrow against ITP collateral) ────────────────────────────
async function readMarketParams(pub: PublicClient, marketId: `0x${string}`) {
  const res = (await pub.readContract({
    address: ADDR.Morpho,
    abi: MORPHO_ABI,
    functionName: 'idToMarketParams',
    args: [marketId],
  })) as readonly [`0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, bigint]
  return {
    loanToken: res[0],
    collateralToken: res[1],
    oracle: res[2],
    irm: res[3],
    lltv: res[4],
  }
}

async function readPosition(pub: PublicClient, marketId: `0x${string}`, who: `0x${string}`) {
  const res = (await pub.readContract({
    address: ADDR.Morpho,
    abi: MORPHO_ABI,
    functionName: 'position',
    args: [marketId, who],
  })) as readonly [bigint, bigint, bigint]
  return { supplyShares: res[0], borrowShares: res[1], collateral: res[2] }
}

export async function actBorrow(ring: Keyring[number]): Promise<ActionResult> {
  const pub = makePublic()
  const markets = await listMorphoMarkets()
  if (markets.length === 0) return { kind: 'borrow', status: 'skip', wallet: ring.account.address, note: 'no morpho markets' }

  // Pick a market the wallet holds the collateral for. If none, deposit collateral first.
  const m: MorphoMarket = pickOne(markets)
  let collBal = 0n
  try {
    collBal = (await pub.readContract({
      address: m.collateralToken.toLowerCase() as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [ring.account.address],
    })) as bigint
  } catch {
    return { kind: 'borrow', status: 'skip', wallet: ring.account.address, note: `collateral ${m.collateralToken.slice(0, 10)} not a deployed ERC20` }
  }

  const params = await readMarketParams(pub, m.marketId)
  if (params.lltv === 0n) {
    return { kind: 'borrow', status: 'skip', wallet: ring.account.address, note: `market ${m.marketId.slice(0, 10)} not registered on Morpho` }
  }
  const tuple = { loanToken: params.loanToken, collateralToken: params.collateralToken, oracle: params.oracle, irm: params.irm, lltv: params.lltv } as const

  const wallet = makeWallet(ring.account)

  // Ensure some collateral is supplied. If zero collateral but the wallet holds shares, supply 50% of them.
  const pos = await readPosition(pub, m.marketId, ring.account.address)
  if (pos.collateral === 0n) {
    if (collBal === 0n) {
      return { kind: 'borrow', status: 'skip', wallet: ring.account.address, note: `no collateral held for ${m.collateralToken.slice(0, 10)}` }
    }
    const supplyAmt = collBal / 2n
    await ensureAllowance(pub, ring, m.collateralToken.toLowerCase() as `0x${string}`, ADDR.Morpho, supplyAmt)
    if (DRY_RUN) {
      return { kind: 'borrow', status: 'ok', wallet: ring.account.address, tx: '0xdry' as Hex, note: `would supplyCollateral ${formatUnits(supplyAmt, 18)} then borrow` }
    }
    const supTx = await wallet.writeContract({
      chain: wallet.chain,
      account: ring.account,
      address: ADDR.Morpho,
      abi: MORPHO_ABI,
      functionName: 'supplyCollateral',
      args: [tuple, supplyAmt, ring.account.address, '0x'],
    })
    await pub.waitForTransactionReceipt({ hash: supTx, timeout: 60_000 })
  }

  // Borrow a small slice — bot keeps positions tiny on purpose.
  // We do not compute LLTV here; we attempt a small fixed nominal and let Morpho revert if unhealthy.
  const borrowUsd = rngFloat(0.5, 2)
  const borrowAmt = parseUnits(borrowUsd.toFixed(6), USDC_DEC)
  if (DRY_RUN) {
    return { kind: 'borrow', status: 'ok', wallet: ring.account.address, tx: '0xdry' as Hex, note: `would borrow ${formatUnits(borrowAmt, USDC_DEC)} USDC` }
  }
  try {
    const tx = await wallet.writeContract({
      chain: wallet.chain,
      account: ring.account,
      address: ADDR.Morpho,
      abi: MORPHO_ABI,
      functionName: 'borrow',
      args: [tuple, borrowAmt, 0n, ring.account.address, ring.account.address],
    })
    return { kind: 'borrow', status: 'ok', wallet: ring.account.address, tx, note: `borrow ${formatUnits(borrowAmt, USDC_DEC)} USDC against ${m.collateralToken.slice(0, 10)}` }
  } catch (e) {
    return { kind: 'borrow', status: 'skip', wallet: ring.account.address, note: `borrow reverted: ${String(e).slice(0, 80)}` }
  }
}

export async function runAction(kind: ActionKind, ring: Keyring[number]): Promise<ActionResult> {
  try {
    switch (kind) {
      case 'buy': return await actBuy(ring)
      case 'sell': return await actSell(ring)
      case 'lend': return await actLend(ring)
      case 'borrow': return await actBorrow(ring)
    }
  } catch (e) {
    log.error({ err: String(e), kind, wallet: ring.account.address }, 'action error')
    return { kind, status: 'error', wallet: ring.account.address, note: String(e).slice(0, 120) }
  }
}
