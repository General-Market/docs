'use client'

import { motion } from 'framer-motion'

/* ═══════════════════════════════════════════
   StatCards — Big numbers in a row
   Usage: <StatCards /> (pre-built variants)
   ═══════════════════════════════════════════ */
function StatCardsBase({ stats, accentColor = 'black' }: {
  stats: { value: string; label: string; sub?: string }[]
  accentColor?: string
}) {
  return (
    <div className="my-10 -mx-4 md:-mx-8">
      <div className="bg-[#fafafa] border-t-[3px] border-b border-black border-b-border-light">
        <div className="grid gap-0 divide-x divide-zinc-200" style={{ gridTemplateColumns: `repeat(${stats.length}, 1fr)` }}>
          {stats.map((s, i) => (
            <motion.div
              key={i}
              className="px-4 md:px-8 py-6 md:py-8 text-center"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
            >
              <p className="text-3xl md:text-5xl font-black tracking-tighter" style={{ color: accentColor }}>{s.value}</p>
              <p className="text-[13px] font-bold text-black mt-2 tracking-tight">{s.label}</p>
              {s.sub && <p className="text-[10px] text-text-muted mt-1">{s.sub}</p>}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Pre-built: article opening stats
export function StatsOverview() {
  return <StatCardsBase stats={[
    { value: '10', label: 'Years of Research', sub: 'EIP-86 (2016) → EIP-8141 (2026)' },
    { value: '1', label: 'Primitive', sub: 'Frame Transactions' },
    { value: 'N', label: 'Frames per TX', sub: 'Validate, execute, pay, deploy...' },
    { value: '0', label: 'Intermediaries', sub: 'No bundler, no relayer' },
  ]} />
}

// Pre-built: what this unlocks
export function StatsUnlocked() {
  return <StatCardsBase stats={[
    { value: '8', label: 'Capabilities', sub: 'Smart wallets to quantum resistance' },
    { value: '100%', label: 'EOA Compatible', sub: 'No migration needed' },
    { value: '<1yr', label: 'To Hegota Fork', sub: 'Targeting 2027' },
  ]} accentColor="#22c55e" />
}

/* ═══════════════════════════════════════════
   BenefitGrid — Cards with icons
   ═══════════════════════════════════════════ */
function BenefitGridBase({ benefits, columns = 3 }: {
  benefits: { icon: string; title: string; description: string; accent?: string }[]
  columns?: number
}) {
  return (
    <div className="my-10 -mx-4 md:-mx-8">
      <div className="bg-[#fafafa] border-t-[3px] border-b border-black border-b-border-light px-4 md:px-8 py-6 md:py-8">
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(columns, benefits.length)}, 1fr)` }}>
          {benefits.map((b, i) => (
            <motion.div
              key={i}
              className="group bg-white border border-zinc-200 hover:border-black transition-all duration-200 p-5 relative overflow-hidden"
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.4 }}
              whileHover={{ y: -2 }}
            >
              <div className="absolute top-0 left-0 right-0 h-[2px] transition-colors" style={{ backgroundColor: b.accent || '#000' }} />
              <span className="text-2xl mb-3 block">{b.icon}</span>
              <p className="text-[13px] font-bold text-black tracking-tight">{b.title}</p>
              <p className="text-[11px] text-text-muted mt-1.5 leading-relaxed">{b.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Pre-built: EOA benefits
export function EOABenefits() {
  return <BenefitGridBase benefits={[
    { icon: '⚡', title: 'Batch Operations', description: 'Multiple calls in one transaction. Approve + swap atomic. No more two-step flows.', accent: '#3b82f6' },
    { icon: '🎁', title: 'Transaction Sponsorship', description: 'Someone else pays your gas. Onboard users with zero ETH. Gasless UX.', accent: '#22c55e' },
    { icon: '🛡️', title: 'FOCIL Guarantees', description: 'First-class frame transactions. Rapid inclusion. Censorship-resistant by protocol.', accent: '#8b5cf6' },
  ]} />
}

// Pre-built: What 8141 solves
export function CapabilityCards() {
  return <BenefitGridBase benefits={[
    { icon: '👛', title: 'Smart Wallets', description: 'Native frame transactions replace off-chain bundlers. Any signature scheme.', accent: '#3b82f6' },
    { icon: '💱', title: 'Gas in Any Token', description: 'On-chain DEX paymaster. Pay in USDC, RAI, DAI. No relay needed.', accent: '#22c55e' },
    { icon: '🔗', title: 'Atomic Batch Ops', description: 'N execution frames. Approve + spend in one tx. No multicall hacks.', accent: '#f59e0b' },
    { icon: '🔒', title: 'Privacy Protocols', description: 'Public mempool replaces centralized broadcasters. ZK-SNARK paymasters.', accent: '#8b5cf6' },
    { icon: '🔐', title: 'Quantum Resistance', description: 'Plug any signature scheme into the validation frame. Post-quantum ready.', accent: '#ef4444' },
    { icon: '🌐', title: 'Cross-Chain Address', description: 'EIP-7997 deterministic factory. Same address on every chain.', accent: '#06b6d4' },
  ]} columns={3} />
}

/* ═══════════════════════════════════════════
   ComparisonCard — Before / After side-by-side
   ═══════════════════════════════════════════ */
function ComparisonBase({ before, after, beforeLabel = 'Before', afterLabel = 'After' }: {
  before: { items: string[] }
  after: { items: string[] }
  beforeLabel?: string
  afterLabel?: string
}) {
  return (
    <div className="my-10 -mx-4 md:-mx-8">
      <div className="bg-[#fafafa] border-t-[3px] border-b border-black border-b-border-light">
        <div className="grid grid-cols-2 divide-x divide-zinc-200">
          {/* Before */}
          <motion.div
            className="px-5 md:px-8 py-6 md:py-8"
            initial={{ opacity: 0, x: -12 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-red-400" />
              <span className="text-[10px] font-bold tracking-[0.15em] uppercase text-red-400">{beforeLabel}</span>
            </div>
            <div className="space-y-2.5">
              {before.items.map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-red-400 text-[11px] mt-0.5 shrink-0">✕</span>
                  <span className="text-[12px] text-zinc-600 leading-relaxed">{item}</span>
                </div>
              ))}
            </div>
          </motion.div>
          {/* After */}
          <motion.div
            className="px-5 md:px-8 py-6 md:py-8"
            initial={{ opacity: 0, x: 12 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.15 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-bold tracking-[0.15em] uppercase text-emerald-500">{afterLabel}</span>
            </div>
            <div className="space-y-2.5">
              {after.items.map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-emerald-500 text-[11px] mt-0.5 shrink-0">✓</span>
                  <span className="text-[12px] text-black font-medium leading-relaxed">{item}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

// Pre-built: FOCIL comparison
export function FOCILComparison() {
  return <ComparisonBase
    beforeLabel="Without FOCIL + AA"
    afterLabel="With FOCIL + AA"
    before={{ items: [
      'Smart wallet txs can be delayed or censored',
      'Privacy txs depend on centralized relayers',
      'Sponsored gas requires bundler infrastructure',
      'Complex ops are second-class citizens',
    ] }}
    after={{ items: [
      'Smart wallet txs get rapid, guaranteed inclusion',
      'Privacy txs submit directly to public mempool',
      'On-chain paymaster, no external infrastructure',
      'Complex ops are first-class frame transactions',
    ] }}
  />
}

// Pre-built: Quantum before/after
export function QuantumComparison() {
  return <ComparisonBase
    beforeLabel="Current Ethereum"
    afterLabel="With EIP-8141"
    before={{ items: [
      'Locked to ECDSA signature scheme',
      'Quantum computers could break all accounts',
      'Changing sig scheme requires new account',
      'No path to post-quantum security',
    ] }}
    after={{ items: [
      'Any signature scheme in validation frame',
      'Hash-based, lattice-based schemes work out of box',
      'Swap validation frame — same address, new crypto',
      'Active work on aggregation for efficiency',
    ] }}
  />
}

/* ═══════════════════════════════════════════
   SummaryBanner — Big closing CTA / summary
   ═══════════════════════════════════════════ */
export function HegotaSummary() {
  return (
    <div className="my-10 -mx-4 md:-mx-8">
      <motion.div
        className="bg-black text-white px-6 md:px-12 py-8 md:py-12"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-zinc-500 mb-4">The Hegota Fork</p>
          <p className="text-xl md:text-2xl font-black tracking-tight leading-tight">
            One mechanism. Every use case. No intermediaries.
          </p>
          <div className="grid grid-cols-3 gap-6 mt-8 pt-6 border-t border-zinc-800">
            <div>
              <p className="text-2xl md:text-3xl font-black text-white">10</p>
              <p className="text-[10px] text-zinc-500 mt-1">years of research</p>
            </div>
            <div>
              <p className="text-2xl md:text-3xl font-black text-white">1</p>
              <p className="text-[10px] text-zinc-500 mt-1">EIP to rule them all</p>
            </div>
            <div>
              <p className="text-2xl md:text-3xl font-black text-emerald-400">&lt;1yr</p>
              <p className="text-[10px] text-zinc-500 mt-1">to ship</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
