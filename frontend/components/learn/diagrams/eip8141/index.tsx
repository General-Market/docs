'use client'

import dynamic from 'next/dynamic'

const Placeholder = ({ h }: { h: string }) => (
  <div className="my-12 -mx-4 md:-mx-8">
    <div className="bg-[#f5f5f5] border-t-[3px] border-black animate-pulse" style={{ height: h }} />
  </div>
)

// Scene 1: Normal TX vs Frame TX side-by-side comparison
export const NormalVsFrame3D = dynamic(
  () => import('./NormalVsFrame3D').then(m => m.NormalVsFrame3D),
  { ssr: false, loading: () => <Placeholder h="420px" /> }
)

// Scene 2: Frame structure + execution flow (untrusted → ACCEPT → trusted)
export const FrameOverview3D = dynamic(
  () => import('./FrameOverview3D').then(m => m.FrameOverview3D),
  { ssr: false, loading: () => <Placeholder h="420px" /> }
)

// Scene 3: Multisig authentication with CALLDATAREAD
export const MultisigAuth3D = dynamic(
  () => import('./MultisigAuth3D').then(m => m.MultisigAuth3D),
  { ssr: false, loading: () => <Placeholder h="420px" /> }
)

// Scene 4: New account deployment (CREATE2 + 3-frame atomic)
export const AccountDeploy3D = dynamic(
  () => import('./AccountDeploy3D').then(m => m.AccountDeploy3D),
  { ssr: false, loading: () => <Placeholder h="420px" /> }
)

// Scene 5: Paymaster gas flow (pay gas in any token)
export const PaymasterFlow3D = dynamic(
  () => import('./PaymasterFlow3D').then(m => m.PaymasterFlow3D),
  { ssr: false, loading: () => <Placeholder h="420px" /> }
)

// Scene 6: ZK-SNARK privacy (no link between deposit and withdrawal)
export const ZKPrivacy3D = dynamic(
  () => import('./ZKPrivacy3D').then(m => m.ZKPrivacy3D),
  { ssr: false, loading: () => <Placeholder h="420px" /> }
)

// Scene 7: FOCIL censorship resistance (with vs without)
export const FOCILGuard3D = dynamic(
  () => import('./FOCILGuard3D').then(m => m.FOCILGuard3D),
  { ssr: false, loading: () => <Placeholder h="420px" /> }
)

// Scene 8: Atomic operations vs vulnerable separate TXs
export const AtomicBatch3D = dynamic(
  () => import('./AtomicBatch3D').then(m => m.AtomicBatch3D),
  { ssr: false, loading: () => <Placeholder h="420px" /> }
)
