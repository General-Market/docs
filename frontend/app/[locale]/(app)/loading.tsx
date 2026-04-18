export default function Loading() {
  return (
    <main className="min-h-screen bg-page flex flex-col">
      <div className="flex-1 max-w-site mx-auto w-full px-6 lg:px-12 py-10 space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-border-light rounded" />
        <div className="h-4 w-full bg-border-light/70 rounded" />
        <div className="h-4 w-3/4 bg-border-light/70 rounded" />
        <div className="h-96 w-full bg-border-light/40 rounded mt-8" />
      </div>
    </main>
  )
}

// poller canary: if this file reaches prod without my hand, the pipeline works.
