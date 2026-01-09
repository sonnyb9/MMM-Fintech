const NodeHelper = require("node_helper");
const fs = require("fs");
const path = require("path");
const providers = require("./providers");
const HistoryManager = require("./lib/history-manager");

module.exports = NodeHelper.create({
  start: function() {
    this.log("MMM-Fintech node_helper started");
    this.dataPath = path.join(this.path, "cache.json");
    this.manualHoldingsPath = path.join(this.path, "manual-holdings.json");
    this.cryptoPriceInterval = null;
    this.stockPriceInterval = null;
    this.holdingsTimeout = null;
    this.lastError = null;
    this.invalidSymbols = [];
    this.rateLimitedSymbols = [];
    this.providers = {};
    this.conversionRate = 1;
    this.postClosePollByType = {};
    this.lastMarketStatusLog = {};
    this.historyManager = null;
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
      this.historyManager = new HistoryManager(this.path, this.config);
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
    if (coinbase.init(this.config, this.path)) {
      this.providers.coinbase = coinbase;
      this.log("Coinbase provider initialized");
    } else {
      this.log("Coinbase provider not configured (optional)");
    }

    var twelvedata = providers.createProvider("twelvedata");
    if (twelvedata.init(this.config, this.path)) {
      this.providers.twelvedata = twelvedata;
      this.log("TwelveData provider initialized");
    } else {
      this.log("TwelveData provider not configured (optional)");
    }

    var snaptrade = providers.createProvider("snaptrade");
    if (snaptrade.init(this.config, this.path)) {
      this.providers.snaptrade = snaptrade;
      this.log("SnapTrade provider initialized");
    } else {
      this.log("SnapTrade provider not configured (optional)");
    }

    if (!this.providers.coinbase && !this.providers.twelvedata && !this.providers.snaptrade) {
      this.logError("INIT", "No providers initialized");
      this.sendSocketNotification("MMM-FINTECH_ERROR", { hasError: true });
    }
  },

  getProviderForSymbol: function(holding) {
    var assetType = holding.type || "crypto";

    if (assetType === "cash") {
      return null;
    }

    var providerName = providers.getProviderForAssetType(assetType);

    if (providerName && this.providers[providerName]) {
      return this.providers[providerName];
    }

    if (assetType === "crypto") {
      return this.providers.coinbase;
    }

    return this.providers.twelvedata || null;
  },

  fetchConversionRate: async function() {
    var currency = this.config.currency || "USD";

    if (currency === "USD") {
      this.conversionRate = 1;
      return;
    }

    if (!this.providers.twelvedata) {
      this.log("TwelveData not available for currency conversion, using USD");
      this.conversionRate = 1;
      return;
    }

    try {
      var pair = "USD/" + currency;
      var rateData = await this.providers.twelvedata.fetchForexRate(pair);
      this.conversionRate = rateData.rate;
      this.log("Conversion rate USD/" + currency + ": " + this.conversionRate.toFixed(4));
    } catch (error) {
      this.logError("CONVERSION", "Failed to fetch conversion rate for " + currency, error.message);
      this.conversionRate = 1;
    }
  },

  schedulePriceUpdates: function() {
    var self = this;
    var cryptoInterval = this.config.cryptoPriceUpdateInterval || 5 * 60 * 1000;
    var stockInterval = this.config.stockPriceUpdateInterval || 20 * 60 * 1000;

    if (this.cryptoPriceInterval) {
      clearInterval(this.cryptoPriceInterval);
    }
    if (this.stockPriceInterval) {
      clearInterval(this.stockPriceInterval);
    }

    this.log("Crypto price updates scheduled every " + (cryptoInterval / 60000) + " minutes");
    this.log("Stock/ETF/Forex price updates scheduled every " + (stockInterval / 60000) + " minutes");

    this.cryptoPriceInterval = setInterval(function() {
      self.updatePricesByType("crypto");
    }, cryptoInterval);

    this.stockPriceInterval = setInterval(function() {
      self.updatePricesByType("stock");
    }, stockInterval);
  },

  getMarketSchedule: function(assetType) {
    var schedules = (this.config && this.config.marketHours) || {};
    return schedules[assetType] || null;
  },

  parseTimeToMinutes: function(timeStr) {
    if (!timeStr) {
      return null;
    }
    var parts = timeStr.split(":");
    if (parts.length < 2) {
      return null;
    }
    var hours = parseInt(parts[0], 10);
    var minutes = parseInt(parts[1], 10);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
      return null;
    }
    return hours * 60 + minutes;
  },

  getZonedTimeParts: function(timezone) {
    var now = new Date();
    var formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });

    var parts = formatter.formatToParts(now);
    var result = {};
    for (var i = 0; i < parts.length; i++) {
      result[parts[i].type] = parts[i].value;
    }

    var weekdayMap = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6
    };

    return {
      weekday: weekdayMap[result.weekday],
      dateKey: result.year + "-" + result.month + "-" + result.day,
      minutes: parseInt(result.hour, 10) * 60 + parseInt(result.minute, 10)
    };
  },

  isForexMarketOpen: function(schedule, zonedParts) {
    var sundayOpen = this.parseTimeToMinutes(schedule.sundayOpen);
    var fridayClose = this.parseTimeToMinutes(schedule.fridayClose);

    if (sundayOpen === null || fridayClose === null) {
      return true;
    }

    var day = zonedParts.weekday;
    var minutes = zonedParts.minutes;

    if (day === 6) {
      return false;
    }

    if (day === 0) {
      return minutes >= sundayOpen;
    }

    if (day === 5) {
      return minutes < fridayClose;
    }

    return true;
  },

  isWithinMarketWindow: function(schedule, zonedParts) {
    var openMinutes = this.parseTimeToMinutes(schedule.open);
    var closeMinutes = this.parseTimeToMinutes(schedule.close);

    if (openMinutes === null || closeMinutes === null) {
      return true;
    }

    var day = zonedParts.weekday;
    var minutes = zonedParts.minutes;

    var tradingDays = schedule.days || [1, 2, 3, 4, 5];
    if (tradingDays.indexOf(day) === -1) {
      return false;
    }

    return minutes >= openMinutes && minutes < closeMinutes;
  },

  shouldAllowPostClosePoll: function(assetType, schedule, zonedParts) {
    if (!schedule.postClosePoll) {
      return false;
    }

    var closeMinutes = this.parseTimeToMinutes(schedule.close);
    if (closeMinutes === null) {
      return false;
    }

    var day = zonedParts.weekday;
    var minutes = zonedParts.minutes;

    var tradingDays = schedule.days || [1, 2, 3, 4, 5];
    if (tradingDays.indexOf(day) === -1) {
      return false;
    }

    if (minutes < closeMinutes) {
      return false;
    }

    var lastKey = this.postClosePollByType[assetType];
    if (lastKey === zonedParts.dateKey) {
      return false;
    }

    this.postClosePollByType[assetType] = zonedParts.dateKey;
    return true;
  },

  canUpdateAssetType: function(assetType) {
    var schedule = this.getMarketSchedule(assetType);

    if (!schedule || schedule.enabled === false) {
      return true;
    }

    var timezone = schedule.timezone || "America/New_York";
    var zonedParts = this.getZonedTimeParts(timezone);

    if (assetType === "forex") {
      return this.isForexMarketOpen(schedule, zonedParts);
    }

    if (this.isWithinMarketWindow(schedule, zonedParts)) {
      return true;
    }

    return this.shouldAllowPostClosePoll(assetType, schedule, zonedParts);
  },

  getMarketDecision: function(assetType, decisions) {
    if (decisions && Object.prototype.hasOwnProperty.call(decisions, assetType)) {
      return decisions[assetType];
    }
    var allowed = this.canUpdateAssetType(assetType);
    if (decisions) {
      decisions[assetType] = allowed;
    }
    return allowed;
  },

  logMarketStatus: function(assetType, message) {
    var now = Date.now();
    var lastLog = this.lastMarketStatusLog[assetType] || 0;
    if (now - lastLog > 5 * 60 * 1000) {
      this.log(message);
      this.lastMarketStatusLog[assetType] = now;
    }
  },

  getManualHoldingsModTime: function() {
    if (!fs.existsSync(this.manualHoldingsPath)) {
      return null;
    }
    try {
      var stats = fs.statSync(this.manualHoldingsPath);
      return stats.mtime.toISOString();
    } catch (error) {
      return null;
    }
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

      var currentModTime = this.getManualHoldingsModTime();
      var cachedModTime = cache.manualHoldingsModTime || null;

      if (currentModTime && currentModTime !== cachedModTime) {
        this.log("manual-holdings.json has changed, triggering sync");
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
      var mergeKey = symbol + ":" + type;

      var quantity = holding.quantity || 0;
      var costBasis = holding.costBasis || 0;
      var openPnl = holding.openPnl || 0;

      if (merged[mergeKey]) {
        var existing = merged[mergeKey];
        var totalCostBasis = existing.costBasis + costBasis;
        var totalQuantity = existing.quantity + quantity;
        existing.quantity = totalQuantity;
        existing.costBasis = totalCostBasis;
        existing.openPnl = (existing.openPnl || 0) + openPnl;
        existing.sources = existing.sources.concat(sources);
      } else {
        merged[mergeKey] = {
          symbol: symbol,
          quantity: quantity,
          type: type,
          sources: sources.slice(),
          costBasis: costBasis,
          openPnl: openPnl
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

  loadManualData: function() {
    var result = {
      holdings: [],
      forex: []
    };

    if (!fs.existsSync(this.manualHoldingsPath)) {
      return result;
    }

    try {
      var manualData = fs.readFileSync(this.manualHoldingsPath, "utf8");
      var parsed = JSON.parse(manualData);

      if (parsed.holdings && Array.isArray(parsed.holdings)) {
        result.holdings = parsed.holdings;
      }

      if (parsed.forex && Array.isArray(parsed.forex)) {
        result.forex = parsed.forex;
      }

      this.log("Loaded " + result.holdings.length + " manual holdings, " + result.forex.length + " forex pairs");
    } catch (error) {
      this.logError("MANUAL_HOLDINGS", "Failed to load manual holdings", error.message);
    }

    return result;
  },

  fetchForexRates: async function(forexPairs) {
    var self = this;
    var rates = [];

    if (!this.providers.twelvedata) {
      this.log("TwelveData provider not available for forex");
      return rates;
    }

    for (var i = 0; i < forexPairs.length; i++) {
      var pair = forexPairs[i].pair;

      try {
        var rateData = await this.providers.twelvedata.fetchForexRate(pair);
        rates.push({
          pair: pair,
          rate: rateData.rate,
          change24h: rateData.change24h || 0,
          timestamp: rateData.timestamp
        });

        var parts = pair.split("/");
        if (parts.length === 2) {
          var inversePair = parts[1] + "/" + parts[0];
          var inverseRate = 1 / rateData.rate;
          var inverseChange = rateData.change24h ? -rateData.change24h : 0;
          rates.push({
            pair: inversePair,
            rate: inverseRate,
            change24h: inverseChange,
            timestamp: rateData.timestamp,
            isInverse: true
          });
        }
      } catch (error) {
        this.logError("FOREX", "Failed to fetch rate for " + pair, error.message);
        rates.push({
          pair: pair,
          rate: 0,
          change24h: 0,
          error: true
        });
      }
    }

    return rates;
  },

  buildCryptoForex: function(holdings) {
    var cryptoAsForex = this.config.cryptoAsForex || [];
    var result = [];
    var currency = this.config.currency || "USD";

    for (var i = 0; i < holdings.length; i++) {
      var h = holdings[i];
      if (h.type === "crypto" && cryptoAsForex.indexOf(h.symbol) !== -1) {
        result.push({
          pair: h.symbol + "/" + currency,
          rate: h.price || 0,
          change24h: h.change24h || 0,
          isCrypto: true
        });
      }
    }

    return result;
  },

  calculateValuesByType: function(holdings) {
    var cryptoAsForex = this.config.cryptoAsForex || [];
    var totalValue = 0;
    var cryptoValue = 0;
    var traditionalValue = 0;

    for (var i = 0; i < holdings.length; i++) {
      var h = holdings[i];
      var value = h.value || 0;

      if (h.type === "crypto" && cryptoAsForex.indexOf(h.symbol) !== -1) {
        continue;
      }

      totalValue += value;

      if (h.type === "crypto") {
        cryptoValue += value;
      } else {
        traditionalValue += value;
      }
    }

    return {
      totalValue: totalValue,
      cryptoValue: cryptoValue,
      traditionalValue: traditionalValue
    };
  },

  recordSnapshot: function(holdings, isDaily) {
    if (!this.historyManager) {
      return;
    }

    var values = this.calculateValuesByType(holdings);

    this.historyManager.addHourlySnapshot(
      values.totalValue,
      values.cryptoValue,
      values.traditionalValue
    );

    if (isDaily) {
      this.historyManager.addDailySnapshot(
        values.totalValue,
        values.cryptoValue,
        values.traditionalValue,
        holdings
      );
    }

    this.sendHistoryData();
  },

  sendHistoryData: function() {
    if (!this.historyManager) {
      this.log("sendHistoryData: no historyManager");
      return;
    }
    if (!this.config.showCharts) {
      this.log("sendHistoryData: showCharts is false");
      return;
    }

    var period = this.config.chartPeriod || "1M";
    var data = this.historyManager.getChartData(period);
    this.log("Sending history data: " + data.length + " points for period " + period);
    this.sendSocketNotification("MMM-FINTECH_HISTORY", { data: data });
  },

  syncHoldings: async function() {
    var self = this;
    this.log("Starting holdings sync...");
    this.invalidSymbols = [];
    this.rateLimitedSymbols = [];

    try {
      await this.fetchConversionRate();

      var apiHoldings = [];

      if (this.providers.snaptrade) {
        try {
          var snaptradeHoldings = await this.providers.snaptrade.fetchHoldings();
          apiHoldings = apiHoldings.concat(snaptradeHoldings);
          this.log("Fetched " + snaptradeHoldings.length + " holdings from SnapTrade");
        } catch (error) {
          this.logError("SNAPTRADE", "Failed to fetch holdings", error.message);
        }
      }

      if (this.providers.coinbase && !this.providers.snaptrade) {
        try {
          var coinbaseHoldings = await this.providers.coinbase.fetchHoldings();
          apiHoldings = apiHoldings.concat(coinbaseHoldings);
          this.log("Fetched " + coinbaseHoldings.length + " holdings from Coinbase");
        } catch (error) {
          this.logError("COINBASE", "Failed to fetch holdings", error.message);
        }
      }

      var manualData = this.loadManualData();
      var combinedHoldings = apiHoldings.concat(manualData.holdings);
      var allHoldings = this.mergeHoldings(combinedHoldings);
      this.log("Merged into " + allHoldings.length + " unique holdings");

      for (var i = 0; i < allHoldings.length; i++) {
        var holding = allHoldings[i];
        var assetType = holding.type || "crypto";

        if (assetType === "cash") {
          holding.price = 1.0 * this.conversionRate;
          holding.change24h = 0;
          holding.value = holding.quantity * holding.price;
          continue;
        }

        var provider = this.getProviderForSymbol(holding);

        if (!provider) {
          this.logError("PROVIDER", "No provider available for " + holding.symbol + " (type: " + holding.type + ")");
          holding.price = 0;
          holding.change24h = 0;
          holding.value = 0;
          continue;
        }

        try {
          var priceData = await provider.fetchPrice(holding.symbol);
          holding.price = priceData.price * this.conversionRate;
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

      var forexRates = [];
      if (manualData.forex.length > 0) {
        forexRates = await this.fetchForexRates(manualData.forex);
      }

      var cryptoForex = this.buildCryptoForex(allHoldings);

      var totalValue = 0;
      var totalCostBasis = 0;
      var cryptoAsForex = this.config.cryptoAsForex || [];
      for (var j = 0; j < allHoldings.length; j++) {
        var h = allHoldings[j];

        if (h.costBasis > 0 && h.value > 0) {
          h.gainLossPercent = ((h.value - h.costBasis) / h.costBasis) * 100;
        } else {
          h.gainLossPercent = null;
        }

        if (h.type === "crypto" && cryptoAsForex.indexOf(h.symbol) !== -1) {
          continue;
        }
        totalValue += h.value;
        totalCostBasis += h.costBasis || 0;
      }

      var totalGainLossPercent = null;
      if (totalCostBasis > 0) {
        totalGainLossPercent = ((totalValue - totalCostBasis) / totalCostBasis) * 100;
      }

      var cache = {
        holdings: allHoldings,
        forex: forexRates,
        cryptoForex: cryptoForex,
        totalValue: totalValue,
        totalCostBasis: totalCostBasis,
        totalGainLossPercent: totalGainLossPercent,
        conversionRate: this.conversionRate,
        currency: this.config.currency || "USD",
        lastUpdated: new Date().toISOString(),
        lastPriceUpdate: new Date().toISOString(),
        lastCryptoPriceUpdate: new Date().toISOString(),
        lastStockPriceUpdate: new Date().toISOString(),
        manualHoldingsModTime: this.getManualHoldingsModTime(),
        hasError: this.lastError !== null,
        invalidSymbols: this.invalidSymbols,
        rateLimitedSymbols: this.rateLimitedSymbols
      };

      fs.writeFileSync(this.dataPath, JSON.stringify(cache, null, 2));
      this.log("Cache updated with " + allHoldings.length + " holdings and " + forexRates.length + " forex rates");

      this.recordSnapshot(allHoldings, true);

      this.clearError();
      this.sendSocketNotification("MMM-FINTECH_DATA", cache);

    } catch (error) {
      this.logError("SYNC", "Holdings sync failed", error.message);
      this.sendSocketNotification("MMM-FINTECH_ERROR", { hasError: true });
    }
  },

  updatePricesByType: async function(updateType) {
    var self = this;
    var isCrypto = updateType === "crypto";
    var typeLabel = isCrypto ? "crypto" : "stock/ETF/forex";
    this.log("Updating " + typeLabel + " prices...");

    if (!fs.existsSync(this.dataPath)) {
      this.log("No cache file found, skipping price update");
      return;
    }

    try {
      await this.fetchConversionRate();

      var cacheData = fs.readFileSync(this.dataPath, "utf8");
      var cache = JSON.parse(cacheData);
      var updatedCount = 0;
      var skippedCount = 0;

      var marketDecisions = {};

      for (var i = 0; i < cache.holdings.length; i++) {
        var holding = cache.holdings[i];
        var holdingType = holding.type || "crypto";
        var isHoldingCrypto = holdingType === "crypto";

        if (isCrypto !== isHoldingCrypto) {
          continue;
        }

        if (!isCrypto && !this.getMarketDecision(holdingType, marketDecisions)) {
          skippedCount++;
          continue;
        }

        var provider = this.getProviderForSymbol(holding);

        if (!provider) {
          continue;
        }

        try {
          var priceData = await provider.fetchPrice(holding.symbol);
          holding.price = priceData.price * this.conversionRate;
          holding.change24h = priceData.change24h;
          holding.value = holding.quantity * holding.price;
          updatedCount++;
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

      if (!isCrypto) {
        var manualData = this.loadManualData();
        if (manualData.forex.length > 0) {
          if (this.getMarketDecision("forex", marketDecisions)) {
            cache.forex = await this.fetchForexRates(manualData.forex);
          } else {
            this.logMarketStatus("forex", "Forex market closed, skipping forex rate refresh");
          }
        }
      }

      for (var assetType in marketDecisions) {
        if (!marketDecisions[assetType]) {
          this.logMarketStatus(assetType, "Market closed for " + assetType + ", skipped price refresh");
        }
      }

      cache.cryptoForex = this.buildCryptoForex(cache.holdings);

      var totalValue = 0;
      var totalCostBasis = 0;
      var cryptoAsForex = this.config.cryptoAsForex || [];
      for (var j = 0; j < cache.holdings.length; j++) {
        var h = cache.holdings[j];

        if (h.costBasis > 0 && h.value > 0) {
          h.gainLossPercent = ((h.value - h.costBasis) / h.costBasis) * 100;
        } else {
          h.gainLossPercent = null;
        }

        if (h.type === "crypto" && cryptoAsForex.indexOf(h.symbol) !== -1) {
          continue;
        }
        totalValue += h.value;
        totalCostBasis += h.costBasis || 0;
      }

      var totalGainLossPercent = null;
      if (totalCostBasis > 0) {
        totalGainLossPercent = ((totalValue - totalCostBasis) / totalCostBasis) * 100;
      }

      cache.totalValue = totalValue;
      cache.totalCostBasis = totalCostBasis;
      cache.totalGainLossPercent = totalGainLossPercent;
      cache.conversionRate = this.conversionRate;
      cache.currency = this.config.currency || "USD";
      cache.lastPriceUpdate = new Date().toISOString();

      if (isCrypto) {
        cache.lastCryptoPriceUpdate = new Date().toISOString();
      } else {
        cache.lastStockPriceUpdate = new Date().toISOString();
      }

      cache.hasError = this.lastError !== null;
      cache.invalidSymbols = this.invalidSymbols;
      cache.rateLimitedSymbols = this.rateLimitedSymbols;

      fs.writeFileSync(this.dataPath, JSON.stringify(cache, null, 2));
      if (skippedCount > 0) {
        this.log("Updated " + updatedCount + " " + typeLabel + " prices, skipped " + skippedCount + " (market closed)");
      } else {
        this.log("Updated " + updatedCount + " " + typeLabel + " prices");
      }

      this.recordSnapshot(cache.holdings, false);

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

    this.sendHistoryData();
  }
});
