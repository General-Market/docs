'use client'

import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'

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
              <p className="text-caption font-bold text-black mt-2 tracking-tight">{s.label}</p>
              {s.sub && <p className="text-micro text-text-muted mt-1">{s.sub}</p>}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Pre-built: article opening stats
export function StatsOverview() {
  const t = useTranslations('pages')
  return <StatCardsBase stats={[
    { value: '10', label: t('learn.visual_cards.years_of_research'), sub: t('learn.visual_cards.years_of_research_sub') },
    { value: '1', label: t('learn.visual_cards.primitive'), sub: t('learn.visual_cards.frame_transactions') },
    { value: 'N', label: t('learn.visual_cards.frames_per_tx'), sub: t('learn.visual_cards.frames_per_tx_sub') },
    { value: '0', label: t('learn.visual_cards.intermediaries'), sub: t('learn.visual_cards.intermediaries_sub') },
  ]} />
}

// Pre-built: what this unlocks
export function StatsUnlocked() {
  const t = useTranslations('pages')
  return <StatCardsBase stats={[
    { value: '8', label: t('learn.visual_cards.capabilities'), sub: t('learn.visual_cards.capabilities_sub') },
    { value: '100%', label: t('learn.visual_cards.eoa_compatible'), sub: t('learn.visual_cards.eoa_compatible_sub') },
    { value: '<1yr', label: t('learn.visual_cards.to_hegota_fork'), sub: t('learn.visual_cards.to_hegota_fork_sub') },
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
              <p className="text-caption font-bold text-black tracking-tight">{b.title}</p>
              <p className="text-label text-text-muted mt-1.5 leading-relaxed">{b.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Pre-built: EOA benefits
export function EOABenefits() {
  const t = useTranslations('pages')
  return <BenefitGridBase benefits={[
    { icon: '⚡', title: t('learn.visual_cards.batch_operations'), description: t('learn.visual_cards.batch_operations_desc'), accent: '#3b82f6' },
    { icon: '🎁', title: t('learn.visual_cards.tx_sponsorship'), description: t('learn.visual_cards.tx_sponsorship_desc'), accent: '#22c55e' },
    { icon: '🛡️', title: t('learn.visual_cards.focil_guarantees'), description: t('learn.visual_cards.focil_guarantees_desc'), accent: '#8b5cf6' },
  ]} />
}

// Pre-built: What 8141 solves
export function CapabilityCards() {
  const t = useTranslations('pages')
  return <BenefitGridBase benefits={[
    { icon: '👛', title: t('learn.visual_cards.smart_wallets'), description: t('learn.visual_cards.smart_wallets_desc'), accent: '#3b82f6' },
    { icon: '💱', title: t('learn.visual_cards.gas_any_token'), description: t('learn.visual_cards.gas_any_token_desc'), accent: '#22c55e' },
    { icon: '🔗', title: t('learn.visual_cards.atomic_batch'), description: t('learn.visual_cards.atomic_batch_desc'), accent: '#f59e0b' },
    { icon: '🔒', title: t('learn.visual_cards.privacy_protocols'), description: t('learn.visual_cards.privacy_protocols_desc'), accent: '#8b5cf6' },
    { icon: '🔐', title: t('learn.visual_cards.quantum_resistance'), description: t('learn.visual_cards.quantum_resistance_desc'), accent: '#ef4444' },
    { icon: '🌐', title: t('learn.visual_cards.cross_chain_address'), description: t('learn.visual_cards.cross_chain_address_desc'), accent: '#06b6d4' },
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
              <span className="text-micro font-bold tracking-[0.15em] uppercase text-red-400">{beforeLabel}</span>
            </div>
            <div className="space-y-2.5">
              {before.items.map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-red-400 text-label mt-0.5 shrink-0">✕</span>
                  <span className="text-caption text-zinc-600 leading-relaxed">{item}</span>
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
              <span className="text-micro font-bold tracking-[0.15em] uppercase text-emerald-500">{afterLabel}</span>
            </div>
            <div className="space-y-2.5">
              {after.items.map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-emerald-500 text-label mt-0.5 shrink-0">✓</span>
                  <span className="text-caption text-black font-medium leading-relaxed">{item}</span>
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
  const t = useTranslations('pages')
  return <ComparisonBase
    beforeLabel={t('learn.visual_cards.without_focil_aa')}
    afterLabel={t('learn.visual_cards.with_focil_aa')}
    before={{ items: [
      t('learn.visual_cards.focil_before_1'),
      t('learn.visual_cards.focil_before_2'),
      t('learn.visual_cards.focil_before_3'),
      t('learn.visual_cards.focil_before_4'),
    ] }}
    after={{ items: [
      t('learn.visual_cards.focil_after_1'),
      t('learn.visual_cards.focil_after_2'),
      t('learn.visual_cards.focil_after_3'),
      t('learn.visual_cards.focil_after_4'),
    ] }}
  />
}

// Pre-built: Quantum before/after
export function QuantumComparison() {
  const t = useTranslations('pages')
  return <ComparisonBase
    beforeLabel={t('learn.visual_cards.current_ethereum')}
    afterLabel={t('learn.visual_cards.with_eip8141')}
    before={{ items: [
      t('learn.visual_cards.quantum_before_1'),
      t('learn.visual_cards.quantum_before_2'),
      t('learn.visual_cards.quantum_before_3'),
      t('learn.visual_cards.quantum_before_4'),
    ] }}
    after={{ items: [
      t('learn.visual_cards.quantum_after_1'),
      t('learn.visual_cards.quantum_after_2'),
      t('learn.visual_cards.quantum_after_3'),
      t('learn.visual_cards.quantum_after_4'),
    ] }}
  />
}

/* ═══════════════════════════════════════════
   SummaryBanner — Big closing CTA / summary
   ═══════════════════════════════════════════ */
export function HegotaSummary() {
  const t = useTranslations('pages')
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
          <p className="text-micro font-bold tracking-[0.2em] uppercase text-zinc-500 mb-4">{t('learn.visual_cards.hegota_fork')}</p>
          <p className="text-xl md:text-2xl font-black tracking-tight leading-tight">
            {t('learn.visual_cards.hegota_tagline')}
          </p>
          <div className="grid grid-cols-3 gap-6 mt-8 pt-6 border-t border-zinc-800">
            <div>
              <p className="text-2xl md:text-3xl font-black text-white">10</p>
              <p className="text-micro text-zinc-500 mt-1">{t('learn.visual_cards.years_research')}</p>
            </div>
            <div>
              <p className="text-2xl md:text-3xl font-black text-white">1</p>
              <p className="text-micro text-zinc-500 mt-1">{t('learn.visual_cards.eip_to_rule')}</p>
            </div>
            <div>
              <p className="text-2xl md:text-3xl font-black text-emerald-400">&lt;1yr</p>
              <p className="text-micro text-zinc-500 mt-1">{t('learn.visual_cards.to_ship')}</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
