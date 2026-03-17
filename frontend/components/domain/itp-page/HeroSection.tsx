interface HeroSectionProps {
  label?: string
  symbol: string
  name: string
  onBuy: () => void
}

export function HeroSection({ label, symbol, name, onBuy }: HeroSectionProps) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 py-6">
      <div>
        {label && (
          <div className="text-xs font-semibold uppercase tracking-widest text-text-secondary mb-2">
            {label}
          </div>
        )}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="bg-text-primary text-text-inverse px-3 py-1.5 text-sm font-bold inline-block">
            {symbol}
          </span>
          <h1 className="text-3xl lg:text-4xl font-bold text-text-primary">
            {name}
          </h1>
        </div>
      </div>
      <button
        onClick={onBuy}
        className="bg-text-primary text-text-inverse px-8 py-3 text-sm font-bold hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-text-primary focus:ring-offset-2"
      >
        Buy This Index
      </button>
    </div>
  )
}
