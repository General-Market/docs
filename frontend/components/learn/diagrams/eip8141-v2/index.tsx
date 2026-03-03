'use client'

import dynamic from 'next/dynamic'

const Placeholder = ({ h }: { h: string }) => (
  <div className="my-12 -mx-4 md:-mx-8">
    <div className="bg-[#f5f5f5] border-t-[3px] border-black animate-pulse" style={{ height: h }} />
  </div>
)

// Scene 1: Normal TX vs Frame TX — padlock placement comparison
export const NormalVsFrame3D = dynamic(
  () => import('./NormalVsFrame3D').then(m => m.NormalVsFrame3D),
  { ssr: false, loading: () => <Placeholder h="420px" /> }
)

// Scene 2: Frame execution flow — ACCEPT as trust boundary
export const FrameOverview3D = dynamic(
  () => import('./FrameOverview3D').then(m => m.FrameOverview3D),
  { ssr: false, loading: () => <Placeholder h="420px" /> }
)

// Scene 3: Multisig — two signers converge on one vault
export const MultisigAuth3D = dynamic(
  () => import('./MultisigAuth3D').then(m => m.MultisigAuth3D),
  { ssr: false, loading: () => <Placeholder h="420px" /> }
)

// Scene 4: Paymaster — bidirectional token exchange for gas
export const PaymasterFlow3D = dynamic(
  () => import('./PaymasterFlow3D').then(m => m.PaymasterFlow3D),
  { ssr: false, loading: () => <Placeholder h="420px" /> }
)

// Scene 5: Account deployment — address before existence
export const AccountDeploy3D = dynamic(
  () => import('./AccountDeploy3D').then(m => m.AccountDeploy3D),
  { ssr: false, loading: () => <Placeholder h="420px" /> }
)

// Scene 6: ZK Privacy — no link between deposit and withdrawal
export const ZKPrivacy3D = dynamic(
  () => import('./ZKPrivacy3D').then(m => m.ZKPrivacy3D),
  { ssr: false, loading: () => <Placeholder h="420px" /> }
)

// Scene 7: FOCIL — censorship resistance (with vs without)
export const FOCILGuard3D = dynamic(
  () => import('./FOCILGuard3D').then(m => m.FOCILGuard3D),
  { ssr: false, loading: () => <Placeholder h="420px" /> }
)

// Scene 8: Atomic batch — gap vs no gap
export const AtomicBatch3D = dynamic(
  () => import('./AtomicBatch3D').then(m => m.AtomicBatch3D),
  { ssr: false, loading: () => <Placeholder h="420px" /> }
)

// Intro: Transformation Promise — BEFORE state
export const PromiseScene3D = dynamic(
  () => import('./PromiseScene3D').then(m => m.PromiseScene3D),
  { ssr: false, loading: () => <Placeholder h="300px" /> }
)

// Outro: Transformation Payoff — AFTER state
export const PayoffScene3D = dynamic(
  () => import('./PayoffScene3D').then(m => m.PayoffScene3D),
  { ssr: false, loading: () => <Placeholder h="300px" /> }
)

// History: Timeline of account abstraction attempts (2016-2026)
export const HistoryTimeline3D = dynamic(
  () => import('./HistoryTimeline3D').then(m => m.HistoryTimeline3D),
  { ssr: false, loading: () => <Placeholder h="340px" /> }
)

// Social Proof: Authority, adoption, and ecosystem scale
export const SocialProof3D = dynamic(
  () => import('./SocialProof3D').then(m => m.SocialProof3D),
  { ssr: false, loading: () => <Placeholder h="340px" /> }
)
