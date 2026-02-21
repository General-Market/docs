'use client'

export function Footer() {
  return (
    <footer className="bg-black text-white/50 py-6 px-6 lg:px-12 text-[11px]">
      <div className="max-w-site mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
        <span>&copy; 2026 General Market. All rights reserved.</span>
        <div>
          <a href="/privacy" className="text-white/70 hover:text-white transition-colors ml-6">Privacy</a>
          <a href="/terms" className="text-white/70 hover:text-white transition-colors ml-6">Terms</a>
          <a href="#" className="text-white/70 hover:text-white transition-colors ml-6">Docs</a>
          <a href="https://discord.gg/xsfgzwR6" target="_blank" rel="noopener noreferrer" className="text-white/70 hover:text-white transition-colors ml-6">Discord</a>
        </div>
      </div>
    </footer>
  )
}
