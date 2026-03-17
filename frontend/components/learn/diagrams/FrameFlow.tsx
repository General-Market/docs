'use client'

import { motion } from 'framer-motion'

interface Step {
  label: string
  sub?: string
}

function FlowDiagram({ steps, caption }: { steps: Step[]; caption?: string }) {
  return (
    <div className="my-10 -mx-4 md:-mx-8">
      <div className="bg-[#f5f5f5] border-t-[3px] border-b border-black border-b-border-light px-6 md:px-10 py-8">
        <div className="flex items-center justify-center gap-0 overflow-x-auto py-4">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-0 shrink-0">
              <motion.div
                className="group relative bg-white border border-zinc-200 hover:border-black hover:bg-black transition-all duration-200 px-6 py-4 min-w-[130px] text-center cursor-default"
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.4 }}
                whileHover={{ y: -3 }}
              >
                <div className="absolute top-0 left-2 right-2 h-[2px] bg-black group-hover:bg-white transition-colors" />
                <p className="text-[13px] font-bold text-black group-hover:text-white transition-colors tracking-[-0.01em]">{step.label}</p>
                {step.sub && <p className="text-[10px] text-text-muted group-hover:text-zinc-400 transition-colors mt-1">{step.sub}</p>}
                <span className="absolute -top-2.5 left-3 text-[9px] font-mono text-text-muted bg-[#f5f5f5] px-1 group-hover:text-zinc-500">{String(i + 1).padStart(2, '0')}</span>
              </motion.div>
              {i < steps.length - 1 && (
                <motion.div className="flex items-center px-1.5" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.1 + 0.2 }}>
                  <div className="w-6 h-[1px] bg-zinc-300" />
                  <div className="w-0 h-0 border-t-[3px] border-t-transparent border-b-[3px] border-b-transparent border-l-[5px] border-l-zinc-300" />
                </motion.div>
              )}
            </div>
          ))}
        </div>
        {caption && <p className="text-[11px] text-text-muted tracking-[0.05em] text-center mt-2">{caption}</p>}
      </div>
    </div>
  )
}

// Pre-built flow variants for MDX (no complex props needed)
export function FlowNormalTx() {
  return <FlowDiagram steps={[{ label: 'Validate', sub: 'Check sig, ACCEPT sender + gas' }, { label: 'Execute', sub: 'Transfer, swap, stake' }]} caption="Standard smart account transaction — any signature scheme works" />
}

export function FlowAtomicOps() {
  return <FlowDiagram steps={[{ label: 'Validate', sub: 'Check signature' }, { label: 'Approve', sub: 'ERC-20 approval' }, { label: 'Spend', sub: 'Swap on DEX' }]} caption="Atomic batch — no more 'approve then pray the swap goes through'" />
}

export function FlowNewAccount() {
  return <FlowDiagram steps={[{ label: 'Deploy', sub: 'EIP-7997 factory' }, { label: 'Validate', sub: 'ACCEPT sender + gas' }, { label: 'Execute', sub: 'First operation' }]} caption="Same address on every chain — deploy once, use everywhere" />
}

export function FlowPrivacyZK() {
  return <FlowDiagram steps={[{ label: 'ZK Verify', sub: 'Proof is valid' }, { label: 'Paymaster', sub: 'ACCEPT → gas' }, { label: 'Execute', sub: 'Private operation' }]} caption="Paymaster doesn't know WHO you are — only that the proof checks out" />
}

// Keep generic version for programmatic use (not from MDX)
export function FrameFlow({ steps, caption }: { steps: Step[]; caption?: string }) {
  return <FlowDiagram steps={steps || []} caption={caption} />
}
