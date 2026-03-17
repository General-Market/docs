'use client'

import dynamic from 'next/dynamic'

const Placeholder = ({ h }: { h: string }) => (
  <div className="my-12 -mx-4 md:-mx-8">
    <div className="bg-[#f5f5f5] border-t-[3px] border-black animate-pulse" style={{ height: h }} />
  </div>
)

// Scene 1: Three ascending platforms — execution, data, proofs
export const RoadmapStaircase3D = dynamic(
  () => import('./RoadmapStaircase3D').then(m => m.RoadmapStaircase3D),
  { ssr: false, loading: () => <Placeholder h="420px" /> }
)

// Scene 2: Sequential vs parallel transaction verification
export const ParallelVerification3D = dynamic(
  () => import('./ParallelVerification3D').then(m => m.ParallelVerification3D),
  { ssr: false, loading: () => <Placeholder h="420px" /> }
)

// Scene 3: ePBS slot clock — proposer/builder timing
export const EPBSSlotClock3D = dynamic(
  () => import('./EPBSSlotClock3D').then(m => m.EPBSSlotClock3D),
  { ssr: false, loading: () => <Placeholder h="420px" /> }
)

// Scene 4: Gas evolution — single to multidimensional
export const GasEvolution3D = dynamic(
  () => import('./GasEvolution3D').then(m => m.GasEvolution3D),
  { ssr: false, loading: () => <Placeholder h="420px" /> }
)

// Scene 5: Blob sampling — PeerDAS data availability
export const BlobSampling3D = dynamic(
  () => import('./BlobSampling3D').then(m => m.BlobSampling3D),
  { ssr: false, loading: () => <Placeholder h="420px" /> }
)

// Scene 6: ZK-EVM staged rollout population
export const ZKEVMPopulation3D = dynamic(
  () => import('./ZKEVMPopulation3D').then(m => m.ZKEVMPopulation3D),
  { ssr: false, loading: () => <Placeholder h="420px" /> }
)

// Scene 7: EOF containerized contracts
export const EOFContainerization3D = dynamic(
  () => import('./EOFContainerization3D').then(m => m.EOFContainerization3D),
  { ssr: false, loading: () => <Placeholder h="420px" /> }
)

// Scene 8: Full stack layer convergence
export const FullStackLayers3D = dynamic(
  () => import('./FullStackLayers3D').then(m => m.FullStackLayers3D),
  { ssr: false, loading: () => <Placeholder h="420px" /> }
)

// Scene 9: Access list conflict detection and lane assignment
export const AccessListConflict3D = dynamic(
  () => import('./AccessListConflict3D').then(m => m.AccessListConflict3D),
  { ssr: false, loading: () => <Placeholder h="420px" /> }
)

// Scene 10: Slot budget — today vs ePBS time allocation
export const SlotBudget3D = dynamic(
  () => import('./SlotBudget3D').then(m => m.SlotBudget3D),
  { ssr: false, loading: () => <Placeholder h="420px" /> }
)

// Scene 11: Reed-Solomon erasure coding for PeerDAS
export const ErasureCoding3D = dynamic(
  () => import('./ErasureCoding3D').then(m => m.ErasureCoding3D),
  { ssr: false, loading: () => <Placeholder h="420px" /> }
)

// Scene 12: Glamsterdam gas reservoir overflow mechanism
export const GasReservoir3D = dynamic(
  () => import('./GasReservoir3D').then(m => m.GasReservoir3D),
  { ssr: false, loading: () => <Placeholder h="420px" /> }
)

// Scene 13: 3-of-5 independent prover consensus
export const ProverConsensus3D = dynamic(
  () => import('./ProverConsensus3D').then(m => m.ProverConsensus3D),
  { ssr: false, loading: () => <Placeholder h="420px" /> }
)

// CSS card components (SSR-safe)
export const ScalingStats = dynamic(
  () => import('./ScalingCards').then(m => m.ScalingStats),
  { ssr: true, loading: () => <Placeholder h="180px" /> }
)

export const ScalingSummary = dynamic(
  () => import('./ScalingCards').then(m => m.ScalingSummary),
  { ssr: true, loading: () => <Placeholder h="220px" /> }
)
