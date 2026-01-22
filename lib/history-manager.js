"use strict";

var fs = require("fs");
var path = require("path");

function HistoryManager(modulePath, config) {
  this.historyPath = path.join(modulePath, "history.json");
  this.config = config || {};
  this.retentionDays = this.config.historyRetention || 1825;
  this.hourlyRetentionHours = this.config.hourlyRetention || 720;
  this.data = null;
}

HistoryManager.prototype.log = function(msg) {
  console.log("[MMM-Fintech:History] " + msg);
};

HistoryManager.prototype.load = function() {
  if (this.data) {
    return this.data;
  }

  if (!fs.existsSync(this.historyPath)) {
    this.data = {
      hourly: [],
      daily: []
    };
    return this.data;
  }

  try {
    var content = fs.readFileSync(this.historyPath, "utf8");
    this.data = JSON.parse(content);
    if (!this.data.hourly) {
      this.data.hourly = [];
    }
    if (!this.data.daily) {
      this.data.daily = [];
    }
    this.log("Loaded history: " + this.data.hourly.length + " hourly, " + this.data.daily.length + " daily snapshots");
  } catch (error) {
    this.log("Error loading history, starting fresh: " + error.message);
    this.data = {
      hourly: [],
      daily: []
    };
  }

  return this.data;
};

HistoryManager.prototype.save = function() {
  if (!this.data) {
    return;
  }

  try {
    fs.writeFileSync(this.historyPath, JSON.stringify(this.data, null, 2));
  } catch (error) {
    this.log("Error saving history: " + error.message);
  }
};

HistoryManager.prototype.addHourlySnapshot = function(totalValue, cryptoValue, traditionalValue) {
  this.load();

  var now = new Date();
  var timestamp = now.toISOString();
  var hourKey = timestamp.slice(0, 13);

  var lastSnapshot = this.data.hourly[this.data.hourly.length - 1];
  if (lastSnapshot) {
    var lastHourKey = lastSnapshot.timestamp.slice(0, 13);
    if (lastHourKey === hourKey) {
      lastSnapshot.totalValue = totalValue;
      lastSnapshot.cryptoValue = cryptoValue;
      lastSnapshot.traditionalValue = traditionalValue;
      lastSnapshot.timestamp = timestamp;
      this.save();
      return;
    }
  }

  this.data.hourly.push({
    timestamp: timestamp,
    totalValue: totalValue,
    cryptoValue: cryptoValue,
    traditionalValue: traditionalValue
  });

  this.pruneHourly();
  this.save();
  this.log("Added hourly snapshot: $" + totalValue.toFixed(2));
};

HistoryManager.prototype.addDailySnapshot = function(totalValue, cryptoValue, traditionalValue, holdings) {
  this.load();

  var now = new Date();
  var dateKey = now.toISOString().slice(0, 10);

  var existingIndex = -1;
  for (var i = 0; i < this.data.daily.length; i++) {
    if (this.data.daily[i].date === dateKey) {
      existingIndex = i;
      break;
    }
  }

  var holdingsSummary = {};
  if (holdings && Array.isArray(holdings)) {
    for (var j = 0; j < holdings.length; j++) {
      var h = holdings[j];
      holdingsSummary[h.symbol] = {
        quantity: h.quantity,
        price: h.price,
        value: h.value,
        type: h.type
      };
    }
  }

  var snapshot = {
    date: dateKey,
    totalValue: totalValue,
    cryptoValue: cryptoValue,
    traditionalValue: traditionalValue,
    holdings: holdingsSummary
  };

  if (existingIndex >= 0) {
    this.data.daily[existingIndex] = snapshot;
  } else {
    this.data.daily.push(snapshot);
    this.data.daily.sort(function(a, b) {
      return a.date.localeCompare(b.date);
    });
  }

  this.pruneDaily();
  this.save();
  this.log("Added daily snapshot for " + dateKey + ": $" + totalValue.toFixed(2));
};

HistoryManager.prototype.pruneHourly = function() {
  if (!this.data || !this.data.hourly.length) {
    return;
  }

  var cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - this.hourlyRetentionHours);
  var cutoffISO = cutoff.toISOString();

  var originalLength = this.data.hourly.length;
  this.data.hourly = this.data.hourly.filter(function(snapshot) {
    return snapshot.timestamp >= cutoffISO;
  });

  var pruned = originalLength - this.data.hourly.length;
  if (pruned > 0) {
    this.log("Pruned " + pruned + " hourly snapshots older than " + this.hourlyRetentionHours + " hours");
  }
};

HistoryManager.prototype.pruneDaily = function() {
  if (!this.data || !this.data.daily.length) {
    return;
  }

  var cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - this.retentionDays);
  var cutoffDate = cutoff.toISOString().slice(0, 10);

  var originalLength = this.data.daily.length;
  this.data.daily = this.data.daily.filter(function(snapshot) {
    return snapshot.date >= cutoffDate;
  });

  var pruned = originalLength - this.data.daily.length;
  if (pruned > 0) {
    this.log("Pruned " + pruned + " daily snapshots older than " + this.retentionDays + " days");
  }
};

HistoryManager.prototype.getHourlyData = function(hours) {
  this.load();

  if (!hours) {
    return this.data.hourly.slice();
  }

  var cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - hours);
  var cutoffISO = cutoff.toISOString();

  return this.data.hourly.filter(function(snapshot) {
    return snapshot.timestamp >= cutoffISO;
  });
};

HistoryManager.prototype.getDailyData = function(days) {
  this.load();

  if (!days) {
    return this.data.daily.slice();
  }

  var cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  var cutoffDate = cutoff.toISOString().slice(0, 10);

  return this.data.daily.filter(function(snapshot) {
    return snapshot.date >= cutoffDate;
  });
};

HistoryManager.prototype.getChartData = function(period) {
  var now = new Date();
  var data = [];
  var normalizedPeriod = (period || "1M").toLowerCase();

  switch (normalizedPeriod) {
    case "1d":
      data = this.getHourlyData(24);
      break;
    case "1w":
      data = this.getHourlyData(168);
      break;
    case "1m":
      var hourlyData = this.getHourlyData(720);
      if (hourlyData.length >= 48) {
        data = hourlyData;
      } else {
        data = this.getDailyData(30);
      }
      break;
    case "3m":
      data = this.getDailyData(90);
      break;
    case "1y":
      data = this.getDailyData(365);
      break;
    case "all":
      data = this.getDailyData();
      break;
    default:
      data = this.getDailyData(30);
  }

  return data;
};

HistoryManager.prototype.getStats = function() {
  this.load();

  return {
    hourlyCount: this.data.hourly.length,
    dailyCount: this.data.daily.length,
    oldestDaily: this.data.daily.length > 0 ? this.data.daily[0].date : null,
    newestDaily: this.data.daily.length > 0 ? this.data.daily[this.data.daily.length - 1].date : null,
    oldestHourly: this.data.hourly.length > 0 ? this.data.hourly[0].timestamp : null,
    newestHourly: this.data.hourly.length > 0 ? this.data.hourly[this.data.hourly.length - 1].timestamp : null
  };
};

module.exports = HistoryManager;
