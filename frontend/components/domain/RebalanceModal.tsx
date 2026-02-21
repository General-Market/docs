'use client'

import { useState, useEffect, useRef } from 'react'
import { useAccount } from 'wagmi'
import { encodeFunctionData, decodeFunctionResult } from 'viem'
import { INDEX_ABI, BRIDGE_PROXY_ABI } from '@/lib/contracts/index-protocol-abi'
import { INDEX_PROTOCOL } from '@/lib/contracts/addresses'
import { activeChainId } from '@/lib/wagmi'
import { useChainWriteContract } from '@/hooks/useChainWrite'
import { WalletActionButton } from '@/components/ui/WalletActionButton'
import { getCoinGeckoUrl } from '@/lib/coingecko'
import { DATA_NODE_URL, ARB_RPC_URL as ARB_RPC, L3_RPC_URL as L3_RPC } from '@/lib/config'
const L3_INDEX = '0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6'
const DEPLOYER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'

interface RebalanceModalProps {
  itpId: string
  itpName: string
  onClose: () => void
}

interface AssetRow {
  address: string
  symbol: string
  currentWeight: bigint
  newWeight: string // user-editable string (percentage)
  isNew?: boolean   // true if added via search (not in current ITP)
}

type Status = 'idle' | 'requesting' | 'confirming' | 'executing' | 'success' | 'error'

async function rpcCall(rpcUrl: string, method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
    signal: AbortSignal.timeout(15_000),
  })
  const json = await res.json()
  if (json.error) throw new Error(`${json.error.message}${json.error.data ? ` (data: ${json.error.data})` : ''}`)
  return json.result
}

async function fetchItpState(itpId: string) {
  const calldata = encodeFunctionData({
    abi: INDEX_ABI,
    functionName: 'getITPState',
    args: [itpId as `0x${string}`],
  })

  const result = await rpcCall(L3_RPC, 'eth_call', [
    { to: L3_INDEX, data: calldata },
    'latest',
  ]) as `0x${string}`

  const decoded = decodeFunctionResult({
    abi: INDEX_ABI,
    functionName: 'getITPState',
    data: result,
  }) as [string, bigint, bigint, string[], bigint[], bigint[]]

  return {
    creator: decoded[0],
    totalSupply: decoded[1],
    nav: decoded[2],
    assets: decoded[3],
    weights: decoded[4],
    inventory: decoded[5],
  }
}

/** Poll Arb RPC for a receipt — retries for up to `timeoutMs` before giving up */
async function waitForArbReceipt(hash: string, timeoutMs = 20_000): Promise<any> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const receipt = await rpcCall(ARB_RPC, 'eth_getTransactionReceipt', [hash]) as any
    if (receipt) return receipt
    await new Promise(r => setTimeout(r, 1_000))
  }
  throw new Error(
    `Transaction receipt not found after ${timeoutMs / 1000}s. ` +
    `Ensure MetaMask chain ${activeChainId} points to ${ARB_RPC}. Tx hash: ${hash}`
  )
}

