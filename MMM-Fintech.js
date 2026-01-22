Module.register("MMM-Fintech", {
  defaults: {
    cryptoPriceUpdateInterval: 5 * 60 * 1000,
    stockPriceUpdateInterval: 20 * 60 * 1000,
    showLastUpdated: true,
    showPricePerUnit: true,
    showQuantity: true,
    showGainLoss: true,
    showForex: true,
    showInverseForex: true,
    showCharts: false,
    chartMode: "combined",
    chartPeriod: "1M",
    showPeriodSelector: false,
    historyRetention: 1825,
    hourlyRetention: 720,
    cryptoAsForex: [],
    sortBy: "value",
    title: "Portfolio",
    holdingsSyncTime: "07:45",
    staleHoldingsThreshold: 25 * 60 * 60 * 1000,
    stalePricesThreshold: 65 * 60 * 1000,
    maxRetries: 6,
    currency: "USD",
    currencyStyle: "symbol",
    fontSize: 100,
    displayMode: "table",
    tickerSpeed: 50,
    tickerPause: 0,
    marketHours: {
      stock: {
        enabled: true,
        timezone: "America/New_York",
        open: "09:30",
        close: "16:00",
        days: [1, 2, 3, 4, 5],
        postClosePoll: true
      },
      etf: {
        enabled: true,
        timezone: "America/New_York",
        open: "09:30",
        close: "16:00",
        days: [1, 2, 3, 4, 5],
        postClosePoll: true
      },
      mutual_fund: {
        enabled: true,
        timezone: "America/New_York",
        open: "09:30",
        close: "16:00",
        days: [1, 2, 3, 4, 5],
        postClosePoll: true
      },
      forex: {
        enabled: true,
        timezone: "America/New_York",
        sundayOpen: "17:00",
        fridayClose: "17:00"
      }
    }
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
    this.totalCostBasis = 0;
    this.totalGainLossPercent = null;
    this.totalChange24h = null;
    this.lastUpdated = null;
    this.lastPriceUpdate = null;
    this.hasError = false;
    this.invalidSymbols = [];
    this.rateLimitedSymbols = [];
    this.chartData = [];
    this.chartInstance = null;
    this.cryptoChartInstance = null;
    this.selectedPeriod = this.config.chartPeriod;
    this.marketStatus = {};
    this.tickerAnimationId = null;

    this.sendSocketNotification("MMM-FINTECH_INIT", {
      config: this.config
    });

    var self = this;
    setTimeout(function () {
      self.sendSocketNotification("MMM-FINTECH_SYNC", {});
    }, 5000);
  },

  notificationReceived: function (notification, payload, sender) {
    if (notification === "NEW_PAGE" && this.config.displayMode === "ticker") {
      var self = this;
      setTimeout(function () {
        self.startTickerAnimation();
      }, 200);
    }
  },

  getStyles: function () {
    return ["MMM-Fintech.css"];
  },

  getScripts: function () {
    return ["https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"];
  },

  getColumnCount: function () {
    var count = 2;
    if (this.config.showQuantity) count += 2;
    if (this.config.showPricePerUnit) count += 1;
    if (this.config.showGainLoss) count += 1;
    return count;
  },

  getDom: function () {
    var wrapper = document.createElement("div");
    wrapper.className = "mmm-fintech";
    wrapper.style.fontSize = this.config.fontSize + "%";

    var displayHoldings = this.getDisplayHoldings();

    if (!displayHoldings.length && !this.cryptoForex.length) {
      var header = document.createElement("div");
      header.className = "mmm-fintech-header";
      header.innerHTML = this.config.title;
      wrapper.appendChild(header);

      var empty = document.createElement("div");
      empty.className = "dimmed";
      empty.innerHTML = "Loading holdings...";
      wrapper.appendChild(empty);
      return wrapper;
    }

    if (this.config.displayMode === "ticker") {
      return this.buildTickerDom(wrapper, displayHoldings);
    }

    return this.buildTableDom(wrapper, displayHoldings);
  },

  buildTableDom: function (wrapper, displayHoldings) {
    var header = document.createElement("div");
    header.className = "mmm-fintech-header";
    header.innerHTML = this.config.title;
    wrapper.appendChild(header);

    var table = document.createElement("table");
    table.className = "mmm-fintech-table";

    if (displayHoldings.length > 0) {
      this.buildHoldingsRows(table, displayHoldings);
      if (this.config.showQuantity) {
        this.buildTotalRow(table);
      }
    }

    wrapper.appendChild(table);

    var forexToShow = this.getDisplayForex();
    if (this.config.showForex && forexToShow.length > 0) {
      var forexSection = this.buildForexSection(forexToShow);
      wrapper.appendChild(forexSection);
    }

    if (this.config.showCharts && this.chartData.length > 0) {
      var chartSection = this.buildChartSection();
      wrapper.appendChild(chartSection);
    }

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

  buildTickerDom: function (wrapper, displayHoldings) {
    wrapper.className = "mmm-fintech mmm-fintech-ticker-wrapper";

    var tickerContainer = document.createElement("div");
    tickerContainer.className = "mmm-fintech-ticker-container";

    var tickerTrack = document.createElement("div");
    tickerTrack.className = "mmm-fintech-ticker-track";

    var totalChange = this.totalChange24h;
    var totalItem = document.createElement("span");
    totalItem.className = "mmm-fintech-ticker-item mmm-fintech-ticker-total";
    var totalChangeClass = totalChange > 0 ? "positive" : totalChange < 0 ? "negative" : "";
    var totalChangeStr = totalChange !== null ? this.formatChangePercent(totalChange) : "";
    totalItem.innerHTML = "<span class='ticker-symbol'>Portfolio:</span> " +
      "<span class='ticker-price'>" + this.formatCurrency(this.totalValue) + "</span> " +
      "<span class='ticker-change " + totalChangeClass + "'>" + totalChangeStr + "</span>";
    tickerTrack.appendChild(totalItem);

    var sortedHoldings = this.sortHoldings(displayHoldings);

    for (var i = 0; i < sortedHoldings.length; i++) {
      var h = sortedHoldings[i];
      var item = document.createElement("span");
      item.className = "mmm-fintech-ticker-item";

      var change = h.change24h || 0;
      var changeClass = change > 0 ? "positive" : change < 0 ? "negative" : "";
      var changeStr = this.formatChangePercent(change);

      var isClosed = this.isMarketClosedForHolding(h);
      var closedIndicator = isClosed ? " <span class='ticker-closed'>(Closed)</span>" : "";

      item.innerHTML = "<span class='ticker-symbol'>" + h.symbol + ":</span> " +
        "<span class='ticker-price'>" + this.formatCurrency(h.price || 0) + "</span> " +
        "<span class='ticker-change " + changeClass + "'>" + changeStr + "</span>" +
        closedIndicator;

      tickerTrack.appendChild(item);
    }

    var forexToShow = this.getDisplayForex();
    if (this.config.showForex && forexToShow.length > 0) {
      for (var j = 0; j < forexToShow.length; j++) {
        var fx = forexToShow[j];
        var fxItem = document.createElement("span");
        fxItem.className = "mmm-fintech-ticker-item mmm-fintech-ticker-forex";

        var fxChange = fx.change24h || 0;
        var fxChangeClass = fxChange > 0 ? "positive" : fxChange < 0 ? "negative" : "";
        var fxChangeStr = this.formatChangePercent(fxChange);

        fxItem.innerHTML = "<span class='ticker-symbol'>" + fx.pair + ":</span> " +
          "<span class='ticker-price'>" + this.formatForexRate(fx.rate) + "</span> " +
          "<span class='ticker-change " + fxChangeClass + "'>" + fxChangeStr + "</span>";

        tickerTrack.appendChild(fxItem);
      }
    }

    var tickerContent = tickerTrack.cloneNode(true);
    tickerContent.className = "mmm-fintech-ticker-track mmm-fintech-ticker-track-clone";
    
    tickerContainer.appendChild(tickerTrack);
    tickerContainer.appendChild(tickerContent);
    wrapper.appendChild(tickerContainer);

    if (this.config.showCharts && this.chartData.length > 0) {
      var chartSection = this.buildChartSection();
      wrapper.appendChild(chartSection);
    }

    var self = this;
    setTimeout(function () {
      self.startTickerAnimation();
    }, 100);

    return wrapper;
  },

  isMarketClosedForHolding: function (holding) {
    var holdingType = holding.type || "crypto";

    if (holdingType === "crypto") {
      return false;
    }

    if (this.marketStatus && this.marketStatus[holdingType] !== undefined) {
      return !this.marketStatus[holdingType];
    }

    return false;
  },

  formatChangePercent: function (change) {
    if (change === null || change === undefined) {
      return "";
    }
    var arrow = change > 0 ? "▲" : change < 0 ? "▼" : "";
    var sign = change > 0 ? "+" : "";
    return arrow + sign + change.toFixed(2) + "%";
  },

  startTickerAnimation: function () {
    var container = document.querySelector(".mmm-fintech-ticker-container");
    var track = document.querySelector(".mmm-fintech-ticker-track");

    if (!container || !track) {
      return;
    }

    var trackWidth = track.scrollWidth;
    if (trackWidth === 0) {
      return;
    }

    var speed = this.config.tickerSpeed;
    var duration = (trackWidth / speed);

    var tracks = document.querySelectorAll(".mmm-fintech-ticker-track, .mmm-fintech-ticker-track-clone");
    tracks.forEach(function(t) {
      t.style.animationDuration = duration + "s";
    });
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
    var result = [];

    for (var i = 0; i < this.forex.length; i++) {
      var fx = this.forex[i];
      if (fx.error) continue;
      if (fx.isInverse) continue;
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
    if (this.config.showGainLoss) {
      headerHtml += "<th class='mmm-fintech-gainloss-header'>G/L</th>";
    }
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

      if (this.config.showGainLoss) {
        var gainLossCell = document.createElement("td");
        gainLossCell.className = "mmm-fintech-gainloss";
        if (h.gainLossPercent !== null && h.gainLossPercent !== undefined) {
          if (h.gainLossPercent > 0) {
            gainLossCell.classList.add("positive");
            gainLossCell.innerHTML = "+" + h.gainLossPercent.toFixed(2) + "%";
          } else if (h.gainLossPercent < 0) {
            gainLossCell.classList.add("negative");
            gainLossCell.innerHTML = h.gainLossPercent.toFixed(2) + "%";
          } else {
            gainLossCell.innerHTML = "0.00%";
          }
        } else {
          gainLossCell.innerHTML = "—";
        }
        row.appendChild(gainLossCell);
      }

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

    if (this.config.showGainLoss) {
      var totalGainLossCell = document.createElement("td");
      totalGainLossCell.className = "mmm-fintech-total-gainloss";
      if (this.totalGainLossPercent !== null && this.totalGainLossPercent !== undefined) {
        if (this.totalGainLossPercent > 0) {
          totalGainLossCell.classList.add("positive");
          totalGainLossCell.innerHTML = "+" + this.totalGainLossPercent.toFixed(2) + "%";
        } else if (this.totalGainLossPercent < 0) {
          totalGainLossCell.classList.add("negative");
          totalGainLossCell.innerHTML = this.totalGainLossPercent.toFixed(2) + "%";
        } else {
          totalGainLossCell.innerHTML = "0.00%";
        }
      } else {
        totalGainLossCell.innerHTML = "";
      }
      row.appendChild(totalGainLossCell);
    }

    table.appendChild(row);
  },

  buildForexSection: function (forexData) {
    var section = document.createElement("div");
    section.className = "mmm-fintech-forex-section";

    var title = document.createElement("div");
    title.className = "mmm-fintech-forex-title";
    title.innerHTML = "Exchange Rates";
    section.appendChild(title);

    var table = document.createElement("table");
    table.className = "mmm-fintech-table mmm-fintech-forex-table";

    var showInverse = this.config.showInverseForex;

    var headerRow = document.createElement("tr");
    var headerHtml = "<th>Currencies</th>";
    if (showInverse) {
      headerHtml += "<th class='mmm-fintech-forex-inverse-header'>Inverse</th>";
    }
    headerHtml += "<th class='mmm-fintech-forex-rate-header'>Rate</th>";
    headerHtml += "<th class='mmm-fintech-forex-change-header'>24h</th>";
    headerRow.innerHTML = headerHtml;
    table.appendChild(headerRow);

    for (var i = 0; i < forexData.length; i++) {
      var fx = forexData[i];
      var row = document.createElement("tr");

      var pairCell = document.createElement("td");
      pairCell.className = "mmm-fintech-forex-pair";
      pairCell.innerHTML = fx.pair;
      row.appendChild(pairCell);

      if (showInverse) {
        var inverseCell = document.createElement("td");
        inverseCell.className = "mmm-fintech-forex-inverse";
        if (fx.rate > 0) {
          inverseCell.innerHTML = this.formatForexRate(1 / fx.rate);
        }
        row.appendChild(inverseCell);
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

  buildChartSection: function () {
    var self = this;
    var section = document.createElement("div");
    section.className = "mmm-fintech-chart-section";

    if (this.config.showPeriodSelector) {
      var periodSelector = document.createElement("div");
      periodSelector.className = "mmm-fintech-period-selector";

      var periods = ["1D", "1W", "1M", "3M", "1Y", "All"];
      for (var i = 0; i < periods.length; i++) {
        var period = periods[i];
        var btn = document.createElement("span");
        btn.className = "mmm-fintech-period-btn";
        btn.innerHTML = period;
        btn.dataset.period = period;
        if (period.toLowerCase() === this.selectedPeriod.toLowerCase()) {
          btn.classList.add("active");
        }
        periodSelector.appendChild(btn);
      }
      section.appendChild(periodSelector);
    }

    var chartMode = this.config.chartMode;

    if (chartMode === "combined") {
      var chartContainer = document.createElement("div");
      chartContainer.className = "mmm-fintech-chart-container";
      var canvas = document.createElement("canvas");
      canvas.id = "mmm-fintech-chart-main";
      chartContainer.appendChild(canvas);
      section.appendChild(chartContainer);
    } else if (chartMode === "separate") {
      var tradContainer = document.createElement("div");
      tradContainer.className = "mmm-fintech-chart-container";
      var tradLabel = document.createElement("div");
      tradLabel.className = "mmm-fintech-chart-label";
      tradLabel.innerHTML = "Traditional";
      tradContainer.appendChild(tradLabel);
      var tradCanvas = document.createElement("canvas");
      tradCanvas.id = "mmm-fintech-chart-traditional";
      tradContainer.appendChild(tradCanvas);
      section.appendChild(tradContainer);

      var cryptoContainer = document.createElement("div");
      cryptoContainer.className = "mmm-fintech-chart-container mmm-fintech-chart-crypto";
      var cryptoLabel = document.createElement("div");
      cryptoLabel.className = "mmm-fintech-chart-label";
      cryptoLabel.innerHTML = "Crypto";
      cryptoContainer.appendChild(cryptoLabel);
      var cryptoCanvas = document.createElement("canvas");
      cryptoCanvas.id = "mmm-fintech-chart-crypto";
      cryptoContainer.appendChild(cryptoCanvas);
      section.appendChild(cryptoContainer);
    } else {
      var container = document.createElement("div");
      container.className = "mmm-fintech-chart-container";
      var tradOnlyCanvas = document.createElement("canvas");
      tradOnlyCanvas.id = "mmm-fintech-chart-main";
      container.appendChild(tradOnlyCanvas);
      section.appendChild(container);
    }

    var renderSelf = this;
    setTimeout(function () {
      renderSelf.renderCharts();
    }, 100);

    return section;
  },

  renderCharts: function () {
    var chartMode = this.config.chartMode;
    var data = this.chartData;

    if (!data || data.length === 0) {
      return;
    }

    if (chartMode === "combined") {
      this.renderChart("mmm-fintech-chart-main", data, "totalValue", "Portfolio Value");
    } else if (chartMode === "separate") {
      this.renderChart("mmm-fintech-chart-traditional", data, "traditionalValue", "Traditional");
      this.renderChart("mmm-fintech-chart-crypto", data, "cryptoValue", "Crypto", true);
    } else {
      this.renderChart("mmm-fintech-chart-main", data, "traditionalValue", "Traditional Investments");
    }
  },

  renderChart: function (canvasId, data, valueKey, label, isCrypto) {
    var self = this;
    var canvas = document.getElementById(canvasId);
    if (!canvas) {
      return;
    }

    var ctx = canvas.getContext("2d");

    var labels = [];
    var values = [];
    var isHourly = data.length > 0 && data[0].timestamp;

    for (var i = 0; i < data.length; i++) {
      var point = data[i];
      if (isHourly) {
        var dt = new Date(point.timestamp);
        labels.push(this.formatChartLabel(dt, data.length, true));
      } else {
        labels.push(this.formatChartLabel(new Date(point.date), data.length, false));
      }
      values.push(point[valueKey] || 0);
    }

    var firstValue = values[0] || 0;
    var lastValue = values[values.length - 1] || 0;
    var periodChange = firstValue > 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;

    var costBasis = this.getCostBasisForChart(valueKey, isCrypto);

    var gradientColor = isCrypto ? "rgba(255, 165, 0, " : "rgba(100, 200, 100, ";
    var lineColor = isCrypto ? "rgba(255, 165, 0, 1)" : "rgba(100, 200, 100, 1)";

    var gradient = ctx.createLinearGradient(0, 0, 0, canvas.height || 150);
    gradient.addColorStop(0, gradientColor + "0.4)");
    gradient.addColorStop(1, gradientColor + "0.05)");

    var existingChart = isCrypto ? this.cryptoChartInstance : this.chartInstance;
    if (existingChart) {
      existingChart.destroy();
    }

    var datasets = [{
      label: label,
      data: values,
      fill: true,
      backgroundColor: gradient,
      borderColor: lineColor,
      borderWidth: 2,
      tension: 0.3,
      pointRadius: 0,
      pointHoverRadius: 4,
      order: 1
    }];

    if (costBasis > 0) {
      var costBasisData = new Array(values.length).fill(costBasis);
      datasets.push({
        label: "Cost Basis",
        data: costBasisData,
        fill: false,
        borderColor: "rgba(255, 255, 255, 0.4)",
        borderWidth: 1,
        borderDash: [5, 5],
        pointRadius: 0,
        pointHoverRadius: 0,
        order: 2
      });
    }

    var newChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: {
            top: 25,
            right: 10
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            mode: "index",
            intersect: false,
            filter: function(tooltipItem) {
              return tooltipItem.datasetIndex === 0;
            },
            callbacks: {
              label: function (context) {
                return "$" + context.parsed.y.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
              }
            }
          }
        },
        scales: {
          x: {
            display: true,
            grid: {
              display: false
            },
            ticks: {
              color: "#888",
              maxTicksLimit: self.getMaxTicksForPeriod(data.length, isHourly),
              maxRotation: 0,
              font: {
                size: 9
              }
            }
          },
          y: {
            display: true,
            grid: {
              color: "rgba(255, 255, 255, 0.06)",
              drawTicks: false
            },
            border: {
              display: false
            },
            ticks: {
              color: "#888",
              maxTicksLimit: 5,
              padding: 8,
              callback: function (value) {
                return self.formatYAxisValue(value);
              },
              font: {
                size: 9
              }
            }
          }
        },
        interaction: {
          mode: "nearest",
          axis: "x",
          intersect: false
        }
      },
      plugins: [{
        id: "periodChangeLabel",
        afterDraw: function(chart) {
          self.drawPeriodChangeLabel(chart, periodChange);
          if (costBasis > 0) {
            self.drawCostBasisLabel(chart, costBasis);
          }
        }
      }]
    });

    if (isCrypto) {
      this.cryptoChartInstance = newChart;
    } else {
      this.chartInstance = newChart;
    }
  },

  getCostBasisForChart: function(valueKey, isCrypto) {
    if (!this.holdings || this.holdings.length === 0) {
      return 0;
    }

    var cryptoAsForex = this.config.cryptoAsForex || [];
    var totalCostBasis = 0;
    var cryptoCostBasis = 0;
    var traditionalCostBasis = 0;

    for (var i = 0; i < this.holdings.length; i++) {
      var h = this.holdings[i];
      if (h.type === "crypto" && cryptoAsForex.indexOf(h.symbol) !== -1) {
        continue;
      }
      var cb = h.costBasis || 0;
      if (h.type === "crypto") {
        cryptoCostBasis += cb;
      } else {
        traditionalCostBasis += cb;
      }
      totalCostBasis += cb;
    }

    if (valueKey === "totalValue") {
      return totalCostBasis;
    } else if (valueKey === "cryptoValue" || isCrypto) {
      return cryptoCostBasis;
    } else {
      return traditionalCostBasis;
    }
  },

  formatChartLabel: function(date, dataLength, isHourly) {
    if (isHourly) {
      if (dataLength > 48) {
        return date.toLocaleDateString([], { month: "short", day: "numeric" }) + " " +
               date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      }
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    if (dataLength > 90) {
      return date.toLocaleDateString([], { month: "short", year: "2-digit" });
    }
    return (date.getMonth() + 1) + "/" + date.getDate();
  },

  getMaxTicksForPeriod: function(dataLength, isHourly) {
    if (dataLength <= 24) return 6;
    if (dataLength <= 48) return 6;
    if (dataLength <= 168) return 7;
    if (dataLength <= 720) return 6;
    return 6;
  },

  formatYAxisValue: function(value) {
    if (value >= 1000000) {
      return "$" + (value / 1000000).toFixed(1) + "M";
    }
    if (value >= 1000) {
      return "$" + (value / 1000).toFixed(0) + "k";
    }
    return "$" + value.toFixed(0);
  },

  drawPeriodChangeLabel: function(chart, periodChange) {
    var ctx = chart.ctx;
    var chartArea = chart.chartArea;

    var changeText = (periodChange >= 0 ? "+" : "") + periodChange.toFixed(2) + "%";
    var changeColor = periodChange >= 0 ? "rgba(100, 200, 100, 1)" : "rgba(255, 100, 100, 1)";

    ctx.save();
    ctx.font = "bold 11px Arial, sans-serif";
    ctx.fillStyle = changeColor;
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText(changeText, chartArea.right, chartArea.top - 18);
    ctx.restore();
  },

  drawCostBasisLabel: function(chart, costBasis) {
    var ctx = chart.ctx;
    var chartArea = chart.chartArea;
    var yScale = chart.scales.y;

    var yPos = yScale.getPixelForValue(costBasis);

    if (yPos < chartArea.top || yPos > chartArea.bottom) {
      return;
    }

    ctx.save();
    ctx.font = "9px Arial, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText("Cost", chartArea.left + 4, yPos - 2);
    ctx.restore();
  },

  formatChartDate: function (dateStr) {
    var date = new Date(dateStr);
    var month = date.getMonth() + 1;
    var day = date.getDate();
    return month + "/" + day;
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === "MMM-FINTECH_DATA") {
      this.holdings = payload.holdings || [];
      this.forex = payload.forex || [];
      this.cryptoForex = payload.cryptoForex || [];
      this.totalValue = payload.totalValue || 0;
      this.totalCostBasis = payload.totalCostBasis || 0;
      this.totalGainLossPercent = payload.totalGainLossPercent;
      this.totalChange24h = payload.totalChange24h || null;
      this.lastUpdated = payload.lastUpdated || null;
      this.lastPriceUpdate = payload.lastPriceUpdate || null;
      this.hasError = payload.hasError || false;
      this.invalidSymbols = payload.invalidSymbols || [];
      this.rateLimitedSymbols = payload.rateLimitedSymbols || [];
      this.marketStatus = payload.marketStatus || {};
      this.updateDom();
    }

    if (notification === "MMM-FINTECH_HISTORY") {
      this.chartData = payload.data || [];
      if (this.config.showCharts) {
        this.updateDom();
      }
    }
  }
});
