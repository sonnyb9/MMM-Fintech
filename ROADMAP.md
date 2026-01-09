# MMM-Fintech Roadmap

This document outlines the development roadmap for MMM-Fintech, a MagicMirror² module for displaying consolidated financial holdings.

## ✅ Phase 1 - Coinbase PoC (Complete)

**Status**: Released in v0.2.0

Core functionality for cryptocurrency tracking via Coinbase CDP API.

- Coinbase CDP API integration (Secret API key, ECDSA)
- JWT authentication with `jsonwebtoken` library
- Encrypted credential storage (AES-256-GCM)
- Manual holdings merge for staked assets
- USD values and 24h percent change display
- Daily holdings sync at configurable time
- Configurable price updates (default: 5 minutes)
- Configurable sorting (by value or name)
- Error handling with warning indicator
- Retry logic with exponential backoff

## ✅ Phase 2 - Hardening (Complete)

**Status**: Released in v0.4.0

Improve reliability and user feedback for production use.

- ✅ **Retry logic with exponential backoff** (v0.3.0)
  - Configurable max retries (default: 6)
  - Exponential backoff: 2s, 4s, 8s, 16s, 32s, 64s
  - Applied to both holdings and price fetches

- ✅ **Stale data detection and alerts** (v0.4.0)
  - Visual indicators for stale data (red timestamp)
  - Footer warnings for API errors and stale data
  - Configurable thresholds for holdings (25h) and prices (65m)
  - On-startup sync if holdings >24 hours old

- ✅ **Health notifications** (v0.4.0)
  - Severity-based footer warnings (warning/error/critical)
  - Specific messages for invalid symbols, rate limits, stale data
  - Enhanced error categorization and tracking
  - Footer only displays when warnings exist

## ✅ Phase 3.1 - Multi-Asset Support (Complete)

**Status**: Released in v0.5.0

Expand beyond cryptocurrency to support stocks, ETFs, mutual funds, and forex.

- ✅ **Provider Architecture Refactor**
  - Base provider class with shared utilities
  - Coinbase provider extracted from node_helper
  - Factory functions for provider creation and routing
  - Provider-specific retry strategies

- ✅ **Twelve Data Integration**
  - Encrypted credential storage (`setup-twelvedata.js`)
  - Stocks, ETFs, mutual funds via `/quote` endpoint
  - Forex rates via `/quote` endpoint (with 24h change)
  - Credit tracking via response headers

- ✅ **Asset Type Support**
  - Types: `crypto`, `stock`, `etf`, `mutual_fund`, `forex`
  - Automatic routing to appropriate provider
  - Merge key: `symbol:type` to prevent conflicts

- ✅ **Separate Update Intervals**
  - Crypto: 5 minutes (`cryptoPriceUpdateInterval`)
  - Stocks/ETFs/Forex: 20 minutes (`stockPriceUpdateInterval`)
  - Stays within Twelve Data free tier (800 calls/day)

- ✅ **Frontend Enhancements**
  - Price per unit column (`showPricePerUnit` config)
  - Forex display section with 24h change (`showForex` config)
  - Automatic inverse forex pair generation
  - Smart rate formatting based on magnitude
  - Default title changed to "Portfolio"

## ✅ Phase 3.2 - Brokerage Integration (Complete)

**Status**: Released in v0.6.0

Automatic ingestion of brokerage account holdings via SnapTrade.

- ✅ **SnapTrade Integration**
  - Official `snaptrade-typescript-sdk` for API access
  - Encrypted credential storage (`setup-snaptrade.js`)
  - Connection portal URL generator (`snaptrade-connect.js`)
  - Fidelity account connection working
  - Coinbase connection working (returns staked crypto!)

- ✅ **SnapTrade Provider**
  - Fetches holdings from all connected brokerages
  - Position aggregation (staked + unstaked combined)
  - Type code mapping: `crypto`, `cs`, `et`, `oef` → internal types
  - Symbol normalization: `BRKB` → `BRK.B`
  - Cash equivalent detection for money market funds

- ✅ **Holdings Priority**
  - SnapTrade (if configured) → Coinbase CDP (fallback) → Manual
  - Coinbase CDP API now only used when SnapTrade not configured
  - Manual holdings remain for users without API access

**Key Discovery**: SnapTrade via Coinbase returns complete holdings including staked crypto (SOL, ETH), solving the CDP API limitation.

## ✅ Phase 3.3 - Cost Basis & Gain/Loss Tracking (Complete)

**Status**: Released in v0.7.0

