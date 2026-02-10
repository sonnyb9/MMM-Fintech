"use strict";

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

class SnapTradeProvider {
  constructor() {
    this.name = "snaptrade";
    this.client = null;
    this.credentials = null;
    this.modulePath = null;
  }

  init(config, modulePath) {
    this.modulePath = modulePath;
    this.config = config;

    try {
      this.credentials = this.loadCredentials();
      const { Snaptrade } = require("snaptrade-typescript-sdk");
      this.client = new Snaptrade({
        clientId: this.credentials.clientId,
        consumerKey: this.credentials.consumerKey,
      });
      return true;
    } catch (err) {
      console.log("[SnapTrade] Init failed: " + err.message);
      return false;
    }
  }

  loadCredentials() {
    var keyPath = path.join(os.homedir(), ".mmm-fintech-key");
    var encPath = path.join(this.modulePath, "snaptrade-credentials.enc");

    if (!fs.existsSync(keyPath)) {
      throw new Error("Missing key file: " + keyPath);
    }
    if (!fs.existsSync(encPath)) {
      throw new Error("Missing credentials file: " + encPath);
    }

    var key = this.loadKey(keyPath);
    return this.decryptCredentials(encPath, key);
  }

  loadKey(keyPath) {
    var rawBuf = fs.readFileSync(keyPath);
    var rawStr = rawBuf.toString("utf8").trim();

    if (/^[0-9a-fA-F]{64}$/.test(rawStr)) {
      return Buffer.from(rawStr, "hex");
    }

    try {
      var b64 = Buffer.from(rawStr, "base64");
      if (b64.length === 32) return b64;
    } catch (_) {}

    if (rawBuf.length === 32) return rawBuf;

    throw new Error("Invalid key format in " + keyPath);
  }

  decryptCredentials(encPath, key) {
    var payload = JSON.parse(fs.readFileSync(encPath, "utf8"));
    var iv = Buffer.from(payload.iv, "base64");
    var tag = Buffer.from(payload.tag, "base64");
    var data = Buffer.from(payload.data, "base64");

    var decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    var plain = Buffer.concat([decipher.update(data), decipher.final()]);
    return JSON.parse(plain.toString("utf8"));
  }

  getAssetTypes() {
    return ["crypto", "stock", "etf", "mutual_fund", "cash"];
  }

  supportsHoldings() {
    return true;
  }

  supportsPricing() {
    return true;
  }

  mapTypeCode(typeCode, cashEquivalent) {
    if (cashEquivalent) {
      return "cash";
    }

    switch (typeCode) {
      case "crypto":
        return "crypto";
      case "cs":
        return "stock";
      case "et":
        return "etf";
      case "oef":
        return "mutual_fund";
      case "cef":
        return "mutual_fund";
      default:
        return "stock";
    }
  }

  normalizeSymbol(symbol) {
    var symbolMap = {
      "BRKB": "BRK.B",
      "BRKA": "BRK.A"
    };
    return symbolMap[symbol] || symbol;
  }

  async withTimeout(promise, timeoutMs, operation) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout: ${operation} exceeded ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
  }

  async withRetry(fn, operation, timeoutMs = 30000) {
    var retryDelays = [60000, 120000, 240000]; // 1min, 2min, 4min
    var lastError;

    for (var attempt = 0; attempt <= retryDelays.length; attempt++) {
      try {
        console.log(`[SnapTrade] Attempt ${attempt + 1}/${retryDelays.length + 1}: ${operation}`);
        var result = await this.withTimeout(fn(), timeoutMs, operation);
        if (attempt > 0) {
          console.log(`[SnapTrade] Success after ${attempt} retries`);
        }
        return result;
      } catch (err) {
        lastError = err;
        console.error(`[SnapTrade] Attempt ${attempt + 1} failed: ${err.message}`);

        if (attempt < retryDelays.length) {
          var delayMs = retryDelays[attempt];
          console.log(`[SnapTrade] Waiting ${delayMs / 1000}s before retry...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    console.error(`[SnapTrade] All retries exhausted for ${operation}`);
    throw lastError;
  }

  async fetchHoldings() {
    if (!this.client || !this.credentials) {
      throw new Error("SnapTrade provider not initialized");
    }

    var userId = this.credentials.userId;
    var userSecret = this.credentials.userSecret;
    var holdingsMap = {};

    var accountsResp = await this.withRetry(
      () => this.client.accountInformation.listUserAccounts({
        userId: userId,
        userSecret: userSecret,
      }),
      "listUserAccounts"
    );

    var accounts = accountsResp.data || [];

    for (var i = 0; i < accounts.length; i++) {
      var account = accounts[i];
      var accountId = account.id;
      var accountName = account.name || "Unknown";
      var institution = account.institution_name || "Unknown";

      var holdingsResp = await this.withRetry(
        () => this.client.accountInformation.getUserHoldings({
          userId: userId,
          userSecret: userSecret,
          accountId: accountId,
        }),
        `getUserHoldings(${accountName})`
      );

      var positions = (holdingsResp.data && holdingsResp.data.positions) || [];

      for (var j = 0; j < positions.length; j++) {
        var pos = positions[j];
        var symbolData = pos.symbol && pos.symbol.symbol;

        if (!symbolData) continue;

        var rawSymbol = symbolData.raw_symbol || symbolData.symbol;
        var typeCode = symbolData.type && symbolData.type.code;
        var cashEquivalent = pos.cash_equivalent || false;

        var units = pos.units || pos.fractional_units || 0;
        if (units === 0) continue;

        var assetType = this.mapTypeCode(typeCode, cashEquivalent);
        var normalizedSymbol = this.normalizeSymbol(rawSymbol);
        var source = "snaptrade-" + institution.toLowerCase();
        var price = pos.price || 0;

        var avgPurchasePrice = pos.average_purchase_price || 0;
        var openPnl = pos.open_pnl || 0;
        var costBasis = avgPurchasePrice * units;

        var key = normalizedSymbol + ":" + assetType + ":" + source;

        if (holdingsMap[key]) {
          var existing = holdingsMap[key];
          var totalCostBasis = existing.costBasis + costBasis;
          var totalUnits = existing.quantity + units;
          existing.quantity = totalUnits;
          existing.costBasis = totalCostBasis;
          existing.openPnl += openPnl;
          existing.avgPurchasePrice = totalUnits > 0 ? totalCostBasis / totalUnits : 0;
        } else {
          holdingsMap[key] = {
            symbol: normalizedSymbol,
            quantity: units,
            type: assetType,
            price: price,
            source: source,
            accountName: accountName,
            costBasis: costBasis,
            avgPurchasePrice: avgPurchasePrice,
            openPnl: openPnl,
          };
        }
      }
    }

    var holdings = [];
    for (var k in holdingsMap) {
      if (holdingsMap.hasOwnProperty(k)) {
        var h = holdingsMap[k];
        if (h.costBasis > 0) {
          h.gainLossPercent = ((h.quantity * h.price) - h.costBasis) / h.costBasis * 100;
        } else {
          h.gainLossPercent = 0;
        }
        holdings.push(h);
      }
    }

    return holdings;
  }

  async fetchPrice(symbol) {
    throw new Error("SnapTrade does not support individual price fetching - use TwelveData");
  }
}

module.exports = SnapTradeProvider;
