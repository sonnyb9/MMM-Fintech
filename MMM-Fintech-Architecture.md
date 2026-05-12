# MMM-Fintech Architecture Overview

MMM-Fintech is a MagicMirror² module that combines holdings from one or more sources, enriches them with pricing, caches the results locally, and optionally records chart history over time.

## Main Components

### Frontend: `MMM-Fintech.js`

- Renders holdings in table or ticker mode
- Displays forex rows, warnings, and stale-data indicators
- Requests chart history for the selected period
- Renders combined, separate, or exclude-crypto charts through Chart.js

### Backend: `node_helper.js`

- Initializes configured providers
- Merges holdings from SnapTrade, Coinbase, and manual JSON input
- Fetches prices and forex rates
- Applies currency conversion and optional manual price overrides
- Maintains `cache.json` and `history.json`
- Enforces market-hours-aware polling for traditional assets

### Providers

- `providers/snaptrade.js` - brokerage holdings and cost basis
- `providers/coinbase.js` - direct crypto holdings and pricing fallback when SnapTrade is absent
- `providers/twelvedata.js` - stock, ETF, and forex pricing
- `providers/eodhd.js` - mutual fund pricing, preferred when configured

### History

- `lib/history-manager.js` stores hourly and daily snapshots in `history.json`
- Hourly data powers `1D`, `1W`, and `1M` views when available
- Daily data powers longer chart periods and fallback for `1M`

## Holdings Flow

1. Frontend sends `MMM-FINTECH_INIT` with config.
2. Backend initializes providers and loads cached data immediately if available.
3. Backend performs a holdings sync on startup when cache is missing, stale, or `manual-holdings.json` changed.
4. Holdings sources are merged by `symbol:type`.
5. Pricing is assigned by asset type:
   - `crypto` -> Coinbase
   - `stock`, `etf`, `forex` -> Twelve Data
   - `mutual_fund` -> EODHD when configured, otherwise Twelve Data fallback
   - `cash` -> fixed 1.00 value
6. Results are cached and sent to the frontend through `MMM-FINTECH_DATA`.

## Pricing Refresh Flow

- Crypto refreshes on its own interval and is always eligible for updates.
- Stocks, ETFs, mutual funds, and forex refresh on the shared traditional-asset interval.
- Traditional assets respect configured market hours unless explicitly disabled.
- EODHD-backed mutual fund refreshes are additionally throttled to avoid wasteful free-tier usage.

## Chart Flow

1. Frontend requests history for the selected period with `MMM-FINTECH_GET_HISTORY`.
2. Backend reads the requested slice from `history.json`.
3. Frontend rerenders the chart area and draws the requested chart mode.
4. Cost-basis overlays are drawn when cost basis data exists.

Supported chart modes:

- `combined`
- `separate`
- `exclude-crypto`

## Local Data Files

- `cache.json` - latest merged holdings, prices, warnings, timestamps, and market status
- `history.json` - hourly and daily chart snapshots
- `manual-holdings.json` - optional user-supplied holdings and forex pairs

## Security Model

- Provider credentials are encrypted at rest
- Decryption happens only in local helper/provider code
- The frontend never receives API credentials
- The shared key lives outside the repo at `~/.mmm-fintech-key`

## Supported Diagnostics

- `health-check.js`
- `test-snaptrade-provider.js`
- `test-twelvedata.js`
- `test-eodhd.js`
- `test-full-sync.js`
- `test-costbasis.js`
