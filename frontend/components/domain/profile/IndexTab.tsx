'use client'

interface IndexTabProps {
  address: string
}

export function IndexTab({ address: _address }: IndexTabProps) {
  return (
    <div className="py-12 text-center text-sm text-text-muted animate-fade-in">
      ITP holdings for this address are coming soon.
    </div>
  )
}
