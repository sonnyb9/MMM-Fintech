"use strict";

const EODHDProvider = require("./providers/eodhd");

async function test() {
  console.log("=== Testing EODHD Provider ===\n");

  var provider = new EODHDProvider();
  var initialized = provider.init({ maxRetries: 2 }, __dirname);

  if (!initialized) {
    console.log("ERROR: Failed to initialize provider.");
    console.log("Make sure you have run: node setup-eodhd.js\n");
    process.exit(1);
  }

  console.log("Provider initialized successfully.\n");

  var testSymbols = [
    { symbol: "FXAIX", name: "Fidelity 500 Index Fund" },
    { symbol: "PRCFX", name: "T. Rowe Price Capital Appreciation" }
  ];

  var results = [];

  for (var i = 0; i < testSymbols.length; i++) {
    var testSymbol = testSymbols[i];
    console.log("Fetching " + testSymbol.symbol + " (" + testSymbol.name + ")...");

    try {
      var result = await provider.fetchPrice(testSymbol.symbol);
      console.log("  ✓ Price: $" + result.price.toFixed(2));
      console.log("  ✓ 24h Change: " + result.change24h.toFixed(2) + "%");
      results.push({ symbol: testSymbol.symbol, status: "OK", price: result.price });
    } catch (error) {
      console.log("  ✗ ERROR: " + error.message);
      if (error.code) {
        console.log("  ✗ Code: " + error.code);
      }
      results.push({ symbol: testSymbol.symbol, status: "FAILED", error: error.message });
    }

    console.log("");
  }

  console.log("=== Summary ===\n");

  var passed = results.filter(function(r) { return r.status === "OK"; }).length;
  var failed = results.filter(function(r) { return r.status === "FAILED"; }).length;

  console.log("Passed: " + passed + "/" + results.length);
  console.log("Failed: " + failed + "/" + results.length);
  console.log("");

  if (failed > 0) {
    console.log("Failed symbols:");
    results.forEach(function(r) {
      if (r.status === "FAILED") {
        console.log("  - " + r.symbol + ": " + r.error);
      }
    });
    console.log("");
  }

  console.log("=== Test Complete ===");
  process.exit(failed > 0 ? 1 : 0);
}

test().catch(function(error) {
  console.error("Test failed:", error);
  process.exit(1);
});
