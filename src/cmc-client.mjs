// CoinMarketCap Pro API client with two modes:
//
//   live — real HTTPS calls to https://pro-api.coinmarketcap.com, API key sent
//          as the X-CMC_PRO_API_KEY header (key comes from .env, never code).
//   mock — cached fixture responses shaped exactly like the real API, so the
//          whole project runs end-to-end with no key. Receipts record which
//          mode produced them; mock data is never passed off as live.
//
// Every method returns { endpoint, params, response } so callers can record
// exactly which endpoint produced a given answer (the receipts layer).

import { fixtures } from './fixtures.mjs';

export const ENDPOINTS = {
  quotesLatest: '/v1/cryptocurrency/quotes/latest',
  listingsLatest: '/v1/cryptocurrency/listings/latest',
  globalMetrics: '/v1/global-metrics/quotes/latest',
  info: '/v1/cryptocurrency/info',
};

const DEFAULT_BASE_URL = 'https://pro-api.coinmarketcap.com';

export function resolveMode({ mode, apiKey } = {}) {
  if (mode === 'live' || mode === 'mock') return mode;
  return apiKey ? 'live' : 'mock';
}

export function createCmcClient({
  mode,
  apiKey = process.env.CMC_API_KEY || '',
  baseUrl = process.env.CMC_API_BASE_URL || DEFAULT_BASE_URL,
  fetchImpl = globalThis.fetch,
} = {}) {
  const resolvedMode = resolveMode({ mode: mode ?? process.env.CMC_MODE, apiKey });

  if (resolvedMode === 'live' && !apiKey) {
    throw new Error(
      'CMC_MODE=live but CMC_API_KEY is not set. Add your key to .env (see .env.example) or use CMC_MODE=mock.',
    );
  }

  async function call(endpoint, params, mockFn) {
    if (resolvedMode === 'mock') {
      const response = mockFn();
      // Stamp the fixture with the current time so mock runs look like runs,
      // while the receipt's mode field keeps them honestly labelled.
      response.status = { ...response.status, timestamp: new Date().toISOString() };
      return { endpoint, params, response };
    }
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    }
    const url = `${baseUrl}${endpoint}?${qs.toString()}`;
    const res = await fetchImpl(url, {
      headers: {
        'X-CMC_PRO_API_KEY': apiKey,
        Accept: 'application/json',
      },
    });
    const response = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = response?.status?.error_message || `HTTP ${res.status}`;
      throw new Error(`CMC API error calling ${endpoint}: ${msg}`);
    }
    if (response?.status?.error_code && response.status.error_code !== 0) {
      throw new Error(`CMC API error calling ${endpoint}: ${response.status.error_message}`);
    }
    return { endpoint, params, response };
  }

  return {
    mode: resolvedMode,
    quotesLatest(symbols) {
      const symbol = symbols.map((s) => String(s).toUpperCase()).join(',');
      return call(
        ENDPOINTS.quotesLatest,
        { symbol, convert: 'USD' },
        () => fixtures.quotesLatest(symbols),
      );
    },
    listingsLatest({ limit = 10, sort = 'market_cap' } = {}) {
      return call(
        ENDPOINTS.listingsLatest,
        { start: 1, limit, sort, convert: 'USD', cryptocurrency_type: 'coins' },
        () => fixtures.listingsLatest(limit),
      );
    },
    globalMetrics() {
      return call(ENDPOINTS.globalMetrics, { convert: 'USD' }, () => fixtures.globalMetrics());
    },
    info(symbols) {
      const symbol = symbols.map((s) => String(s).toUpperCase()).join(',');
      return call(ENDPOINTS.info, { symbol }, () => fixtures.info(symbols));
    },
  };
}
