#!/usr/bin/env node
// Scripted agent session against the MarketReceipt MCP server.
//
// Spawns the real server over stdio, speaks MCP JSON-RPC to it exactly like
// an agent client would, asks for a market briefing and two lookups, prints
// every answer with its receipt, then verifies the receipt ledger.
//
// Usage: npm run demo            (mock mode unless .env provides a key)
//        CMC_MODE=live npm run demo   (with CMC_API_KEY in .env)

import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rmSync } from 'node:fs';
import { verifyLedgerFile } from './receipts.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const demoLedger = resolve(projectRoot, 'data/demo-receipts.jsonl');
rmSync(demoLedger, { force: true });

const child = spawn(process.execPath, [resolve(projectRoot, 'src/server.mjs')], {
  env: { ...process.env, RECEIPTS_FILE: 'data/demo-receipts.jsonl' },
  stdio: ['pipe', 'pipe', 'inherit'],
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

function request(method, params) {
  const id = nextId++;
  return new Promise((res) => {
    pending.set(id, res);
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
  });
}

function notify(method, params) {
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`);
}

const init = await request('initialize', {
  protocolVersion: '2024-11-05',
  capabilities: {},
  clientInfo: { name: 'marketreceipt-demo', version: '0.1.0' },
});
notify('notifications/initialized');
console.log(`Connected to ${init.result.serverInfo.name} v${init.result.serverInfo.version}\n`);

const list = await request('tools/list');
console.log(`Tools available: ${list.result.tools.map((t) => t.name).join(', ')}\n`);

async function call(name, args) {
  const res = await request('tools/call', { name, arguments: args });
  if (res.result?.isError) throw new Error(res.result.content[0].text);
  const out = JSON.parse(res.result.content[0].text);
  console.log(`── ${name}(${JSON.stringify(args)})`);
  console.log(JSON.stringify(out.data, null, 2));
  console.log(
    `receipt #${out.receipt.seq} · mode=${out.receipt.mode} · endpoints=${out.receipt.endpoints.join(' + ')} · response sha256=${out.receipt.responseSha256.slice(0, 16)}… · receipt sha256=${out.receipt.receiptSha256.slice(0, 16)}…\n`,
  );
  return out;
}

await call('market_brief', { symbols: ['BTC', 'ETH', 'SOL'] });
await call('get_quotes', { symbols: ['DOGE'] });
await call('get_coin_info', { symbol: 'SOL' });

child.stdin.end();
child.kill();

const check = verifyLedgerFile(demoLedger);
if (!check.ok) {
  console.error('Ledger verification FAILED:', check.errors);
  process.exit(1);
}
console.log(`Ledger verified: ${check.count} receipts, chain intact (${demoLedger})`);
console.log('DEMO OK');
