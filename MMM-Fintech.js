Module.register("MMM-Fintech", {
  defaults: {
    priceUpdateInterval: 5 * 60 * 1000,
    showLastUpdated: true,
    sortBy: "value",
    title: "Holdings"
  },

  start: function () {
    Log.info("Starting module: " + this.name);
    this.holdings = [];
    this.totalValue = 0;
    this.lastUpdated = null;
    this.hasError = false;

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

    var titleSpan = document.createElement("span");
    titleSpan.innerHTML = this.config.title;
    header.appendChild(titleSpan);

    if (this.hasError) {
      var errorSpan = document.createElement("span");
      errorSpan.className = "mmm-fintech-error";
      errorSpan.innerHTML = " ⚠ check logs";
      header.appendChild(errorSpan);
    }

    wrapper.appendChild(header);

    if (!this.holdings.length) {
      var empty = document.createElement("div");
      empty.className = "dimmed xsmall";
      empty.innerHTML = "Loading holdings...";
      wrapper.appendChild(empty);
      return wrapper;
    }

    var table = document.createElement("table");
    table.className = "xsmall mmm-fintech-table";

    var headerRow = document.createElement("tr");
    headerRow.innerHTML = "<th></th><th class='mmm-fintech-qty-header'>Qty</th><th class='mmm-fintech-value-header'>Value</th><th class='mmm-fintech-change-header'>24h</th>";
    table.appendChild(headerRow);

    var sortedHoldings = this.sortHoldings(this.holdings);

    for (var i = 0; i < sortedHoldings.length; i++) {
      var h = sortedHoldings[i];
      var row = document.createElement("tr");

      var symbolCell = document.createElement("td");
      symbolCell.className = "mmm-fintech-symbol";
      symbolCell.innerHTML = h.symbol;

      var qtyCell = document.createElement("td");
      qtyCell.className = "mmm-fintech-qty";
      qtyCell.innerHTML = this.formatQuantity(h.quantity);

      var valueCell = document.createElement("td");
      valueCell.className = "mmm-fintech-value";
      valueCell.innerHTML = this.formatCurrency(h.value);

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

      row.appendChild(symbolCell);
      row.appendChild(qtyCell);
      row.appendChild(valueCell);
      row.appendChild(changeCell);
      table.appendChild(row);
    }

    wrapper.appendChild(table);

    var totalDiv = document.createElement("div");
    totalDiv.className = "mmm-fintech-total";
    totalDiv.innerHTML = "Total: " + this.formatCurrency(this.totalValue);
    wrapper.appendChild(totalDiv);

    if (this.config.showLastUpdated && this.lastUpdated) {
      var footer = document.createElement("div");
      footer.className = "dimmed xsmall mmm-fintech-footer";
      footer.innerHTML = "Updated: " + this.formatTime(this.lastUpdated);
      wrapper.appendChild(footer);
    }

    return wrapper;
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

  formatTime: function (isoString) {
    var date = new Date(isoString);
    return date.toLocaleString();
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === "MMM-FINTECH_DATA") {
      this.holdings = payload.holdings || [];
      this.totalValue = payload.totalValue || 0;
      this.lastUpdated = payload.lastUpdated || null;
      this.hasError = payload.hasError || false;
      this.updateDom();
    }
  }
});
