# MMM-Fintech Architecture Overview

> For AI assistant context and change checklists, see `AI-CONTEXT.md`

---

## 1. Purpose and Scope

MMM-Fintech is a MagicMirror² module designed to display consolidated financial holdings with a clear separation between:
- **Slow-moving data** (account positions, quantities) — synced daily
- **Fast-moving data** (price quotes) — updated every 5 minutes

The goal is to minimize API usage, reduce failure modes, and present a stable daily snapshot augmented by near-real-time pricing.

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    MagicMirror Frontend                      │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              MMM-Fintech.js (Frontend)               │    │
│  │  - Renders holdings table                            │    │
│  │  - Displays warnings/alerts                          │    │
│  │  - Handles socket notifications                      │    │
│  └──────────────────────┬──────────────────────────────┘    │
│                         │ Socket.IO                          │
│  ┌──────────────────────▼──────────────────────────────┐    │
│  │              node_helper.js (Backend)                │    │
│  │  - Coinbase CDP API calls                            │    │
│  │  - JWT authentication                                │    │
│  │  - Scheduling (holdings sync, price updates)         │    │
│  │  - Cache management                                  │    │
│  │  - Error tracking                                    │    │
│  └──────────────────────┬──────────────────────────────┘    │
└─────────────────────────┼───────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
          ▼               ▼               ▼
   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
   │  Coinbase   │ │   manual-   │ │  cache.json │
   │  CDP API    │ │ holdings.json│ │             │
   └─────────────┘ └─────────────┘ └─────────────┘
```

---

## 3. Data Flow

### 3.1 Holdings Sync (Daily)
1. Triggered at configured time (default 07:45) or on startup if stale
2. Fetch accounts from Coinbase CDP API
3. Load manual-holdings.json for staked assets
4. Merge holdings by symbol (combining sources)
5. Fetch prices for all symbols
6. Calculate USD values
7. Write to cache.json
8. Send to frontend via `MMM-FINTECH_DATA`

### 3.2 Price Updates (Every 5 minutes)
1. Load existing holdings from cache
2. Fetch current price for each symbol
3. Update values and 24h change
4. Write to cache.json
5. Send to frontend via `MMM-FINTECH_DATA`

### 3.3 Startup Sequence
1. Frontend sends `MMM-FINTECH_INIT` with config
2. Backend loads encrypted credentials
3. Backend loads cache and sends immediately (fast UI render)
4. Frontend sends `MMM-FINTECH_SYNC`
5. Backend checks cache staleness, syncs if needed
6. Backend starts price update interval
7. Backend schedules next holdings sync

---

## 4. Security Model

### 4.1 Credential Storage
```
~/.mmm-fintech-key          # 64-char hex encryption key (chmod 600)
MMM-Fintech/cdp-credentials.enc  # AES-256-GCM encrypted credentials
- The key file is shared across providers
- Key may be stored as hex/base64/raw and is parsed accordingly
- SnapTrade adds snaptrade-credentials.enc written by setup-snaptrade.js
```

### 4.2 Encryption Details
- Algorithm: AES-256-GCM
- IV: 12 bytes (prepended to ciphertext)
- Auth Tag: 16 bytes (after IV)
- Key: 32 bytes, stored as 64-char hex string

### 4.3 Trust Boundaries
- Frontend never sees credentials
- node_helper is sole API consumer
- Decryption only at runtime in node_helper

---

## 5. Cache Schema

```json
{
  "holdings": [
    {
      "symbol": "BTC",
      "quantity": 0.5,
      "sources": ["coinbase-api", "manual"],
      "price": 97000.00,
      "change24h": -1.5,
      "value": 48500.00
    }
  ],
  "totalValue": 48500.00,
  "lastUpdated": "2025-12-29T12:00:00.000Z",
  "lastPriceUpdate": "2025-12-29T12:05:00.000Z",
  "hasError": false,
  "invalidSymbols": ["INVALID"],
  "rateLimitedSymbols": []
}
```

---

## 6. Error Handling

### 6.1 Error Categories
| Category | Cause | Behavior |
|----------|-------|----------|
| `INVALID_SYMBOL` | 404 from price API | Track in array, show warning |
| `RATE_LIMIT` | 429 from API | Track in array, show warning |
| `CREDENTIALS` | Decryption failure | Log, stop initialization |
| `SYNC` | Holdings fetch failure | Log, keep cached data |
| `PRICE_UPDATE` | Price fetch failure | Log, keep old prices |

### 6.2 Retry Logic
- Exponential backoff: 2s, 4s, 8s, 16s, 32s, 64s
- Configurable max retries (default: 6)
- Applied to both holdings and price fetches

### 6.3 Stale Data Detection
- Holdings threshold: 25 hours (configurable)
- Prices threshold: 65 minutes (configurable)
- Visual indicator: red timestamp
- Warning messages in footer

---

## 7. Coinbase CDP API Integration

### 7.1 Authentication
- JWT with ES256 (ECDSA) signing
- Uses `jsonwebtoken` npm package
- JWT URI signature excludes query parameters
- Nonce: 16 random hex characters

### 7.2 Endpoints Used
| Endpoint | Purpose |
|----------|---------|
| `/api/v3/brokerage/accounts` | Fetch holdings |
| `/api/v3/brokerage/market/products/{id}` | Fetch prices |

### 7.3 Rate Limits
- Private endpoints: 30 req/sec
- Public endpoints: 10 req/sec

---

## 8. Phase Roadmap

### Phase 1 — Coinbase PoC ✅
- CDP API integration
- Manual holdings merge
- Basic display

### Phase 2 — Hardening ✅
- Retry logic
- Stale data detection
- Health notifications
- Enhanced error handling

### Phase 3 — Multi-Asset Support (Planned)
- Twelve Data API for stocks/ETFs/forex
- Asset type differentiation
- Separate update intervals

See `ROADMAP.md` for detailed planning.

---

## 9. Non-Goals

- Intraday trading
- Order placement
- Tax reporting
- Cost basis tracking (future consideration)

MMM-Fintech is strictly a read-only visualization layer.
