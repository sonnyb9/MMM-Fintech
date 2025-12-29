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

## 🚧 Phase 2 - Hardening (In Progress)

**Status**: 2 of 3 items complete (v0.4.0 in development)

Improve reliability and user feedback for production use.

- ✅ **Retry logic with exponential backoff** (v0.3.0)
  - Configurable max retries (default: 6)
  - Exponential backoff: 2s, 4s, 8s, 16s, 32s, 64s
  - Applied to both holdings and price fetches

- ✅ **Stale data detection and alerts** (v0.4.0)
  - Visual indicators for stale data (red timestamp)
  - Footer warnings for API errors and stale data
  - Configurable thresholds for holdings and prices
  - On-startup sync if holdings >24 hours old

- ⏳ **Health notifications** (Planned)
  - Email/webhook notifications for persistent errors
  - Daily health report summary
  - Configurable notification thresholds

## 📋 Phase 3 - Multi-Asset Support

**Status**: Planned

Expand beyond cryptocurrency to support stocks, ETFs, and mutual funds.

### 3.1 - Twelve Data Integration

Add support for traditional financial assets via Twelve Data API.

- [ ] Twelve Data API integration
- [ ] Support for stocks, ETFs, mutual funds, forex
- [ ] Encrypted API key storage for Twelve Data
- [ ] Price per unit/share column
- [ ] Asset type identification and display
- [ ] Unified pricing updates across all asset types

### 3.2 - Brokerage Integration (Fidelity via Plaid)

Automatic ingestion of brokerage account holdings.

- [ ] Plaid Link integration
- [ ] Fidelity account connection
- [ ] Automatic holdings sync from brokerage
- [ ] Support for multiple account types (brokerage, IRA, 401k)
- [ ] Position quantity tracking

### 3.3 - Enhanced Financial Metrics

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

- **v0.4.0** (In Progress) - Phase 2: Stale data detection
- **v0.3.0** (2025-12-27) - Phase 2: Retry logic with exponential backoff
- **v0.2.0** (2025-12-26) - Phase 1: Coinbase PoC complete
- **v0.1.0** (2025-12-26) - Initial module skeleton
