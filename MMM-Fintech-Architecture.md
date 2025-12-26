# MMM-Fintech – Architecture Overview

## 1. Purpose and Scope
MMM-Fintech is a MagicMirror² module designed to display consolidated financial holdings (traditional brokerage and crypto) with a clear separation between:
- **Slow-moving data** (account positions, quantities, cost basis)
- **Fast-moving data** (intraday price quotes)

The goal is to minimize API usage, reduce failure modes, and present a stable daily snapshot augmented by near-real-time pricing.

---

## 2. High-Level Architecture

### 2.1 Data Sources
- **Coinbase (Phase 1 – Implemented)**
  - Primary source for crypto holdings via CDP API keys.
  - Daily synchronization of positions at 4am local time.
  - Price updates every 5 minutes (configurable).
- **Manual Holdings**
  - JSON file for assets not returned by API (e.g., staked crypto).
  - Merged with API data during sync.
- **Plaid → Fidelity (Phase 3 – Planned)**
  - Plaid used as an aggregation layer for Fidelity IRA accounts.
  - Once-daily synchronization of equity and fund positions.

### 2.2 Data Separation Model
- **Static Holdings Layer**
  - Retrieved once per day at 4am.
  - Includes: symbol, quantity, sources.
  - Stored locally in cache.json.
- **Dynamic Pricing Layer**
  - Fetched from Coinbase API every 5 minutes (configurable).
  - Includes: current price, 24h percent change, calculated USD value.

---

## 3. MagicMirror Module Structure

### 3.1 Frontend (MMM-Fintech.js)
- Renders holdings table with columns: Symbol, Quantity, Value, 24h Change.
- Displays total portfolio value.
- Shows last updated timestamp.
- Displays warning indicator when errors occur.
- Configurable sorting (by value or name).

### 3.2 Node Helper (node_helper.js)
- Handles all external API communication.
- Responsibilities:
  - CDP API key authentication via encrypted credentials.
  - Scheduled daily holdings sync (4am local time).
  - Periodic price updates (default: 5 minutes).
  - Error tracking and reporting.
  - Cache persistence to disk.
- Exposes IPC messages to the frontend.

### 3.3 Supporting Files
- **setup-credentials.js**: Encrypts CDP API key JSON to cdp-credentials.enc.
- **manual-holdings.json**: User-maintained file for staked/manual holdings.
- **cache.json**: Persisted holdings and price data.

---

## 4. Scheduling and Execution

### 4.1 Holdings Sync
- Executed daily at 4am local time.
- Implemented via internal setTimeout scheduling.
- Fetches account balances from Coinbase API.
- Merges with manual holdings.
- Results persisted to cache.json.

### 4.2 Price Updates
- Default interval: 5 minutes (configurable via priceUpdateInterval).
- Fetches current price and 24h change for each holding.
- Updates cache and UI without re-fetching holdings.

### 4.3 Startup Behavior
- On MagicMirror startup:
  - Load cached data immediately for fast UI render.
  - Initialize Coinbase client with decrypted credentials.
  - Trigger initial sync after 5 seconds.
  - Schedule recurring price updates and next holdings sync.

---

## 5. Security Model

### 5.1 Secrets Handling
- CDP API credentials:
  - Original JSON downloaded from Coinbase portal.
  - Encrypted using AES-256-GCM via setup-credentials.js.
  - Stored as cdp-credentials.enc in module directory.
  - Encryption key stored at ~/.mmm-fintech-key (chmod 600).
  - Original JSON should be deleted after encryption.
- All secret files excluded via .gitignore.

### 5.2 Trust Boundaries
- Frontend never sees raw credentials.
- Node helper is the sole API consumer.
- Decryption only occurs in node_helper context at runtime.

---

## 6. Cache Schema

```json
{
  "holdings": [
    {
      "symbol": "BTC",
      "quantity": 0.08744052,
      "sources": ["coinbase-api"],
      "price": 87177.51,
      "change24h": -1.16,
      "value": 7622.84
    }
  ],
  "totalValue": 10308.38,
  "lastUpdated": "2025-12-26T15:46:29.940Z",
  "lastPriceUpdate": "2025-12-26T15:51:29.481Z",
  "hasError": false
}
```

---

## 7. Configuration Options

```javascript
{
  module: "MMM-Fintech",
  position: "top_right",
  config: {
    title: "Holdings",              // Header text
    priceUpdateInterval: 300000,    // Price refresh in ms (default: 5 min)
    showLastUpdated: true,          // Show timestamp footer
    sortBy: "value"                 // Sort by "value" or "name"
  }
}
```

---

## 8. Roadmap

### Phase 1 – Coinbase Proof of Concept ✅
- CDP API key integration.
- Daily holdings sync at 4am.
- Configurable price updates.
- Manual holdings merge for staked assets.
- Local cache persistence.
- UI with values, 24h change, total.
- Encrypted credential storage.
- Error handling with status indicator.

### Phase 2 – Hardening (Current)
- Health notifications.
- Error differentiation.
- Logging and metrics.

### Phase 3 – Fidelity via Plaid
- Plaid Link flow.
- Fidelity account ingestion.
- Schema reuse with no frontend changes.

---

## 9. Non-Goals
- Intraday trading.
- Order placement.
- Tax reporting.

MMM-Fintech is strictly a read-only visualization layer.

---

## 10. Future Enhancements
- Display percent change since last close for each stock (Phase 3).
- Cost basis tracking and total return calculation.
- Multiple currency support.
