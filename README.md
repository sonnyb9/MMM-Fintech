# MMM-Fintech

A MagicMirror² module for displaying consolidated financial holdings with real-time pricing.

> **Note**: This module is a work in progress. Features and APIs may change.

## Features

- **Multi-Asset Support**: Crypto, stocks, ETFs, mutual funds, and forex
- **SnapTrade Integration**: Fetches holdings from Fidelity, Coinbase, and other brokerages
- **Coinbase Integration**: Fetches crypto holdings via CDP API
- **Twelve Data Integration**: Stocks, ETFs, mutual funds, and forex pricing
- **Manual Holdings**: Support for manual entry without any API registrations
- **Cost Basis & Gain/Loss**: Display unrealized gain/loss percentages
- **Portfolio Charts**: Visual performance tracking over time
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

## Data Providers

MMM-Fintech supports multiple ways to track your holdings, from fully manual to fully automated.

### Manual Holdings (No API Required)

**Purpose**: Track holdings without any API registrations or costs

**Cost**: Free

If you prefer not to register for any data provider APIs, you can manually enter your holdings in `manual-holdings.json`. This requires you to update the file yourself whenever your holdings change.

**How it works**: You enter your holdings (symbol, quantity, type) in a JSON file. The module will still need Twelve Data (free tier) to fetch current prices, or you can use the `cash` type for money market funds which uses a fixed $1.00 price with no API calls.

**Best for**: Users who want simplicity, don't want to share credentials with third-party services, or have holdings at brokerages not supported by SnapTrade.

