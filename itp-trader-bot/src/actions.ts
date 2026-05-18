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

export type ActionKind = 'buy' | 'sell' | 'lend' | 'withdraw' | 'borrow' | 'repay'
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

  // Bias toward markets the wallet can actually borrow against. Scan every
  // market and look for one where the wallet either already has a Morpho
  // collateral position OR holds the underlying collateral ERC20. Shuffle
  // so successive borrow ticks don't keep racing the same market.
  // Falls back to a single random pick so the deeper skip path still
  // surfaces during cold-start.
  const candidates = [...markets].sort(() => Math.random() - 0.5)
  let m: MorphoMarket | undefined
  let collBal = 0n
  for (const candidate of candidates) {
    let bal = 0n
    try {
      bal = (await pub.readContract({
        address: candidate.collateralToken.toLowerCase() as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [ring.account.address],
      })) as bigint
    } catch {
      continue
    }
    if (bal > 0n) {
      m = candidate
      collBal = bal
      break
    }
    try {
      const pos = await readPosition(pub, candidate.marketId, ring.account.address)
      if (pos.collateral > 0n) {
        m = candidate
        collBal = bal
        break
      }
    } catch {
      // ignore — keep scanning
    }
  }
  if (!m) {
    // No candidate matched. Take a random pick so the deeper skip reason surfaces.
    m = pickOne(markets)
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

  // Compute max borrowable so we never request more than the collateral
  // backs. Mock oracle is 1e36 (1 collateral = 1 loan, both 18-dec), so
  // max ≈ collateral * lltv / 1e18. Borrow a random 20–60 % of that, minus
  // any debt already on the position.
  const freshPos = await readPosition(pub, m.marketId, ring.account.address)
  const maxBorrowable = (freshPos.collateral * params.lltv) / BigInt(1e18)
  const headroom = maxBorrowable > 0n ? maxBorrowable / 2n : 0n // half max to leave health buffer
  if (headroom === 0n) {
    return { kind: 'borrow', status: 'skip', wallet: ring.account.address, note: 'no borrow headroom' }
  }
  const pct = BigInt(Math.floor(rngFloat(0.4, 1.0) * 10_000))
  const borrowAmt = (headroom * pct) / 10_000n
  if (borrowAmt === 0n) {
    return { kind: 'borrow', status: 'skip', wallet: ring.account.address, note: 'borrow amount rounded to 0' }
  }
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

// ── WITHDRAW (MetaMorpho redeem) ─────────────────────────────────────────────
export async function actWithdraw(ring: Keyring[number]): Promise<ActionResult> {
  const pub = makePublic()
  const shares = (await pub.readContract({
    address: ADDR.MetaMorphoUSDC,
    abi: METAMORPHO_ABI,
    functionName: 'balanceOf',
    args: [ring.account.address],
  })) as bigint
  if (shares === 0n) return { kind: 'withdraw', status: 'skip', wallet: ring.account.address, note: 'no vault shares to withdraw' }
  // Withdraw a random 5–40 % slice. MetaMorpho's withdraw takes assets, not
  // shares — so estimate assets by share value at 1:1 (close enough at
  // zero/near-zero utilization; vault accounting will reconcile).
  const pct = BigInt(Math.floor(rngFloat(0.05, 0.4) * 10_000))
  const burn = (shares * pct) / 10_000n
  if (burn === 0n) return { kind: 'withdraw', status: 'skip', wallet: ring.account.address, note: 'withdraw rounded to 0' }
  if (DRY_RUN) {
    return { kind: 'withdraw', status: 'ok', wallet: ring.account.address, tx: '0xdry' as Hex, note: `would withdraw ~${formatUnits(burn, USDC_DEC)} USDC` }
  }
  const wallet = makeWallet(ring.account)
  try {
    const tx = await wallet.writeContract({
      chain: wallet.chain,
      account: ring.account,
      address: ADDR.MetaMorphoUSDC,
      abi: METAMORPHO_ABI,
      functionName: 'withdraw',
      args: [burn, ring.account.address, ring.account.address],
    })
    return { kind: 'withdraw', status: 'ok', wallet: ring.account.address, tx, note: `withdraw ~${formatUnits(burn, USDC_DEC)} USDC` }
  } catch (e) {
    return { kind: 'withdraw', status: 'skip', wallet: ring.account.address, note: `withdraw reverted: ${String(e).slice(0, 80)}` }
  }
}

// ── REPAY (Morpho.repay against an existing borrow position) ─────────────────
export async function actRepay(ring: Keyring[number]): Promise<ActionResult> {
  const pub = makePublic()
  const markets = await listMorphoMarkets()
  // Find any market where this wallet has an outstanding borrow.
  for (const m of markets) {
    const params = await readMarketParams(pub, m.marketId)
    if (params.lltv === 0n) continue
    const pos = await readPosition(pub, m.marketId, ring.account.address)
    if (pos.borrowShares === 0n) continue
    const tuple = { loanToken: params.loanToken, collateralToken: params.collateralToken, oracle: params.oracle, irm: params.irm, lltv: params.lltv } as const

    // Repay a random 20–100 % slice of the debt by shares.
    const pct = BigInt(Math.floor(rngFloat(0.2, 1.0) * 10_000))
    const repayShares = (pos.borrowShares * pct) / 10_000n
    if (repayShares === 0n) continue

    // Approve USDC up to a generous bound; the actual debt is small.
    const usdcBal = (await pub.readContract({
      address: ADDR.USDC,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [ring.account.address],
    })) as bigint
    if (usdcBal === 0n) return { kind: 'repay', status: 'skip', wallet: ring.account.address, note: 'no USDC to repay with' }
    await ensureAllowance(pub, ring, ADDR.USDC, ADDR.Morpho, usdcBal)

    if (DRY_RUN) {
      return { kind: 'repay', status: 'ok', wallet: ring.account.address, tx: '0xdry' as Hex, note: `would repay ${repayShares} shares on ${m.marketId.slice(0, 10)}` }
    }
    const wallet = makeWallet(ring.account)
    try {
      const tx = await wallet.writeContract({
        chain: wallet.chain,
        account: ring.account,
        address: ADDR.Morpho,
        abi: MORPHO_ABI,
        functionName: 'repay',
        // repay(MarketParams, assets=0, shares, onBehalf, data=0x)
        args: [tuple, 0n, repayShares, ring.account.address, '0x'],
      })
      return { kind: 'repay', status: 'ok', wallet: ring.account.address, tx, note: `repay ${repayShares} shares against ${m.collateralToken.slice(0, 10)}` }
    } catch (e) {
      return { kind: 'repay', status: 'skip', wallet: ring.account.address, note: `repay reverted: ${String(e).slice(0, 80)}` }
    }
  }
  return { kind: 'repay', status: 'skip', wallet: ring.account.address, note: 'no open borrow positions' }
}

export async function runAction(kind: ActionKind, ring: Keyring[number]): Promise<ActionResult> {
  try {
    switch (kind) {
      case 'buy': return await actBuy(ring)
      case 'sell': return await actSell(ring)
      case 'lend': return await actLend(ring)
      case 'withdraw': return await actWithdraw(ring)
      case 'borrow': return await actBorrow(ring)
      case 'repay': return await actRepay(ring)
    }
  } catch (e) {
    log.error({ err: String(e), kind, wallet: ring.account.address }, 'action error')
    return { kind, status: 'error', wallet: ring.account.address, note: String(e).slice(0, 120) }
  }
}
