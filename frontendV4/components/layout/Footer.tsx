'use client'

export function Footer() {
  return (
    <footer className="bg-page text-text-inverse mt-auto border-t border-border-dark">
      <div className="max-w-site mx-auto px-6 lg:px-12 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div>
            <span className="text-lg font-semibold tracking-tight">General Market</span>
            <p className="text-text-inverse-muted text-sm mt-3 leading-relaxed">
              The institutional-grade protocol for on-chain index products.
            </p>
          </div>

          {/* Protocol */}
          <div>
            <h4 className="text-xs font-medium uppercase tracking-widest text-text-inverse-muted mb-4">Protocol</h4>
            <ul className="space-y-2.5">
              <li><span className="text-sm text-text-inverse-muted hover:text-text-inverse transition-colors cursor-pointer">Markets</span></li>
              <li><span className="text-sm text-text-inverse-muted hover:text-text-inverse transition-colors cursor-pointer">Create ITP</span></li>
              <li><span className="text-sm text-text-inverse-muted hover:text-text-inverse transition-colors cursor-pointer">Portfolio</span></li>
              <li><span className="text-sm text-text-inverse-muted hover:text-text-inverse transition-colors cursor-pointer">System Status</span></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-xs font-medium uppercase tracking-widest text-text-inverse-muted mb-4">Resources</h4>
            <ul className="space-y-2.5">
              <li><a href="https://discord.gg/xsfgzwR6" target="_blank" rel="noopener noreferrer" className="text-sm text-text-inverse-muted hover:text-text-inverse transition-colors">Discord</a></li>
              <li><a href="https://x.com/otc_max" target="_blank" rel="noopener noreferrer" className="text-sm text-text-inverse-muted hover:text-text-inverse transition-colors">Twitter / X</a></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-xs font-medium uppercase tracking-widest text-text-inverse-muted mb-4">Legal</h4>
            <ul className="space-y-2.5">
              <li><a href="/terms" className="text-sm text-text-inverse-muted hover:text-text-inverse transition-colors">Terms of Service</a></li>
              <li><a href="/privacy" className="text-sm text-text-inverse-muted hover:text-text-inverse transition-colors">Privacy Policy</a></li>
              <li><span className="text-sm text-text-inverse-muted">Risk Disclosures</span></li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-border-dark">
        <div className="max-w-site mx-auto px-6 lg:px-12 py-4 flex flex-col md:flex-row justify-between items-center gap-2">
          <p className="text-xs text-text-inverse-muted">
            &copy; 2026 General Market. All rights reserved.
          </p>
          <p className="text-xs text-text-inverse-muted/60 max-w-xl text-center md:text-right">
            Index products involve risk. Past performance does not guarantee future results. This is not financial advice.
          </p>
        </div>
      </div>
    </footer>
  )
}
