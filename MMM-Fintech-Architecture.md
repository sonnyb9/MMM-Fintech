# MMM-Fintech – Architecture Overview

## 1. Purpose and Scope
MMM-Fintech is a MagicMirror² module family designed to display consolidated financial holdings (traditional brokerage and crypto) with a clear separation between:
- **Slow-moving data** (account positions, quantities, cost basis)
- **Fast-moving data** (intraday price quotes)

The goal is to minimize API usage, reduce failure modes, and present a stable daily snapshot augmented by near-real-time pricing from existing MagicMirror modules.

---

## 2. High-Level Architecture

### 2.1 Data Sources
- **Coinbase (Phase 1 – Proof of Concept)**
  - Primary source for crypto holdings.
  - Once-daily synchronization of positions.
- **Plaid → Fidelity (Phase 2)**
  - Plaid used as an aggregation layer for Fidelity IRA accounts.
  - Once-daily synchronization of equity and fund positions.

### 2.2 Data Separation Model
- **Static Holdings Layer**
  - Retrieved once per day.
  - Includes: symbol, quantity, account, asset type, cost basis (when available).
  - Stored locally in a normalized schema.
- **Dynamic Pricing Layer**
  - Provided by an existing module (e.g., MMM-AVStocks).
  - Consumes symbols/tickers only.
  - Updates intraday without touching brokerage APIs.

---

## 3. MagicMirror Module Structure

### 3.1 Frontend (MMM-Fintech.js)
- Renders holdings and computed values.
- Reads from cached holdings data.
- Delegates price updates to MMM-AVStocks or equivalent.
- Displays health/status indicators (last successful sync time).

### 3.2 Node Helper (node_helper.js)
- Handles all external API communication.
- Responsibilities:
  - OAuth token management.
  - Scheduled daily sync.
  - Error classification (auth vs API outage).
  - Secure storage of encrypted tokens.
- Exposes IPC messages to the frontend.

---

## 4. Scheduling and Execution

### 4.1 Daily Sync Model
- Executed once every 24 hours.
- Implemented via:
  - systemd timer (preferred), or
  - cron fallback.
- Sync results persisted to disk.

### 4.2 Startup Behavior
- On MagicMirror startup:
  - Load last known holdings from cache.
  - Do not block UI if APIs are unavailable.

---

## 5. Security Model

### 5.1 Secrets Handling
- Client IDs, secrets, and refresh tokens:
  - Stored encrypted on disk (e.g., oauth-tokens.enc).
  - Excluded via .gitignore.
- Decryption only occurs in node_helper context.

### 5.2 Trust Boundaries
- Frontend never sees raw credentials.
- Node helper is the sole API consumer.

---

## 6. Unified Holdings Schema

```json
{
  "provider": "coinbase | plaid",
  "accountId": "string",
  "assetType": "crypto | equity | fund",
  "symbol": "string",
  "quantity": number,
  "costBasis": number | null,
  "lastUpdated": "ISO-8601 timestamp"
}
```

This schema allows provider-agnostic rendering and simplifies future expansion.

---

## 7. Roadmap

### Phase 1 – Coinbase Proof of Concept
- OAuth integration.
- Daily holdings sync.
- Local cache persistence.
- UI rendering with static pricing.

### Phase 2 – Hardening
- Health notifications.
- Error differentiation.
- Logging and metrics.

### Phase 3 – Fidelity via Plaid
- Plaid Link flow.
- Fidelity account ingestion.
- Schema reuse with no frontend changes.

---

## 8. Non-Goals
- Intraday trading.
- Order placement.
- Tax reporting.

MMM-Fintech is strictly a read-only visualization layer.

---

## 9. Future Enhancements
- Display percent change since last close for each stock (when Plaid/Fidelity integration is added in Phase 3).
