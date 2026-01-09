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
    historyRetention: 1825,
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
    this.lastUpdated = null;
    this.lastPriceUpdate = null;
    this.hasError = false;
    this.invalidSymbols = [];
    this.rateLimitedSymbols = [];
    this.chartData = [];
    this.chartInstance = null;
    this.cryptoChartInstance = null;
    this.selectedPeriod = this.config.chartPeriod;

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
      if (this.config.showQuantity) {
        this.buildTotalRow(table);
      }
    }

    var forexToShow = this.getDisplayForex();
    if (this.config.showForex && forexToShow.length > 0) {
      this.buildForexRows(table, forexToShow);
    }

    wrapper.appendChild(table);

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

  buildForexRows: function (table, forexData) {
    var colCount = this.getColumnCount();
    var showInverse = this.config.showInverseForex;

    var titleRow = document.createElement("tr");
    titleRow.className = "mmm-fintech-forex-title-row";
    var titleCell = document.createElement("td");
    titleCell.colSpan = colCount;
    titleCell.className = "mmm-fintech-forex-title";
    titleCell.innerHTML = "Exchange Rates";
    titleRow.appendChild(titleCell);
    table.appendChild(titleRow);

    var headerRow = document.createElement("tr");
    headerRow.className = "mmm-fintech-forex-header-row";
    var headerHtml = "<th>Currencies</th>";
    if (this.config.showQuantity) {
      if (showInverse) {
        headerHtml += "<th class='mmm-fintech-forex-inverse-header'>Inverse</th>";
      } else {
        headerHtml += "<th></th>";
      }
    }
    if (this.config.showPricePerUnit) {
      headerHtml += "<th></th>";
    }
    headerHtml += "<th class='mmm-fintech-forex-rate-header'>Rate</th>";
    headerHtml += "<th class='mmm-fintech-forex-change-header'>24h</th>";
    if (this.config.showGainLoss) {
      headerHtml += "<th></th>";
    }
    headerRow.innerHTML = headerHtml;
    table.appendChild(headerRow);

    for (var i = 0; i < forexData.length; i++) {
      var fx = forexData[i];
      var row = document.createElement("tr");

      var pairCell = document.createElement("td");
      pairCell.className = "mmm-fintech-forex-pair";
      pairCell.innerHTML = fx.pair;
      row.appendChild(pairCell);

      if (this.config.showQuantity) {
        var inverseCell = document.createElement("td");
        inverseCell.className = "mmm-fintech-forex-inverse";
        if (showInverse && fx.rate > 0) {
          inverseCell.innerHTML = this.formatForexRate(1 / fx.rate);
        }
        row.appendChild(inverseCell);
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

      if (this.config.showGainLoss) {
        var emptyGainLoss = document.createElement("td");
        row.appendChild(emptyGainLoss);
      }

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

  buildChartSection: function () {
    var self = this;
    var section = document.createElement("div");
    section.className = "mmm-fintech-chart-section";

    var periodSelector = document.createElement("div");
    periodSelector.className = "mmm-fintech-period-selector";

    var periods = ["1D", "1W", "1M", "3M", "1Y", "All"];
    for (var i = 0; i < periods.length; i++) {
      var period = periods[i];
      var btn = document.createElement("span");
      btn.className = "mmm-fintech-period-btn";
      btn.innerHTML = period;
      btn.dataset.period = period;
      if (period === this.selectedPeriod) {
        btn.classList.add("active");
      }
      periodSelector.appendChild(btn);
    }
    section.appendChild(periodSelector);

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
        labels.push(dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      } else {
        labels.push(this.formatChartDate(point.date));
      }
      values.push(point[valueKey] || 0);
    }

    var gradientColor = isCrypto ? "rgba(255, 165, 0, " : "rgba(100, 200, 100, ";
    var lineColor = isCrypto ? "rgba(255, 165, 0, 1)" : "rgba(100, 200, 100, 1)";

    var gradient = ctx.createLinearGradient(0, 0, 0, canvas.height || 150);
    gradient.addColorStop(0, gradientColor + "0.4)");
    gradient.addColorStop(1, gradientColor + "0.05)");

    var existingChart = isCrypto ? this.cryptoChartInstance : this.chartInstance;
    if (existingChart) {
      existingChart.destroy();
    }

    var newChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [{
          label: label,
          data: values,
          fill: true,
          backgroundColor: gradient,
          borderColor: lineColor,
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            mode: "index",
            intersect: false,
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
              color: "#999",
              maxTicksLimit: 6,
              font: {
                size: 10
              }
            }
          },
          y: {
            display: true,
            grid: {
              color: "rgba(255, 255, 255, 0.1)"
            },
            ticks: {
              color: "#999",
              callback: function (value) {
                if (value >= 1000) {
                  return "$" + (value / 1000).toFixed(0) + "k";
                }
                return "$" + value;
              },
              font: {
                size: 10
              }
            }
          }
        },
        interaction: {
          mode: "nearest",
          axis: "x",
          intersect: false
        }
      }
    });

    if (isCrypto) {
      this.cryptoChartInstance = newChart;
    } else {
      this.chartInstance = newChart;
    }
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
      this.lastUpdated = payload.lastUpdated || null;
      this.lastPriceUpdate = payload.lastPriceUpdate || null;
      this.hasError = payload.hasError || false;
      this.invalidSymbols = payload.invalidSymbols || [];
      this.rateLimitedSymbols = payload.rateLimitedSymbols || [];
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
