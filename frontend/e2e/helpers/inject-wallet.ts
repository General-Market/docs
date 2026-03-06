/**
 * EIP-1193 mock wallet provider for E2E testing.
 * Injected via page.addInitScript() before any page JS runs.
 *
 * Supports two modes:
 * - Anvil mode: eth_sendTransaction auto-accepted (local dev)
 * - Testnet mode: uses exposed __e2eSignAndSend function for real signing
 *
 * Supports multi-chain: both chains use the same RPC on testnet.
 */

export function getInjectWalletScript(
  rpcUrl: string,
  chainId: number,
  address: string,
  arbRpcUrl?: string,
  arbChainId?: number,
): string {
  const _arbRpcUrl = arbRpcUrl || rpcUrl;
  const _arbChainId = arbChainId || chainId;
  return `
(function() {
  const RPC_URL = ${JSON.stringify(rpcUrl)};
  const CHAIN_ID = ${chainId};
  const CHAIN_ID_HEX = '0x' + CHAIN_ID.toString(16);
  const ADDRESS = ${JSON.stringify(address.toLowerCase())};

  // Multi-chain RPC routing: chain ID → RPC URL
  const L3_CHAIN_ID = ${chainId};
  const L3_RPC_URL = ${JSON.stringify(rpcUrl)};
  const ARB_CHAIN_ID = ${_arbChainId};
  const ARB_RPC_URL = ${JSON.stringify(_arbRpcUrl)};

  const CHAIN_RPCS = {
    [CHAIN_ID]: RPC_URL,
    [L3_CHAIN_ID]: L3_RPC_URL,
    [ARB_CHAIN_ID]: ARB_RPC_URL,
  };

  let currentChainId = CHAIN_ID;
  let currentChainIdHex = CHAIN_ID_HEX;

  const listeners = {};

  function emit(event, ...args) {
    if (listeners[event]) {
      listeners[event].forEach(fn => {
        try { fn(...args); } catch (e) { console.error('[mock-wallet] listener error:', e); }
      });
    }
  }

  function getCurrentRpcUrl() {
    return CHAIN_RPCS[currentChainId] || RPC_URL;
  }

  async function rpcCall(method, params) {
    const res = await fetch(getCurrentRpcUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params: params || [] }),
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error.message || JSON.stringify(json.error));
    return json.result;
  }

  const provider = {
    isMetaMask: true,
    isConnected: () => true,
    chainId: CHAIN_ID_HEX,
    selectedAddress: ADDRESS,
    networkVersion: String(CHAIN_ID),

    on(event, fn) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(fn);
    },

    removeListener(event, fn) {
      if (!listeners[event]) return;
      listeners[event] = listeners[event].filter(f => f !== fn);
    },

    removeAllListeners(event) {
      if (event) { delete listeners[event]; }
      else { Object.keys(listeners).forEach(k => delete listeners[k]); }
    },

    async request({ method, params }) {
      switch (method) {
        case 'eth_requestAccounts':
          // User clicked "Connect" — authorize and return address
          window.__mockWalletConnected = true;
          return [ADDRESS];

        case 'eth_accounts':
          // Only return address if user has explicitly connected
          // (prevents wagmi auto-connect on page load)
          return window.__mockWalletConnected ? [ADDRESS] : [];

        case 'eth_chainId':
          return currentChainIdHex;

        case 'net_version':
          return String(currentChainId);

        case 'wallet_addEthereumChain':
          return null;

        case 'wallet_switchEthereumChain': {
          // Actually switch the chain so transactions route to the correct RPC
          const requestedChainId = parseInt(params[0].chainId, 16);
          if (CHAIN_RPCS[requestedChainId]) {
            currentChainId = requestedChainId;
            currentChainIdHex = '0x' + requestedChainId.toString(16);
            provider.chainId = currentChainIdHex;
            provider.networkVersion = String(currentChainId);
            emit('chainChanged', currentChainIdHex);
          }
          return null;
        }

        case 'wallet_requestPermissions':
          return [{ parentCapability: 'eth_accounts' }];

        case 'personal_sign': {
          // Use exposed signing function if available (testnet mode)
          if (window.__e2ePersonalSign) {
            return window.__e2ePersonalSign(params[0], params[1]);
          }
          // Anvil fallback: dummy signature
          return '0x' + '00'.repeat(65);
        }

        case 'eth_sendTransaction': {
          const tx = { ...params[0], from: ADDRESS };
          // Use exposed signing function for real chains (testnet mode)
          if (window.__e2eSignAndSend) {
            return window.__e2eSignAndSend(JSON.stringify({
              ...tx,
              chainId: currentChainId,
              rpcUrl: getCurrentRpcUrl(),
            }));
          }
          // Anvil fallback: forward unsigned
          return rpcCall('eth_sendTransaction', [tx]);
        }

        default:
          return rpcCall(method, params);
      }
    },

    // Legacy sendAsync for older libraries
    sendAsync(payload, callback) {
      provider.request({ method: payload.method, params: payload.params })
        .then(result => callback(null, { id: payload.id, jsonrpc: '2.0', result }))
        .catch(err => callback(err));
    },

    send(method, params) {
      if (typeof method === 'string') {
        return provider.request({ method, params });
      }
      // Legacy { method, params } object form
      return provider.request(method);
    },

    enable() {
      return provider.request({ method: 'eth_requestAccounts' });
    },
  };

  // Set as non-writable to prevent wagmi/other libs from overwriting
  Object.defineProperty(window, 'ethereum', {
    value: provider,
    writable: false,
    configurable: false,
  });

  // Dispatch EIP-6963 announcement for newer wagmi versions
  const announceEvent = new CustomEvent('eip6963:announceProvider', {
    detail: Object.freeze({
      info: {
        uuid: 'e2e-mock-wallet-0001',
        name: 'Mock Wallet',
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',
        rdns: 'io.e2e.mockwallet',
      },
      provider: provider,
    }),
  });

  window.dispatchEvent(announceEvent);

  // Also respond to future requestProvider events
  window.addEventListener('eip6963:requestProvider', () => {
    window.dispatchEvent(announceEvent);
  });
})();
`;
}
