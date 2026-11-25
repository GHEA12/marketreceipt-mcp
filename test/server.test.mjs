import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyLedgerFile } from '../src/receipts.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function startServer() {
  const dir = mkdtempSync(join(tmpdir(), 'mr-server-'));
  const ledgerAbs = join(dir, 'ledger.jsonl');
  const child = spawn(process.execPath, [resolve(projectRoot, 'src/server.mjs')], {
    cwd: dir,
    env: { ...process.env, CMC_MODE: 'mock', RECEIPTS_FILE: ledgerAbs },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const pending = new Map();
  let nextId = 1;
  const rl = createInterface({ input: child.stdout, crlfDelay: Infinity });
  rl.on('line', (line) => {
    let msg;
    try { msg = JSON.parse(line); } catch { return; }
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  });
  const request = (method, params) =>
    new Promise((res) => {
      const id = nextId++;
      pending.set(id, res);
      child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    });
  return { child, request, ledgerPath: ledgerAbs };
}

test('MCP protocol round-trip: initialize, tools/list, tools/call, errors', async (t) => {
  const { child, request, ledgerPath } = startServer();
  t.after(() => child.kill());

  const init = await request('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'test', version: '0' },
  });
  assert.equal(init.result.serverInfo.name, 'marketreceipt-mcp');
  assert.equal(init.result.protocolVersion, '2024-11-05');

  const list = await request('tools/list');
  assert.equal(list.result.tools.length, 5);

  const call = await request('tools/call', { name: 'get_quotes', arguments: { symbols: ['BTC'] } });
  assert.equal(call.result.isError, false);
  const out = JSON.parse(call.result.content[0].text);
  assert.equal(out.data.quotes[0].symbol, 'BTC');
  assert.equal(out.receipt.tool, 'get_quotes');
  assert.equal(out.receipt.mode, 'mock');

  const brief = await request('tools/call', { name: 'market_brief', arguments: { symbols: ['ETH', 'SOL'] } });
  assert.equal(brief.result.isError, false);

  const bad = await request('tools/call', { name: 'nope', arguments: {} });
  assert.equal(bad.result.isError, true);
  assert.match(bad.result.content[0].text, /Unknown tool/);

  const unknown = await request('resources/list');
  assert.equal(unknown.error.code, -32601);

  child.stdin.end();
  await new Promise((res) => child.once('exit', res));

  const v = verifyLedgerFile(ledgerPath);
  assert.equal(v.ok, true, v.errors.join('; '));
  assert.equal(v.count, 2); // only the two successful calls wrote receipts
});
