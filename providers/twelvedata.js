const BaseProvider = require("./base");
const https = require("https");
const path = require("path");

class TwelveDataProvider extends BaseProvider {
  constructor() {
    super("TwelveData");
    this.credentials = null;
    this.creditsUsed = 0;
    this.creditsLeft = null;
  }

  init(config, modulePath) {
    super.init(config, modulePath);
    this.encryptedCredentialsPath = path.join(modulePath, "twelvedata-credentials.enc");
    this.credentials = this.loadTwelveDataCredentials();
    if (this.credentials) {
      this.log("Credentials loaded successfully");
    }
    return this.credentials !== null;
  }

  loadTwelveDataCredentials() {
    return this.loadCredentials(this.encryptedCredentialsPath);
  }

  getAssetTypes() {
    return ["stock", "etf", "mutual_fund", "forex"];
  }

  supportsHoldings() {
    return false;
  }

  supportsPricing() {
    return true;
  }

  getRetryConfig() {
    return {
      maxRetries: this.config.maxRetries || 3,
      initialDelay: 60000,
      backoffMultiplier: 1,
      maxDelay: 60000
    };
  }

  classifyError(error) {
    var message = error.message || "";

    if (message.includes("429") || message.includes("Too Many Requests") || message.includes("rate limit")) {
      return {
        code: "RATE_LIMIT",
        retryable: true,
        message: message
      };
    }

    if (message.includes("401") || message.includes("Invalid API key")) {
      return {
        code: "AUTH_ERROR",
        retryable: false,
        message: message
      };
    }

    if (message.includes("404") || message.includes("not found") || message.includes("No data")) {
      return {
        code: "INVALID_SYMBOL",
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
      retryable: false,
      message: message
    };
  }

  makeAPIRequest(endpoint, params) {
    var self = this;

    return new Promise(function(resolve, reject) {
      var queryParams = Object.assign({}, params, { apikey: self.credentials.apiKey });
      var queryString = Object.keys(queryParams)
        .map(function(key) { return key + "=" + encodeURIComponent(queryParams[key]); })
        .join("&");

      var options = {
        hostname: "api.twelvedata.com",
        port: 443,
        path: "/" + endpoint + "?" + queryString,
        method: "GET",
        headers: {
          "Content-Type": "application/json"
        }
      };

      var req = https.request(options, function(res) {
        var data = "";

        if (res.headers["api-credits-used"]) {
          self.creditsUsed = parseInt(res.headers["api-credits-used"], 10);
        }
        if (res.headers["api-credits-left"]) {
          self.creditsLeft = parseInt(res.headers["api-credits-left"], 10);
        }

        res.on("data", function(chunk) {
          data += chunk;
        });

        res.on("end", function() {
          try {
            var parsed = JSON.parse(data);

            if (parsed.status === "error" || parsed.code) {
              var errorCode = parsed.code || res.statusCode;
              var errorMessage = parsed.message || "Unknown error";
              reject(new Error("API error " + errorCode + ": " + errorMessage));
              return;
            }

            resolve(parsed);
          } catch (error) {
            reject(new Error("Failed to parse response: " + error.message));
          }
        });
      });

      req.on("error", function(error) {
        reject(error);
      });

      req.end();
    });
  }

  async fetchPrice(symbol) {
    var self = this;

    if (!this.credentials) {
      throw new Error("Credentials not loaded");
    }

    try {
      var response = await this.retryWithBackoff(
        function() {
          return self.makeAPIRequest("quote", { symbol: symbol });
        },
        "Price Fetch (" + symbol + ")"
      );

      if (!response || !response.close) {
        var noDataError = new Error("No data returned for " + symbol);
        noDataError.code = "INVALID_SYMBOL";
        throw noDataError;
      }

      var price = parseFloat(response.close);
      var previousClose = parseFloat(response.previous_close || response.close);
      var change24h = 0;

      if (previousClose && previousClose !== 0) {
        change24h = ((price - previousClose) / previousClose) * 100;
      } else if (response.percent_change) {
        change24h = parseFloat(response.percent_change);
      }

      return {
        price: price,
        change24h: change24h
      };
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

  async fetchForexRate(pair) {
    var self = this;

    if (!this.credentials) {
      throw new Error("Credentials not loaded");
    }

    try {
      var response = await this.retryWithBackoff(
        function() {
          return self.makeAPIRequest("quote", { symbol: pair });
        },
        "Forex Fetch (" + pair + ")"
      );

      if (!response || !response.close) {
        var noDataError = new Error("No data returned for " + pair);
        noDataError.code = "INVALID_SYMBOL";
        throw noDataError;
      }

      var rate = parseFloat(response.close);
      var previousClose = parseFloat(response.previous_close || response.close);
      var change24h = 0;

      if (previousClose && previousClose !== 0) {
        change24h = ((rate - previousClose) / previousClose) * 100;
      } else if (response.percent_change) {
        change24h = parseFloat(response.percent_change);
      }

      return {
        rate: rate,
        change24h: change24h,
        timestamp: response.timestamp || Date.now()
      };
    } catch (error) {
      var classified = this.classifyError(error);

      if (classified.code === "INVALID_SYMBOL") {
        var symbolError = new Error("Invalid or unavailable forex pair: " + pair);
        symbolError.code = "INVALID_SYMBOL";
        throw symbolError;
      }

      if (classified.code === "RATE_LIMIT") {
        var rateLimitError = new Error("Rate limit exceeded for " + pair);
        rateLimitError.code = "RATE_LIMIT";
        throw rateLimitError;
      }

      throw error;
    }
  }

  getCreditsInfo() {
    return {
      used: this.creditsUsed,
      left: this.creditsLeft
    };
  }
}

module.exports = TwelveDataProvider;
