// ─── Live data fetch ───────────────────────────────────────────────────────────
// Mirrors the website's data sources:
//   pool    → https://api.basedmining.xyz/api/pool/status
//   bitcoin → https://api.basedmining.xyz/api/bitcoin/status
//   price   → https://mempool.space/api/v1/prices
//
// In dev, Vite proxies /api/* to api.basedmining.xyz (see vite.config.ts) to dodge
// browser CORS. In the built native app, CapacitorHttp (capacitor.config.ts) routes
// fetch through the native stack, so absolute URLs work without CORS.

export interface PoolStatus {
  hashrate_1m: number;
  hashrate_5m: number;
  user_count: number;
  worker_count: number;
  block_count: number;
  accepted_shares: number;
  rejected_shares: number;
  uptime_secs: number;
}

export interface BitcoinStatus {
  height: number;
  network_difficulty: number;
  network_hashrate: number;
  mempool_txs: number;
}

export interface LiveData {
  pool: PoolStatus | null;
  bitcoin: BitcoinStatus | null;
  btcPrice: number | null;
}

// '' in dev (hits the Vite proxy at /api); full origin in the built app.
const API_BASE = import.meta.env.DEV ? '' : 'https://api.basedmining.xyz';

export async function fetchLiveData(): Promise<LiveData> {
  const [poolRes, bitcoinRes, priceRes] = await Promise.allSettled([
    fetch(`${API_BASE}/api/pool/status`, { cache: 'no-store' }),
    fetch(`${API_BASE}/api/bitcoin/status`, { cache: 'no-store' }),
    fetch('https://mempool.space/api/v1/prices'),
  ]);

  const pool =
    poolRes.status === 'fulfilled' && poolRes.value.ok
      ? ((await poolRes.value.json()) as PoolStatus)
      : null;
  const bitcoin =
    bitcoinRes.status === 'fulfilled' && bitcoinRes.value.ok
      ? ((await bitcoinRes.value.json()) as BitcoinStatus)
      : null;
  const price =
    priceRes.status === 'fulfilled' && priceRes.value.ok
      ? await priceRes.value.json()
      : null;

  return {
    pool,
    bitcoin,
    btcPrice: price?.USD ?? null,
  };
}
