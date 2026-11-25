// Cached CoinMarketCap-shaped responses for mock mode.
//
// These fixtures mirror the real CMC Pro API envelope ({ status, data }) and
// field names exactly, so every code path that runs against them also runs
// against the live API unchanged. Prices are plausible snapshots, NOT live
// data — receipts produced in mock mode are stamped mode:"mock" so nobody
// can mistake them for real API evidence.

const TS = '2026-11-25T00:00:00.000Z';

function status(creditCount = 1) {
  return {
    timestamp: TS,
    error_code: 0,
    error_message: null,
    elapsed: 12,
    credit_count: creditCount,
  };
}

function quoteUsd(price, volume24h, pct1h, pct24h, pct7d, marketCap) {
  return {
    USD: {
      price,
      volume_24h: volume24h,
      volume_change_24h: -3.21,
      percent_change_1h: pct1h,
      percent_change_24h: pct24h,
      percent_change_7d: pct7d,
      percent_change_30d: 4.56,
      market_cap: marketCap,
      market_cap_dominance: 0,
      fully_diluted_market_cap: marketCap * 1.05,
      last_updated: TS,
    },
  };
}

const COINS = {
  BTC: {
    id: 1, name: 'Bitcoin', symbol: 'BTC', slug: 'bitcoin', cmc_rank: 1,
    circulating_supply: 19980000, total_supply: 19980000, max_supply: 21000000,
    quote: quoteUsd(91247.31, 48230000000, 0.18, 2.34, 5.12, 1823100000000),
  },
  ETH: {
    id: 1027, name: 'Ethereum', symbol: 'ETH', slug: 'ethereum', cmc_rank: 2,
    circulating_supply: 120450000, total_supply: 120450000, max_supply: null,
    quote: quoteUsd(3412.87, 21450000000, -0.07, 1.86, 3.94, 411090000000),
  },
  USDT: {
    id: 825, name: 'Tether USDt', symbol: 'USDT', slug: 'tether', cmc_rank: 3,
    circulating_supply: 184200000000, total_supply: 184200000000, max_supply: null,
    quote: quoteUsd(0.9998, 61200000000, 0.0, -0.01, 0.02, 184160000000),
  },
  BNB: {
    id: 1839, name: 'BNB', symbol: 'BNB', slug: 'bnb', cmc_rank: 4,
    circulating_supply: 139300000, total_supply: 139300000, max_supply: 200000000,
    quote: quoteUsd(941.22, 1980000000, 0.11, -0.94, 2.31, 131120000000),
  },
  SOL: {
    id: 5426, name: 'Solana', symbol: 'SOL', slug: 'solana', cmc_rank: 5,
    circulating_supply: 516800000, total_supply: 590100000, max_supply: null,
    quote: quoteUsd(214.63, 3980000000, 0.42, 4.71, 9.86, 110910000000),
  },
  XRP: {
    id: 52, name: 'XRP', symbol: 'XRP', slug: 'xrp', cmc_rank: 6,
    circulating_supply: 60240000000, total_supply: 99980000000, max_supply: 100000000000,
    quote: quoteUsd(1.42, 5120000000, -0.23, -2.18, 1.07, 85540000000),
  },
  DOGE: {
    id: 74, name: 'Dogecoin', symbol: 'DOGE', slug: 'dogecoin', cmc_rank: 7,
    circulating_supply: 151200000000, total_supply: 151200000000, max_supply: null,
    quote: quoteUsd(0.3184, 2870000000, 0.65, 6.23, -1.44, 48150000000),
  },
  ADA: {
    id: 2010, name: 'Cardano', symbol: 'ADA', slug: 'cardano', cmc_rank: 8,
    circulating_supply: 35980000000, total_supply: 45000000000, max_supply: 45000000000,
    quote: quoteUsd(0.9721, 890000000, -0.12, 0.87, -3.62, 34970000000),
  },
};

