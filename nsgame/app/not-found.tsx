import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="min-h-screen bg-page flex items-center justify-center">
      <div className="text-center px-6 animate-fade-up">
        <h1 className="text-[72px] font-black tracking-tight text-black leading-none">404</h1>
        <p className="text-body text-text-secondary mt-3">This page doesn't exist.</p>
        <Link
          href="/"
          className="inline-block mt-6 px-6 py-3 bg-black text-white text-caption font-bold hover:bg-zinc-800 transition-colors"
        >
          Back to nsgame
        </Link>
      </div>
    </main>
  )
}
