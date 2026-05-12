# Development Workflow

This repo is intended to stay clean enough for normal contributors to clone, configure, validate, and deploy without carrying local machine artifacts in git.

## Core Rules

- Treat your development clone as the source of truth.
- Keep secrets, caches, exported holdings, and chart history out of git.
- Prefer small, reviewable commits with a clear behavior change.
- Validate syntax locally before deploying.
- Use the diagnostic scripts in this repo instead of one-off debug files when possible.

## Recommended Flow

1. Clone the repo and install dependencies.
2. Configure only the providers you plan to use.
3. Make code or documentation changes in your development clone.
4. Run lightweight validation:
   - `node --check MMM-Fintech.js`
   - `node --check node_helper.js`
   - `node health-check.js`
5. Test in your MagicMirror environment.
6. Commit only intentional source, test, and documentation changes.

## Setup Scripts

- `node setup.js` - guided setup for all supported providers
- `node setup-snaptrade.js` - encrypt SnapTrade credentials
- `node snaptrade-connect.js` - generate a fresh brokerage connection URL
- `node setup-twelvedata.js` - encrypt Twelve Data credentials
- `node setup-eodhd.js` - encrypt EODHD credentials
- `node setup-credentials.js` - encrypt a Coinbase CDP key JSON file

## Diagnostics

- `node health-check.js` - runs the main diagnostic suite
- `node test-snaptrade-provider.js` - validates SnapTrade holdings access
- `node test-twelvedata.js` - validates stock, ETF, and forex pricing
- `node test-eodhd.js` - validates mutual fund pricing through EODHD
- `node test-full-sync.js` - validates provider initialization and merge flow
- `node test-costbasis.js` - validates SnapTrade cost-basis output

## Files That Should Stay Local

- `manual-holdings.json`
- `cache.json`
- `history.json`
- `cdp_api_key.json`
- `*.enc` credential files
- `~/.mmm-fintech-key`

## Documentation Expectations

If behavior changes, update the public docs in the same pass:

- `README.md` for setup, configuration, and troubleshooting
- `MMM-Fintech-Architecture.md` for data flow and subsystem boundaries
- `docs/SnapTrade.md` for provider-specific setup notes
- `CHANGELOG.md` for user-visible fixes and cleanup
