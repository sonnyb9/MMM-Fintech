const NodeHelper = require("node_helper");
const fs = require("fs");
const path = require("path");
const { CBAdvancedTradeClient } = require("coinbase-api");

module.exports = NodeHelper.create({
  start: function () {
    this.log("MMM-Fintech node_helper started");
    this.dataPath = path.join(this.path, "cache.json");
    this.credentialsPath = path.join(this.path, "cdp_api_key.json");
    this.manualHoldingsPath = path.join(this.path, "manual-holdings.json");
    this.client = null;
  },

  log: function (msg) {
    console.log("[MMM-Fintech] " + msg);
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === "MMM-FINTECH_INIT") {
      this.config = payload.config;
      this.initClient();
      this.loadCachedData();
    }

    if (notification === "MMM-FINTECH_SYNC") {
      this.syncHoldings();
    }
  },

  initClient: function () {
    if (!fs.existsSync(this.credentialsPath)) {
      this.log("No CDP credentials found at " + this.credentialsPath);
      return;
    }

    try {
      const cdpKey = JSON.parse(fs.readFileSync(this.credentialsPath, "utf8"));
      this.client = new CBAdvancedTradeClient({
        apiKey: cdpKey.name,
        apiSecret: cdpKey.privateKey,
      });
      this.log("Coinbase client initialized");
    } catch (err) {
      this.log("Error initializing Coinbase client: " + err.message);
    }
  },

  loadCachedData: function () {
    if (!fs.existsSync(this.dataPath)) {
      this.sendSocketNotification("MMM-FINTECH_DATA", {
        holdings: [],
        lastUpdated: null
      });
      return;
    }

    try {
      const raw = fs.readFileSync(this.dataPath);
      const parsed = JSON.parse(raw);
      this.sendSocketNotification("MMM-FINTECH_DATA", parsed);
    } catch (err) {
      this.log("Error reading cache: " + err.message);
      this.sendSocketNotification("MMM-FINTECH_DATA", {
        holdings: [],
        lastUpdated: null
      });
    }
  },

  loadManualHoldings: function () {
    if (!fs.existsSync(this.manualHoldingsPath)) {
      return [];
    }

    try {
      const data = JSON.parse(fs.readFileSync(this.manualHoldingsPath, "utf8"));
      return data.holdings || [];
    } catch (err) {
      this.log("Error reading manual holdings: " + err.message);
      return [];
    }
  },

  syncHoldings: async function () {
    this.log("Starting holdings sync...");

    let apiHoldings = [];

    if (this.client) {
      try {
        const response = await this.client.getAccounts({ limit: 250 });
        const accounts = response.accounts || [];

        apiHoldings = accounts
          .filter((acct) => {
            const balance = parseFloat(acct.available_balance?.value || "0");
            return balance > 0;
          })
          .map((acct) => ({
            symbol: acct.currency,
            quantity: parseFloat(acct.available_balance?.value || "0"),
            source: "coinbase-api"
          }));

        this.log("Fetched " + apiHoldings.length + " holdings from API");
      } catch (err) {
        this.log("Error fetching from Coinbase: " + err.message);
      }
    } else {
      this.log("No Coinbase client available, using manual holdings only");
    }

    const manualHoldings = this.loadManualHoldings();
    this.log("Loaded " + manualHoldings.length + " manual holdings");

    const merged = {};

    apiHoldings.forEach((h) => {
      if (!merged[h.symbol]) {
        merged[h.symbol] = { symbol: h.symbol, quantity: 0, sources: [] };
      }
      merged[h.symbol].quantity += h.quantity;
      merged[h.symbol].sources.push(h.source);
    });

    manualHoldings.forEach((h) => {
      if (!merged[h.symbol]) {
        merged[h.symbol] = { symbol: h.symbol, quantity: 0, sources: [] };
      }
      merged[h.symbol].quantity += h.quantity;
      merged[h.symbol].sources.push(h.source || "manual");
    });

    const holdings = Object.values(merged).sort((a, b) =>
      a.symbol.localeCompare(b.symbol)
    );

    const data = {
      holdings: holdings,
      lastUpdated: new Date().toISOString()
    };

    try {
      fs.writeFileSync(this.dataPath, JSON.stringify(data, null, 2));
      this.log("Cache updated with " + holdings.length + " holdings");
    } catch (err) {
      this.log("Error writing cache: " + err.message);
    }

    this.sendSocketNotification("MMM-FINTECH_DATA", data);
  }
});
