# Changelog

All notable changes to MMM-Fintech are documented in this file.

## [0.9.0] - 2026-02-10

### Added
- **Unified Setup Wizard**: New `setup.js` script for interactive provider configuration
  - Single menu-driven interface for all credential setup
  - Clear warnings about provider limitations (e.g., Coinbase excludes staked assets)
  - Manual holdings guidance with README reference
  - Streamlines setup process from 5+ separate scripts to one wizard
- **Unified Health Check**: New `health-check.js` diagnostic runner
  - Runs all four test scripts in sequence (SnapTrade, Twelve Data, Full Sync, Cost Basis)
  - Provides pass/fail summary with timing information
  - Color-coded output for quick status assessment
  - Simplifies troubleshooting from choosing between 4 scripts to one command

### Documentation
- Updated README with "Quick Setup" section featuring the new wizard
- Added health-check documentation to diagnostic test scripts section
- Reorganized setup instructions: Quick Setup (recommended) vs Manual Setup (alternative)

## [0.8.2] - 2026-01-22

### Added
- **Extended Hourly Retention**: Configurable via `hourlyRetention` (default: 720 hours / 30 days)
  - 1W period now uses hourly data for higher granularity
  - 1M period uses hourly data when available (falls back to daily)
- **Cost Basis Line on Charts**: Dashed horizontal line showing total cost basis
  - Displays "Cost" label on the chart
  - Correctly calculates cost basis per chart mode (combined/separate/traditional)
- **Period Change Label**: Shows percentage change over displayed period
  - Color-coded green (positive) / red (negative)
  - Positioned in top-right of chart area
- **Improved Chart Tick Marks**: Cleaner Y-axis formatting
  - Support for million-dollar values ($1.2M)
  - Better tick distribution (5 ticks max)
  - Subtler grid lines

### Changed
- Hourly retention increased from 48 hours to 720 hours (30 days) by default
- Chart labels now adapt to data density (include dates for longer periods)
- Tooltip now filters out cost basis line (shows only portfolio value)

## [0.8.1] - 2026-01-12

### Added
- **Ticker Display Mode**: Horizontal scrolling ticker for TV/landscape viewing
  - `displayMode: "ticker"` config option
  - `tickerSpeed` - configurable scroll speed (pixels/second)
  - `tickerPause` - optional pause duration per item
  - Portfolio total shown first with value-weighted 24h change
  - Each holding shows symbol, price, and change percentage
  - Green/red color coding for gains/losses
  - `(Closed)` indicator for non-crypto assets when markets are closed
  - Charts still supported alongside ticker mode
- **Market Status Tracking**: Backend now tracks open/closed status for each asset type
- **Total 24h Change**: Value-weighted portfolio change percentage calculation

### Changed
- Data payload now includes `totalChange24h` and `marketStatus` fields

### Fixed
- Chart Y-axis now uses fewer ticks (max 4) with dynamic precision to avoid duplicate labels when value range is small
- Ticker animation now recalculates on page change (MMM-pages compatibility) to ensure scrolling starts when module becomes visible

### Added
- Forex pairs now display in ticker mode (when `showForex: true`)

## [0.8.0] - 2026-01-09

### Added
- **Portfolio Performance Charts**: Visual tracking of portfolio value over time
  - Area chart with gradient fill
  - Hourly snapshots (rolling 48 hours) for 1D view
  - Daily snapshots for 1W, 1M, 3M, 1Y, All views
  - Chart.js integration via CDN
- **Chart Configuration Options**:
  - `showCharts` - Enable chart display (default: false)
  - `chartMode` - "combined" / "separate" / "exclude-crypto"
  - `chartPeriod` - "1D" / "1W" / "1M" / "3M" / "1Y" / "All"
  - `showPeriodSelector` - Show period buttons for touch devices (default: false)
  - `historyRetention` - Days to retain daily history (default: 1825 / 5 years)
- **History Storage**: New `lib/history-manager.js` module and `history.json` file for snapshot data
  - ~600 bytes per snapshot (10 holdings)
  - ~250 KB after 1 year, ~1.1 MB after 5 years

### Changed
- Price updates now record hourly snapshots for chart data
- Holdings sync now records daily snapshots for chart data

## [0.7.0] - 2026-01-08

### Added
- **Cost Basis & Gain/Loss Tracking**: Display unrealized gains/losses for holdings
  - Extracts `average_purchase_price` and `open_pnl` from SnapTrade
  - Calculates gain/loss percentage per holding
  - Shows total portfolio gain/loss percentage
  - New `showGainLoss` config option (default: true)
  - Supports `costBasis` field in manual-holdings.json
