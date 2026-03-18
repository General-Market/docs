'use client'

import { motion } from 'framer-motion'

/* ═══════════════════════════════════════════
   ScalingStats — Opening stat bar
   4 key numbers for the Ethereum scaling article
   ═══════════════════════════════════════════ */

const stats = [
  { value: '100x', label: 'throughput target' },
  { value: '5', label: 'independent upgrades' },
  { value: '3 years', label: 'timeline' },
  { value: '1,500 TPS', label: 'target capacity' },
]

export function ScalingStats() {
  return (
    <div className="my-10 -mx-4 md:-mx-8">
      <div className="bg-white border-t-[3px] border-b border-black border-b-border-light">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0 divide-y md:divide-y-0 md:divide-x divide-zinc-200">
          {stats.map((s, i) => (
            <motion.div
              key={i}
              className="px-4 md:px-8 py-6 md:py-8 text-center"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
            >
              <p className="text-[32px] font-black tracking-tighter text-black">{s.value}</p>
              <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-zinc-500 mt-2">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════
   ScalingSummary — Closing banner
   Black bg, white text, key takeaway
   ═══════════════════════════════════════════ */

export function ScalingSummary() {
  return (
    <div className="my-10 -mx-4 md:-mx-8">
      <motion.div
        className="bg-black text-white px-6 md:px-12 py-10 md:py-14"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-[28px] md:text-[32px] font-black tracking-tight leading-[1.15]">
            Solo stakers survive. 100x throughput. No compromise.
          </p>
          <p className="text-[14px] text-zinc-400 mt-5 leading-relaxed">
            Parallel verification + ePBS + multidimensional gas + PeerDAS + ZK-EVM. Five upgrades, one validated block.
          </p>
        </div>
      </motion.div>
    </div>
  )
}
