/* MagicMirror²
 * Module: MMM-Fintech
 *
 * By sonnyb9
 * MIT Licensed.
 */

Module.register("MMM-Fintech", {
  defaults: {
    updateInterval: 24 * 60 * 60 * 1000, // 24 hours
    showLastUpdated: true
  },

  start: function () {
    Log.info("Starting module: " + this.name);

    this.holdings = [];
    this.lastUpdated = null;

    this.sendSocketNotification("MMM-FINTECH_INIT", {
      config: this.config
    });
  },

  getStyles: function () {
    return [];
  },

  getDom: function () {
    const wrapper = document.createElement("div");

    if (!this.holdings.length) {
      wrapper.innerHTML = "MMM-Fintech: no data available";
      return wrapper;
    }

    const table = document.createElement("table");
    table.className = "small";

    this.holdings.forEach(h => {
      const row = document.createElement("tr");

      const symbol = document.createElement("td");
      symbol.innerHTML = h.symbol;

      const qty = document.createElement("td");
      qty.innerHTML = h.quantity;

      row.appendChild(symbol);
      row.appendChild(qty);
      table.appendChild(row);
    });

    wrapper.appendChild(table);

    if (this.config.showLastUpdated && this.lastUpdated) {
      const footer = document.createElement("div");
      footer.className = "dimmed small";
      footer.innerHTML = "Last updated: " + this.lastUpdated;
      wrapper.appendChild(footer);
    }

    return wrapper;
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === "MMM-FINTECH_DATA") {
      this.holdings = payload.holdings || [];
      this.lastUpdated = payload.lastUpdated || null;
      this.updateDom();
    }
  }
});
