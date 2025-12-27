const NodeHelper = require("node_helper");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const https = require("https");

module.exports = NodeHelper.create({
  start: function () {
    this.log("MMM-Fintech node_helper started");
    this.dataPath = path.join(this.path, "cache.json");
    this.encryptedCredentialsPath = path.join(this.path, "cdp-credentials.enc");
    this.keyPath = path.join(process.env.HOME || process.env.USERPROFILE, ".mmm-fintech-key");
    this.manualHoldingsPath = path.join(this.path, "manual-holdings.json");
    this.credentials = null;
    this.priceInterval = null;
    this.holdingsTimeout = null;
    this.lastError = null;
    this.maxRetries = 6;
    this.initialRetryDelay = 2000;
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

  sleep: function (ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  },

  retryWithBackoff: async function (fn, context, args, operation) {
    var attempt = 0;
    var self = this;

    while (attempt <= this.maxRetries) {
      try {
        return await fn.apply(context, args);
      } catch (error) {
        attempt++;
        
        if (attempt > this.maxRetries) {
          self.logError(operation, "Max retries exceeded", error.message);
          throw error;
        }

        var delay = self.initialRetryDelay * Math.pow(2, attempt - 1);
        self.log(operation + " failed (attempt " + attempt + "/" + self.maxRetries + "), retrying in " + (delay / 1000) + "s...");
        await self.sleep(delay);
      }
    }
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
      this.log("Encryption key not found at " + this.keyPath);
      return null;
    }

    if (!fs.existsSync(this.encryptedCredentialsPath)) {
      this.log("Encrypted credentials not found. Run setup-credentials.js first.");
      return null;
    }

    try {
      var encKey = fs.readFileSync(this.keyPath, "utf8").trim();
      var keyBuffer = Buffer.from(encKey, "hex");
      var encryptedData = fs.readFileSync(this.encryptedCredentialsPath);
      var decrypted = this.decrypt(encryptedData, keyBuffer);
      return JSON.parse(decrypted);
    } catch (error) {
      this.logError("CREDENTIALS", "Failed to load credentials", error.message);
      return null;
    }
  },

  initClient: function () {
    this.credentials = this.loadCredentials();
    if (!this.credentials) {
      this.logError("INIT", "Cannot initialize without credentials");
      this.sendSocketNotification("MMM-FINTECH_ERROR", { hasError: true });
      return;
    }

    this.log("Credentials loaded successfully");
  },

  buildJWT: function (method, pathWithQuery) {
    var algorithm = "ES256";
    var uri = method + " api.coinbase.com" + pathWithQuery;
    
    var header = {
      alg: algorithm,
      kid: this.credentials.name,
      nonce: crypto.randomBytes(16).toString("hex"),
      typ: "JWT"
    };

    var payload = {
      sub: this.credentials.name,
      iss: "cdp",
      nbf: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 120,
      uri: uri
    };

    var encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
    var encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
    var token = encodedHeader + "." + encodedPayload;

    var sign = crypto.createSign("SHA256");
    sign.update(token);
    sign.end();
    
    var signature = sign.sign(this.credentials.privateKey, "base64url");
    
    return token + "." + signature;
  },

  makeAPIRequest: function (method, path, params) {
    var self = this;
    
    return new Promise(function (resolve, reject) {
      var queryString = "";
      if (params && Object.keys(params).length > 0) {
        queryString = "?" + Object.keys(params)
          .map(function (key) { return key + "=" + encodeURIComponent(params[key]); })
          .join("&");
      }

      var pathWithQuery = path + queryString;
      var jwt = self.buildJWT(method, pathWithQuery);

      var options = {
        hostname: "api.coinbase.com",
        port: 443,
        path: pathWithQuery,
        method: method,
        headers: {
          "Authorization": "Bearer " + jwt,
          "Content-Type": "application/json"
        }
      };

      var req = https.request(options, function (res) {
        var data = "";

        res.on("data", function (chunk) {
          data += chunk;
        });

        res.on("end", function () {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(data));
            } catch (error) {
              reject(new Error("Failed to parse response: " + error.message));
            }
          } else {
            reject(new Error("API request failed with status " + res.statusCode + ": " + data));
          }
        });
      });

      req.on("error", function (error) {
        reject(error);
      });

      req.end();
    });
  },

  fetchHoldingsFromAPI: async function () {
    if (!this.credentials) {
      throw new Error("Credentials not loaded");
    }

    var response = await this.makeAPIRequest("GET", "/api/v3/brokerage/accounts", { limit: 250 });
    var holdings = [];

    if (response && response.accounts) {
      for (var i = 0; i < response.accounts.length; i++) {
        var account = response.accounts[i];
        var balance = parseFloat(account.available_balance.value);
        if (balance > 0) {
          holdings.push({
            symbol: account.currency,
            quantity: balance,
            sources: ["coinbase-api"]
          });
        }
      }
    }

    return holdings;
  },

  fetchPriceFromAPI: async function (symbol) {
    if (!this.credentials) {
      throw new Error("Credentials not loaded");
    }

    var productId = symbol + "-USD";
    var response = await this.makeAPIRequest("GET", "/api/v3/brokerage/market/products/" + productId, {});

    if (response && response.price) {
      return {
        price: parseFloat(response.price),
        change24h: parseFloat(response.price_percentage_change_24h || 0)
      };
    }

    throw new Error("No price data returned for " + symbol);
  },

  syncHoldings: async function () {
    var self = this;
    this.log("Starting holdings sync...");

    try {
      var apiHoldings = await this.retryWithBackoff(
        this.fetchHoldingsFromAPI,
        this,
        [],
        "Holdings Fetch"
      );

      this.log("Fetched " + apiHoldings.length + " holdings from API");

      var manualHoldings = [];
      if (fs.existsSync(this.manualHoldingsPath)) {
        try {
          var manualData = fs.readFileSync(this.manualHoldingsPath, "utf8");
          manualHoldings = JSON.parse(manualData);
          this.log("Loaded " + manualHoldings.length + " manual holdings");
        } catch (error) {
          this.logError("MANUAL_HOLDINGS", "Failed to load manual holdings", error.message);
        }
      }

      var allHoldings = apiHoldings.concat(manualHoldings);

      for (var i = 0; i < allHoldings.length; i++) {
        var holding = allHoldings[i];
        try {
          var priceData = await this.retryWithBackoff(
            this.fetchPriceFromAPI,
            this,
            [holding.symbol],
            "Price Fetch (" + holding.symbol + ")"
          );

          holding.price = priceData.price;
          holding.change24h = priceData.change24h;
          holding.value = holding.quantity * holding.price;
        } catch (error) {
          this.logError("PRICE_FETCH", "Failed to fetch price for " + holding.symbol, error.message);
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
        hasError: this.lastError !== null
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

  updatePricesOnly: async function () {
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
        try {
          var priceData = await this.retryWithBackoff(
            this.fetchPriceFromAPI,
            this,
            [holding.symbol],
            "Price Update (" + holding.symbol + ")"
          );

          holding.price = priceData.price;
          holding.change24h = priceData.change24h;
          holding.value = holding.quantity * holding.price;
        } catch (error) {
          this.logError("PRICE_UPDATE", "Failed to update price for " + holding.symbol, error.message);
        }
      }

      var totalValue = 0;
      for (var j = 0; j < cache.holdings.length; j++) {
        totalValue += cache.holdings[j].value;
      }

      cache.totalValue = totalValue;
      cache.lastPriceUpdate = new Date().toISOString();
      cache.hasError = this.lastError !== null;

      fs.writeFileSync(this.dataPath, JSON.stringify(cache, null, 2));
      this.log("Prices updated");

      this.clearError();
      this.sendSocketNotification("MMM-FINTECH_DATA", cache);

    } catch (error) {
      this.logError("PRICE_UPDATE", "Price update failed", error.message);
      this.sendSocketNotification("MMM-FINTECH_ERROR", { hasError: true });
    }
  },

  loadCachedData: function () {
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
