#!/usr/bin/env node
// MarketReceipt MCP server.
//
// A zero-dependency Model Context Protocol server speaking newline-delimited
// JSON-RPC 2.0 over stdio — the standard MCP transport — so it plugs into any
// MCP client (Claude Desktop/Code, Cursor, custom agents) as-is.
//
// Config (see .env.example): CMC_MODE, CMC_API_KEY, RECEIPTS_FILE.
// With no API key it runs in mock mode against cached CMC-shaped fixtures;
// receipts always record which mode produced them.

import { createInterface } from 'node:readline';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCmcClient } from './cmc-client.mjs';
import { ReceiptLedger } from './receipts.mjs';
import { TOOLS, createToolCaller } from './tools.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

try {
  process.loadEnvFile(resolve(projectRoot, '.env'));
} catch {
  // No .env file — environment variables / mock mode it is.
}

const receiptsFile = resolve(projectRoot, process.env.RECEIPTS_FILE || 'data/receipts.jsonl');
const client = createCmcClient();
const ledger = new ReceiptLedger(receiptsFile);
const callTool = createToolCaller({ client, ledger });

const PROTOCOL_VERSION = '2024-11-05';

function send(obj) {
  process.stdout.write(`${JSON.stringify(obj)}\n`);
}

async function handle(msg) {
  const { id, method, params } = msg;
  const isNotification = id === undefined || id === null;
  try {
    let result;
    switch (method) {
      case 'initialize':
        result = {
          protocolVersion: params?.protocolVersion || PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: { name: 'marketreceipt-mcp', version: '0.1.0' },
        };
        break;
      case 'ping':
        result = {};
        break;
      case 'tools/list':
        result = { tools: TOOLS };
        break;
      case 'tools/call': {
        try {
          const out = await callTool(params?.name, params?.arguments ?? {});
          result = {
            content: [{ type: 'text', text: JSON.stringify(out, null, 2) }],
            structuredContent: out,
            isError: false,
          };
        } catch (e) {
          result = {
            content: [{ type: 'text', text: `Error: ${e.message}` }],
            isError: true,
          };
        }
        break;
      }
      default:
        if (isNotification) return;
        send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } });
        return;
    }
    if (!isNotification) send({ jsonrpc: '2.0', id, result });
  } catch (e) {
    if (!isNotification) send({ jsonrpc: '2.0', id, error: { code: -32603, message: e.message } });
  }
}

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let msg;
  try {
    msg = JSON.parse(trimmed);
  } catch {
    return; // Not JSON — ignore, per tolerant stdio framing.
  }
  void handle(msg);
});

process.stderr.write(
  `marketreceipt-mcp ready (mode=${client.mode}, receipts=${receiptsFile}, prior receipts=${ledger.receipts.length})\n`,
);
