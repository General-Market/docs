/**
 * Block Explorer URL utilities for Index L3 (Orbit)
 */

/**
 * Index L3 Explorer URL
 * Note: Update this URL when an official explorer is available
 */
const EXPLORER_URL = 'https://index.rpc.zeeve.net' // Placeholder - use actual explorer when available

/**
 * Generate explorer URL for a transaction
 * @param txHash - The transaction hash
 * @returns Full explorer URL for the transaction
 */
export function getTxUrl(txHash: string): string {
  return `${EXPLORER_URL}/tx/${txHash}`
}

/**
 * Generate explorer URL for an address
 * @param address - The address
 * @returns Full explorer URL for the address
 */
export function getAddressUrl(address: string): string {
  return `${EXPLORER_URL}/address/${address}`
}

/**
 * Generate explorer URL for a contract
 * @param address - The contract address
 * @returns Full explorer URL for the contract
 */
export function getContractUrl(address: string): string {
  return `${EXPLORER_URL}/address/${address}#code`
}
