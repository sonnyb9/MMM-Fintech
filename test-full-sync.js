"use strict";

const fs = require("fs");
const path = require("path");
const providers = require("./providers");

async function main() {
  console.log("Testing Full Holdings Sync Flow\n");
  console.log("=".repeat(60));

  var modulePath = __dirname;
  var activeProviders = {};

  console.log("\n1) Initializing providers...\n");

  var snaptrade = providers.createProvider("snaptrade");
  if (snaptrade.init({}, modulePath)) {
    activeProviders.snaptrade = snaptrade;
    console.log("   [OK] SnapTrade provider initialized");
  } else {
    console.log("   [--] SnapTrade not configured");
  }

  var coinbase = providers.createProvider("coinbase");
  if (coinbase.init({}, modulePath)) {
    activeProviders.coinbase = coinbase;
    console.log("   [OK] Coinbase provider initialized");
  } else {
    console.log("   [--] Coinbase not configured");
  }

  var twelvedata = providers.createProvider("twelvedata");
  if (twelvedata.init({}, modulePath)) {
    activeProviders.twelvedata = twelvedata;
    console.log("   [OK] TwelveData provider initialized");
  } else {
    console.log("   [--] TwelveData not configured");
  }

  console.log("\n2) Fetching holdings...\n");

  var apiHoldings = [];

  if (activeProviders.snaptrade) {
    try {
      var snapHoldings = await activeProviders.snaptrade.fetchHoldings();
      apiHoldings = apiHoldings.concat(snapHoldings);
      console.log("   SnapTrade: " + snapHoldings.length + " positions");
    } catch (err) {
      console.log("   SnapTrade error: " + err.message);
    }
  }

  if (activeProviders.coinbase && !activeProviders.snaptrade) {
    try {
      var cbHoldings = await activeProviders.coinbase.fetchHoldings();
      apiHoldings = apiHoldings.concat(cbHoldings);
      console.log("   Coinbase: " + cbHoldings.length + " positions");
    } catch (err) {
      console.log("   Coinbase error: " + err.message);
    }
  }

  var manualPath = path.join(modulePath, "manual-holdings.json");
  var manualHoldings = [];
  var forexPairs = [];

  if (fs.existsSync(manualPath)) {
    var manualData = JSON.parse(fs.readFileSync(manualPath, "utf8"));
    manualHoldings = manualData.holdings || [];
    forexPairs = manualData.forex || [];
    console.log("   Manual: " + manualHoldings.length + " holdings, " + forexPairs.length + " forex pairs");
  }

  var combined = apiHoldings.concat(manualHoldings);

  console.log("\n3) Merging holdings...\n");

  var merged = {};
  for (var i = 0; i < combined.length; i++) {
    var h = combined[i];
    var key = h.symbol + ":" + h.type;
    if (merged[key]) {
      merged[key].quantity += h.quantity;
    } else {
      merged[key] = {
        symbol: h.symbol,
        quantity: h.quantity,
        type: h.type,
        source: h.source
      };
    }
  }

  var holdings = Object.values(merged);
  console.log("   Merged into " + holdings.length + " unique holdings\n");

  console.log("4) Final Holdings:\n");
  console.log("-".repeat(60));

  var total = 0;
  for (var j = 0; j < holdings.length; j++) {
    var pos = holdings[j];
    console.log(
      "   " +
      pos.symbol.padEnd(8) +
      pos.type.padEnd(14) +
      pos.quantity.toFixed(4).padStart(14) +
      "   (" + pos.source + ")"
    );
  }

  console.log("-".repeat(60));
  console.log("\nForex pairs to fetch: " + forexPairs.map(function(f) { return f.pair; }).join(", "));
  console.log("\nDone!");
}

main().catch(function(err) {
  console.error("Error:", err);
  process.exit(1);
});
