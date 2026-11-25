// Hash-chained receipt ledger — the receipts pattern from our FabReceipt /
// RunReceipt projects, applied to API answers.
//
// Every answer the MCP server gives is recorded as a receipt:
//   { seq, ts, tool, endpoints, params, mode, responseSha256,
//     prevReceiptSha256, receiptSha256 }
//
// responseSha256 is the SHA-256 of the canonicalised raw API response, and
// each receipt links to the previous receipt's hash. Editing any recorded
// answer (or any receipt) after the fact breaks the chain, and
// verifyLedger() will say exactly where.

import { createHash } from 'node:crypto';
import { appendFileSync, readFileSync, existsSync } from 'node:fs';

export function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
}

export function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export const GENESIS_HASH = '0'.repeat(64);

export class ReceiptLedger {
  /** filePath may be null for an in-memory-only ledger (tests). */
  constructor(filePath = null) {
    this.filePath = filePath;
    this.receipts = [];
    if (filePath && existsSync(filePath)) {
      const lines = readFileSync(filePath, 'utf8').split('\n').filter(Boolean);
      this.receipts = lines.map((l) => JSON.parse(l));
    }
  }

  get lastHash() {
    return this.receipts.length
      ? this.receipts[this.receipts.length - 1].receiptSha256
      : GENESIS_HASH;
  }

  /**
   * Record one tool answer. `calls` is the list of { endpoint, params,
   * response } the answer was built from (one entry for simple tools,
   * several for composite tools like market_brief).
   */
  append({ tool, mode, calls }) {
    const endpoints = calls.map((c) => c.endpoint);
    const params = calls.length === 1 ? calls[0].params : calls.map((c) => ({ endpoint: c.endpoint, ...c.params }));
    const responsePayload = calls.length === 1 ? calls[0].response : Object.fromEntries(calls.map((c) => [c.endpoint, c.response]));
    const responseSha256 = sha256(canonical(responsePayload));
    const core = {
      seq: this.receipts.length + 1,
      ts: new Date().toISOString(),
      tool,
      endpoints,
      params,
      mode,
      responseSha256,
      prevReceiptSha256: this.lastHash,
    };
    const receipt = { ...core, receiptSha256: sha256(canonical(core)) };
    this.receipts.push(receipt);
    if (this.filePath) appendFileSync(this.filePath, `${JSON.stringify(receipt)}\n`);
    return receipt;
  }
}

/** Verify a list of receipts: hashes, chain links, and sequence. */
export function verifyReceipts(receipts) {
  const errors = [];
  let prev = GENESIS_HASH;
  receipts.forEach((r, i) => {
    const expectedSeq = i + 1;
    if (r.seq !== expectedSeq) errors.push(`receipt #${i + 1}: seq is ${r.seq}, expected ${expectedSeq}`);
    if (r.prevReceiptSha256 !== prev) errors.push(`receipt #${i + 1}: prevReceiptSha256 does not match the previous receipt's hash`);
    const { receiptSha256, ...core } = r;
    if (sha256(canonical(core)) !== receiptSha256) errors.push(`receipt #${i + 1}: receiptSha256 mismatch (receipt was edited)`);
    prev = r.receiptSha256;
  });
  return { ok: errors.length === 0, count: receipts.length, errors };
}

export function verifyLedgerFile(filePath) {
  if (!existsSync(filePath)) return { ok: false, count: 0, errors: [`ledger not found: ${filePath}`] };
  const lines = readFileSync(filePath, 'utf8').split('\n').filter(Boolean);
  let receipts;
  try {
    receipts = lines.map((l) => JSON.parse(l));
  } catch (e) {
    return { ok: false, count: lines.length, errors: [`ledger is not valid JSONL: ${e.message}`] };
  }
  return verifyReceipts(receipts);
}
