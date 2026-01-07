# MMM-Fintech

A MagicMirrorÂ² module for displaying consolidated financial holdings with real-time pricing.

## Features

- **Multi-Asset Support**: Crypto, stocks, ETFs, mutual funds, and forex
- **Coinbase Integration**: Fetches crypto holdings via CDP API
- **Twelve Data Integration**: Stocks, ETFs, mutual funds, and forex pricing
- **Manual Holdings**: Support for staked assets and brokerage positions
- **Real-time Pricing**: Configurable update intervals by asset type
- **Market Hours Scheduling**: Limit stock/forex polling to market hours
- **24h Change**: Shows percent change for each holding
- **Portfolio Total**: Displays total value in configurable currency
- **Forex Rates**: Display exchange rates with optional inverse pairs
- **Currency Conversion**: Display values in any currency (USD, EUR, GBP, etc.)
- **Privacy Mode**: Hide quantity, value, and total
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
- `cash` - Money market funds with stable $1.00 NAV (no API calls)

**Forex Pairs**: Inverse rates shown as a column (can be hidden via `showInverseForex: false`)

### 6. Configure MagicMirror

Add to your `config/config.js`:

```javascript
{
  module: "MMM-Fintech",
  position: "top_right",
  config: {
    title: "Portfolio",
    showLastUpdated: true,
    showPricePerUnit: true,
    showQuantity: true,
    showForex: true,
    sortBy: "value"
  }
}
```

## Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `title` | `"Portfolio"` | Header text |
| `fontSize` | `100` | Font size as percentage (e.g., 80 for smaller, 120 for larger) |
| `currency` | `"USD"` | Currency for values (e.g., `EUR`, `GBP`, `PHP`) |
| `currencyStyle` | `"symbol"` | Display as `"symbol"` ($, â‚¬, Â£) or `"code"` (USD, EUR) |
| `cryptoPriceUpdateInterval` | `300000` | Crypto price refresh (5 min) |
| `stockPriceUpdateInterval` | `1200000` | Stock/forex price refresh (20 min) |
| `showLastUpdated` | `true` | Show last sync timestamp |
| `showPricePerUnit` | `true` | Show price column |
| `showQuantity` | `true` | Show quantity, value columns, and total row |
| `showForex` | `true` | Show forex rates section |
| `showInverseForex` | `true` | Show inverse rate column in forex section |
| `cryptoAsForex` | `[]` | Crypto symbols to show as forex rates (e.g., `["BTC", "ETH"]`) |
| `sortBy` | `"value"` | Sort by `"value"` or `"name"` |
| `maxRetries` | `6` | Maximum API retry attempts |
| `holdingsSyncTime` | `"07:45"` | Daily holdings sync time (HH:MM) |
| `staleHoldingsThreshold` | `90000000` | Holdings stale after 25 hours |
| `stalePricesThreshold` | `3900000` | Prices stale after 65 minutes |
| `marketHours` | See below | Market-hour polling schedules by asset type |

## Market Hours Scheduling

Stock, ETF, and mutual fund price updates are limited to US market hours by default. Forex updates follow the 24/5 forex market schedule (Sunday 5pm - Friday 5pm ET). This reduces unnecessary API calls and rate limit issues outside trading hours.

**Default Configuration:**

```javascript
marketHours: {
  stock: {
    enabled: true,
    timezone: "America/New_York",
    open: "09:30",
    close: "16:00",
    days: [1, 2, 3, 4, 5],  // Mon-Fri (0=Sun, 6=Sat)
    postClosePoll: true     // One final update after close
  },
  etf: {
    enabled: true,
    timezone: "America/New_York",
    open: "09:30",
    close: "16:00",
    days: [1, 2, 3, 4, 5],
    postClosePoll: true
  },
  mutual_fund: {
    enabled: true,
    timezone: "America/New_York",
    open: "09:30",
    close: "16:00",
    days: [1, 2, 3, 4, 5],
    postClosePoll: true
  },
  forex: {
    enabled: true,
    timezone: "America/New_York",
    sundayOpen: "17:00",    // Market opens Sunday 5pm ET
    fridayClose: "17:00"    // Market closes Friday 5pm ET
  }
}
```

**Disable Market Hours (poll 24/7):**

```javascript
config: {
  marketHours: {
    stock: { enabled: false },
    etf: { enabled: false },
    mutual_fund: { enabled: false },
    forex: { enabled: false }
  }
}
```

**Key behaviors:**
- **postClosePoll**: When enabled, allows one final price update after market close each trading day
- **days**: Array of trading days (0=Sunday through 6=Saturday)
- **Crypto**: Always updates regardless of market hours (24/7 market)

## Example Configurations

### Privacy Mode (hide quantities and total)
```javascript
config: {
  showQuantity: false,
  showPricePerUnit: true
}
```

### Euro Display
```javascript
config: {
  currency: "EUR",
  currencyStyle: "symbol"
}
```

### Show BTC/ETH as Exchange Rates
```javascript
config: {
  cryptoAsForex: ["BTC", "ETH"],
  showInverseForex: false
}
```

### Smaller Font
```javascript
config: {
  fontSize: 80
}
```

## Scheduling

- **Holdings sync**: Daily at configured time (default: 7:45am), plus on startup if data >24 hours old
- **Crypto prices**: Every 5 minutes (configurable), 24/7
- **Stock/ETF prices**: Every 20 minutes during market hours (configurable)
- **Forex prices**: Every 20 minutes during forex market hours (Sun 5pm - Fri 5pm ET)

## API Rate Limits

**Twelve Data Free Tier**: 800 calls/day
- With 20-minute intervals during market hours: ~200 calls/day for 10 symbols
- Currency conversion adds 1 extra call per sync (if not USD)
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

**"Market closed for stock, skipped price refresh"**
- Normal behavior outside market hours
- Set `marketHours.stock.enabled: false` to disable

## Roadmap

See [ROADMAP.md](ROADMAP.md) for planned features and development phases.

## License

MIT

## Developer Workflow

For development on Windows and testing on Raspberry Pi, see DEV.md.

## SnapTrade (Work in progress)

SnapTrade integration is being added to support brokerage position sync.


### SnapTrade setup (WIP)

Run the setup helper to enter credentials (storage/encryption is added in a later step):

```powershell
node .\setup-snaptrade.js
```

The setup script creates an encrypted credentials file (snaptrade-credentials.enc) in the module directory using AES-256-GCM. The encryption key is stored at ~/.mmm-fintech-key (copy this file to the same path on your Raspberry Pi).
