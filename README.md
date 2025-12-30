# MMM-Fintech

A MagicMirror² module for displaying consolidated financial holdings with real-time pricing.

## Features

- **Multi-Asset Support**: Crypto, stocks, ETFs, mutual funds, and forex
- **Coinbase Integration**: Fetches crypto holdings via CDP API
- **Twelve Data Integration**: Stocks, ETFs, mutual funds, and forex pricing
- **Manual Holdings**: Support for staked assets and brokerage positions
- **Real-time Pricing**: Configurable update intervals by asset type
- **24h Change**: Shows percent change for each holding
- **Portfolio Total**: Displays total USD value
- **Forex Rates**: Display exchange rates with automatic inverse pairs
- **Secure Credentials**: AES-256-GCM encrypted API keys
- **Error Indicators**: Visual warnings when sync fails
- **Configurable Sorting**: By value or alphabetically

## Installation

```bash
cd ~/MagicMirror/modules
git clone https://github.com/sonnyb9/MMM-Fintech.git
cd MMM-Fintech
npm install
```

## Setup

### 1. Create Coinbase API Key (for crypto)

1. Go to [CDP Portal](https://portal.cdp.coinbase.com/)
2. Create a **Secret API key**
3. Set permission to **View** only
4. Select **ECDSA** algorithm (required for SDK)
5. Download the JSON file

### 2. Encrypt Coinbase Credentials

Place the downloaded `cdp_api_key.json` in the module folder, then run:

```bash
node setup-credentials.js
```

This will:
- Generate an encryption key at `~/.mmm-fintech-key`
- Create `cdp-credentials.enc` from your JSON file
- Prompt to delete the original JSON (recommended)

### 3. Create Twelve Data API Key (for stocks/forex)

1. Go to [Twelve Data](https://twelvedata.com/)
2. Create a free account
3. Copy your API key from the dashboard

### 4. Encrypt Twelve Data Credentials

```bash
node setup-twelvedata.js
```

Enter your API key when prompted. This creates `twelvedata-credentials.enc`.

### 5. Add Manual Holdings

Create `manual-holdings.json` in the module folder:

```json
{
  "description": "Manual holdings and forex pairs",
  "lastUpdated": "2025-12-29T00:00:00Z",
  "holdings": [
    {
      "symbol": "SOL",
      "quantity": 12.919,
      "type": "crypto",
      "source": "coinbase-staked",
      "notes": "100% staked"
    },
    {
      "symbol": "AAPL",
      "quantity": 50,
      "type": "stock",
      "source": "fidelity"
    },
    {
      "symbol": "VOO",
      "quantity": 25,
      "type": "etf",
      "source": "fidelity"
    }
  ],
  "forex": [
    {"pair": "USD/PHP"},
    {"pair": "USD/EUR"}
  ]
}
```

**Asset Types**:
- `crypto` - Cryptocurrency (priced via Coinbase)
- `stock` - Individual stocks (priced via Twelve Data)
- `etf` - Exchange-traded funds (priced via Twelve Data)
- `mutual_fund` - Mutual funds (priced via Twelve Data)

**Forex Pairs**: Inverse rates are automatically generated (USD/PHP → PHP/USD)

### 6. Configure MagicMirror

Add to your `config/config.js`:

```javascript
{
  module: "MMM-Fintech",
  position: "top_right",
  config: {
    title: "Holdings",
    cryptoPriceUpdateInterval: 5 * 60 * 1000,   // 5 minutes
    stockPriceUpdateInterval: 20 * 60 * 1000,   // 20 minutes
    showLastUpdated: true,
    showPricePerUnit: true,
    showForex: true,
    sortBy: "value"
  }
}
```

## Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `title` | "Holdings" | Header text |
| `cryptoPriceUpdateInterval` | 300000 | Crypto price refresh (5 min) |
| `stockPriceUpdateInterval` | 1200000 | Stock/forex price refresh (20 min) |
| `showLastUpdated` | true | Show last sync timestamp |
| `showPricePerUnit` | true | Show price column |
| `showForex` | true | Show forex rates section |
| `sortBy` | "value" | Sort by "value" or "name" |
| `maxRetries` | 6 | Maximum API retry attempts |
| `holdingsSyncTime` | "07:45" | Daily holdings sync time (HH:MM) |
| `staleHoldingsThreshold` | 90000000 | Holdings stale after 25 hours |
| `stalePricesThreshold` | 3900000 | Prices stale after 65 minutes |

## Scheduling

- **Holdings sync**: Daily at configured time (default: 7:45am), plus on startup if data >24 hours old
- **Crypto prices**: Every 5 minutes (configurable)
- **Stock/forex prices**: Every 20 minutes (configurable)

## API Rate Limits

**Twelve Data Free Tier**: 800 calls/day
- With 20-minute intervals: ~720 calls/day for 10 symbols
- Crypto uses Coinbase (separate limit)

## Files

| File | Description | Git |
|------|-------------|-----|
| `cdp_api_key.json` | Original Coinbase key (delete after setup) | Ignored |
| `cdp-credentials.enc` | Encrypted Coinbase credentials | Ignored |
| `twelvedata-credentials.enc` | Encrypted Twelve Data credentials | Ignored |
| `~/.mmm-fintech-key` | Encryption key | N/A |
| `manual-holdings.json` | Manual holdings and forex | Ignored |
| `cache.json` | Cached data | Ignored |

## Finding Valid Symbols

**Crypto** (Coinbase):
- Use uppercase: `BTC`, `ETH`, `SOL`
- Check: [Coinbase Advanced Trade](https://www.coinbase.com/advanced-trade)

**Stocks/ETFs** (Twelve Data):
- Use standard tickers: `AAPL`, `GOOGL`, `VOO`, `SPY`
- Check: [Twelve Data Symbol Search](https://twelvedata.com/symbols)

**Forex** (Twelve Data):
- Format: `BASE/QUOTE` (e.g., `USD/PHP`, `EUR/USD`)

## Troubleshooting

### View Logs

```bash
pm2 logs magicmirror --lines 100 | grep -i fintech
```

### Force Holdings Sync

```bash
rm ~/MagicMirror/modules/MMM-Fintech/cache.json
pm2 restart magicmirror
```

### Test Provider Connections

```bash
cd ~/MagicMirror/modules/MMM-Fintech
node test-coinbase.js      # Test Coinbase
node test-twelvedata.js    # Test Twelve Data
```

### Common Errors

**"Crypto holdings data is N hours old"**
- Check sync logs: `pm2 logs magicmirror --lines 100 | grep -E "Holdings sync"`
- Restart: `pm2 restart magicmirror`

**"Invalid symbol 'XYZ'"**
- Verify symbol exists on the appropriate exchange
- Check `type` field matches the asset (crypto vs stock)

**"TwelveData provider not configured"**
- Run `node setup-twelvedata.js` to add credentials

**"Rate limit exceeded"**
- Twelve Data: Wait for credit reset (per minute)
- Coinbase: Uses exponential backoff automatically

## Roadmap

See [ROADMAP.md](ROADMAP.md) for planned features and development phases.

## License

MIT
