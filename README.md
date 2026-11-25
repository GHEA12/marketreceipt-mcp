# MarketReceipt MCP

**Live CoinMarketCap data for AI agents — with a verifiable receipt for every answer.**

An MCP (Model Context Protocol) server that puts CoinMarketCap market data in front of
any MCP-compatible AI agent, and records a **receipt** for every answer it gives: the
exact CMC endpoint called, the parameters, a timestamp, and a SHA-256 hash of the raw
API response. Receipts are appended to a hash-chained ledger, so anything an agent
claimed about the market can later be audited back to the API response it came from —
and any after-the-fact edit to the record breaks the chain and fails verification.

Built for **Build with CMC: API Hackathon Round 2**, track **AI Agents and Automation**.
Author: Indra Dwi Junianto.

## Why

Agents quote prices from memory, from stale context, or from nowhere. When an agent
says "BTC is $91,247, up 2.3% today", there is usually no way to check where that came
from. MarketReceipt makes the claim checkable: the number travels with its receipt.

## Quickstart (no API key needed)

Requires Node.js ≥ 20. Zero dependencies.

```bash
npm test          # 20 tests: client, receipts, tools, full MCP protocol round-trip
npm run demo      # scripted agent session against the real server, then ledger verification
```

The demo runs in **mock mode**: cached responses shaped exactly like the real CMC API
envelope (see `src/fixtures.mjs`). Receipts produced this way are stamped
`mode: "mock"` — mock data is never passed off as live evidence.

## Going live with a real CMC API key

1. Create a free API account at https://coinmarketcap.com/api and copy your key.
   (Hackathon participants: register on DoraHacks with the same email as your CMC
   account and the key is upgraded to the free **Startup tier** for the event.)
2. `cp .env.example .env` and set `CMC_API_KEY=...` in `.env`.
   **Never commit `.env`** — it is gitignored, and the hackathon rules score key hygiene.
3. Run the server or demo again. With a key present the client switches to live mode
   automatically (or force it with `CMC_MODE=live`). Receipts are stamped `mode: "live"`.

## Use it from an MCP client

The server speaks newline-delimited JSON-RPC 2.0 over stdio, the standard MCP
transport. Example client configuration:

```json
{
  "mcpServers": {
    "marketreceipt": {
      "command": "node",
      "args": ["/path/to/marketreceipt-mcp/src/server.mjs"],
      "env": { "CMC_API_KEY": "your-key-here" }
    }
  }
}
```

## Tools

| Tool | CMC API endpoint(s) | What it returns |
| --- | --- | --- |
| `get_quotes` | `GET /v1/cryptocurrency/quotes/latest` | Latest price, market cap, 24h volume, 1h/24h/7d changes for given symbols |
| `get_top_listings` | `GET /v1/cryptocurrency/listings/latest` | Top coins by market cap with quotes |
| `get_global_metrics` | `GET /v1/global-metrics/quotes/latest` | Total market cap/volume, BTC & ETH dominance, DeFi & stablecoin totals |
| `get_coin_info` | `GET /v1/cryptocurrency/info` | Coin metadata: description, category, tags, website, docs |
| `market_brief` | quotes/latest + global-metrics + listings/latest | One fused briefing (watchlist + market context + top movers) under a single receipt |

Every tool result is `{ data, receipt }`. The receipt:

```json
{
  "seq": 1,
  "ts": "2026-11-25T08:07:45.000Z",
  "tool": "market_brief",
  "endpoints": ["/v1/cryptocurrency/quotes/latest", "/v1/global-metrics/quotes/latest", "/v1/cryptocurrency/listings/latest"],
  "params": { "symbol": "BTC,ETH,SOL", "convert": "USD" },
  "mode": "live",
  "responseSha256": "…sha256 of the canonicalised raw API response(s)…",
  "prevReceiptSha256": "…hash of the previous receipt (chain link)…",
  "receiptSha256": "…sha256 of this receipt…"
}
```

Verify a ledger at any time:

```bash
npm run verify -- data/receipts.jsonl
# OK — N receipt(s) verified
```

## Evidence of an API call

The live client issues exactly this request (from `src/cmc-client.mjs`):

```http
GET https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=BTC&convert=USD
X-CMC_PRO_API_KEY: <your key>
Accept: application/json
```

and hashes the JSON response body into the receipt. A response has the standard CMC
envelope:

```json
{
  "status": { "timestamp": "…", "error_code": 0, "error_message": null, "elapsed": 12, "credit_count": 1 },
  "data": { "BTC": { "id": 1, "name": "Bitcoin", "symbol": "BTC",
    "quote": { "USD": { "price": 91247.31, "percent_change_24h": 2.34, "market_cap": 1823100000000, "last_updated": "…" } } } }
}
```

(The sample above is the mock fixture, byte-shaped like the real thing. Run
`CMC_MODE=live npm run demo` with your key to produce genuine live receipts.)

## What the API made possible — and where it got in the way

Made possible: one key and four endpoints cover quotes, rankings, global context and
metadata, which is everything an agent needs to answer market questions with citations
instead of vibes. The `status.credit_count` field makes it easy to budget calls, and
keying `quotes/latest` responses by symbol keeps client code trivial.

Got in the way: the free Basic tier's credit limits are tight enough that a chatty
agent burns them fast (the hackathon Startup upgrade fixes this during the event);
`listings/latest` and `quotes/latest` return differently shaped `data` (array vs
symbol-keyed object), so a client needs two normalisers where one would do; and there
is no single "briefing" endpoint, so a composite answer costs three calls and three
credits where one fused endpoint would cost one.

## Layout

```
src/server.mjs          MCP server (stdio JSON-RPC, zero dependencies)
src/tools.mjs           tool definitions + handlers
src/cmc-client.mjs      CMC API client (live + mock modes)
src/fixtures.mjs        cached CMC-shaped responses for mock mode
src/receipts.mjs        hash-chained receipt ledger + verification
src/demo.mjs            scripted agent session (spawns the real server)
src/verify-receipts.mjs ledger verification CLI
test/                   node --test suite
```

## License

MIT
