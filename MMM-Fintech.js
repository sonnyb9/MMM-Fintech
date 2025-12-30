Module.register("MMM-Fintech", {
  defaults: {
    cryptoPriceUpdateInterval: 5 * 60 * 1000,
    stockPriceUpdateInterval: 20 * 60 * 1000,
    showLastUpdated: true,
    showPricePerUnit: true,
    showForex: true,
    sortBy: "value",
    title: "Portfolio",
    holdingsSyncTime: "07:45",
    staleHoldingsThreshold: 25 * 60 * 60 * 1000,
    stalePricesThreshold: 65 * 60 * 1000,
    maxRetries: 6
  },

  start: function () {
    Log.info("Starting module: " + this.name);
    this.holdings = [];
    this.forex = [];
    this.totalValue = 0;
    this.lastUpdated = null;
    this.lastPriceUpdate = null;
    this.hasError = false;
    this.invalidSymbols = [];
    this.rateLimitedSymbols = [];

    this.sendSocketNotification("MMM-FINTECH_INIT", {
      config: this.config
    });

    var self = this;
    setTimeout(function () {
      self.sendSocketNotification("MMM-FINTECH_SYNC", {});
    }, 5000);
  },

  getStyles: function () {
    return ["MMM-Fintech.css"];
  },

  getDom: function () {
    var wrapper = document.createElement("div");
    wrapper.className = "mmm-fintech";

    var header = document.createElement("div");
    header.className = "mmm-fintech-header";
    header.innerHTML = this.config.title;
    wrapper.appendChild(header);

    if (!this.holdings.length) {
      var empty = document.createElement("div");
      empty.className = "dimmed xsmall";
      empty.innerHTML = "Loading holdings...";
      wrapper.appendChild(empty);
      return wrapper;
    }

    wrapper.appendChild(this.buildHoldingsTable());

    var totalDiv = document.createElement("div");
    totalDiv.className = "mmm-fintech-total";
    totalDiv.innerHTML = "Total: " + this.formatCurrency(this.totalValue);
    wrapper.appendChild(totalDiv);

    if (this.config.showForex && this.forex && this.forex.length > 0) {
      wrapper.appendChild(this.buildForexSection());
    }

    var warningData = this.getWarnings();
    var isStale = this.isDataStale();

    if (this.config.showLastUpdated && this.lastUpdated) {
      var timestampDiv = document.createElement("div");
      timestampDiv.className = "dimmed xsmall mmm-fintech-timestamp";
      if (isStale) {
        timestampDiv.classList.add("stale");
      }
      timestampDiv.innerHTML = "Updated: " + this.formatTime(this.lastUpdated);
      wrapper.appendChild(timestampDiv);
    }

    if (warningData.messages.length > 0) {
      var footer = document.createElement("div");
      footer.className = "xsmall mmm-fintech-footer-warnings " + warningData.severity;
      footer.innerHTML = warningData.messages.join(" • ");
      wrapper.appendChild(footer);
    }

    return wrapper;
  },

  buildHoldingsTable: function () {
    var table = document.createElement("table");
    table.className = "xsmall mmm-fintech-table";

    var headerRow = document.createElement("tr");
    var headerHtml = "<th></th><th class='mmm-fintech-qty-header'>Qty</th>";
    if (this.config.showPricePerUnit) {
      headerHtml += "<th class='mmm-fintech-price-header'>Price</th>";
    }
    headerHtml += "<th class='mmm-fintech-value-header'>Value</th><th class='mmm-fintech-change-header'>24h</th>";
    headerRow.innerHTML = headerHtml;
    table.appendChild(headerRow);

    var sortedHoldings = this.sortHoldings(this.holdings);

    for (var i = 0; i < sortedHoldings.length; i++) {
      var h = sortedHoldings[i];
      var row = document.createElement("tr");

      var symbolCell = document.createElement("td");
      symbolCell.className = "mmm-fintech-symbol";
      symbolCell.innerHTML = h.symbol;
      row.appendChild(symbolCell);

      var qtyCell = document.createElement("td");
      qtyCell.className = "mmm-fintech-qty";
      qtyCell.innerHTML = this.formatQuantity(h.quantity);
      row.appendChild(qtyCell);

      if (this.config.showPricePerUnit) {
        var priceCell = document.createElement("td");
        priceCell.className = "mmm-fintech-price";
        priceCell.innerHTML = this.formatCurrency(h.price || 0);
        row.appendChild(priceCell);
      }

      var valueCell = document.createElement("td");
      valueCell.className = "mmm-fintech-value";
      valueCell.innerHTML = this.formatCurrency(h.value);
      row.appendChild(valueCell);

      var changeCell = document.createElement("td");
      changeCell.className = "mmm-fintech-change";
      if (h.change24h > 0) {
        changeCell.classList.add("positive");
        changeCell.innerHTML = "+" + h.change24h.toFixed(2) + "%";
      } else if (h.change24h < 0) {
        changeCell.classList.add("negative");
        changeCell.innerHTML = h.change24h.toFixed(2) + "%";
      } else {
        changeCell.innerHTML = "0.00%";
      }
      row.appendChild(changeCell);

      table.appendChild(row);
    }

    return table;
  },

  buildForexSection: function () {
    var section = document.createElement("div");
    section.className = "mmm-fintech-forex-section";

    var header = document.createElement("div");
    header.className = "mmm-fintech-forex-header";
    header.innerHTML = "Exchange Rates";
    section.appendChild(header);

    var table = document.createElement("table");
    table.className = "xsmall mmm-fintech-forex-table";

    for (var i = 0; i < this.forex.length; i++) {
      var fx = this.forex[i];

      if (fx.error) {
        continue;
      }

      var row = document.createElement("tr");

      var pairCell = document.createElement("td");
      pairCell.className = "mmm-fintech-forex-pair";
      pairCell.innerHTML = fx.pair;
      row.appendChild(pairCell);

      var rateCell = document.createElement("td");
      rateCell.className = "mmm-fintech-forex-rate";
      rateCell.innerHTML = this.formatForexRate(fx.rate);
      row.appendChild(rateCell);

      var changeCell = document.createElement("td");
      changeCell.className = "mmm-fintech-forex-change";
      var change = fx.change24h || 0;
      if (change > 0) {
        changeCell.classList.add("positive");
        changeCell.innerHTML = "+" + change.toFixed(2) + "%";
      } else if (change < 0) {
        changeCell.classList.add("negative");
        changeCell.innerHTML = change.toFixed(2) + "%";
      } else {
        changeCell.innerHTML = "0.00%";
      }
      row.appendChild(changeCell);

      table.appendChild(row);
    }

    section.appendChild(table);
    return section;
  },

  isDataStale: function () {
    if (!this.lastUpdated || !this.lastPriceUpdate) {
      return false;
    }

    var now = new Date();
    var holdingsAge = now - new Date(this.lastUpdated);
    var pricesAge = now - new Date(this.lastPriceUpdate);

    var holdingsStale = holdingsAge > this.config.staleHoldingsThreshold;
    var pricesStale = pricesAge > this.config.stalePricesThreshold;

    return holdingsStale || pricesStale;
  },

  getWarnings: function () {
    var warnings = [];
    var severity = "warning";

    if (this.invalidSymbols && this.invalidSymbols.length > 0) {
      if (this.invalidSymbols.length === 1) {
        warnings.push("⚠ Invalid symbol '" + this.invalidSymbols[0] + "' in manual holdings");
      } else {
        warnings.push("⚠ " + this.invalidSymbols.length + " invalid symbols: " + this.invalidSymbols.join(", "));
      }
      severity = "error";
    }

    if (this.rateLimitedSymbols && this.rateLimitedSymbols.length > 0) {
      warnings.push("⚠ Rate limit hit for " + this.rateLimitedSymbols.length + " symbol(s)");
      severity = "error";
    }

    if (this.isDataStale()) {
      var now = new Date();
      var holdingsAge = (now - new Date(this.lastUpdated)) / (60 * 60 * 1000);
      var pricesAge = (now - new Date(this.lastPriceUpdate)) / (60 * 1000);

      if (holdingsAge > 48) {
        warnings.push("⚠ Holdings data is " + holdingsAge.toFixed(1) + " hours old");
        severity = "critical";
      } else if (holdingsAge > 25) {
        warnings.push("⚠ Holdings data is " + holdingsAge.toFixed(1) + " hours old");
        severity = "warning";
      }

      if (pricesAge > 120) {
        warnings.push("⚠ Price updates failing");
        if (severity !== "critical") {
          severity = "error";
        }
      }
    }

    if (this.hasError && warnings.length === 0) {
      warnings.push("⚠ API errors detected, check logs");
      severity = "error";
    }

    return { messages: warnings, severity: severity };
  },

  sortHoldings: function (holdings) {
    var self = this;
    var sorted = holdings.slice();

    if (self.config.sortBy === "value") {
      sorted.sort(function (a, b) {
        return (b.value || 0) - (a.value || 0);
      });
    } else {
      sorted.sort(function (a, b) {
        return a.symbol.localeCompare(b.symbol);
      });
    }

    return sorted;
  },

  formatQuantity: function (qty) {
    if (qty >= 1) {
      return qty.toFixed(4);
    }
    return qty.toPrecision(4);
  },

  formatCurrency: function (value) {
    return "$" + value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  },

  formatForexRate: function (rate) {
    if (rate >= 100) {
      return rate.toFixed(2);
    } else if (rate >= 1) {
      return rate.toFixed(4);
    }
    return rate.toFixed(6);
  },

  formatTime: function (isoString) {
    var date = new Date(isoString);
    return date.toLocaleString();
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === "MMM-FINTECH_DATA") {
      this.holdings = payload.holdings || [];
      this.forex = payload.forex || [];
      this.totalValue = payload.totalValue || 0;
      this.lastUpdated = payload.lastUpdated || null;
      this.lastPriceUpdate = payload.lastPriceUpdate || null;
      this.hasError = payload.hasError || false;
      this.invalidSymbols = payload.invalidSymbols || [];
      this.rateLimitedSymbols = payload.rateLimitedSymbols || [];
      this.updateDom();
    }
  }
});
