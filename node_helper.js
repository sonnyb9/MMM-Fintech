const NodeHelper = require("node_helper");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { CBAdvancedTradeClient } = require("coinbase-api");

module.exports = NodeHelper.create({
  start: function () {
    this.log("MMM-Fintech node_helper started");
    this.dataPath = path.join(this.path, "cache.json");
    this.encryptedCredentialsPath = path.join(this.path, "cdp-credentials.enc");
    this.keyPath = path.join(process.env.HOME || process.env.USERPROFILE, ".mmm-fintech-key");
    this.manualHoldingsPath = path.join(this.path, "manual-holdings.json");
    this.client = null;
    this.priceInterval = null;
    this.holdingsTimeout = null;
    this.lastError = null;
  },

  log: function (msg) {
    console.log("[MMM-Fintech] " + msg);
  },

  logError: function (category, message, details) {
    this.lastError = {
      category: category,
      message: message,
      details: details || null,
      timestamp: new Date().toISOString()
    };
    this.log("ERROR [" + category + "] " + message + (details ? " - " + details : ""));
  },

  clearError: function () {
    this.lastError = null;
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === "MMM-FINTECH_INIT") {
      this.config = payload.config;
      this.initClient();
      this.loadCachedData();
    }

    if (notification === "MMM-FINTECH_SYNC") {
      this.syncHoldings();
      this.schedulePriceUpdates();
      this.scheduleNextHoldingsSync();
    }
  },

  schedulePriceUpdates: function () {
    var self = this;
    var interval = this.config.priceUpdateInterval || 5 * 60 * 1000;

    if (this.priceInterval) {
      clearInterval(this.priceInterval);
    }

    this.log("Price updates scheduled every " + (interval / 60000) + " minutes");

    this.priceInterval = setInterval(function () {
      self.updatePricesOnly();
    }, interval);
  },

  scheduleNextHoldingsSync: function () {
    var self = this;
    var now = new Date();
    var next4am = new Date(now);

    next4am.setHours(4, 0, 0, 0);

    if (now >= next4am) {
      next4am.setDate(next4am.getDate() + 1);
    }

    var msUntil4am = next4am.getTime() - now.getTime();

    if (this.holdingsTimeout) {
      clearTimeout(this.holdingsTimeout);
    }

    this.log("Next holdings sync scheduled for " + next4am.toLocaleString());

    this.holdingsTimeout = setTimeout(function () {
      self.syncHoldings();
      self.scheduleNextHoldingsSync();
    }, msUntil4am);
  },

  decrypt: function (encryptedBuffer, key) {
    var iv = encryptedBuffer.slice(0, 12);
    var authTag = encryptedBuffer.slice(12, 28);
    var encrypted = encryptedBuffer.slice(28);
    var decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(encrypted, null, "utf8") + decipher.final("utf8");
  },

  loadCredentials: function () {
    if (!fs.existsSync(this.keyPath)) {
      this.logError("CREDENTIALS", "Encryption key not found", this.keyPath);
      return null;
    }

    if (!fs.existsSync(this.encryptedCredentialsPath)) {
      this.logError("CREDENTIALS", "Encrypted credentials not found", "Run setup-credentials.js");
      return null;
    }

    try {
      var key = fs.readFileSync(this.keyPath);
      var encrypted = fs.readFileSync(this.encryptedCredentialsPath);
      var decrypted = this.decrypt(encrypted, key);
      return JSON.parse(decrypted);
    } catch (err) {
      this.logError("CREDENTIALS", "Failed to decrypt credentials", err.message);
      return null;
    }
  },

  initClient: function () {
    var cdpKey = this.loadCredentials();

    if (!cdpKey) {
      return;
    }

    try {
      this.client = new CBAdvancedTradeClient({
        apiKey: cdpKey.name,
        apiSecret: cdpKey.privateKey,
      });
      this.log("Coinbase client initialized");
    } catch (err) {
      this.logError("CLIENT", "Failed to initialize Coinbase client", err.message);
    }
  },

  loadCachedData: function () {
    if (!fs.existsSync(this.dataPath)) {
      this.sendSocketNotification("MMM-FINTECH_DATA", {
        holdings: [],
        lastUpdated: null,
        hasError: !!this.lastError
      });
      return;
    }

    try {
      var raw = fs.readFileSync(this.dataPath);
      var parsed = JSON.parse(raw);
      parsed.hasError = !!this.lastError;
      this.sendSocketNotification("MMM-FINTECH_DATA", parsed);
    } catch (err) {
      this.logError("CACHE", "Failed to read cache file", err.message);
      this.sendSocketNotification("MMM-FINTECH_DATA", {
        holdings: [],
        lastUpdated: null,
        hasError: true
      });
    }
  },

  loadManualHoldings: function () {
    if (!fs.existsSync(this.manualHoldingsPath)) {
      return [];
    }

    try {
      var data = JSON.parse(fs.readFileSync(this.manualHoldingsPath, "utf8"));
      return data.holdings || [];
    } catch (err) {
      this.logError("MANUAL", "Failed to read manual holdings", err.message);
      return [];
    }
  },

  fetchPrices: async function (symbols) {
    var prices = {};
    var self = this;
    var hasError = false;

    for (var i = 0; i < symbols.length; i++) {
      var symbol = symbols[i];
      var productId = symbol + "-USD";

      try {
        var product = await self.client.getProduct({ product_id: productId });
        var price = parseFloat(product.price || 0);
        var change24h = parseFloat((product.price_percentage_change_24h || "0").replace("%", ""));

        prices[symbol] = {
          price: price,
          change24h: change24h
        };
      } catch (err) {
        self.logError("PRICE", "Failed to fetch price for " + symbol, err.message);
        prices[symbol] = { price: 0, change24h: 0 };
        hasError = true;
      }
    }

    return { prices: prices, hasError: hasError };
  },

  updatePricesOnly: async function () {
    if (!fs.existsSync(this.dataPath)) {
      return;
    }

    var self = this;

    try {
      var raw = fs.readFileSync(this.dataPath);
      var data = JSON.parse(raw);
      var holdings = data.holdings || [];

      if (holdings.length === 0 || !this.client) {
        return;
      }

      var symbols = holdings.map(function (h) { return h.symbol; });

      this.log("Updating prices for " + symbols.length + " symbols...");
      var result = await this.fetchPrices(symbols);
      var prices = result.prices;

      if (!result.hasError) {
        this.clearError();
      }

      var totalValue = 0;

      holdings.forEach(function (h) {
        var priceData = prices[h.symbol] || { price: h.price || 0, change24h: h.change24h || 0 };
        h.price = priceData.price;
        h.change24h = priceData.change24h;
        h.value = h.quantity * h.price;
        totalValue += h.value;
      });

      data.holdings = holdings;
      data.totalValue = totalValue;
      data.lastPriceUpdate = new Date().toISOString();
      data.hasError = !!this.lastError;

      fs.writeFileSync(this.dataPath, JSON.stringify(data, null, 2));
      this.log("Prices updated");

      this.sendSocketNotification("MMM-FINTECH_DATA", data);
    } catch (err) {
      this.logError("PRICE_UPDATE", "Failed to update prices", err.message);
    }
  },

  syncHoldings: async function () {
    this.log("Starting holdings sync...");
    this.clearError();

    var apiHoldings = [];
    var self = this;

    if (this.client) {
      try {
        var response = await this.client.getAccounts({ limit: 250 });
        var accounts = response.accounts || [];

        apiHoldings = accounts
          .filter(function (acct) {
            var balance = parseFloat(acct.available_balance?.value || "0");
            return balance > 0;
          })
          .map(function (acct) {
            return {
              symbol: acct.currency,
              quantity: parseFloat(acct.available_balance?.value || "0"),
              source: "coinbase-api"
            };
          });

        this.log("Fetched " + apiHoldings.length + " holdings from API");
      } catch (err) {
        this.logError("HOLDINGS", "Failed to fetch holdings from Coinbase", err.message);
      }
    } else {
      this.logError("CLIENT", "No Coinbase client available", "Check credentials setup");
    }

    var manualHoldings = this.loadManualHoldings();
    this.log("Loaded " + manualHoldings.length + " manual holdings");

    var merged = {};

    apiHoldings.forEach(function (h) {
      if (!merged[h.symbol]) {
        merged[h.symbol] = { symbol: h.symbol, quantity: 0, sources: [] };
      }
      merged[h.symbol].quantity += h.quantity;
      merged[h.symbol].sources.push(h.source);
    });

    manualHoldings.forEach(function (h) {
      if (!merged[h.symbol]) {
        merged[h.symbol] = { symbol: h.symbol, quantity: 0, sources: [] };
      }
      merged[h.symbol].quantity += h.quantity;
      merged[h.symbol].sources.push(h.source || "manual");
    });

    var holdings = Object.values(merged).sort(function (a, b) {
      return a.symbol.localeCompare(b.symbol);
    });

    var symbols = holdings.map(function (h) { return h.symbol; });
    var prices = {};
    var priceError = false;

    if (this.client && symbols.length > 0) {
      this.log("Fetching prices for " + symbols.length + " symbols...");
      var result = await this.fetchPrices(symbols);
      prices = result.prices;
      priceError = result.hasError;
    }

    var totalValue = 0;

    holdings.forEach(function (h) {
      var priceData = prices[h.symbol] || { price: 0, change24h: 0 };
      h.price = priceData.price;
      h.change24h = priceData.change24h;
      h.value = h.quantity * h.price;
      totalValue += h.value;
    });

    this.log("Total portfolio value updated");

    var data = {
      holdings: holdings,
      totalValue: totalValue,
      lastUpdated: new Date().toISOString(),
      lastPriceUpdate: new Date().toISOString(),
      hasError: !!this.lastError
    };

    try {
      fs.writeFileSync(this.dataPath, JSON.stringify(data, null, 2));
      this.log("Cache updated with " + holdings.length + " holdings");
    } catch (err) {
      this.logError("CACHE", "Failed to write cache file", err.message);
      data.hasError = true;
    }

    this.sendSocketNotification("MMM-FINTECH_DATA", data);
  }
});
