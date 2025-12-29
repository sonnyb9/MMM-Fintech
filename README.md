# MMM-Fintech

A MagicMirror² module for displaying consolidated cryptocurrency holdings with real-time pricing.

## Features

- **Coinbase Integration**: Fetches holdings via CDP API
- **Manual Holdings**: Support for staked assets not returned by API
- **Real-time Pricing**: Configurable update interval (default: 5 minutes)
- **24h Change**: Shows percent change for each holding
- **Portfolio Total**: Displays total USD value
- **Secure Credentials**: AES-256-GCM encrypted API keys
- **Error Indicators**: Visual warning when sync fails
- **Configurable Sorting**: By value or alphabetically

## Installation

```bash
cd ~/MagicMirror/modules
git clone https://github.com/sonnyb9/MMM-Fintech.git
cd MMM-Fintech
npm install
```

## Setup

### 1. Create Coinbase API Key

1. Go to [CDP Portal](https://portal.cdp.coinbase.com/)
2. Create a **Secret API key**
3. Set permission to **View** only
4. Select **ECDSA** algorithm (required for SDK)
5. Download the JSON file

### 2. Encrypt Credentials

Place the downloaded `cdp_api_key.json` in the module folder, then run:

```bash
node setup-credentials.js
```

This will:
- Generate an encryption key at `~/.mmm-fintech-key`
- Create `cdp-credentials.enc` from your JSON file
- Prompt to delete the original JSON (recommended)

### 3. Add Manual Holdings (Optional)

For staked assets or holdings not returned by the API, create `manual-holdings.json` in the module folder:

```json
{
  "description": "Manual holdings not returned by Coinbase API",
  "lastUpdated": "2025-12-26T00:00:00Z",
  "holdings": [
    {
      "symbol": "SOL",
      "quantity": 12.919,
      "source": "coinbase-staked",
      "notes": "100% staked"
    },
    {
      "symbol": "ETH",
      "quantity": 0.380,
      "source": "coinbase-staked",
      "notes": "Staked ETH"
    }
  ]
}
```

**Finding Valid Symbols:**

Crypto symbols must match Coinbase's ticker format:
- Use uppercase (e.g., `BTC`, `ETH`, `SOL`)
- Must be available on Coinbase Advanced Trade
- Check available symbols: [Coinbase Advanced Trade](https://www.coinbase.com/advanced-trade)
- Common symbols: `BTC`, `ETH`, `SOL`, `USDC`, `MATIC`, `AVAX`, `LINK`, `UNI`

**Verifying Symbols Work:**

After adding symbols to `manual-holdings.json`, check the logs:

```bash
pm2 logs magicmirror --lines 50 | grep -E "(Failed to fetch price|No price data)"
```

If you see errors for a specific symbol, it may be:
- Misspelled or incorrectly formatted
- Not available on Coinbase Advanced Trade
- Delisted or suspended from trading

**What Happens with Invalid Symbols:**

If a symbol in `manual-holdings.json` is invalid:
- The holding will display with $0.00 price and value
- An error will be logged: `Failed to fetch price for SYMBOL`
- The footer may show: "⚠ Invalid symbol 'SYMBOL' in manual holdings"
- Other valid holdings will continue to work normally

**Troubleshooting Invalid Symbols:**

```bash
# Check which symbols are failing
pm2 logs magicmirror --lines 100 | grep "Failed to fetch price for"

# Verify symbol exists on Coinbase
# Visit: https://www.coinbase.com/advanced-trade/spot/SYMBOL-USD
# Example: https://www.coinbase.com/advanced-trade/spot/BTC-USD
```

### 4. Configure MagicMirror

Add to your `config/config.js`:

```javascript
{
  module: "MMM-Fintech",
  position: "top_right",
  config: {
    title: "Crypto Holdings",
    priceUpdateInterval: 5 * 60 * 1000,  // 5 minutes
    showLastUpdated: true,
    sortBy: "value"  // or "name"
  }
}
```

## Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `title` | "Holdings" | Header text |
| `priceUpdateInterval` | 300000 | Price refresh interval in ms (5 min) |
| `showLastUpdated` | true | Show last sync timestamp |
| `sortBy` | "value" | Sort holdings by "value" or "name" |
| `maxRetries` | 6 | Maximum API retry attempts with exponential backoff |
| `holdingsSyncTime` | "07:45" | Daily holdings sync time in 24-hour format (HH:MM) |
| `staleHoldingsThreshold` | 90000000 | Holdings considered stale after this many ms (25 hours) |
| `stalePricesThreshold` | 3900000 | Prices considered stale after this many ms (65 minutes) |

## Scheduling

- **Holdings sync**: Daily at configured time (default: 7:45am), plus on startup if data >24 hours old
- **Price updates**: Every 5 minutes (configurable)

## Files

| File | Description | Git |
|------|-------------|-----|
| `cdp_api_key.json` | Original API key (delete after setup) | Ignored |
| `cdp-credentials.enc` | Encrypted credentials | Ignored |
| `~/.mmm-fintech-key` | Encryption key | N/A |
| `manual-holdings.json` | Manual/staked holdings | Ignored |
| `cache.json` | Cached holdings and prices | Ignored |

## Troubleshooting

If you see the ⚠ warning indicator, check the logs using the commands below.

### Error: "Crypto holdings data is N hours old"

**Check sync logs:**
```bash
pm2 logs magicmirror --lines 100 | grep -E "(Holdings sync|syncIfStale|scheduleNextHoldingsSync)"
```

**Check for sync errors:**
```bash
pm2 logs magicmirror --lines 100 | grep -E "ERROR.*SYNC"
```

**Verify next sync time:**
Look for log message: "Next holdings sync scheduled for..."

**Common causes:**
- Sync scheduler not running (module not initialized properly)
- Sync failed due to API error (check ERROR logs above)
- Pi was powered off during scheduled sync time
- Clock/timezone issue on Pi

**Fix:**
```bash
pm2 restart magicmirror
```

### Error: "Coinbase sync failed N times, retrying..."

**Check sync failure details:**
```bash
pm2 logs magicmirror --lines 100 | grep -E "Holdings Fetch.*failed|SYNC.*failed"
```

**Check API response:**
```bash
pm2 logs magicmirror --lines 100 | grep "API request failed"
```

**Verify credentials exist:**
```bash
ls -la ~/.mmm-fintech-key ~/MagicMirror/modules/MMM-Fintech/cdp-credentials.enc
```

**Common causes:**
- API key expired or revoked
- Network connectivity issues
- Coinbase API outage
- Rate limit exceeded (unlikely with daily sync)
- Credentials file corrupted or missing

**Fix:**
```bash
# If credentials issue, re-run setup
cd ~/MagicMirror/modules/MMM-Fintech
node setup-credentials.js
```

### Error: "Crypto price updates failing"

**Check price update logs:**
```bash
pm2 logs magicmirror --lines 100 | grep -E "Price Update.*failed|PRICE_UPDATE"
```

**Check which symbols are failing:**
```bash
pm2 logs magicmirror --lines 100 | grep "Failed to update price for"
```

**Common causes:**
- Specific symbol unavailable on Coinbase (e.g., delisted)
- Symbol in `manual-holdings.json` is misspelled or invalid
- API rate limit (unlikely at 5min intervals)
- Network timeout

**Fix:**
```bash
# Verify symbol exists on Coinbase
# Visit: https://www.coinbase.com/advanced-trade/spot/SYMBOL-USD

# If symbol is invalid, edit manual-holdings.json:
nano ~/MagicMirror/modules/MMM-Fintech/manual-holdings.json
# Remove or correct the invalid symbol

# Restart to apply changes:
pm2 restart magicmirror
```

### Error: "Invalid symbol 'XYZ' in manual holdings"

**Check manual holdings file:**
```bash
cat ~/MagicMirror/modules/MMM-Fintech/manual-holdings.json
```

**Verify symbol format:**
- Must be uppercase (e.g., `BTC`, not `btc`)
- Must match Coinbase ticker exactly
- Must be available on Coinbase Advanced Trade

**Fix:**
```bash
# Edit manual holdings:
nano ~/MagicMirror/modules/MMM-Fintech/manual-holdings.json

# Correct the symbol or remove the entry
# Save and restart:
pm2 restart magicmirror
```

### Error: "[CREDENTIALS] - Encryption key or credentials file missing"

**Check if files exist:**
```bash
ls -la ~/.mmm-fintech-key
ls -la ~/MagicMirror/modules/MMM-Fintech/cdp-credentials.enc
```

**Common causes:**
- Setup script not run: `setup-credentials.js` not executed
- Encryption key accidentally deleted
- Running on different user account than setup

**Fix:**
```bash
cd ~/MagicMirror/modules/MMM-Fintech
node setup-credentials.js
```

### General Debugging

**View all MMM-Fintech logs:**
```bash
pm2 logs magicmirror | grep MMM-Fintech
```

**View last 100 lines:**
```bash
pm2 logs magicmirror --lines 100
```

**Follow logs in real-time:**
```bash
pm2 logs magicmirror --lines 0
```

**Check module is loaded:**
```bash
pm2 logs magicmirror --lines 50 | grep "MMM-Fintech node_helper started"
```

## Roadmap

See [ROADMAP.md](ROADMAP.md) for planned features and development phases.

## License

MIT
