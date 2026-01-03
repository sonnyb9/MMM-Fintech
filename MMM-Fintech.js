Module.register("MMM-Fintech", {
  defaults: {
    cryptoPriceUpdateInterval: 5 * 60 * 1000,
    stockPriceUpdateInterval: 20 * 60 * 1000,
    showLastUpdated: true,
    showPricePerUnit: true,
    showQuantity: true,
    showForex: true,
    showInverseForex: true,
    cryptoAsForex: [],
    sortBy: "value",
    title: "Portfolio",
    holdingsSyncTime: "07:45",
    staleHoldingsThreshold: 25 * 60 * 60 * 1000,
    stalePricesThreshold: 65 * 60 * 1000,
    maxRetries: 6,
    currency: "USD",
    currencyStyle: "symbol",
    fontSize: 100
  },

  currencySymbols: {
    USD: "$",
    EUR: "€",
    GBP: "£",
    JPY: "¥",
    CNY: "¥",
    PHP: "₱",
    CAD: "C$",
    AUD: "A$",
    CHF: "CHF",
    INR: "₹",
    KRW: "₩",
    MXN: "MX$",
    BRL: "R$",
    SGD: "S$",
    HKD: "HK$"
  },

  start: function () {
    Log.info("Starting module: " + this.name);
    this.holdings = [];
    this.forex = [];
    this.cryptoForex = [];
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

  getColumnCount: function () {
    var count = 2;
    if (this.config.showQuantity) count += 2;
    if (this.config.showPricePerUnit) count += 1;
    return count;
  },

  getDom: function () {
    var wrapper = document.createElement("div");
    wrapper.className = "mmm-fintech";
    wrapper.style.fontSize = this.config.fontSize + "%";

    var header = document.createElement("div");
    header.className = "mmm-fintech-header";
    header.innerHTML = this.config.title;
    wrapper.appendChild(header);

    var displayHoldings = this.getDisplayHoldings();

    if (!displayHoldings.length && !this.cryptoForex.length) {
      var empty = document.createElement("div");
      empty.className = "dimmed";
      empty.innerHTML = "Loading holdings...";
      wrapper.appendChild(empty);
      return wrapper;
    }

    var table = document.createElement("table");
    table.className = "mmm-fintech-table";

    if (displayHoldings.length > 0) {
      this.buildHoldingsRows(table, displayHoldings);
      this.buildTotalRow(table);
    }

    var forexToShow = this.getDisplayForex();
    if (this.config.showForex && forexToShow.length > 0) {
      this.buildForexRows(table, forexToShow);
    }

    wrapper.appendChild(table);

    var warningData = this.getWarnings();
    var isStale = this.isDataStale();

    if (this.config.showLastUpdated && this.lastUpdated) {
      var timestampDiv = document.createElement("div");
      timestampDiv.className = "dimmed mmm-fintech-timestamp";
      if (isStale) {
        timestampDiv.classList.add("stale");
      }
      timestampDiv.innerHTML = "Updated: " + this.formatTime(this.lastUpdated);
      wrapper.appendChild(timestampDiv);
    }

    if (warningData.messages.length > 0) {
      var footer = document.createElement("div");
      footer.className = "mmm-fintech-footer-warnings " + warningData.severity;
      footer.innerHTML = warningData.messages.join(" • ");
      wrapper.appendChild(footer);
    }

    return wrapper;
  },

  getDisplayHoldings: function () {
    var self = this;
    var cryptoAsForex = this.config.cryptoAsForex || [];

    return this.holdings.filter(function (h) {
      if (h.type === "crypto" && cryptoAsForex.indexOf(h.symbol) !== -1) {
        return false;
      }
      return true;
    });
  },

  getDisplayForex: function () {
    var self = this;
    var result = [];
    var showInverse = this.config.showInverseForex;

    for (var i = 0; i < this.forex.length; i++) {
      var fx = this.forex[i];
      if (fx.error) continue;
      if (!showInverse && fx.isInverse) continue;
      result.push(fx);
    }

    for (var j = 0; j < this.cryptoForex.length; j++) {
      result.push(this.cryptoForex[j]);
    }

    return result;
  },

  buildHoldingsRows: function (table, holdings) {
    var headerRow = document.createElement("tr");
    var headerHtml = "<th></th>";
    if (this.config.showQuantity) {
      headerHtml += "<th class='mmm-fintech-qty-header'>Qty</th>";
    }
    if (this.config.showPricePerUnit) {
      headerHtml += "<th class='mmm-fintech-price-header'>Price</th>";
    }
    if (this.config.showQuantity) {
      headerHtml += "<th class='mmm-fintech-value-header'>Value</th>";
    }
    headerHtml += "<th class='mmm-fintech-change-header'>24h</th>";
    headerRow.innerHTML = headerHtml;
    table.appendChild(headerRow);

    var sortedHoldings = this.sortHoldings(holdings);

    for (var i = 0; i < sortedHoldings.length; i++) {
      var h = sortedHoldings[i];
      var row = document.createElement("tr");

      var symbolCell = document.createElement("td");
      symbolCell.className = "mmm-fintech-symbol";
      symbolCell.innerHTML = h.symbol;
      row.appendChild(symbolCell);

      if (this.config.showQuantity) {
        var qtyCell = document.createElement("td");
        qtyCell.className = "mmm-fintech-qty";
        qtyCell.innerHTML = this.formatQuantity(h.quantity);
        row.appendChild(qtyCell);
      }

      if (this.config.showPricePerUnit) {
        var priceCell = document.createElement("td");
        priceCell.className = "mmm-fintech-price";
        priceCell.innerHTML = this.formatCurrency(h.price || 0);
        row.appendChild(priceCell);
      }

      if (this.config.showQuantity) {
        var valueCell = document.createElement("td");
        valueCell.className = "mmm-fintech-value";
        valueCell.innerHTML = this.formatCurrency(h.value);
        row.appendChild(valueCell);
      }

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
  },

  buildTotalRow: function (table) {
    var row = document.createElement("tr");
    row.className = "mmm-fintech-total-row";

    var labelCell = document.createElement("td");
    labelCell.className = "mmm-fintech-total-label";
    labelCell.innerHTML = "Total:";
    row.appendChild(labelCell);

    if (this.config.showQuantity) {
      var emptyQty = document.createElement("td");
      row.appendChild(emptyQty);
    }

    if (this.config.showPricePerUnit) {
      var emptyPrice = document.createElement("td");
      row.appendChild(emptyPrice);
    }

    var valueCell = document.createElement("td");
    valueCell.className = "mmm-fintech-total-value";
    valueCell.innerHTML = this.formatCurrency(this.totalValue);
    row.appendChild(valueCell);

    var emptyChange = document.createElement("td");
    row.appendChild(emptyChange);

    table.appendChild(row);
  },

  buildForexRows: function (table, forexData) {
    var colCount = this.getColumnCount();

    var headerRow = document.createElement("tr");
    headerRow.className = "mmm-fintech-forex-header-row";
    var headerCell = document.createElement("td");
    headerCell.colSpan = colCount;
    headerCell.className = "mmm-fintech-forex-header";
    headerCell.innerHTML = "Exchange Rates";
    headerRow.appendChild(headerCell);
    table.appendChild(headerRow);

    for (var i = 0; i < forexData.length; i++) {
      var fx = forexData[i];
      var row = document.createElement("tr");

      var pairCell = document.createElement("td");
      pairCell.className = "mmm-fintech-forex-pair";
      pairCell.innerHTML = fx.pair;
      row.appendChild(pairCell);

      if (this.config.showQuantity) {
        var emptyQty = document.createElement("td");
        row.appendChild(emptyQty);
      }

      if (this.config.showPricePerUnit) {
        var emptyPrice = document.createElement("td");
        row.appendChild(emptyPrice);
      }

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
    var currency = this.config.currency || "USD";
    var style = this.config.currencyStyle || "symbol";
    var formattedValue = value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    if (style === "symbol") {
      var symbol = this.currencySymbols[currency] || currency;
      return symbol + formattedValue;
    } else {
      return formattedValue + " " + currency;
    }
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
      this.cryptoForex = payload.cryptoForex || [];
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
