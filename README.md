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

For staked assets or holdings not returned by the API, create `manual-holdings.json`:

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

If you see the ⚠ warning indicator, check logs:

```bash
pm2 logs magicmirror
```

Common errors:
- `[CREDENTIALS]` - Encryption key or credentials file missing
- `[HOLDINGS]` - Failed to fetch from Coinbase API
- `[PRICE]` - Failed to fetch price for a symbol

## License

MIT