- **G/L Column**: New column in holdings table showing gain/loss percentage
  - Green for gains, red for losses
  - Dash (—) displayed when cost basis unavailable
  - Total row shows overall portfolio gain/loss

### Changed
- Holdings merge function now preserves cost basis data when aggregating
- Price updates recalculate gain/loss percentages

## [0.6.0] - 2026-01-07

### Added
- **SnapTrade Integration**: Unified brokerage holdings via SnapTrade API
  - Support for Fidelity, Coinbase, and other connected brokerages
  - Returns complete holdings including staked crypto (SOL, ETH)
  - Uses official `snaptrade-typescript-sdk`
  - Encrypted credential storage (`setup-snaptrade.js`)
  - Connection portal URL generator (`snaptrade-connect.js`)
- **SnapTrade Provider**: Full provider implementation
  - Position aggregation (handles staked + unstaked as single holding)
  - Type code mapping: `crypto`, `cs`, `et`, `oef`, `cef` → internal types
  - Symbol normalization: `BRKB` → `BRK.B`, `BRKA` → `BRK.A`
  - Cash equivalent detection for money market funds

### Changed
- **Holdings fetch priority**: SnapTrade (if configured) → Coinbase CDP (fallback) → Manual
- Coinbase CDP API now only used when SnapTrade is not configured
- Manual holdings no longer needed for Fidelity positions or staked crypto
- Coinbase provider initialization no longer required (optional)

### Documentation
- AI-CONTEXT.md rewritten for v0.6.0 with SnapTrade details
- Removed patch workflow documentation (no longer used)

## [0.5.0] - 2025-01-05

### Added
- **Multi-Asset Support**: Track crypto and traditional investments together
  - Asset type field (`crypto`, `stock`, `etf`, `mutual_fund`, `forex`)
  - Provider routing based on asset type
  - Merge key changed to `symbol:type` to prevent cross-asset conflicts
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
- **Separate Update Intervals**: Different frequencies by asset class
  - Crypto prices: every 5 minutes (configurable via `cryptoPriceUpdateInterval`)
  - Stock/ETF/Forex prices: every 20 minutes (configurable via `stockPriceUpdateInterval`)
  - Stays within Twelve Data free tier (800 calls/day)
- **Market Hours Scheduling**: Limit Twelve Data polling to market hours
  - Stocks/ETFs/mutual funds: Mon-Fri 9:30am-4pm ET (configurable)
  - Forex: 24/5 schedule (Sunday 5pm - Friday 5pm ET)
  - `marketHours` config option with per-asset-type settings
  - `postClosePoll` option for one final update after market close
  - `days` array to specify trading days (0=Sun through 6=Sat)
  - Throttled logging (max every 5 min per asset type) when market closed
  - Significantly reduces unnecessary API calls outside trading hours
- **Price Per Unit Column**: New column showing price for each holding
  - Configurable via `showPricePerUnit` (default: true)
- **Forex Display Section**: Separate section for exchange rates
  - Shows all configured forex pairs with rates and 24h change
  - Configurable via `showForex` (default: true)
  - Smart formatting based on rate magnitude
- **Privacy Mode**: Hide quantity, value columns, and total row
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
- **Suppress Inverse Forex**: Option to hide inverse rate column
  - `showInverseForex` config option (default: true)
  - When false, hides inverse rate column but maintains column alignment
- **Configurable Font Size**: Percentage-based font sizing
  - `fontSize` config option (default: 100)
  - Use values like 80 for smaller, 120 for larger

### Changed
- Default title changed from "Holdings" to "Portfolio"
- `priceUpdateInterval` split into `cryptoPriceUpdateInterval` and `stockPriceUpdateInterval`
- Manual holdings structure now requires `type` field for each holding
- Manual holdings file now supports `forex` array for exchange rate pairs
- Cache now tracks `lastCryptoPriceUpdate` and `lastStockPriceUpdate` separately
- Provider initialization: Coinbase required, Twelve Data optional
- Symbol warning lists reset at start of each holdings sync
- Forex section redesigned: inverse rate now displayed as column instead of separate rows
- Forex section title now matches module header style
- Forex section has column headers (Currencies, Inverse, Rate, 24h)

### Fixed
- Column alignment for holdings, total, and forex sections now use individual cells instead of colspan

### Documentation
- README.md updated with market hours configuration and all new options
- AI-CONTEXT.md updated to v0.5.0 with market hours implementation details
- ROADMAP.md Phase 3.1 marked complete, Phase 4 (charts) added

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
