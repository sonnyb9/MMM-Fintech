const TwelveDataProvider = require("./providers/twelvedata");

async function test() {
  console.log("=== Testing Twelve Data Provider ===\n");

  var provider = new TwelveDataProvider();
  var initialized = provider.init({ maxRetries: 2 }, __dirname);

  if (!initialized) {
    console.log("ERROR: Failed to initialize provider.");
    console.log("Make sure you have run: node setup-twelvedata.js\n");
    process.exit(1);
  }

  console.log("Provider initialized successfully.\n");

  var testSymbols = [
    { symbol: "PRCOX", type: "mutual_fund", name: "T. Rowe Price U.S. Equity Research" },
    { symbol: "NVDA", type: "stock", name: "NVIDIA" },
    { symbol: "MSFT", type: "stock", name: "Microsoft" },
    { symbol: "BRK.B", type: "stock", name: "Berkshire Hathaway B" },
    { symbol: "RZLV", type: "stock", name: "Rezolve AI" }
  ];

  console.log("=== Stock/ETF/Mutual Fund Tests ===\n");

  var results = [];

  for (var i = 0; i < testSymbols.length; i++) {
    var test = testSymbols[i];
    console.log("Fetching " + test.symbol + " (" + test.name + ")...");

    try {
      var result = await provider.fetchPrice(test.symbol);
      console.log("  ✓ Price: $" + result.price.toFixed(2));
      console.log("  ✓ 24h Change: " + result.change24h.toFixed(2) + "%");
      results.push({ symbol: test.symbol, status: "OK", price: result.price });
    } catch (error) {
      console.log("  ✗ ERROR: " + error.message);
      if (error.code) {
        console.log("  ✗ Code: " + error.code);
      }
      results.push({ symbol: test.symbol, status: "FAILED", error: error.message });
    }
    console.log("");
  }

  console.log("=== Forex Tests ===\n");

  var forexPairs = ["USD/PHP", "USD/EUR"];

  for (var j = 0; j < forexPairs.length; j++) {
    var pair = forexPairs[j];
    console.log("Fetching " + pair + "...");

    try {
      var forex = await provider.fetchForexRate(pair);
      console.log("  ✓ Rate: " + forex.rate.toFixed(4));
      results.push({ symbol: pair, status: "OK", rate: forex.rate });
    } catch (error) {
      console.log("  ✗ ERROR: " + error.message);
      results.push({ symbol: pair, status: "FAILED", error: error.message });
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

  console.log("Credits used: " + provider.creditsUsed + ", remaining: " + provider.creditsLeft);
  console.log("\n=== Test Complete ===");
}

test().catch(function(error) {
  console.error("Test failed:", error);
  process.exit(1);
});
