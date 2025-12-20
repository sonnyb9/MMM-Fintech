/* MagicMirror²
 * Node Helper: MMM-Fintech
 *
 * By sonnyb9
 * MIT Licensed.
 */

const NodeHelper = require("node_helper");
const fs = require("fs");
const path = require("path");

module.exports = NodeHelper.create({
  start: function () {
    this.log("MMM-Fintech node_helper started");
    this.dataPath = path.join(this.path, "cache.json");
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === "MMM-FINTECH_INIT") {
      this.loadCachedData();
    }
  },

  loadCachedData: function () {
    if (!fs.existsSync(this.dataPath)) {
      this.sendSocketNotification("MMM-FINTECH_DATA", {
        holdings: [],
        lastUpdated: null
      });
      return;
    }

    try {
      const raw = fs.readFileSync(this.dataPath);
      const parsed = JSON.parse(raw);

      this.sendSocketNotification("MMM-FINTECH_DATA", parsed);
    } catch (err) {
      this.log("Error reading cache:", err);
      this.sendSocketNotification("MMM-FINTECH_DATA", {
        holdings: [],
        lastUpdated: null
      });
    }
  }
});