export function RebalanceModal({ itpId, itpName, onClose }: RebalanceModalProps) {
  const { address } = useAccount()
  const [assets, setAssets] = useState<AssetRow[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [txHash, setTxHash] = useState('')

  // Search bar state for adding new assets
  const [searchTerm, setSearchTerm] = useState('')
  const [availableAssets, setAvailableAssets] = useState<{ address: string; symbol: string }[]>([])

  // wagmi hooks for Step 1: requestRebalance on BridgeProxy (through MetaMask)
  const {
    writeContract,
    data: requestHash,
    isPending: isWalletPending,
    error: writeError,
    reset: resetWrite,
  } = useChainWriteContract()

  // Track rebalance params for Step 2
  const rebalanceParamsRef = useRef<{
    newWeights: bigint[]
    newAssetAddresses: `0x${string}`[]
    removedIndices: bigint[]
  } | null>(null)

  // Load available assets from deployed-assets.json
  useEffect(() => {
    fetch('/deployed-assets.json')
      .then(res => res.ok ? res.json() : Promise.reject('not found'))
      .then((data: { address: string; symbol: string }[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setAvailableAssets(data)
        }
      })
      .catch(() => {})
  }, [])

  // Load ITP state + symbols on mount
  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const state = await fetchItpState(itpId)

        let symbolMap: Record<string, string> = {}
        try {
          const res = await fetch(`${DATA_NODE_URL}/aum-ranking?top_n=200`, {
            signal: AbortSignal.timeout(5_000),
          })
          if (res.ok) {
            const data = await res.json()
            const latest = data.snapshots?.[data.snapshots.length - 1]
            if (latest?.ranked) {
              for (const r of latest.ranked) {
                symbolMap[r.address.toLowerCase()] = r.symbol
              }
            }
          }
        } catch {
          // symbols are nice-to-have
        }

        if (cancelled) return

        const rows: AssetRow[] = state.assets.map((addr, i) => ({
          address: addr,
          symbol: symbolMap[addr.toLowerCase()] || `Asset ${i}`,
          currentWeight: state.weights[i],
          newWeight: (Number(state.weights[i]) / 1e16).toFixed(2),
        }))

        setAssets(rows)
      } catch (e: any) {
        setErrorMsg(e.message || 'Failed to load ITP state')
        setStatus('error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [itpId])

  // Handle writeError from wagmi
  useEffect(() => {
    if (writeError) {
      console.error('[Rebalance] writeError:', writeError)
      const msg = writeError.message || 'Transaction failed'
      const shortMsg = msg.includes('User rejected')
        ? 'Transaction rejected in wallet'
        : msg.includes('Details:')
          ? msg.split('Details:')[1].trim().slice(0, 200)
          : msg.slice(0, 200)
      setErrorMsg(shortMsg)
      setStatus('error')
    }
  }, [writeError])

  // When MetaMask returns a hash, manually poll for receipt then proceed to Step 2.
  // This is more reliable than useWaitForTransactionReceipt on local Anvil.
  useEffect(() => {
    if (!requestHash || status !== 'confirming') return
    const arbTxHash = requestHash // capture for closure (non-null)

    let cancelled = false

    async function confirmAndExecute() {
      try {
        // Step 1 done: wait for receipt on Arb Anvil
        const receipt = await waitForArbReceipt(arbTxHash)
        if (cancelled) return

        if (receipt.status === '0x0') {
          throw new Error('requestRebalance reverted on Arbitrum')
        }

        // Step 2: Execute rebalance on L3
        setStatus('executing')
        const params = rebalanceParamsRef.current
        if (!params) throw new Error('Rebalance params missing')

        // Fetch current prices for ALL assets
        const addresses = assets.map(a => a.address).join(',')
        const priceRes = await fetch(
          `${DATA_NODE_URL}/fast-prices-by-address?addresses=${addresses}`,
          { signal: AbortSignal.timeout(10_000) },
        )
        if (!priceRes.ok) throw new Error(`Failed to fetch prices: ${priceRes.status}`)
        const priceJson = await priceRes.json() as {
          prices: Record<string, { price: string; symbol: string }>
        }

        const prices = assets.map(a => {
          const entry = priceJson.prices[a.address.toLowerCase()] ?? priceJson.prices[a.address]
          if (!entry) throw new Error(`No price for ${a.symbol} (${a.address})`)
          return BigInt(entry.price)
        })

        // Encode Index.rebalance() calldata
        const calldata = encodeFunctionData({
          abi: INDEX_ABI,
          functionName: 'rebalance',
          args: [
            itpId as `0x${string}`,
            params.removedIndices,
            params.newAssetAddresses,
            params.newWeights,
            prices,
            '0x', // empty BLS signature (bypassed in dev)
          ],
        })

        // Execute on L3 via raw RPC (deployer simulates issuer consensus)
        const hash = await rpcCall(L3_RPC, 'eth_sendTransaction', [{
          from: DEPLOYER,
          to: L3_INDEX,
          data: calldata,
          gas: '0x500000',
        }]) as string

        const l3Receipt = await rpcCall(L3_RPC, 'eth_getTransactionReceipt', [hash]) as any
        if (l3Receipt && l3Receipt.status === '0x0') {
          throw new Error('Rebalance execution reverted on L3')
        }

        if (!cancelled) {
          setTxHash(hash)
          setStatus('success')
        }
      } catch (e: any) {
        if (!cancelled) {
          console.error('[Rebalance] error:', e)
          setErrorMsg(e.message || 'Rebalance failed')
          setStatus('error')
        }
      }
    }

    confirmAndExecute()
    return () => { cancelled = true }
  }, [requestHash, status, assets, itpId])

  // Filter available assets: match search, exclude already-selected
  const assetAddresses = new Set(assets.map(a => a.address.toLowerCase()))
  const filteredSearch = searchTerm.length > 0
    ? availableAssets.filter(
        a => a.symbol.toLowerCase().includes(searchTerm.toLowerCase()) &&
             !assetAddresses.has(a.address.toLowerCase())
      ).slice(0, 8)
    : []

  function addAsset(asset: { address: string; symbol: string }) {
    setAssets(prev => [...prev, {
      address: asset.address,
      symbol: asset.symbol,
      currentWeight: 0n,
      newWeight: '0',
      isNew: true,
    }])
    setSearchTerm('')
  }

  function removeAsset(index: number) {
    setAssets(prev => prev.filter((_, i) => i !== index))
  }

  // Compute weight sum
  const weightSum = assets.reduce((sum, a) => sum + parseFloat(a.newWeight || '0'), 0)
  const isValid = Math.abs(weightSum - 100) < 0.001 && assets.length > 0

  function setEqualWeights() {
    const pct = (100 / assets.length).toFixed(2)
    const perAsset = parseFloat(pct)
    const remainder = 100 - perAsset * assets.length
    setAssets(prev => prev.map((a, i) => ({
      ...a,
      newWeight: i === 0
        ? (perAsset + remainder).toFixed(2)
        : pct,
    })))
  }

  function updateWeight(index: number, value: string) {
    setAssets(prev => prev.map((a, i) => i === index ? { ...a, newWeight: value } : a))
  }

  function handleRebalance() {
    if (!address || !isValid) return

    resetWrite()
    setErrorMsg('')

    const newAssetRows = assets.filter(a => a.isNew)
    const removedIndices: bigint[] = []

    const newWeights = assets.map(a => {
      const pct = parseFloat(a.newWeight)
      return BigInt(Math.round(pct * 1e16))
    })

    // Store params for Step 2 (captured by ref — no re-render dependency)
    rebalanceParamsRef.current = {
      newWeights,
      newAssetAddresses: newAssetRows.map(a => a.address as `0x${string}`),
      removedIndices,
    }

    // Set status to requesting (wallet pending), will advance to confirming when hash arrives
    setStatus('requesting')

    // Step 1: Submit requestRebalance through MetaMask
    writeContract({
      address: INDEX_PROTOCOL.bridgeProxy,
      abi: BRIDGE_PROXY_ABI,
      functionName: 'requestRebalance',
      args: [
        itpId as `0x${string}`,
        removedIndices,
        newAssetRows.map(a => a.address as `0x${string}`),
        newWeights,
        'Frontend rebalance request',
      ],
    })
  }

  // Advance from 'requesting' to 'confirming' once wallet returns hash
  useEffect(() => {
    if (requestHash && status === 'requesting') {
      setStatus('confirming')
    }
  }, [requestHash, status])

  const isWorking = status === 'requesting' || status === 'confirming' || status === 'executing'

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-card border border-border-light rounded-xl shadow-modal max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-text-primary">Rebalance {itpName}</h2>
            <button onClick={onClose} className="text-text-muted hover:text-text-primary text-2xl leading-none">&times;</button>
          </div>
          <p className="text-xs text-text-muted font-mono mb-4 break-all">ITP ID: {itpId}</p>

          {loading ? (
            <div className="text-center py-8 text-text-muted">Loading ITP state...</div>
          ) : status === 'error' && assets.length === 0 ? (
            <div className="bg-surface-down border border-color-down/30 rounded-lg p-3 text-color-down text-sm">
              {errorMsg}
            </div>
          ) : (
            <>
              {/* Add asset search bar */}
              <div className="bg-muted border border-border-light rounded-lg p-3 mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-text-secondary">Add Asset ({assets.length} in basket, {availableAssets.length} available)</span>
                </div>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search asset to add..."
                  className="w-full bg-card border border-border-medium rounded-lg px-3 py-1.5 text-sm text-text-primary focus:border-zinc-600 focus:outline-none mb-2"
                  disabled={isWorking || status === 'success'}
                />
                {filteredSearch.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {filteredSearch.map(asset => (
                      <div key={asset.address} className="relative group">
                        <button
                          onClick={() => addAsset(asset)}
                          className="px-2 py-0.5 pr-5 bg-card border border-border-medium rounded text-xs text-text-primary hover:border-zinc-500 transition-colors"
                        >
                          + {asset.symbol}
                        </button>
                        <a
                          href={getCoinGeckoUrl(asset.symbol)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="absolute top-0 right-0 px-1 py-0.5 text-text-muted hover:text-text-primary text-xs transition-colors"
                          title={`View ${asset.symbol} on CoinGecko`}
                        >
                          &nearr;
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick-set buttons */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={setEqualWeights}
                  className="px-3 py-1 text-xs border border-border-medium rounded text-text-secondary hover:border-zinc-500 hover:text-text-primary transition-colors"
                >
                  Equal Weights
                </button>
              </div>

              {/* Weight sum indicator */}
              <div className={`flex justify-between items-center mb-3 p-2 rounded text-sm font-mono ${
                isValid
                  ? 'bg-surface-up border border-color-up/30 text-color-up'
                  : 'bg-surface-down border border-color-down/30 text-color-down'
              }`}>
                <span>Weight Sum</span>
                <span>{weightSum.toFixed(2)}%</span>
              </div>

              {/* Asset table */}
              <div className="max-h-[400px] overflow-y-auto border border-border-light rounded-lg">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted">
                    <tr className="text-text-muted text-xs">
                      <th className="text-left p-2">Asset</th>
                      <th className="text-right p-2">Current %</th>
                      <th className="text-right p-2">New %</th>
                      <th className="p-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {assets.map((asset, i) => (
                      <tr key={asset.address} className={`border-t border-border-light hover:bg-card-hover ${asset.isNew ? 'bg-surface-up/30' : ''}`}>
                        <td className="p-2">
                          <span className="text-text-secondary">{asset.symbol}</span>
                          <a
                            href={getCoinGeckoUrl(asset.symbol)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-1 text-text-muted hover:text-text-primary text-xs transition-colors"
                            title={`View ${asset.symbol} on CoinGecko`}
                          >
                            &nearr;
                          </a>
                          {asset.isNew && <span className="ml-1 text-color-up text-xs">NEW</span>}
                        </td>
                        <td className="p-2 text-right text-text-muted font-mono">
                          {asset.isNew ? '—' : `${(Number(asset.currentWeight) / 1e16).toFixed(2)}%`}
                        </td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={asset.newWeight}
                            onChange={e => updateWeight(i, e.target.value)}
                            className="w-20 bg-muted border border-border-medium rounded px-2 py-1 text-right text-text-primary font-mono text-sm focus:border-zinc-600 focus:outline-none"
                            disabled={isWorking || status === 'success'}
                          />
                        </td>
                        <td className="p-2 text-center">
                          {asset.isNew && !isWorking && status !== 'success' && (
                            <button
                              onClick={() => removeAsset(i)}
                              className="text-color-down hover:text-color-down/80 text-sm"
                            >
                              x
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Status messages */}
              {status === 'requesting' && (
                <div className="mt-4 bg-color-info/10 border border-color-info/30 rounded-lg p-3 text-color-info text-sm">
                  Step 1/2: Confirm in your wallet...
                </div>
              )}

              {status === 'confirming' && (
                <div className="mt-4 bg-color-info/10 border border-color-info/30 rounded-lg p-3 text-color-info text-sm">
                  Step 1/2: Confirming on-chain...
                  {requestHash && <p className="text-xs font-mono mt-1 text-color-info/60 break-all">Tx: {requestHash}</p>}
                </div>
              )}

              {status === 'executing' && (
                <div className="mt-4 bg-color-info/10 border border-color-info/30 rounded-lg p-3 text-color-info text-sm">
                  Step 2/2: Executing rebalance on L3 (issuer consensus)...
                </div>
              )}

              {status === 'error' && errorMsg && (
                <div className="mt-4 bg-surface-down border border-color-down/30 rounded-lg p-3 text-color-down text-sm break-all">
                  {errorMsg}
                </div>
              )}

              {status === 'success' && (
                <div className="mt-4 bg-surface-up border border-color-up/30 rounded-lg p-3 text-color-up text-sm">
                  <p className="font-medium mb-1">Rebalanced!</p>
                  <p className="text-xs font-mono break-all text-color-up/70">L3 Tx: {txHash}</p>
                </div>
              )}

              {/* Submit button */}
              <div className="flex gap-3 mt-4">
                <WalletActionButton
                  onClick={handleRebalance}
                  disabled={!isValid || isWorking || status === 'success'}
                  className="flex-1 py-3 bg-zinc-900 text-white font-medium rounded-lg text-sm hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {status === 'requesting' ? 'Waiting for wallet...'
                    : status === 'confirming' ? 'Confirming...'
                    : status === 'executing' ? 'Executing on L3...'
                    : status === 'success' ? 'Rebalanced!'
                    : 'Rebalance'}
                </WalletActionButton>
                <a
                  href="https://discord.gg/xsfgzwR6"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-3 bg-zinc-900 text-white font-medium rounded-lg text-sm hover:bg-zinc-800 transition-colors flex items-center"
                >
                  Support
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
