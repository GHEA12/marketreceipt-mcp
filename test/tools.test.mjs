import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCmcClient, ENDPOINTS } from '../src/cmc-client.mjs';
import { ReceiptLedger, verifyReceipts } from '../src/receipts.mjs';
import { TOOLS, createToolCaller } from '../src/tools.mjs';

function setup() {
  const client = createCmcClient({ mode: 'mock' });
  const ledger = new ReceiptLedger(null);
  return { callTool: createToolCaller({ client, ledger }), ledger };
}

test('five tools are defined with valid schemas', () => {
  assert.deepEqual(
    TOOLS.map((t) => t.name).sort(),
    ['get_coin_info', 'get_global_metrics', 'get_quotes', 'get_top_listings', 'market_brief'],
  );
  for (const t of TOOLS) {
    assert.equal(t.inputSchema.type, 'object');
    assert.ok(t.description.length > 20);
  }
});

test('get_quotes returns normalised quotes plus a receipt naming the endpoint', async () => {
  const { callTool } = setup();
  const { data, receipt } = await callTool('get_quotes', { symbols: ['BTC', 'SOL'] });
  assert.equal(data.quotes.length, 2);
  const btc = data.quotes.find((q) => q.symbol === 'BTC');
  assert.equal(typeof btc.price_usd, 'number');
  assert.equal(typeof btc.percent_change_24h, 'number');
  assert.deepEqual(receipt.endpoints, [ENDPOINTS.quotesLatest]);
  assert.equal(receipt.tool, 'get_quotes');
  assert.equal(receipt.mode, 'mock');
});

test('get_quotes reports unknown symbols as missing instead of inventing them', async () => {
  const { callTool } = setup();
  const { data } = await callTool('get_quotes', { symbols: ['BTC', 'NOTACOIN'] });
  assert.equal(data.quotes.length, 1);
  assert.deepEqual(data.missing_symbols, ['NOTACOIN']);
});

test('get_top_listings returns ranked rows', async () => {
  const { callTool } = setup();
  const { data, receipt } = await callTool('get_top_listings', { limit: 5 });
  assert.equal(data.listings.length, 5);
  assert.equal(data.listings[0].rank, 1);
  assert.equal(data.listings[0].symbol, 'BTC');
  assert.deepEqual(receipt.endpoints, [ENDPOINTS.listingsLatest]);
});

test('get_global_metrics returns the headline numbers', async () => {
  const { callTool } = setup();
  const { data } = await callTool('get_global_metrics', {});
  assert.equal(typeof data.total_market_cap_usd, 'number');
  assert.equal(typeof data.btc_dominance, 'number');
  assert.ok(data.btc_dominance > 0 && data.btc_dominance < 100);
});

test('get_coin_info returns metadata and rejects unknown symbols', async () => {
  const { callTool } = setup();
  const { data } = await callTool('get_coin_info', { symbol: 'ETH' });
  assert.equal(data.name, 'Ethereum');
  assert.ok(data.website.includes('ethereum.org'));
  await assert.rejects(() => callTool('get_coin_info', { symbol: 'NOTACOIN' }), /No CoinMarketCap metadata/);
});

test('market_brief fuses three API calls under one receipt', async () => {
  const { callTool, ledger } = setup();
  const { data, receipt } = await callTool('market_brief', { symbols: ['BTC', 'ETH', 'SOL'] });
  assert.equal(data.watchlist.length, 3);
  assert.equal(typeof data.market_context.total_market_cap_usd, 'number');
  assert.equal(data.top_movers_top20.length, 5);
  const abs = data.top_movers_top20.map((m) => Math.abs(m.percent_change_24h));
  assert.deepEqual(abs, [...abs].sort((a, b) => b - a)); // sorted by |change| desc
  assert.deepEqual(
    [...receipt.endpoints].sort(),
    [ENDPOINTS.globalMetrics, ENDPOINTS.listingsLatest, ENDPOINTS.quotesLatest].sort(),
  );
  assert.equal(verifyReceipts(ledger.receipts).ok, true);
});

test('unknown tool names are rejected', async () => {
  const { callTool } = setup();
  await assert.rejects(() => callTool('get_moon_phases', {}), /Unknown tool/);
});

test('every call in a session chains into one verifiable ledger', async () => {
  const { callTool, ledger } = setup();
  await callTool('get_quotes', { symbols: ['BTC'] });
  await callTool('get_global_metrics', {});
  await callTool('market_brief', { symbols: ['ETH'] });
  assert.equal(ledger.receipts.length, 3);
  const v = verifyReceipts(ledger.receipts);
  assert.equal(v.ok, true, v.errors.join('; '));
});
