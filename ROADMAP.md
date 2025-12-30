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
  - Forex rates via `/exchange_rate` endpoint
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
  - Forex display section (`showForex` config)
  - Automatic inverse forex pair generation
  - Smart rate formatting based on magnitude

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

## 📋 Phase 3.2 - Brokerage Integration

**Status**: Planning

Automatic ingestion of brokerage account holdings via Plaid.

- [ ] Plaid Link integration
- [ ] Fidelity account connection
- [ ] Automatic holdings sync from brokerage
- [ ] Support for multiple account types (brokerage, IRA, 401k)
- [ ] Position quantity tracking
- [ ] Secure token storage

## 📋 Phase 3.3 - Enhanced Financial Metrics

**Status**: Planning

- [ ] Percent change since last market close for equities
- [ ] Intraday vs. overnight change tracking
- [ ] Cost basis tracking
- [ ] Unrealized gain/loss calculation
- [ ] Total return percentage

## 🔮 Future Enhancements

Features under consideration for future phases:

### Performance Tracking
- Historical portfolio value tracking
- Performance charts and graphs
- Benchmark comparison (S&P 500, etc.)
- Dividend tracking and income reporting

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

- **v0.5.0** (2025-12-29) - Phase 3.1 complete: Multi-asset support, Twelve Data integration, provider architecture
- **v0.4.0** (2025-12-29) - Phase 2 complete: Stale data detection, health notifications, enhanced error handling
- **v0.3.0** (2025-12-27) - Phase 2: Retry logic with exponential backoff
- **v0.2.0** (2025-12-26) - Phase 1: Coinbase PoC complete
- **v0.1.0** (2025-12-26) - Initial module skeleton
