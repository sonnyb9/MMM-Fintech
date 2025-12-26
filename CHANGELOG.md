# Changelog

All notable changes to MMM-Fintech are documented in this file.

## [0.2.0] - 2025-12-26

### Added
- **Coinbase CDP API Integration**: Fetch holdings using Secret API keys with ECDSA authentication
- **Credential Encryption**: AES-256-GCM encryption for API credentials via `setup-credentials.js`
- **Manual Holdings Support**: JSON file for staked assets not returned by API, merged with API data
- **USD Values**: Display current price and calculated USD value for each holding
- **24h Change**: Show percent change with color coding (green positive, red negative)
- **Portfolio Total**: Display total USD value of all holdings
- **Scheduled Holdings Sync**: Automatic sync at 4am local time
- **Configurable Price Updates**: Default 5-minute interval, adjustable via `priceUpdateInterval`
- **Configurable Sorting**: Sort holdings by value (default) or name via `sortBy` option
- **Error Handling**: Warning indicator (⚠) in header when errors occur
- **Improved Logging**: Categorized error messages with details for troubleshooting

### Changed
- Font size reduced to `xsmall` class for compact display
- Removed bold styling from header, total, and currency names
- Architecture doc updated to reflect implemented features
- README rewritten with complete setup instructions

### Security
- API credentials encrypted at rest with key stored outside repo
- All sensitive files excluded via .gitignore

## [0.1.0] - 2025-12-26

### Added
- Initial module skeleton
- Architecture documentation
- Basic frontend with holdings table
- Node helper with cache loading
- Package.json with module metadata
- .gitignore for sensitive files

---

## Roadmap

### Phase 2 - Hardening
- [ ] Health notifications
- [ ] Retry logic with exponential backoff
- [ ] Stale data detection and alerts

### Phase 3 - Fidelity via Plaid
- [ ] Plaid Link integration
- [ ] Fidelity account ingestion
- [ ] Stock price integration
- [ ] Percent change since last close for equities
- [ ] Cost basis tracking
