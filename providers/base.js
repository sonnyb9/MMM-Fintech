const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

class BaseProvider {
  constructor(name) {
    this.name = name;
    this.config = null;
    this.modulePath = null;
    this.lastError = null;
  }

  init(config, modulePath) {
    this.config = config;
    this.modulePath = modulePath;
  }

  log(msg) {
    console.log("[MMM-Fintech:" + this.name + "] " + msg);
  }

  logError(category, message, details) {
    this.lastError = {
      category: category,
      message: message,
      details: details || null,
      timestamp: new Date().toISOString()
    };
    this.log("ERROR [" + category + "] " + message + (details ? " - " + details : ""));
  }

  clearError() {
    this.lastError = null;
  }

  sleep(ms) {
    return new Promise(function(resolve) {
      setTimeout(resolve, ms);
    });
  }

  getKeyPath() {
    return path.join(process.env.HOME || process.env.USERPROFILE, ".mmm-fintech-key");
  }

  loadEncryptionKey() {
    var keyPath = this.getKeyPath();
    if (!fs.existsSync(keyPath)) {
      this.log("Encryption key not found at " + keyPath);
      return null;
    }
    try {
      return Buffer.from(fs.readFileSync(keyPath, "utf8").trim(), "hex");
    } catch (error) {
      this.logError("CREDENTIALS", "Failed to load encryption key", error.message);
      return null;
    }
  }

  decrypt(encryptedBuffer, key) {
    var iv = encryptedBuffer.slice(0, 12);
    var authTag = encryptedBuffer.slice(12, 28);
    var encrypted = encryptedBuffer.slice(28);
    var decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(encrypted, null, "utf8") + decipher.final("utf8");
  }

  loadCredentials(encryptedFilePath) {
    var keyBuffer = this.loadEncryptionKey();
    if (!keyBuffer) {
      return null;
    }

    if (!fs.existsSync(encryptedFilePath)) {
      this.log("Encrypted credentials not found at " + encryptedFilePath);
      return null;
    }

    try {
      var encryptedData = fs.readFileSync(encryptedFilePath);
      var decrypted = this.decrypt(encryptedData, keyBuffer);
      return JSON.parse(decrypted);
    } catch (error) {
      this.logError("CREDENTIALS", "Failed to decrypt credentials", error.message);
      return null;
    }
  }

  getAssetTypes() {
    throw new Error("getAssetTypes() must be implemented by provider");
  }

  supportsHoldings() {
    return false;
  }

  supportsPricing() {
    return false;
  }

  async fetchHoldings() {
    throw new Error("fetchHoldings() not implemented by this provider");
  }

  async fetchPrice(symbol) {
    throw new Error("fetchPrice() not implemented by this provider");
  }

  async fetchPrices(symbols) {
    var results = [];
    for (var i = 0; i < symbols.length; i++) {
      try {
        var priceData = await this.fetchPrice(symbols[i]);
        results.push({
          symbol: symbols[i],
          success: true,
          data: priceData
        });
      } catch (error) {
        results.push({
          symbol: symbols[i],
          success: false,
          error: error
        });
      }
    }
    return results;
  }

  classifyError(error) {
    return {
      code: "UNKNOWN",
      retryable: false,
      message: error.message
    };
  }

  getRetryConfig() {
    return {
      maxRetries: 3,
      initialDelay: 1000,
      backoffMultiplier: 2,
      maxDelay: 60000
    };
  }

  async retryWithBackoff(fn, operation) {
    var self = this;
    var config = this.getRetryConfig();
    var attempt = 0;

    while (attempt <= config.maxRetries) {
      try {
        return await fn();
      } catch (error) {
        var classified = self.classifyError(error);
        attempt++;

        if (!classified.retryable || attempt > config.maxRetries) {
          self.logError(operation, "Failed after " + attempt + " attempts", error.message);
          throw error;
        }

        var delay = Math.min(
          config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1),
          config.maxDelay
        );
        self.log(operation + " failed (attempt " + attempt + "/" + config.maxRetries + "), retrying in " + (delay / 1000) + "s...");
        await self.sleep(delay);
      }
    }
  }
}

module.exports = BaseProvider;