const INFO = {
  BTC: {
    id: 1, name: 'Bitcoin', symbol: 'BTC', category: 'coin',
    description:
      'Bitcoin (BTC) is a cryptocurrency launched in 2010. Users are able to generate BTC through the process of mining. Bitcoin has a current supply of 19,980,000. The last known price of Bitcoin is 91,247.31 USD.',
    slug: 'bitcoin', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png',
    date_added: '2010-07-13T00:00:00.000Z', notice: null,
    tags: ['mineable', 'pow', 'sha-256', 'store-of-value'],
    platform: null,
    urls: {
      website: ['https://bitcoin.org/'],
      technical_doc: ['https://bitcoin.org/bitcoin.pdf'],
      source_code: ['https://github.com/bitcoin/bitcoin'],
      message_board: ['https://bitcointalk.org'],
      reddit: ['https://reddit.com/r/bitcoin'],
    },
  },
  ETH: {
    id: 1027, name: 'Ethereum', symbol: 'ETH', category: 'coin',
    description:
      'Ethereum (ETH) is a cryptocurrency launched in 2015. Ethereum has a current supply of 120,450,000. The last known price of Ethereum is 3,412.87 USD. Ethereum is a decentralised smart-contract platform.',
    slug: 'ethereum', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png',
    date_added: '2015-08-07T00:00:00.000Z', notice: null,
    tags: ['pos', 'smart-contracts', 'ethereum-ecosystem', 'layer-1'],
    platform: null,
    urls: {
      website: ['https://ethereum.org/'],
      technical_doc: ['https://ethereum.org/en/whitepaper/'],
      source_code: ['https://github.com/ethereum/go-ethereum'],
      message_board: [],
      reddit: ['https://reddit.com/r/ethereum'],
    },
  },
  SOL: {
    id: 5426, name: 'Solana', symbol: 'SOL', category: 'coin',
    description:
      'Solana (SOL) is a cryptocurrency launched in 2020. Solana has a current supply of 590,100,000 with 516,800,000 in circulation. The last known price of Solana is 214.63 USD. Solana is a high-throughput layer-1 blockchain.',
    slug: 'solana', logo: 'https://s2.coinmarketcap.com/static/img/coins/64x64/5426.png',
    date_added: '2020-04-10T00:00:00.000Z', notice: null,
    tags: ['pos', 'solana-ecosystem', 'layer-1', 'web3'],
    platform: null,
    urls: {
      website: ['https://solana.com/'],
      technical_doc: ['https://docs.solana.com/'],
      source_code: ['https://github.com/solana-labs/solana'],
      message_board: [],
      reddit: ['https://reddit.com/r/solana'],
    },
  },
};

function pickCoins(symbols) {
  const out = {};
  for (const s of symbols) {
    const sym = String(s).toUpperCase();
    if (COINS[sym]) out[sym] = structuredClone(COINS[sym]);
  }
  return out;
}

export const fixtures = {
  quotesLatest(symbols) {
    return { status: status(), data: pickCoins(symbols) };
  },
  listingsLatest(limit = 10) {
    const all = Object.values(COINS).sort((a, b) => a.cmc_rank - b.cmc_rank);
    return { status: status(), data: structuredClone(all.slice(0, limit)) };
  },
  globalMetrics() {
    return {
      status: status(),
      data: {
        active_cryptocurrencies: 11248,
        total_cryptocurrencies: 38412,
        active_market_pairs: 91234,
        active_exchanges: 812,
        total_exchanges: 2145,
        eth_dominance: 12.94,
        btc_dominance: 57.31,
        defi_volume_24h: 12400000000,
        defi_market_cap: 128400000000,
        stablecoin_volume_24h: 88400000000,
        stablecoin_market_cap: 268900000000,
        derivatives_volume_24h: 142300000000,
        quote: {
          USD: {
            total_market_cap: 3181700000000,
            total_volume_24h: 168420000000,
            total_volume_24h_reported: 171050000000,
            altcoin_volume_24h: 120190000000,
            altcoin_market_cap: 1358600000000,
            last_updated: TS,
          },
        },
        last_updated: TS,
      },
    };
  },
  info(symbols) {
    const out = {};
    for (const s of symbols) {
      const sym = String(s).toUpperCase();
      if (INFO[sym]) out[sym] = structuredClone(INFO[sym]);
      else if (COINS[sym]) {
        const c = COINS[sym];
        out[sym] = {
          id: c.id, name: c.name, symbol: c.symbol, category: 'coin',
          description: `${c.name} (${c.symbol}) market metadata.`,
          slug: c.slug, logo: `https://s2.coinmarketcap.com/static/img/coins/64x64/${c.id}.png`,
          date_added: TS, notice: null, tags: [], platform: null,
          urls: { website: [], technical_doc: [], source_code: [], message_board: [], reddit: [] },
        };
      }
    }
    return { status: status(), data: out };
  },
};
