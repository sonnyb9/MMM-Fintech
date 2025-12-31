# Changelog

All notable changes to MMM-Fintech are documented in this file.

## [0.6.0] - 2025-12-30

### Added
- **Privacy Mode**: Hide quantity and value columns
  - `showQuantity` config option (default: true)
  - When false, only shows symbol, price, and 24h change
- **Currency Conversion**: Display values in any currency
  - `currency` config option (default: "USD")
  - Fetches conversion rate from Twelve Data automatically
  - Supported: USD, EUR, GBP, JPY, CNY, PHP, CAD, AUD, CHF, INR, KRW, MXN, BRL, SGD, HKD
- **Currency Style**: Choose symbol or code display
  - `currencyStyle` config option: "symbol" ($, €, £) or "code" (USD, EUR, GBP)
- **Crypto as Forex**: Display crypto prices in exchange rates section
  - `cryptoAsForex` config option (array of symbols, e.g., `["BTC", "ETH"]`)
  - Excludes specified crypto from holdings table and total value
  - Shows as "BTC/USD: 94,250.00" in forex section
- **Suppress Inverse Forex**: Option to hide auto-generated inverse pairs
  - `showInverseForex` config option (default: true)
  - When false, only shows configured pairs (not PHP/USD for USD/PHP)
- **Configurable Font Size**: Adjust module text size
  - `fontSize` config option: "xsmall", "small", "medium", "large", "xlarge"
  - Applies to entire module

### Changed
- Default title changed from "Holdings" to "Portfolio"
- Font size now controlled via config instead of hardcoded CSS class
- Forex section now includes `cryptoForex` entries from config

### Documentation
- README.md updated with new config options and examples
- AI-CONTEXT.md updated to v0.6.0 with new patterns

## [0.5.0] - 2025-12-29

### Added
- **Provider Architecture**: Modular system for multiple data sources
  - Base provider class with shared utilities (encryption, logging, retry)
  - Coinbase provider extracted from monolithic node_helper
  - Twelve Data provider for stocks, ETFs, mutual funds, forex
  - Factory functions for provider creation and asset type routing
- **Twelve Data Integration**: Support for traditional financial assets
  - Stocks, ETFs, mutual funds pricing via `/quote` endpoint
  - Forex rates via `/quote` endpoint (with 24h change)
  - Automatic inverse forex pair generation (USD/PHP → PHP/USD)
  - Credit tracking via response headers
  - Encrypted credential storage (`setup-twelvedata.js`)
- **Multi-Asset Support**: Track crypto and traditional investments together
  - Asset type field (`crypto`, `stock`, `etf`, `mutual_fund`, `forex`)
  - Provider routing based on asset type
  - Merge key changed to `symbol:type` to prevent cross-asset conflicts
- **Separate Update Intervals**: Different frequencies by asset class
  - Crypto prices: every 5 minutes (configurable via `cryptoPriceUpdateInterval`)
  - Stock/ETF/Forex prices: every 20 minutes (configurable via `stockPriceUpdateInterval`)
  - Stays within Twelve Data free tier (800 calls/day)
- **Price Per Unit Column**: New column showing price for each holding
  - Configurable via `showPricePerUnit` (default: true)
- **Forex Display Section**: Separate section for exchange rates
  - Shows all configured forex pairs with rates and 24h change
  - Configurable via `showForex` (default: true)
  - Smart formatting based on rate magnitude

### Changed
- `priceUpdateInterval` split into `cryptoPriceUpdateInterval` and `stockPriceUpdateInterval`
- Manual holdings structure now requires `type` field for each holding
- Manual holdings file now supports `forex` array for exchange rate pairs
- Cache now tracks `lastCryptoPriceUpdate` and `lastStockPriceUpdate` separately
- Provider initialization: Coinbase required, Twelve Data optional

### Documentation
- AI-CONTEXT.md updated with provider architecture details
- README.md updated with multi-asset setup instructions
- ROADMAP.md Phase 3.1 marked complete

## [0.4.0] - 2025-12-29

### Added
- **Stale Data Detection**: Visual indicators when holdings or prices are stale
  - Red timestamp when data exceeds configured thresholds
  - Configurable thresholds: `staleHoldingsThreshold` (25 hours) and `stalePricesThreshold` (65 minutes)
  - On-startup sync if holdings >24 hours old
