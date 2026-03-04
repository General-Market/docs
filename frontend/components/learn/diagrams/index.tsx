'use client'

import dynamic from 'next/dynamic'

const Placeholder = ({ h }: { h: string }) => (
  <div className={`my-12 -mx-4 md:-mx-8`}>
    <div className={`bg-[#f5f5f5] border-t-[3px] border-black animate-pulse`} style={{ height: h }} />
  </div>
)

export const FrameTransactionScene = dynamic(
  () => import('./FrameTransactionScene').then(m => m.FrameTransactionScene),
  { ssr: false, loading: () => <Placeholder h="420px" /> }
)

export const PaymasterFlow = dynamic(
  () => import('./PaymasterFlow').then(m => m.PaymasterFlow),
  { ssr: false, loading: () => <Placeholder h="540px" /> }
)

export const MempoolLayers = dynamic(
  () => import('./MempoolLayers').then(m => m.MempoolLayers),
  { ssr: false, loading: () => <Placeholder h="440px" /> }
)

export const PrivacyDiagram = dynamic(
  () => import('./PrivacyDiagram').then(m => m.PrivacyDiagram),
  { ssr: false, loading: () => <Placeholder h="440px" /> }
)

export const BeforeAfterScene = dynamic(
  () => import('./BeforeAfterScene').then(m => m.BeforeAfterScene),
  { ssr: false, loading: () => <Placeholder h="520px" /> }
)

export const EIPTimeline3D = dynamic(
  () => import('./EIPTimeline3D').then(m => m.EIPTimeline3D),
  { ssr: false, loading: () => <Placeholder h="420px" /> }
)

export { EIPTimeline } from './EIPTimeline'
export { FrameFlow, FlowNormalTx, FlowAtomicOps, FlowNewAccount, FlowPrivacyZK } from './FrameFlow'
export {
  StatsOverview,
  StatsUnlocked,
  EOABenefits,
  CapabilityCards,
  FOCILComparison,
  QuantumComparison,
  HegotaSummary,
} from './VisualCards'
