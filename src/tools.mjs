// MCP tool definitions and handlers.
//
// Each handler returns { data, receipt }: the normalised answer an agent can
// use directly, plus the receipt that binds it to the raw CMC API response(s)
// it came from. Handlers never invent numbers — every figure in `data` is
// copied from an API response field.

function num(x) {
  return typeof x === 'number' ? x : null;
}

function quoteRow(symbol, coin) {
  const q = coin.quote?.USD ?? {};
  return {
    symbol,
    name: coin.name,
    price_usd: num(q.price),
    market_cap_usd: num(q.market_cap),
    volume_24h_usd: num(q.volume_24h),
    percent_change_1h: num(q.percent_change_1h),
    percent_change_24h: num(q.percent_change_24h),
    percent_change_7d: num(q.percent_change_7d),
    last_updated: q.last_updated ?? null,
  };
}

function symbolsArg(args, fallback = ['BTC']) {
  const raw = args?.symbols ?? (args?.symbol ? [args.symbol] : fallback);
  const list = (Array.isArray(raw) ? raw : String(raw).split(','))
    .map((s) => String(s).trim().toUpperCase())
    .filter(Boolean);
  if (!list.length) throw new Error('Provide at least one symbol, e.g. ["BTC","ETH"].');
  return list;
}

export const TOOLS = [
  {
    name: 'get_quotes',
    description:
      'Get the latest price, market cap, 24h volume and 1h/24h/7d percent changes for one or more cryptocurrencies from CoinMarketCap. Returns the data plus a verifiable receipt of the API call.',
    inputSchema: {
      type: 'object',
      properties: {
        symbols: {
          type: 'array',
          items: { type: 'string' },
          description: 'Ticker symbols, e.g. ["BTC","ETH","SOL"]',
        },
      },
      required: ['symbols'],
    },
  },
  {
    name: 'get_top_listings',
    description:
      'Get the top cryptocurrencies ranked by market cap from CoinMarketCap, with prices and 24h changes. Returns the data plus a verifiable receipt of the API call.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'How many listings to return (default 10, max 100)' },
      },
    },
  },
  {
    name: 'get_global_metrics',
    description:
      'Get global crypto market metrics from CoinMarketCap: total market cap, 24h volume, BTC and ETH dominance, DeFi and stablecoin totals. Returns the data plus a verifiable receipt of the API call.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_coin_info',
    description:
      'Get CoinMarketCap metadata for a coin: what it is, its category, tags, official website and technical docs. Returns the data plus a verifiable receipt of the API call.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Ticker symbol, e.g. "BTC"' },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'market_brief',
    description:
      'Build one fused market briefing for a watchlist: current quotes for the watchlist, global market context, and the biggest movers among the top 20. Backed by three CoinMarketCap API calls, all covered by a single verifiable receipt.',
    inputSchema: {
      type: 'object',
      properties: {
        symbols: {
          type: 'array',
          items: { type: 'string' },
          description: 'Watchlist symbols, e.g. ["BTC","ETH","SOL"]',
        },
      },
      required: ['symbols'],
    },
  },
];

export function createToolCaller({ client, ledger }) {
  const handlers = {
    async get_quotes(args) {
      const symbols = symbolsArg(args);
      const call = await client.quotesLatest(symbols);
      const data = Object.entries(call.response.data ?? {}).map(([sym, coin]) => quoteRow(sym, coin));
      const missing = symbols.filter((s) => !call.response.data?.[s]);
      return { data: { quotes: data, missing_symbols: missing }, calls: [call] };
    },

    async get_top_listings(args) {
      const limit = Math.min(Math.max(Number(args?.limit ?? 10) || 10, 1), 100);
      const call = await client.listingsLatest({ limit });
      const data = (call.response.data ?? []).map((coin) => ({
        rank: coin.cmc_rank,
        ...quoteRow(coin.symbol, coin),
      }));
      return { data: { listings: data }, calls: [call] };
    },

    async get_global_metrics() {
      const call = await client.globalMetrics();
      const d = call.response.data ?? {};
      const usd = d.quote?.USD ?? {};
      return {
        data: {
          total_market_cap_usd: num(usd.total_market_cap),
          total_volume_24h_usd: num(usd.total_volume_24h),
          btc_dominance: num(d.btc_dominance),
          eth_dominance: num(d.eth_dominance),
          active_cryptocurrencies: num(d.active_cryptocurrencies),
          defi_market_cap_usd: num(d.defi_market_cap),
          stablecoin_market_cap_usd: num(d.stablecoin_market_cap),
          last_updated: d.last_updated ?? usd.last_updated ?? null,
        },
        calls: [call],
      };
    },

    async get_coin_info(args) {
      const [symbol] = symbolsArg(args);
      const call = await client.info([symbol]);
      const info = call.response.data?.[symbol];
      if (!info) throw new Error(`No CoinMarketCap metadata found for symbol ${symbol}.`);
      return {
        data: {
          symbol,
          name: info.name,
          category: info.category ?? null,
          description: info.description ?? null,
          tags: info.tags ?? [],
          website: info.urls?.website?.[0] ?? null,
          technical_doc: info.urls?.technical_doc?.[0] ?? null,
          date_added: info.date_added ?? null,
        },
        calls: [call],
      };
    },

    async market_brief(args) {
      const symbols = symbolsArg(args);
      const [quotesCall, globalCall, listingsCall] = await Promise.all([
        client.quotesLatest(symbols),
        client.globalMetrics(),
        client.listingsLatest({ limit: 20 }),
      ]);
      const watchlist = Object.entries(quotesCall.response.data ?? {}).map(([sym, coin]) => quoteRow(sym, coin));
      const g = globalCall.response.data ?? {};
      const usd = g.quote?.USD ?? {};
      const movers = (listingsCall.response.data ?? [])
        .map((coin) => ({
          rank: coin.cmc_rank,
          symbol: coin.symbol,
          percent_change_24h: num(coin.quote?.USD?.percent_change_24h),
          price_usd: num(coin.quote?.USD?.price),
        }))
        .filter((m) => m.percent_change_24h !== null)
        .sort((a, b) => Math.abs(b.percent_change_24h) - Math.abs(a.percent_change_24h))
        .slice(0, 5);
      return {
        data: {
          as_of: quotesCall.response.status?.timestamp ?? null,
          market_context: {
            total_market_cap_usd: num(usd.total_market_cap),
            total_volume_24h_usd: num(usd.total_volume_24h),
            btc_dominance: num(g.btc_dominance),
            eth_dominance: num(g.eth_dominance),
          },
          watchlist,
          top_movers_top20: movers,
        },
        calls: [quotesCall, globalCall, listingsCall],
      };
    },
  };

  return async function callTool(name, args = {}) {
    const handler = handlers[name];
    if (!handler) throw new Error(`Unknown tool: ${name}`);
    const { data, calls } = await handler(args ?? {});
    const receipt = ledger.append({ tool: name, mode: client.mode, calls });
    return { data, receipt };
  };
}
