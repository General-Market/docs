// Browser-side dedupe for the two big static JSON files served from /public.
// Without this, four components and one hook each call fetch('/coin-map.json')
// on mount — same 374 KB decoded, four times. Same story for deployed-assets.

export type CoinEntry = { id: string; image: string }
export type CoinMap = Record<string, CoinEntry>
export type DeployedAsset = { address: string; symbol: string }

let coinMapPromise: Promise<CoinMap> | null = null
let deployedAssetsPromise: Promise<DeployedAsset[]> | null = null

export function loadCoinMap(): Promise<CoinMap> {
  if (typeof window === 'undefined') return Promise.resolve({})
  if (!coinMapPromise) {
    coinMapPromise = fetch('/coin-map.json', { signal: AbortSignal.timeout(10_000) })
      .then(r => (r.ok ? (r.json() as Promise<CoinMap>) : {}))
      .catch(() => {
        coinMapPromise = null
        return {} as CoinMap
      })
  }
  return coinMapPromise
}

export function loadDeployedAssets(): Promise<DeployedAsset[]> {
  if (typeof window === 'undefined') return Promise.resolve([])
  if (!deployedAssetsPromise) {
    deployedAssetsPromise = fetch('/deployed-assets.json')
      .then(r => (r.ok ? (r.json() as Promise<DeployedAsset[]>) : []))
      .then(data => (Array.isArray(data) ? data : []))
      .catch(() => {
        deployedAssetsPromise = null
        return [] as DeployedAsset[]
      })
  }
  return deployedAssetsPromise
}
