'use client'

export function Footer() {
  return (
    <footer className="bg-zinc-950 text-white/60 pt-12 pb-6 px-6 lg:px-12 text-[12px]">
      <div className="max-w-site mx-auto">
        {/* 3-column grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 pb-10 border-b border-white/10">
          {/* Col 1: Brand */}
          <div>
            <span className="text-white font-bold text-[15px] tracking-tight">General Market</span>
            <p className="mt-2 text-white/40 leading-relaxed text-[11px]">
              Institutional-grade index products for the digital asset economy.
            </p>
            <div className="flex gap-3 mt-4">
              <a
                href="https://discord.gg/xsfgzwR6"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/40 hover:text-white transition-colors"
                aria-label="Discord"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
                </svg>
              </a>
              <a
                href="https://x.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/40 hover:text-white transition-colors"
                aria-label="X (Twitter)"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Col 2: Product */}
          <div>
            <span className="text-white/80 font-semibold text-[11px] uppercase tracking-[0.1em] block mb-3">Product</span>
            <ul className="space-y-2">
              <li><a href="/#indexes" className="hover:text-white transition-colors">Indexes</a></li>
              <li><a href="/#simulation" className="hover:text-white transition-colors">Simulation</a></li>
              <li><a href="/#lending" className="hover:text-white transition-colors">Lending</a></li>
              <li><a href="/#create-itp" className="hover:text-white transition-colors">Create ITP</a></li>
            </ul>
          </div>

          {/* Col 3: Resources */}
          <div>
            <span className="text-white/80 font-semibold text-[11px] uppercase tracking-[0.1em] block mb-3">Resources</span>
            <ul className="space-y-2">
              <li><a href="#" className="hover:text-white transition-colors">Docs</a></li>
              <li><a href="https://discord.gg/xsfgzwR6" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Discord</a></li>
              <li><a href="/privacy" className="hover:text-white transition-colors">Privacy Policy</a></li>
              <li><a href="/terms" className="hover:text-white transition-colors">Terms of Service</a></li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-6 flex flex-col sm:flex-row justify-between items-center gap-3">
          <span className="text-white/30 text-[10px]">&copy; 2026 General Market. All rights reserved.</span>
          <p className="text-white/25 text-[10px] max-w-xl text-center sm:text-right leading-relaxed">
            Index products involve risk. Past performance does not guarantee future results. This platform does not provide financial advice.
          </p>
        </div>
      </div>
    </footer>
  )
}
