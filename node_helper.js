const NodeHelper = require("node_helper");
const fs = require("fs");
const path = require("path");
const providers = require("./providers");

module.exports = NodeHelper.create({
  start: function() {
    this.log("MMM-Fintech node_helper started");
    this.dataPath = path.join(this.path, "cache.json");
    this.manualHoldingsPath = path.join(this.path, "manual-holdings.json");
    this.priceInterval = null;
    this.holdingsTimeout = null;
    this.lastError = null;
    this.invalidSymbols = [];
    this.rateLimitedSymbols = [];
    this.providers = {};
  },

  log: function(msg) {
    console.log("[MMM-Fintech] " + msg);
  },

  logError: function(category, message, details) {
    this.lastError = {
      category: category,
      message: message,
      details: details || null,
      timestamp: new Date().toISOString()
    };
    this.log("ERROR [" + category + "] " + message + (details ? " - " + details : ""));
  },

  clearError: function() {
    this.lastError = null;
  },

  socketNotificationReceived: function(notification, payload) {
    if (notification === "MMM-FINTECH_INIT") {
      this.config = payload.config;
      this.initProviders();
      this.loadCachedData();
    }

    if (notification === "MMM-FINTECH_SYNC") {
      this.syncIfStale();
      this.schedulePriceUpdates();
      this.scheduleNextHoldingsSync();
    }
  },

  initProviders: function() {
    var coinbase = providers.createProvider("coinbase");
    var initialized = coinbase.init(this.config, this.path);

    if (initialized) {
      this.providers.coinbase = coinbase;
      this.log("Coinbase provider initialized");
    } else {
      this.logError("INIT", "Failed to initialize Coinbase provider");
      this.sendSocketNotification("MMM-FINTECH_ERROR", { hasError: true });
    }
  },

  getProviderForSymbol: function(holding) {
    var assetType = holding.type || "crypto";
    var providerName = providers.getProviderForAssetType(assetType);

    if (providerName && this.providers[providerName]) {
      return this.providers[providerName];
    }

    return this.providers.coinbase;
  },

  schedulePriceUpdates: function() {
    var self = this;
    var interval = this.config.priceUpdateInterval || 5 * 60 * 1000;

    if (this.priceInterval) {
      clearInterval(this.priceInterval);
    }

    this.log("Price updates scheduled every " + (interval / 60000) + " minutes");

    this.priceInterval = setInterval(function() {
      self.updatePricesOnly();
    }, interval);
  },

  syncIfStale: function() {
    if (!fs.existsSync(this.dataPath)) {
      this.log("No cache file found, triggering holdings sync");
      this.syncHoldings();
      return;
    }

    try {
      var cacheData = fs.readFileSync(this.dataPath, "utf8");
      var cache = JSON.parse(cacheData);

      if (!cache.lastUpdated) {
        this.log("No lastUpdated timestamp, triggering holdings sync");
        this.syncHoldings();
        return;
      }

      var now = new Date();
      var lastUpdate = new Date(cache.lastUpdated);
      var ageHours = (now - lastUpdate) / (60 * 60 * 1000);

      if (ageHours > 24) {
        this.log("Holdings data is " + ageHours.toFixed(1) + " hours old (>24h), triggering sync");
        this.syncHoldings();
      } else {
        this.log("Holdings data is " + ageHours.toFixed(1) + " hours old, no sync needed");
      }
    } catch (error) {
      this.logError("SYNC_CHECK", "Failed to check cache staleness", error.message);
      this.syncHoldings();
    }
  },

  scheduleNextHoldingsSync: function() {
    var self = this;
    var now = new Date();
    var syncTime = this.config.holdingsSyncTime || "07:45";
    var timeParts = syncTime.split(":");
    var hours = parseInt(timeParts[0], 10);
    var minutes = parseInt(timeParts[1], 10);

    var nextSync = new Date(now);
    nextSync.setHours(hours, minutes, 0, 0);

    if (now >= nextSync) {
      nextSync.setDate(nextSync.getDate() + 1);
    }

    var msUntilSync = nextSync.getTime() - now.getTime();

    if (this.holdingsTimeout) {
      clearTimeout(this.holdingsTimeout);
    }

    this.log("Next holdings sync scheduled for " + nextSync.toLocaleString());

    this.holdingsTimeout = setTimeout(function() {
      self.syncHoldings();
      self.scheduleNextHoldingsSync();
    }, msUntilSync);
  },

  mergeHoldings: function(holdings) {
    var merged = {};

    for (var i = 0; i < holdings.length; i++) {
      var holding = holdings[i];
      var symbol = holding.symbol;
      var sources = holding.sources || (holding.source ? [holding.source] : []);
      var type = holding.type || "crypto";

      if (merged[symbol]) {
        merged[symbol].quantity += holding.quantity;
        merged[symbol].sources = merged[symbol].sources.concat(sources);
      } else {
        merged[symbol] = {
          symbol: symbol,
          quantity: holding.quantity,
          type: type,
          sources: sources.slice()
        };
      }
    }

    var result = [];
    for (var key in merged) {
      if (merged.hasOwnProperty(key)) {
        result.push(merged[key]);
      }
    }

    return result;
  },

  syncHoldings: async function() {
    var self = this;
    this.log("Starting holdings sync...");

    try {
      var apiHoldings = [];

      if (this.providers.coinbase) {
        try {
          var coinbaseHoldings = await this.providers.coinbase.fetchHoldings();
          apiHoldings = apiHoldings.concat(coinbaseHoldings);
          this.log("Fetched " + coinbaseHoldings.length + " holdings from Coinbase");
        } catch (error) {
          this.logError("COINBASE", "Failed to fetch holdings", error.message);
        }
      }

      var manualHoldings = [];
      if (fs.existsSync(this.manualHoldingsPath)) {
        try {
          var manualData = fs.readFileSync(this.manualHoldingsPath, "utf8");
          var parsed = JSON.parse(manualData);
          manualHoldings = parsed.holdings || [];
          this.log("Loaded " + manualHoldings.length + " manual holdings");
        } catch (error) {
          this.logError("MANUAL_HOLDINGS", "Failed to load manual holdings", error.message);
        }
      }

      var combinedHoldings = apiHoldings.concat(manualHoldings);
      var allHoldings = this.mergeHoldings(combinedHoldings);
      this.log("Merged into " + allHoldings.length + " unique holdings");

      for (var i = 0; i < allHoldings.length; i++) {
        var holding = allHoldings[i];
        var provider = this.getProviderForSymbol(holding);

        if (!provider) {
          this.logError("PROVIDER", "No provider available for " + holding.symbol);
          holding.price = 0;
          holding.change24h = 0;
          holding.value = 0;
          continue;
        }

        try {
          var priceData = await provider.fetchPrice(holding.symbol);
          holding.price = priceData.price;
          holding.change24h = priceData.change24h;
          holding.value = holding.quantity * holding.price;
        } catch (error) {
          if (error.code === "INVALID_SYMBOL") {
            if (this.invalidSymbols.indexOf(holding.symbol) === -1) {
              this.invalidSymbols.push(holding.symbol);
            }
            this.logError("INVALID_SYMBOL", "Invalid or unavailable symbol", holding.symbol);
          } else if (error.code === "RATE_LIMIT") {
            if (this.rateLimitedSymbols.indexOf(holding.symbol) === -1) {
              this.rateLimitedSymbols.push(holding.symbol);
            }
            this.logError("RATE_LIMIT", "Rate limit exceeded for symbol", holding.symbol);
          } else {
            this.logError("PRICE_FETCH", "Failed to fetch price for " + holding.symbol, error.message);
          }
          holding.price = 0;
          holding.change24h = 0;
          holding.value = 0;
        }
      }

      var totalValue = 0;
      for (var j = 0; j < allHoldings.length; j++) {
        totalValue += allHoldings[j].value;
      }

      var cache = {
        holdings: allHoldings,
        totalValue: totalValue,
        lastUpdated: new Date().toISOString(),
        lastPriceUpdate: new Date().toISOString(),
        hasError: this.lastError !== null,
        invalidSymbols: this.invalidSymbols,
        rateLimitedSymbols: this.rateLimitedSymbols
      };

      fs.writeFileSync(this.dataPath, JSON.stringify(cache, null, 2));
      this.log("Cache updated with " + allHoldings.length + " holdings");

      this.clearError();
      this.sendSocketNotification("MMM-FINTECH_DATA", cache);

    } catch (error) {
      this.logError("SYNC", "Holdings sync failed", error.message);
      this.sendSocketNotification("MMM-FINTECH_ERROR", { hasError: true });
    }
  },

  updatePricesOnly: async function() {
    var self = this;
    this.log("Updating prices...");

    if (!fs.existsSync(this.dataPath)) {
      this.log("No cache file found, skipping price update");
      return;
    }

    try {
      var cacheData = fs.readFileSync(this.dataPath, "utf8");
      var cache = JSON.parse(cacheData);

      for (var i = 0; i < cache.holdings.length; i++) {
        var holding = cache.holdings[i];
        var provider = this.getProviderForSymbol(holding);

        if (!provider) {
          continue;
        }

        try {
          var priceData = await provider.fetchPrice(holding.symbol);
          holding.price = priceData.price;
          holding.change24h = priceData.change24h;
          holding.value = holding.quantity * holding.price;
        } catch (error) {
          if (error.code === "INVALID_SYMBOL") {
            if (this.invalidSymbols.indexOf(holding.symbol) === -1) {
              this.invalidSymbols.push(holding.symbol);
            }
            this.logError("INVALID_SYMBOL", "Invalid or unavailable symbol", holding.symbol);
          } else if (error.code === "RATE_LIMIT") {
            if (this.rateLimitedSymbols.indexOf(holding.symbol) === -1) {
              this.rateLimitedSymbols.push(holding.symbol);
            }
            this.logError("RATE_LIMIT", "Rate limit exceeded for symbol", holding.symbol);
          } else {
            this.logError("PRICE_UPDATE", "Failed to update price for " + holding.symbol, error.message);
          }
        }
      }

      var totalValue = 0;
      for (var j = 0; j < cache.holdings.length; j++) {
        totalValue += cache.holdings[j].value;
      }

      cache.totalValue = totalValue;
      cache.lastPriceUpdate = new Date().toISOString();
      cache.hasError = this.lastError !== null;
      cache.invalidSymbols = this.invalidSymbols;
      cache.rateLimitedSymbols = this.rateLimitedSymbols;

      fs.writeFileSync(this.dataPath, JSON.stringify(cache, null, 2));
      this.log("Prices updated");

      this.clearError();
      this.sendSocketNotification("MMM-FINTECH_DATA", cache);

    } catch (error) {
      this.logError("PRICE_UPDATE", "Price update failed", error.message);
      this.sendSocketNotification("MMM-FINTECH_ERROR", { hasError: true });
    }
  },

  loadCachedData: function() {
    if (fs.existsSync(this.dataPath)) {
      try {
        var data = fs.readFileSync(this.dataPath, "utf8");
        var cache = JSON.parse(data);
        this.log("Loaded cached data");
        this.sendSocketNotification("MMM-FINTECH_DATA", cache);
      } catch (error) {
        this.logError("CACHE", "Failed to load cache", error.message);
      }
    } else {
      this.log("No cache file found");
    }
  }
});
