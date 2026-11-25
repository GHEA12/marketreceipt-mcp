#!/usr/bin/env node
// Verify a MarketReceipt ledger: every receipt's hash, chain link, and order.
// Usage: npm run verify -- [path-to-receipts.jsonl]

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyLedgerFile } from './receipts.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const file = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : resolve(projectRoot, process.env.RECEIPTS_FILE || 'data/receipts.jsonl');

const result = verifyLedgerFile(file);
if (result.ok) {
  console.log(`OK — ${result.count} receipt(s) verified in ${file}`);
  process.exit(0);
} else {
  console.error(`FAILED — ${file}`);
  for (const e of result.errors) console.error(`  - ${e}`);
  process.exit(1);
}
