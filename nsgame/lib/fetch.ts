/**
 * Proxy-aware fetch wrappers.
 * Browser calls go through /api/* catch-all proxies — no mixed-content, no CORS.
 * Server-side calls go direct to avoid an extra hop.
 */

export function dnFetch(path: string, init?: RequestInit): Promise<Response> {
  const prefix = typeof window !== 'undefined'
    ? '/api/dn'
    : (process.env.DATA_NODE_URL || 'http://localhost:8200')
  const url = path.startsWith('/') ? `${prefix}${path}` : `${prefix}/${path}`
  return fetch(url, init)
}

export function oracleFetch(path: string, init?: RequestInit): Promise<Response> {
  const prefix = typeof window !== 'undefined'
    ? '/api/oracle'
    : (process.env.ORACLE_URL || 'http://localhost:9001')
  const url = path.startsWith('/') ? `${prefix}${path}` : `${prefix}/${path}`
  return fetch(url, init)
}

export function visionFetch(path: string, init?: RequestInit): Promise<Response> {
  const prefix = typeof window !== 'undefined'
    ? '/api/vision'
    : (process.env.VISION_API_URL || 'http://localhost:10001')
  const url = path.startsWith('/') ? `${prefix}${path}` : `${prefix}/${path}`
  return fetch(url, init)
}

export function backendFetch(path: string, init?: RequestInit): Promise<Response> {
  const prefix = typeof window !== 'undefined'
    ? '/api/backend'
    : (process.env.BACKEND_URL || 'http://localhost:3001')
  const url = path.startsWith('/') ? `${prefix}${path}` : `${prefix}/${path}`
  return fetch(url, init)
}
