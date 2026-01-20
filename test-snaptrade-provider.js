"use strict";

const path = require("path");
const SnapTradeProvider = require("./providers/snaptrade");

async function main() {
  console.log("Testing SnapTrade Provider...\n");

  var provider = new SnapTradeProvider();
  var modulePath = __dirname;

  console.log("Initializing provider...");
  var initialized = provider.init({}, modulePath);

  if (!initialized) {
    console.error("Failed to initialize provider");
    process.exit(1);
  }

  console.log("Provider initialized successfully\n");
  console.log("Supported asset types:", provider.getAssetTypes());
  console.log("Supports holdings:", provider.supportsHoldings());
  console.log("Supports pricing:", provider.supportsPricing());

  console.log("\nFetching holdings...\n");

  try {
    var holdings = await provider.fetchHoldings();

    console.log("Holdings retrieved:", holdings.length, "positions\n");

    for (var i = 0; i < holdings.length; i++) {
      var h = holdings[i];
      var value = h.quantity * h.price;
      console.log(
        h.symbol.padEnd(8),
        h.type.padEnd(12),
        h.quantity.toFixed(4).padStart(12),
        "@",
        ("$" + h.price.toFixed(2)).padStart(10),
        "=",
        ("$" + value.toFixed(2)).padStart(12),
        "(" + h.source + ")"
      );
    }

    var total = holdings.reduce(function(sum, h) {
      return sum + h.quantity * h.price;
    }, 0);

    console.log("\nTotal value: $" + total.toFixed(2));
  } catch (err) {
    console.error("Failed to fetch holdings:", err.message);
    if (err.response) {
      console.error("Response:", err.response.status, err.response.data);
    }
    process.exit(1);
  }
}

main();
