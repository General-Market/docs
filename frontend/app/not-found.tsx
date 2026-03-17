import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="min-h-screen bg-page flex items-center justify-center">
      <div className="text-center px-6">
        <h1 className="text-[72px] font-black tracking-[-0.03em] text-black leading-none">404</h1>
        <p className="text-[15px] text-text-secondary mt-3">This page doesn't exist.</p>
        <Link
          href="/"
          className="inline-block mt-6 px-6 py-3 bg-black text-white text-[13px] font-bold hover:bg-zinc-800 transition-colors"
        >
          Back to General Market
        </Link>
      </div>
    </main>
  )
}
