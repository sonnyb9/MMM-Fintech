# SnapTrade (Work in progress)

## What this adds

- `setup-snaptrade.js` creates `snaptrade-credentials.enc` (encrypted) using the shared key at `~/.mmm-fintech-key`.
- `snaptrade-fetch-holdings.js` reads `snaptrade-credentials.enc`, calls SnapTrade, and prints normalized holdings.

## Validate on Raspberry Pi

From `~/MagicMirror/modules/MMM-Fintech`:

```bash
node setup-snaptrade.js
node snaptrade-fetch-holdings.js

## Troubleshooting: signature failures

SnapTrade request signing uses a SignedContent payload. For GET endpoints, MMM-Fintech signs only `clientId` + `timestamp` in the `query` portion, and signs `userId`/`userSecret` (and other non-auth query params) in the `content` portion.
