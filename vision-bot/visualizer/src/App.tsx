import { useState } from 'react'
import { StatusBar } from './components/StatusBar'
import { Sidebar } from './components/Sidebar'
import { AssetView } from './components/AssetView'
import { useIndex } from './lib/queries'
import type { IndexItem } from './lib/types'

export function App() {
  const { data: index, error, isPending } = useIndex()
  const [selected, setSelected] = useState<IndexItem | null>(null)

  return (
    <div className="grid h-full grid-cols-[360px_1fr] grid-rows-[auto_1fr]">
      <StatusBar
        player={index?.player}
        stats={index?.stats}
        loading={isPending}
        error={error?.message}
      />
      <Sidebar
        items={index?.items ?? []}
        selected={selected}
        onSelect={setSelected}
        loading={isPending}
      />
      <AssetView item={selected} />
    </div>
  )
}
