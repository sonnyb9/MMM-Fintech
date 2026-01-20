"use strict";

const path = require("path");
const fs = require("fs");
const providers = require("./providers");

async function main() {
  console.log("Testing Cost Basis & Gain/Loss Data Flow\n");
  console.log("=".repeat(80));

  var modulePath = __dirname;
  var snaptrade = providers.createProvider("snaptrade");

  if (!snaptrade.init({}, modulePath)) {
    console.log("Failed to initialize SnapTrade provider");
    process.exit(1);
  }

  console.log("\nFetching holdings with cost basis...\n");

  var holdings = await snaptrade.fetchHoldings();

  console.log("Holdings from SnapTrade:", holdings.length, "positions\n");

  var manualPath = path.join(modulePath, "manual-holdings.json");
  var manualHoldings = [];
  if (fs.existsSync(manualPath)) {
    var manualData = JSON.parse(fs.readFileSync(manualPath, "utf8"));
    manualHoldings = manualData.holdings || [];
    console.log("Manual holdings:", manualHoldings.length, "positions\n");
  }

  console.log("-".repeat(80));

  var totalValue = 0;
  var totalCostBasis = 0;

  for (var i = 0; i < holdings.length; i++) {
    var h = holdings[i];
    var value = h.quantity * h.price;
    totalValue += value;
    totalCostBasis += h.costBasis || 0;

    var gainLossStr = "";
    if (h.gainLossPercent !== undefined && h.gainLossPercent !== 0) {
      var sign = h.gainLossPercent >= 0 ? "+" : "";
      gainLossStr = sign + h.gainLossPercent.toFixed(2) + "%";
    } else {
      gainLossStr = "N/A";
    }

    console.log(
      h.symbol.padEnd(8) +
      h.type.padEnd(14) +
      "$" + value.toFixed(2).padStart(12) +
      "  Cost: $" + (h.costBasis || 0).toFixed(2).padStart(10) +
      "  G/L: " + gainLossStr.padStart(10)
    );
  }

  console.log("-".repeat(80));
  
  var totalGainLoss = totalValue - totalCostBasis;
  var totalGainLossPercent = totalCostBasis > 0 ? (totalGainLoss / totalCostBasis * 100) : 0;
  var sign = totalGainLossPercent >= 0 ? "+" : "";

  console.log("\nTotal Value:      $" + totalValue.toFixed(2));
  console.log("Total Cost Basis: $" + totalCostBasis.toFixed(2));
  console.log("Total Gain/Loss:  $" + totalGainLoss.toFixed(2) + " (" + sign + totalGainLossPercent.toFixed(2) + "%)");
}

main().catch(function(err) {
  console.error("Error:", err.message);
  process.exit(1);
});
