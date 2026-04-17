import {
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js'
import {
  createApproveCheckedInstruction,
  createRevokeInstruction,
} from '@solana/spl-token'

// One-click trading primitives.
//
// A session wallet is an ephemeral Keypair generated in-browser and kept only
// in memory. To make it useful we do two things in a single user-signed tx:
//
//   1. Fund the session key with a small amount of SOL so it can pay fees.
//   2. Approve the session key as a delegate on the user's token account
//      (USDC, or whatever the trading collateral is), with an explicit
//      spending cap.
//
// After that single popup, any subsequent trade transaction can be signed
// locally by the session key — no wallet prompt. The session key can only
// move the token up to the cap, and only that one token. Revoking is a
// second user-signed tx that calls Revoke on the delegate.
//
// The session key never persists. Closing the tab kills it. To keep trading,
// the user re-approves with one signature. That is the cost of not having
// an encrypted IDB store — and the benefit of not storing long-lived
// signing material on disk.

export interface SessionConfig {
  // The SPL token mint whose spending is being delegated.
  tokenMint: PublicKey
  // The user's associated token account for tokenMint.
  userTokenAccount: PublicKey
  // Spending cap in base units (e.g. USDC with 6 decimals → 100 USDC = 100_000_000n).
  spendingCap: bigint
  // Decimals of the token mint. SPL's approveChecked requires it as a sanity check.
  mintDecimals: number
  // SOL funding for the session key, in whole SOL. 0.02 SOL ~ 200 trades at
  // 5k lamport fees. Tune up if you expect more throughput.
  solFunding: number
}

export function generateSessionKeypair(): Keypair {
  return Keypair.generate()
}

// Builds the one tx the user signs to enable their session.
// feePayer / recentBlockhash are set by the caller before signing.
export function buildEnableSessionTx(
  owner: PublicKey,
  session: PublicKey,
  config: SessionConfig,
): Transaction {
  const tx = new Transaction()

  // Fund the session key with SOL so it can pay transaction fees itself.
  const fundingLamports = Math.floor(config.solFunding * LAMPORTS_PER_SOL)
  if (fundingLamports > 0) {
    tx.add(
      SystemProgram.transfer({
        fromPubkey: owner,
        toPubkey: session,
        lamports: fundingLamports,
      }),
    )
  }

  // Delegate the session key with a capped allowance on the user's token
  // account. The session can move up to spendingCap base units of this
  // token, nothing else. approveChecked requires decimals — SPL enforces
  // that the mint's decimals match, catching sign-in-wrong-token bugs.
  tx.add(
    createApproveCheckedInstruction(
      config.userTokenAccount,
      config.tokenMint,
      session,
      owner,
      config.spendingCap,
      config.mintDecimals,
    ),
  )

  return tx
}

// Revokes the delegation. The session SOL balance stays put (often dust, not
// worth a sweep). Call this on logout, session expiry, or explicit user action.
export function buildDisableSessionTx(
  owner: PublicKey,
  userTokenAccount: PublicKey,
): Transaction {
  const tx = new Transaction()
  tx.add(createRevokeInstruction(userTokenAccount, owner))
  return tx
}
