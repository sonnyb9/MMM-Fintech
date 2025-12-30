const BaseProvider = require("./base");
const https = require("https");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");

class CoinbaseProvider extends BaseProvider {
  constructor() {
    super("Coinbase");
    this.credentials = null;
  }

  init(config, modulePath) {
    super.init(config, modulePath);
    this.encryptedCredentialsPath = path.join(modulePath, "cdp-credentials.enc");
    this.credentials = this.loadCoinbaseCredentials();
    if (this.credentials) {
      this.log("Credentials loaded successfully");
    }
    return this.credentials !== null;
  }

  loadCoinbaseCredentials() {
    return this.loadCredentials(this.encryptedCredentialsPath);
  }

  getAssetTypes() {
    return ["crypto"];
  }

  supportsHoldings() {
    return true;
  }

  supportsPricing() {
    return true;
  }

  getRetryConfig() {
    return {
      maxRetries: this.config.maxRetries || 6,
      initialDelay: 2000,
      backoffMultiplier: 2,
      maxDelay: 64000
    };
  }

  classifyError(error) {
    var message = error.message || "";

    if (message.includes("429") || message.includes("rate limit") || message.includes("rate_limit_exceeded")) {
      return {
        code: "RATE_LIMIT",
        retryable: true,
        message: message
      };
    }

    if (message.includes("404") || message.includes("not found") || message.includes("INVALID_SYMBOL")) {
      return {
        code: "INVALID_SYMBOL",
        retryable: false,
        message: message
      };
    }

    if (message.includes("401") || message.includes("403") || message.includes("unauthorized")) {
      return {
        code: "AUTH_ERROR",
        retryable: false,
        message: message
      };
    }

    if (message.includes("500") || message.includes("502") || message.includes("503") || message.includes("504")) {
      return {
        code: "SERVER_ERROR",
        retryable: true,
        message: message
      };
    }

    if (message.includes("ECONNRESET") || message.includes("ETIMEDOUT") || message.includes("ENOTFOUND")) {
      return {
        code: "NETWORK_ERROR",
        retryable: true,
        message: message
      };
    }

    return {
      code: "UNKNOWN",
      retryable: true,
      message: message
    };
  }

  buildJWT(method, requestPath) {
    var uri = method + " api.coinbase.com" + requestPath;

    var payload = {
      sub: this.credentials.name,
      iss: "cdp",
      nbf: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 120,
      uri: uri
    };

    var header = {
      alg: "ES256",
      kid: this.credentials.name,
      nonce: crypto.randomBytes(16).toString("hex")
    };

    return jwt.sign(payload, this.credentials.privateKey, {
      algorithm: "ES256",
      header: header
    });
  }

  makeAPIRequest(method, requestPath, params) {
    var self = this;

    return new Promise(function(resolve, reject) {
      var queryString = "";
      if (params && Object.keys(params).length > 0) {
        queryString = "?" + Object.keys(params)
          .map(function(key) { return key + "=" + encodeURIComponent(params[key]); })
          .join("&");
      }

      var pathWithQuery = requestPath + queryString;
      var jwtToken = self.buildJWT(method, requestPath);

      var options = {
        hostname: "api.coinbase.com",
        port: 443,
        path: pathWithQuery,
        method: method,
        headers: {
          "Authorization": "Bearer " + jwtToken,
          "Content-Type": "application/json"
        }
      };

      var req = https.request(options, function(res) {
        var data = "";

        res.on("data", function(chunk) {
          data += chunk;
        });

        res.on("end", function() {
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

      req.on("error", function(error) {
        reject(error);
      });

      req.end();
    });
  }

  async fetchHoldings() {
    var self = this;

    if (!this.credentials) {
      throw new Error("Credentials not loaded");
    }

    var response = await this.retryWithBackoff(
      function() {
        return self.makeAPIRequest("GET", "/api/v3/brokerage/accounts", { limit: 250 });
      },
      "Holdings Fetch"
    );

    var holdings = [];

    if (response && response.accounts) {
      for (var i = 0; i < response.accounts.length; i++) {
        var account = response.accounts[i];
        var balance = parseFloat(account.available_balance.value);
        if (balance > 0 && account.currency) {
          holdings.push({
            symbol: account.currency,
            quantity: balance,
            type: "crypto",
            sources: ["coinbase-api"]
          });
        }
      }
    }

    return holdings;
  }

  async fetchPrice(symbol) {
    var self = this;

    if (!this.credentials) {
      throw new Error("Credentials not loaded");
    }

    var productId = symbol + "-USD";

    try {
      var response = await this.retryWithBackoff(
        function() {
          return self.makeAPIRequest("GET", "/api/v3/brokerage/market/products/" + productId, {});
        },
        "Price Fetch (" + symbol + ")"
      );

      if (response && response.price) {
        return {
          price: parseFloat(response.price),
          change24h: parseFloat(response.price_percentage_change_24h || 0)
        };
      }

      throw new Error("No price data returned for " + symbol);
    } catch (error) {
      var classified = this.classifyError(error);

      if (classified.code === "INVALID_SYMBOL") {
        var symbolError = new Error("Invalid or unavailable symbol: " + symbol);
        symbolError.code = "INVALID_SYMBOL";
        throw symbolError;
      }

      if (classified.code === "RATE_LIMIT") {
        var rateLimitError = new Error("Rate limit exceeded for " + symbol);
        rateLimitError.code = "RATE_LIMIT";
        throw rateLimitError;
      }

      throw error;
    }
  }
}

module.exports = CoinbaseProvider;