- **Health Notifications**: Enhanced footer warnings with severity levels
  - Three severity colors: warning (yellow), error (orange), critical (red)
  - Specific error messages: invalid symbols, rate limits, stale data, API failures
  - Footer only shows when warnings exist
- **Enhanced Error Handling**: Distinguish between error types
  - Invalid/unavailable symbols (404 errors)
  - Rate limit exceeded (429 errors)
  - Temporary API failures
  - Tracked separately for targeted troubleshooting
- **Configurable Holdings Sync Time**: `holdingsSyncTime` option (default: "07:45")
- **Symbol Validation**: Comprehensive documentation for finding and verifying crypto symbols
- **Duplicate Holdings Merge**: Combine same symbol from API and manual sources into single row
  - Supports both `source` (string) and `sources` (array) formats
  - Merged sources tracked for transparency

### Changed
- Holdings sync schedule moved from 4:00am to 7:45am (configurable)
- Footer warnings now use bullet separator (•) for multiple messages
- Error logging includes specific categories: INVALID_SYMBOL, RATE_LIMIT, PRICE_FETCH, PRICE_UPDATE
- Cache now includes `invalidSymbols` and `rateLimitedSymbols` arrays

### Fixed
- Manual holdings with duplicate symbols (e.g., staked + unstaked ETH) now display as single row
- Holdings merge handles inconsistent source/sources field formats

### Documentation
- Comprehensive troubleshooting section with specific commands for each error type
- Symbol validation guide with Coinbase Advanced Trade link
- Detailed error message explanations with common causes and fixes
- ROADMAP.md created with Phase 3 planning details

## [0.3.0] - 2025-12-27

### Added
- **Retry Logic**: Exponential backoff for API calls (6 retries: 2s, 4s, 8s, 16s, 32s, 64s)
- **Configurable Retries**: `maxRetries` config option (default: 6)
- **JWT Authentication**: Proper ES256 JWT signing using `jsonwebtoken` library for CDP API keys

### Changed
- Replaced `coinbase-api` SDK with direct HTTPS requests and manual JWT authentication
- JWT signature now excludes query parameters from URI (per Coinbase API requirements)
- Manual holdings parsing now correctly extracts `holdings` array from JSON object
- API accounts without `currency` field are now filtered out to prevent undefined symbols

### Fixed
- Coinbase CDP API authentication now works correctly with Secret API keys (ECDSA)
- Setup script now saves encryption key as hex string instead of binary
- Credential decryption handles hex-encoded keys properly

## [0.2.0] - 2025-12-26

### Added
- **Error Handling**: Warning indicator (⚠) in header when errors occur (1a3945d)
- **Improved Logging**: Categorized error messages with details for troubleshooting (1a3945d)
- **Scheduled Holdings Sync**: Automatic sync at 4am local time (9282a12)
- **Configurable Price Updates**: Default 5-minute interval via `priceUpdateInterval` (9282a12)
- **Configurable Sorting**: Sort holdings by value (default) or name via `sortBy` (7848345)
- **USD Values**: Display current price and calculated USD value for each holding (b7a651f)
- **24h Change**: Show percent change with color coding (green/red) (b7a651f)
- **Portfolio Total**: Display total USD value of all holdings (b7a651f)
- **Credential Encryption**: AES-256-GCM encryption via `setup-credentials.js` (94c7f93)
- **Manual Holdings Support**: JSON file for staked assets merged with API data (589e582)
- **Coinbase CDP API Integration**: Fetch holdings using Secret API keys (589e582)

### Changed
- Font size reduced to `xsmall` class for compact display (7848345)
- Removed bold styling from header, total, and currency names (cf6e9c6)
- Portfolio value removed from logs for privacy (0902036)
- Architecture doc updated to reflect implemented features (564a5d4)
- README rewritten with complete setup instructions (564a5d4)

### Security
- API credentials encrypted at rest with key stored outside repo (94c7f93)
- All sensitive files excluded via .gitignore (589e582)

## [0.1.0] - 2025-12-26

### Added
- MagicMirror module skeleton with basic frontend and node helper (97a3ca4)
- Architecture documentation outlining phased approach (07f6e39)
- Package.json with module metadata (97a3ca4)
- .gitignore for sensitive files (97a3ca4)
- Cache loading from local JSON file (97a3ca4)

---

For upcoming features and development phases, see [ROADMAP.md](ROADMAP.md).
