import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCmcClient, resolveMode, ENDPOINTS } from '../src/cmc-client.mjs';

test('mode resolution: explicit mode wins, key implies live, no key means mock', () => {
  assert.equal(resolveMode({ mode: 'mock', apiKey: 'k' }), 'mock');
  assert.equal(resolveMode({ mode: 'live', apiKey: '' }), 'live');
  assert.equal(resolveMode({ apiKey: 'k' }), 'live');
  assert.equal(resolveMode({ apiKey: '' }), 'mock');
  assert.equal(resolveMode({}), 'mock');
});

test('live mode without a key throws a helpful error', () => {
  assert.throws(() => createCmcClient({ mode: 'live', apiKey: '' }), /CMC_API_KEY is not set/);
});

test('mock client returns CMC-shaped responses for every endpoint', async () => {
  const client = createCmcClient({ mode: 'mock' });
  assert.equal(client.mode, 'mock');

  const q = await client.quotesLatest(['BTC', 'ETH']);
  assert.equal(q.endpoint, ENDPOINTS.quotesLatest);
  assert.equal(q.response.status.error_code, 0);
  assert.equal(typeof q.response.data.BTC.quote.USD.price, 'number');
  assert.equal(typeof q.response.data.ETH.quote.USD.market_cap, 'number');

  const l = await client.listingsLatest({ limit: 3 });
  assert.equal(l.response.data.length, 3);
  assert.equal(l.response.data[0].symbol, 'BTC');
  assert.equal(l.response.data[0].cmc_rank, 1);

  const g = await client.globalMetrics();
  assert.equal(typeof g.response.data.quote.USD.total_market_cap, 'number');
  assert.equal(typeof g.response.data.btc_dominance, 'number');

  const i = await client.info(['SOL']);
  assert.equal(i.response.data.SOL.name, 'Solana');
  assert.ok(i.response.data.SOL.urls.website.length > 0);
});

test('live client sends the key as X-CMC_PRO_API_KEY and builds the right URL', async () => {
  const seen = [];
  const fetchImpl = async (url, opts) => {
    seen.push({ url, opts });
    return {
      ok: true,
      status: 200,
      json: async () => ({
        status: { timestamp: '2026-11-25T00:00:00.000Z', error_code: 0, error_message: null, elapsed: 1, credit_count: 1 },
        data: { BTC: { id: 1, name: 'Bitcoin', symbol: 'BTC', quote: { USD: { price: 1 } } } },
      }),
    };
  };
  const client = createCmcClient({ mode: 'live', apiKey: 'test-key-123', fetchImpl });
  const out = await client.quotesLatest(['btc']);
  assert.equal(out.endpoint, ENDPOINTS.quotesLatest);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].opts.headers['X-CMC_PRO_API_KEY'], 'test-key-123');
  const url = new URL(seen[0].url);
  assert.equal(url.origin + url.pathname, `https://pro-api.coinmarketcap.com${ENDPOINTS.quotesLatest}`);
  assert.equal(url.searchParams.get('symbol'), 'BTC');
  assert.equal(url.searchParams.get('convert'), 'USD');
});

test('live client surfaces CMC API errors', async () => {
  const fetchImpl = async () => ({
    ok: false,
    status: 401,
    json: async () => ({ status: { error_code: 1002, error_message: 'API key missing or invalid.' } }),
  });
  const client = createCmcClient({ mode: 'live', apiKey: 'bad', fetchImpl });
  await assert.rejects(() => client.globalMetrics(), /API key missing or invalid/);
});
