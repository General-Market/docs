import Link from 'next/link'

export default function RoomLanding() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center space-y-6">
        <h1 className="text-3xl font-semibold tracking-tight">Access link required</h1>
        <p className="text-[17px] leading-relaxed text-neutral-600">
          Investor data rooms are reached through a personal link.
          If you were sent one, follow it. If not, the deck is public.
        </p>
        <div className="pt-4">
          <Link
            href="/pitchdeck"
            className="inline-flex items-center justify-center rounded-full bg-black text-white px-6 py-3 text-[15px] font-medium hover:bg-neutral-800 transition-colors"
          >
            See the public deck
          </Link>
        </div>
      </div>
    </main>
  )
}
