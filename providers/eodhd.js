const BaseProvider = require("./base");
const https = require("https");
const path = require("path");

class EODHDProvider extends BaseProvider {
  constructor() {
    super("EODHD");
    this.credentials = null;
    this.symbolCache = {};
  }

  init(config, modulePath) {
    super.init(config, modulePath);
    this.encryptedCredentialsPath = path.join(modulePath, "eodhd-credentials.enc");
    this.credentials = this.loadCredentials(this.encryptedCredentialsPath);
    if (this.credentials) {
      this.log("Credentials loaded successfully");
    }
    return this.credentials !== null;
  }

  getAssetTypes() {
    return ["mutual_fund"];
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
    var status = typeof error.statusCode === "number" ? error.statusCode : null;

    if ((status === 429) || message.includes("429") || message.includes("Too Many Requests") || message.includes("rate limit")) {
      return { code: "RATE_LIMIT", retryable: true, message: message };
    }
    if ((status === 401 || status === 403) || message.includes("401") || message.includes("403") || message.includes("Invalid API key")) {
      return { code: "AUTH_ERROR", retryable: false, message: message };
    }
    if ((status === 404) || message.includes("404") || message.includes("not found") || message.includes("No data")) {
      return { code: "INVALID_SYMBOL", retryable: false, message: message };
    }
    if ((status && status >= 500) || message.includes("500") || message.includes("502") || message.includes("503") || message.includes("504")) {
      return { code: "SERVER_ERROR", retryable: true, message: message };
    }
    if (message.includes("ECONNRESET") || message.includes("ETIMEDOUT") || message.includes("ENOTFOUND") || message.includes("EAI_AGAIN")) {
      return { code: "NETWORK_ERROR", retryable: true, message: message };
    }
    return { code: "UNKNOWN", retryable: false, message: message };
  }

  makeAPIRequest(pathname) {
    return new Promise(function(resolve, reject) {
      var options = {
        hostname: "eodhd.com",
        port: 443,
        path: pathname,
        method: "GET",
        headers: {
          "Content-Type": "application/json"
        }
      };

      var req = https.request(options, function(res) {
        var data = "";

        res.on("data", function(chunk) {
          data += chunk;
        });

        res.on("end", function() {
          var parsed = null;
          try {
            parsed = data ? JSON.parse(data) : null;
          } catch (_) {
            parsed = null;
          }

          if (res.statusCode && res.statusCode >= 400) {
            var httpErr = new Error(
              "HTTP " + res.statusCode +
              ": " + (parsed && parsed.message ? parsed.message : (typeof data === "string" ? data.slice(0, 200) : ""))
            );
            httpErr.statusCode = res.statusCode;
            return reject(httpErr);
          }

          if (parsed && parsed.error) {
            var apiErr = new Error(parsed.error);
            apiErr.statusCode = res.statusCode || 400;
            return reject(apiErr);
          }

          resolve(parsed);
        });
      });

      req.on("error", function(error) {
        reject(error);
      });

      req.end();
    });
  }

  getRecentDateRange() {
    var to = new Date();
    var from = new Date(to.getTime() - (7 * 24 * 60 * 60 * 1000));
    return {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10)
    };
  }

  async fetchSeriesForTicker(ticker) {
    var self = this;
    var range = this.getRecentDateRange();
    var pathname =
      "/api/eod/" + encodeURIComponent(ticker) +
      "?from=" + encodeURIComponent(range.from) +
      "&to=" + encodeURIComponent(range.to) +
      "&period=d&order=d&fmt=json&api_token=" + encodeURIComponent(this.credentials.apiToken);

    return this.retryWithBackoff(function() {
      return self.makeAPIRequest(pathname);
    }, "Price Fetch (" + ticker + ")");
  }

  async resolveTicker(symbol) {
    if (this.symbolCache[symbol]) {
      return this.symbolCache[symbol];
    }

    var candidates = symbol.indexOf(".") !== -1
      ? [symbol]
      : [symbol + ".US", symbol + ".NMFQS"];

    for (var i = 0; i < candidates.length; i++) {
      var ticker = candidates[i];
      try {
        var series = await this.fetchSeriesForTicker(ticker);
        if (Array.isArray(series) && series.length > 0) {
          this.symbolCache[symbol] = ticker;
          return {
            ticker: ticker,
            series: series
          };
        }
      } catch (error) {
        var classified = this.classifyError(error);
        if (classified.code === "RATE_LIMIT" || classified.code === "AUTH_ERROR") {
          throw error;
        }
      }
    }

    var invalidSymbolError = new Error("Invalid or unavailable symbol: " + symbol);
    invalidSymbolError.code = "INVALID_SYMBOL";
    throw invalidSymbolError;
  }

  async fetchPrice(symbol) {
    if (!this.credentials) {
      throw new Error("Credentials not loaded");
    }

    try {
      var resolved = await this.resolveTicker(symbol);
      var series = resolved.series;

      if (!Array.isArray(series) || series.length === 0) {
        var noDataError = new Error("No data returned for " + symbol);
        noDataError.code = "INVALID_SYMBOL";
        throw noDataError;
      }

      var latest = series[0];
      var previous = series.length > 1 ? series[1] : null;
      var price = parseFloat(latest.adjusted_close || latest.close);
      var previousClose = previous ? parseFloat(previous.adjusted_close || previous.close) : price;
      var change24h = 0;

      if (!Number.isFinite(price)) {
        var invalidDataError = new Error("No price data returned for " + symbol);
        invalidDataError.code = "INVALID_SYMBOL";
        throw invalidDataError;
      }

      if (Number.isFinite(previousClose) && previousClose !== 0) {
        change24h = ((price - previousClose) / previousClose) * 100;
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
}

module.exports = EODHDProvider;
