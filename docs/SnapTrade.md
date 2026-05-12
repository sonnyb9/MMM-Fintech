# SnapTrade Setup Notes

SnapTrade is the preferred holdings source for automated brokerage accounts in MMM-Fintech.

## What SnapTrade Is Used For

- Fetch holdings from connected brokerages
- Preserve cost basis and gain/loss inputs when the brokerage returns them
- Replace the direct Coinbase holdings path when SnapTrade is configured
- Surface complete Coinbase positions, including staked assets that the CDP API does not expose

## Files Involved

- `setup-snaptrade.js` - encrypts and stores credentials in `snaptrade-credentials.enc`
- `snaptrade-connect.js` - creates a fresh brokerage authorization URL
- `providers/snaptrade.js` - runtime provider used by the module

## Setup

1. Run `node setup-snaptrade.js`
2. Enter `clientId`, `consumerKey`, `userId`, and `userSecret`
3. Run `node snaptrade-connect.js`
4. Open the generated URL and finish brokerage authorization before it expires

## Validation

- `node test-snaptrade-provider.js`
- `node test-costbasis.js`
- `node test-full-sync.js`
- `node health-check.js`

## Current Behavior

- If SnapTrade is configured, MMM-Fintech does not separately fetch Coinbase holdings from the CDP API
- Manual holdings are still merged in for unsupported brokerages or temporary adjustments
- SnapTrade timeout failures are surfaced in the footer and retried on later syncs

## Troubleshooting

### Expired authorization

Symptom:
- Footer warning says the SnapTrade connection expired or is unauthorized

Fix:
- Run `node snaptrade-connect.js` and complete the reconnect flow

### Timeout errors

Symptom:
- Footer warning says the SnapTrade API timed out

Fix:
- Check connectivity and provider status
- Retry later or run `node test-snaptrade-provider.js` for a direct check

### Missing holdings

Symptom:
- Expected positions are not appearing in the module

Fix:
- Confirm the account is still connected in SnapTrade
- Run `node test-snaptrade-provider.js`
- Run `node test-full-sync.js`
- Confirm you are not relying on the unsupported legacy REST debug path
