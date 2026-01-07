# MMM-Fintech Roadmap

This document outlines the development roadmap for MMM-Fintech, a MagicMirrorÂ² module for displaying consolidated financial holdings.

## âœ… Phase 1 - Coinbase PoC (Complete)

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

## âœ… Phase 2 - Hardening (Complete)

**Status**: Released in v0.4.0

Improve reliability and user feedback for production use.

- âœ… **Retry logic with exponential backoff** (v0.3.0)
  - Configurable max retries (default: 6)
  - Exponential backoff: 2s, 4s, 8s, 16s, 32s, 64s
  - Applied to both holdings and price fetches

- âœ… **Stale data detection and alerts** (v0.4.0)
  - Visual indicators for stale data (red timestamp)
  - Footer warnings for API errors and stale data
  - Configurable thresholds for holdings (25h) and prices (65m)
  - On-startup sync if holdings >24 hours old

- âœ… **Health notifications** (v0.4.0)
  - Severity-based footer warnings (warning/error/critical)
  - Specific messages for invalid symbols, rate limits, stale data
  - Enhanced error categorization and tracking
  - Footer only displays when warnings exist

## âœ… Phase 3.1 - Multi-Asset Support (Complete)

**Status**: Released in v0.5.0

Expand beyond cryptocurrency to support stocks, ETFs, mutual funds, and forex.

- âœ… **Provider Architecture Refactor**
  - Base provider class with shared utilities
  - Coinbase provider extracted from node_helper
  - Factory functions for provider creation and routing
  - Provider-specific retry strategies

- âœ… **Twelve Data Integration**
  - Encrypted credential storage (`setup-twelvedata.js`)
  - Stocks, ETFs, mutual funds via `/quote` endpoint
  - Forex rates via `/quote` endpoint (with 24h change)
  - Credit tracking via response headers

- âœ… **Asset Type Support**
  - Types: `crypto`, `stock`, `etf`, `mutual_fund`, `forex`
  - Automatic routing to appropriate provider
  - Merge key: `symbol:type` to prevent conflicts

- âœ… **Separate Update Intervals**
  - Crypto: 5 minutes (`cryptoPriceUpdateInterval`)
  - Stocks/ETFs/Forex: 20 minutes (`stockPriceUpdateInterval`)
  - Stays within Twelve Data free tier (800 calls/day)

- âœ… **Frontend Enhancements**
  - Price per unit column (`showPricePerUnit` config)
  - Forex display section with 24h change (`showForex` config)
  - Automatic inverse forex pair generation
  - Smart rate formatting based on magnitude
  - Default title changed to "Portfolio"

**Manual Holdings Structure**:
```json
{
  "holdings": [
    {"symbol": "SOL", "quantity": 12.919, "type": "crypto", "source": "coinbase-staked"},
    {"symbol": "AAPL", "quantity": 50, "type": "stock", "source": "fidelity"}
  ],
  "forex": [
    {"pair": "USD/PHP"},
    {"pair": "USD/EUR"}
  ]
}
```

## ðŸ“‹ Phase 3.2 - Brokerage Integration

**Status**: Planning

Automatic ingestion of brokerage account holdings via Plaid.

- [ ] Plaid Link integration
- [ ] Fidelity account connection
- [ ] Automatic holdings sync from brokerage
- [ ] Support for multiple account types (brokerage, IRA, 401k)
- [ ] Position quantity tracking
- [ ] Secure token storage

## ðŸ“‹ Phase 3.3 - Cost Basis & Gain/Loss Tracking

**Status**: Planning (after Phase 3.2)

Add cost basis tracking and unrealized gain/loss display.

**Data Source Analysis**:
| Source | Cost Basis Available? | Notes |
|--------|----------------------|-------|
| Coinbase | âœ… Yes | Portfolio Breakdown API has `cost_basis` and `average_entry_price` |
| Twelve Data | âŒ No | Market data only, not portfolio tracking |
| Plaid | âš ï¸ TBD | May provide cost basis from connected brokerages |
| Manual | âš ï¸ User-provided | Add `costBasis` field to manual-holdings.json |

**Implementation Tasks**:
- [ ] Fetch cost basis from Coinbase Portfolio Breakdown API
- [ ] Add `costBasis` field to manual holdings structure
- [ ] Investigate Plaid cost basis availability
- [ ] Calculate unrealized gain/loss (current value - cost basis)
- [ ] Add gain/loss column to holdings table
- [ ] Add total gain/loss to portfolio summary
- [ ] Color coding for gains (green) and losses (red)

## ðŸ“‹ Phase 4 - Portfolio Performance Charts

**Status**: Planning

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

## ðŸ”® Future Enhancements

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
- Additional brokerage integrations (Vanguard, Schwab, etc.)
- Bank account balances
- Real estate valuations
- Alternative investments (bonds, commodities)

## Contributing

Have ideas for the roadmap? Open an issue on [GitHub](https://github.com/sonnyb9/MMM-Fintech/issues) to discuss new features or improvements.

## Version History

- **v0.6.0** (2025-12-30) - Display enhancements: privacy mode, currency conversion, crypto as forex, percentage-based font size
- **v0.5.0** (2025-12-29) - Phase 3.1 complete: Multi-asset support, Twelve Data integration, provider architecture
- **v0.4.0** (2025-12-29) - Phase 2 complete: Stale data detection, health notifications, enhanced error handling
- **v0.3.0** (2025-12-27) - Phase 2: Retry logic with exponential backoff
- **v0.2.0** (2025-12-26) - Phase 1: Coinbase PoC complete
- **v0.1.0** (2025-12-26) - Initial module skeleton

## Developer Tooling
- Patch workflow documented (DEV.md) and LF enforcement added (.gitattributes).

## Integrations (Planned / WIP)
- SnapTrade: brokerage connection + position sync (WIP)
- [x] SnapTrade: encrypted credentials setup helper (setup-snaptrade.js)
- [x] SnapTrade setup: reuse shared encryption key (~/.mmm-fintech-key)
