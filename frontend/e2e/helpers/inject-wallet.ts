/**
 * EIP-1193 mock wallet provider for E2E testing.
 * Injected via page.addInitScript() before any page JS runs.
 * Anvil auto-accepts eth_sendTransaction from known accounts — no signing needed.
 */

export function getInjectWalletScript(
  rpcUrl: string,
  chainId: number,
  address: string,
): string {
  return `
(function() {
  const RPC_URL = ${JSON.stringify(rpcUrl)};
  const CHAIN_ID = ${chainId};
  const CHAIN_ID_HEX = '0x' + CHAIN_ID.toString(16);
  const ADDRESS = ${JSON.stringify(address.toLowerCase())};

  const listeners = {};

  function emit(event, ...args) {
    if (listeners[event]) {
      listeners[event].forEach(fn => {
        try { fn(...args); } catch (e) { console.error('[mock-wallet] listener error:', e); }
      });
    }
  }

  async function rpcCall(method, params) {
    const res = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
          return CHAIN_ID_HEX;

        case 'net_version':
          return String(CHAIN_ID);

        case 'wallet_addEthereumChain':
        case 'wallet_switchEthereumChain':
          return null;

        case 'wallet_requestPermissions':
          return [{ parentCapability: 'eth_accounts' }];

        case 'personal_sign':
          // Anvil doesn't need real signatures; return a dummy
          return '0x' + '00'.repeat(65);

        case 'eth_sendTransaction': {
          // Ensure 'from' is set to our test address
          const tx = { ...params[0], from: ADDRESS };
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
