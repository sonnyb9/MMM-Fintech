# Changelog

All notable changes to MMM-Fintech are documented in this file.

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

## Roadmap

### Phase 2 - Hardening
- [x] Retry logic with exponential backoff
- [ ] Stale data detection and alerts
- [ ] Health notifications

### Phase 3 - Fidelity via Plaid
- [ ] Plaid Link integration
- [ ] Fidelity account ingestion
- [ ] Stock price integration
- [ ] Percent change since last close for equities
- [ ] Cost basis tracking