See [Manual Holdings Setup](#5-add-manual-holdings-optional) for the file format.

---

### SnapTrade (Recommended for Automated Brokerage Holdings)

**Purpose**: Automatically fetches holdings from connected brokerage accounts (Fidelity, Coinbase, Schwab, etc.)

**Cost**: Pay-as-you-go pricing. See [SnapTrade Pricing](https://snaptrade.com/pricing) for details.

**Why use it**: SnapTrade provides unified access to multiple brokerages through a single API. When connected to Coinbase, it returns complete holdings including staked crypto (SOL, ETH) which the Coinbase CDP API cannot access. Holdings update automatically—no manual file editing required.

**Get credentials**: 
1. Create account at [SnapTrade Dashboard](https://dashboard.snaptrade.com/)
2. Generate API key (clientId and consumerKey)
3. See [SnapTrade Getting Started](https://docs.snaptrade.com/) for full setup

### Coinbase CDP API (Free - Crypto Only)

**Purpose**: Automatically fetches crypto holdings directly from Coinbase

**Cost**: Free. See [Coinbase Developer Platform](https://www.coinbase.com/developer-platform)

**Limitation**: The CDP API does not return staked crypto assets. If you have staked SOL, ETH, or other assets, they will not appear. Use SnapTrade (connected to Coinbase) or manual holdings instead to track staked assets.

**Get credentials**:
1. Go to [CDP Portal API Keys](https://portal.cdp.coinbase.com/projects/api-keys)
2. Create a Secret API key with **View** permission
3. Select **ECDSA** algorithm (required)
4. Download the JSON file

### Twelve Data (Free Tier - Pricing Only)

**Purpose**: Provides real-time pricing for stocks, ETFs, mutual funds, and forex rates

**Cost**: Free tier includes 8 API calls/minute (800/day). See [Twelve Data Pricing](https://twelvedata.com/pricing)

**Note**: Twelve Data is a pricing provider only—it does not track holdings. Holdings come from SnapTrade, Coinbase, manual entry, or a combination. With the default 20-minute update interval during market hours, you'll use approximately 200 calls/day for 10 symbols, well within the free tier.

**Get credentials**:
1. Create account at [Twelve Data](https://twelvedata.com/)
2. Copy your API key from the dashboard

### Provider Priority

When fetching holdings, the module uses this priority:
1. **SnapTrade** (if configured) — Fetches from all connected brokerages
2. **Coinbase CDP** (if SnapTrade not configured) — Fetches crypto only
3. **Manual holdings** — Always merged for additional positions or as standalone

For pricing:
- **Crypto**: Coinbase CDP API
- **Stocks/ETFs/Mutual Funds/Forex**: Twelve Data API
- **Cash (money market)**: Fixed at $1.00 (no API calls)

## Installation

```bash
cd ~/MagicMirror/modules
git clone https://github.com/sonnyb9/MMM-Fintech.git
cd MMM-Fintech
npm install
```

## Setup

### 1. Set Up SnapTrade (Recommended)

SnapTrade provides the most complete holdings data, including staked crypto.

```bash
node setup-snaptrade.js
```

Enter your clientId and consumerKey when prompted. Then generate a connection portal URL:

```bash
node snaptrade-connect.js
```

Open the URL in a browser to connect your brokerage accounts (Fidelity, Coinbase, etc.). **Note**: The connection portal URL expires in 5 minutes—run the command again if it expires before you complete the connection.

### 2. Set Up Coinbase CDP API (Alternative to SnapTrade for Crypto)

Only needed if you're not using SnapTrade for crypto holdings.

1. Download your API key JSON from [CDP Portal](https://portal.cdp.coinbase.com/projects/api-keys)
2. Place `cdp_api_key.json` in the module folder
3. Run:

```bash
node setup-credentials.js
```

This will:
- Generate an encryption key at `~/.mmm-fintech-key`
- Create `cdp-credentials.enc` from your JSON file
- Prompt to delete the original JSON (recommended)

### 3. Set Up Twelve Data (Required for Stock/Forex Pricing)

```bash
node setup-twelvedata.js
```

Enter your API key when prompted. This creates `twelvedata-credentials.enc`.

### 4. Configure MagicMirror

Add to your `config/config.js`:

```javascript
{
  module: "MMM-Fintech",
  position: "middle_center",  // Recommended for best display
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

### 5. Add Manual Holdings (Optional)

Create `manual-holdings.json` in the module folder for any holdings not covered by APIs, or as your sole holdings source if not using SnapTrade or Coinbase:

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
    },
    {
      "symbol": "SPAXX",
      "quantity": 1000,
      "type": "cash",
      "source": "fidelity",
      "notes": "Money market fund"
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

**Note**: You must update this file manually whenever your holdings change. If using SnapTrade, this file is only needed for holdings at unsupported brokerages.

## Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `title` | `"Portfolio"` | Header text |
| `fontSize` | `100` | Font size as percentage (e.g., 80 for smaller, 120 for larger) |
| `displayMode` | `"table"` | Display mode: `"table"` (default) or `"ticker"` for horizontal scrolling |
| `tickerSpeed` | `50` | Ticker scroll speed in pixels per second |
| `tickerPause` | `0` | Milliseconds to pause on each item (0 = no pause) |
| `currency` | `"USD"` | Currency for values (e.g., `EUR`, `GBP`, `PHP`) |
| `currencyStyle` | `"symbol"` | Display as `"symbol"` ($, €, £) or `"code"` (USD, EUR) |
| `cryptoPriceUpdateInterval` | `300000` | Crypto price refresh (5 min) |
| `stockPriceUpdateInterval` | `1200000` | Stock/forex price refresh (20 min) |
| `showLastUpdated` | `true` | Show last sync timestamp |
| `showPricePerUnit` | `true` | Show price column |
| `showQuantity` | `true` | Show quantity, value columns, and total row |
| `showGainLoss` | `true` | Show gain/loss percentage column (requires SnapTrade or manual costBasis) |
| `showForex` | `true` | Show forex rates section |
| `showInverseForex` | `true` | Show inverse rate column in forex section |
| `cryptoAsForex` | `[]` | Crypto symbols to show as forex rates (e.g., `["BTC", "ETH"]`) |
| `sortBy` | `"value"` | Sort by `"value"` or `"name"` |
| `maxRetries` | `6` | Maximum API retry attempts |
| `holdingsSyncTime` | `"07:45"` | Daily holdings sync time (HH:MM) |
| `staleHoldingsThreshold` | `90000000` | Holdings stale after 25 hours |
| `stalePricesThreshold` | `3900000` | Prices stale after 65 minutes |
| `showCharts` | `false` | Enable portfolio performance charts |
| `chartMode` | `"combined"` | Chart mode: `"combined"`, `"separate"`, or `"exclude-crypto"` |
| `chartPeriod` | `"1M"` | Default chart period: `"1D"`, `"1W"`, `"1M"`, `"3M"`, `"1Y"`, `"All"` |
| `showPeriodSelector` | `false` | Show period selector buttons (for touch devices) |
| `historyRetention` | `1825` | Days to retain chart history (default: 5 years) |
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

### Enable Portfolio Charts
```javascript
config: {
  showCharts: true,
  chartPeriod: "1M"
}
```

### Separate Crypto Chart
```javascript
config: {
  showCharts: true,
  chartMode: "separate"
}
```

## Ticker Mode

Ticker mode displays holdings as a horizontal scrolling ticker bar, ideal for TV displays or landscape orientations.

**Features:**
- Portfolio total shown first with value-weighted 24h change
- Each holding shows: Symbol, Price, Change %
- Green/red color coding for positive/negative changes
- `(Closed)` indicator for non-crypto assets when markets are closed
- Charts can still be displayed alongside the ticker

**Basic Ticker Configuration:**
```javascript
config: {
  displayMode: "ticker",
  tickerSpeed: 50,      // pixels per second
  tickerPause: 0        // no pause between items
}
```

**Ticker with Chart:**
```javascript
config: {
  displayMode: "ticker",
  tickerSpeed: 40,
  showCharts: true,
  chartMode: "combined",
  chartPeriod: "1W"
}
```

**Market Status:**
- Crypto: Always shows live 24h change (24/7 market)
- Stocks/ETFs/Mutual Funds: Shows change since previous close during market hours; shows last trading day's change with `(Closed)` indicator when markets are closed
- Forex: Shows change since previous close during trading hours (Sun 5pm - Fri 5pm ET)

## Portfolio Charts

The module can display portfolio value charts over time.

**Chart Modes:**
- `combined` - Single chart showing total portfolio value
- `separate` - Two charts: Traditional investments + Crypto
- `exclude-crypto` - Single chart showing only traditional investments

**Time Periods:**
- `1D` - Last 24 hours (uses hourly snapshots)
- `1W`, `1M`, `3M`, `1Y`, `All` - Use daily snapshots

**Data Collection:**
- Hourly snapshots recorded during each price update (rolling 48 hours)
- Daily snapshots recorded during the morning holdings sync
- Data starts fresh from when you enable charts (no historical backfill)

**Storage Requirements (10 holdings):**
- ~600 bytes per snapshot
- ~250 KB after 1 year
- ~1.1 MB after 5 years

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
| `snaptrade-credentials.enc` | Encrypted SnapTrade credentials | Ignored |
| `~/.mmm-fintech-key` | Encryption key (shared by all providers) | N/A |
| `manual-holdings.json` | Manual holdings and forex | Ignored |
| `cache.json` | Cached data | Ignored |
| `history.json` | Chart history snapshots | Ignored |

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

### Diagnostic Test Scripts

The module includes test scripts to verify provider connections and data flow:

```bash
cd ~/MagicMirror/modules/MMM-Fintech
```

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `test-snaptrade-provider.js` | Tests SnapTrade initialization and holdings fetch | After SnapTrade setup to verify credentials and brokerage connections |
| `test-twelvedata.js` | Tests Twelve Data API for stocks, mutual funds, and forex | After Twelve Data setup to verify API key and symbol availability |
| `test-full-sync.js` | Tests complete holdings sync across all providers | When holdings aren't appearing or to debug provider priority |
| `test-costbasis.js` | Tests cost basis and gain/loss data from SnapTrade | When G/L column shows incorrect values or dashes |

**Example usage:**

```bash
# Verify SnapTrade is working
node test-snaptrade-provider.js

# Check if Twelve Data can fetch your symbols
node test-twelvedata.js

# Debug the full sync process
node test-full-sync.js
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

**"SnapTrade provider not configured"**
- Run `node setup-snaptrade.js` to add credentials

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
