import Link from 'next/link'

// Dark-native 404. The address you typed never existed, or no longer
// does. Either way, there is no page to find.

export default function NotFound() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
          404
        </p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-tight text-zinc-50">
          Nothing here<span className="text-rose-500">.</span>
        </h1>
        <p className="mt-3 font-mono text-[12px] text-zinc-500">
          The page you wanted does not exist. Either it never did, or it
          stopped existing while you weren't looking.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex items-center gap-2 rounded border border-zinc-700 bg-zinc-900 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-200 hover:border-zinc-500 hover:text-zinc-50 transition-colors"
        >
          ← back to nsgame
        </Link>
      </div>
    </main>
  )
}
