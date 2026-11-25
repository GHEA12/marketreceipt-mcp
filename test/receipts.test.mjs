import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ReceiptLedger, verifyReceipts, verifyLedgerFile, GENESIS_HASH } from '../src/receipts.mjs';

function fakeCall(endpoint, price) {
  return {
    endpoint,
    params: { symbol: 'BTC', convert: 'USD' },
    response: { status: { error_code: 0 }, data: { BTC: { quote: { USD: { price } } } } },
  };
}

test('appended receipts form a verifiable hash chain', () => {
  const ledger = new ReceiptLedger(null);
  const r1 = ledger.append({ tool: 'get_quotes', mode: 'mock', calls: [fakeCall('/v1/cryptocurrency/quotes/latest', 100)] });
  const r2 = ledger.append({ tool: 'get_quotes', mode: 'mock', calls: [fakeCall('/v1/cryptocurrency/quotes/latest', 101)] });

  assert.equal(r1.seq, 1);
  assert.equal(r1.prevReceiptSha256, GENESIS_HASH);
  assert.equal(r2.seq, 2);
  assert.equal(r2.prevReceiptSha256, r1.receiptSha256);
  assert.match(r1.responseSha256, /^[0-9a-f]{64}$/);

  const result = verifyReceipts(ledger.receipts);
  assert.equal(result.ok, true);
  assert.equal(result.count, 2);
});

test('the same response always produces the same response hash', () => {
  const a = new ReceiptLedger(null);
  const b = new ReceiptLedger(null);
  const call = fakeCall('/v1/cryptocurrency/quotes/latest', 42);
  const ra = a.append({ tool: 'get_quotes', mode: 'live', calls: [call] });
  const rb = b.append({ tool: 'get_quotes', mode: 'live', calls: [call] });
  assert.equal(ra.responseSha256, rb.responseSha256);
});

test('different responses produce different response hashes', () => {
  const ledger = new ReceiptLedger(null);
  const r1 = ledger.append({ tool: 'get_quotes', mode: 'mock', calls: [fakeCall('/x', 1)] });
  const r2 = ledger.append({ tool: 'get_quotes', mode: 'mock', calls: [fakeCall('/x', 2)] });
  assert.notEqual(r1.responseSha256, r2.responseSha256);
});

test('editing a recorded receipt breaks verification', () => {
  const ledger = new ReceiptLedger(null);
  ledger.append({ tool: 'get_quotes', mode: 'mock', calls: [fakeCall('/x', 1)] });
  ledger.append({ tool: 'get_quotes', mode: 'mock', calls: [fakeCall('/x', 2)] });

  const tampered = structuredClone(ledger.receipts);
  tampered[0].responseSha256 = 'f'.repeat(64); // pretend the recorded answer was different
  const result = verifyReceipts(tampered);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes('receiptSha256 mismatch')));
});

test('ledger persists to JSONL and verifies from disk; a tampered file fails', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mr-receipts-'));
  const file = join(dir, 'receipts.jsonl');
  const ledger = new ReceiptLedger(file);
  ledger.append({ tool: 'get_quotes', mode: 'mock', calls: [fakeCall('/x', 7)] });
  ledger.append({ tool: 'market_brief', mode: 'mock', calls: [fakeCall('/a', 1), fakeCall('/b', 2), fakeCall('/c', 3)] });

  const fromDisk = verifyLedgerFile(file);
  assert.equal(fromDisk.ok, true);
  assert.equal(fromDisk.count, 2);

  // Reopening the ledger continues the chain instead of restarting it.
  const reopened = new ReceiptLedger(file);
  assert.equal(reopened.receipts.length, 2);
  const r3 = reopened.append({ tool: 'get_quotes', mode: 'mock', calls: [fakeCall('/x', 8)] });
  assert.equal(r3.seq, 3);
  assert.equal(verifyLedgerFile(file).ok, true);

  const lines = readFileSync(file, 'utf8').split('\n').filter(Boolean);
  const edited = JSON.parse(lines[1]);
  edited.tool = 'get_global_metrics';
  lines[1] = JSON.stringify(edited);
  writeFileSync(file, `${lines.join('\n')}\n`);
  const after = verifyLedgerFile(file);
  assert.equal(after.ok, false);
});
