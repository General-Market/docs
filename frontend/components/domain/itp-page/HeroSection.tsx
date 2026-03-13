interface HeroSectionProps {
  label?: string
  symbol: string
  name: string
  onBuy: () => void
  onSell: () => void
}

export function HeroSection({ label, symbol, name, onBuy, onSell }: HeroSectionProps) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 py-6">
      <div>
        {label && (
          <div className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
            {label}
          </div>
        )}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="bg-gray-900 text-white px-3 py-1.5 text-sm font-bold inline-block">
            {symbol}
          </span>
          <h1 className="text-3xl lg:text-4xl font-bold text-gray-900">
            {name}
          </h1>
        </div>
      </div>
      <div className="flex gap-3">
        <button
          onClick={onBuy}
          className="bg-gray-900 text-white px-8 py-3 text-sm font-bold hover:bg-gray-800 transition-colors"
        >
          Buy This Index
        </button>
        <button
          onClick={onSell}
          className="border-2 border-gray-900 text-gray-900 px-8 py-3 text-sm font-bold hover:bg-gray-900 hover:text-white transition-colors"
        >
          Sell
        </button>
      </div>
    </div>
  )
}