Add cost basis tracking and unrealized gain/loss display.

- ✅ **SnapTrade Cost Basis**: Extract from `average_purchase_price` and `open_pnl`
- ✅ **Gain/Loss Calculation**: Per-holding and total portfolio percentages
- ✅ **Manual Holdings Support**: Optional `costBasis` field in manual-holdings.json
- ✅ **G/L Column**: New column with green/red coloring
- ✅ **Config Option**: `showGainLoss` (default: true)

## 📋 Phase 4 - Portfolio Performance Charts

**Status**: Planning

**Decisions Made**:
- Chart style: Area chart with gradient fill
- `chartMode` config: `combined` | `separate` | `exclude-crypto`
  - `combined` - All assets in one chart
  - `separate` - Two charts: traditional investments + crypto
  - `exclude-crypto` - Only traditional investments charted
- `chartPeriod` config: `1D` | `1W` | `1M` | `3M` | `1Y` | `All`
- Data storage: Daily snapshots in `history.json`
- Rendering: Chart.js
- Start fresh (no backfill of historical data)
- Display below holdings table

Add visual performance charts for portfolio tracking over time.

### Features

- **Total Portfolio Value Chart**
  - Built from daily snapshots (starting from implementation date)
  - Time period selector: 1D, 1W, 1M, 3M, 1Y, All
  - Displayed below holdings table

- **Individual Holding Charts** (optional)
  - Configurable via `chartHoldings` array
  - Half-size charts stacked below main portfolio chart
  - Historical price data from Twelve Data `/time_series` endpoint

- **Toggle to show/hide charts**

### Data Storage

- Local JSON file (`history.json`, gitignored)
- Daily snapshot at US market close (4:00 PM ET)
- Configurable retention period (default: 5 years)

**Snapshot Structure**:
```json
{
  "date": "2025-01-02",
  "totalValue": 152340.50,
  "holdings": {
    "NVDA": { "quantity": 72.49, "price": 187.72, "value": 13609.42 },
    "ETH": { "quantity": 0.38, "price": 3350.00, "value": 1273.00 }
  }
}
```

### Technical

- Chart.js library for rendering
- ~1KB per daily snapshot (~365KB/year)

### Config Options

| Option | Default | Description |
|--------|---------|-------------|
| `showCharts` | `false` | Enable/disable chart display |
| `chartHoldings` | `[]` | Array of symbols for individual holding charts |
| `historyRetention` | `1825` | Days to retain history (default: 5 years) |

### Implementation Tasks

- [ ] Add Chart.js dependency
- [ ] Create `history.json` storage with daily snapshot logic
- [ ] Schedule snapshot at US market close (4:00 PM ET)
- [ ] Implement history retention/cleanup
- [ ] Build total portfolio value chart component
- [ ] Build individual holding chart component
- [ ] Add time period selector (1D, 1W, 1M, 3M, 1Y, All)
- [ ] Fetch historical prices from Twelve Data `/time_series`
- [ ] Add config options and toggle

## 🔮 Future Enhancements

Features under consideration for future phases:

### Performance Tracking
- Benchmark comparison (S&P 500, etc.)
- Dividend tracking and income reporting
- Percentage vs dollar gain views

### Advanced Features
- Multiple currency support
- Tax lot tracking for cost basis
- Rebalancing suggestions
- Asset allocation visualization
- Portfolio diversity metrics

### User Experience
- Multiple portfolio support
- Customizable display layouts
- Mobile companion app
- Voice assistant integration

### Data Sources
- Additional brokerage integrations via SnapTrade (Vanguard, Schwab, etc.)
- Bank account balances
- Real estate valuations
- Alternative investments (bonds, commodities)

## Contributing

Have ideas for the roadmap? Open an issue on [GitHub](https://github.com/sonnyb9/MMM-Fintech/issues) to discuss new features or improvements.

## Version History

- **v0.7.0** (2026-01-08) - Phase 3.3 complete: Cost basis and gain/loss tracking
- **v0.6.0** (2026-01-07) - Phase 3.2 complete: SnapTrade integration for brokerage holdings
- **v0.5.0** (2025-01-05) - Phase 3.1 complete: Multi-asset support, Twelve Data integration, market hours
- **v0.4.0** (2025-12-29) - Phase 2 complete: Stale data detection, health notifications
- **v0.3.0** (2025-12-27) - Retry logic with exponential backoff
- **v0.2.0** (2025-12-26) - Phase 1: Coinbase PoC complete
- **v0.1.0** (2025-12-26) - Initial module skeleton
