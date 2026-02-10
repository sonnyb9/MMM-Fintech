"use strict";

const { spawn } = require("child_process");
const path = require("path");

var tests = [
  { name: "SnapTrade Provider", script: "test-snaptrade-provider.js" },
  { name: "Twelve Data Provider", script: "test-twelvedata.js" },
  { name: "Full Sync Flow", script: "test-full-sync.js" },
  { name: "Cost Basis & Gain/Loss", script: "test-costbasis.js" }
];

var results = [];

function runTest(test) {
  return new Promise(function(resolve) {
    console.log("\n" + "=".repeat(80));
    console.log("Running: " + test.name);
    console.log("=".repeat(80) + "\n");

    var child = spawn("node", [test.script], {
      cwd: __dirname,
      stdio: "inherit"
    });

    var startTime = Date.now();

    child.on("close", function(code) {
      var duration = ((Date.now() - startTime) / 1000).toFixed(2);
      results.push({
        name: test.name,
        script: test.script,
        exitCode: code,
        duration: duration,
        success: code === 0
      });
      resolve();
    });

    child.on("error", function(err) {
      results.push({
        name: test.name,
        script: test.script,
        exitCode: -1,
        duration: "0.00",
        success: false,
        error: err.message
      });
      resolve();
    });
  });
}

async function main() {
  console.log("\n");
  console.log("╔" + "═".repeat(78) + "╗");
  console.log("║" + " ".repeat(22) + "MMM-Fintech Health Check" + " ".repeat(32) + "║");
  console.log("╚" + "═".repeat(78) + "╝");

  for (var i = 0; i < tests.length; i++) {
    await runTest(tests[i]);
  }

  console.log("\n");
  console.log("╔" + "═".repeat(78) + "╗");
  console.log("║" + " ".repeat(32) + "Summary" + " ".repeat(39) + "║");
  console.log("╚" + "═".repeat(78) + "╝");
  console.log("");

  var passed = 0;
  var failed = 0;

  for (var j = 0; j < results.length; j++) {
    var result = results[j];
    var status = result.success ? "✓ PASS" : "✗ FAIL";
    var statusColor = result.success ? "\x1b[32m" : "\x1b[31m";
    var resetColor = "\x1b[0m";

    console.log(
      "  " +
      statusColor + status + resetColor +
      "  " +
      result.name.padEnd(30) +
      " (" + result.duration + "s)"
    );

    if (result.success) {
      passed++;
    } else {
      failed++;
      if (result.error) {
        console.log("       Error: " + result.error);
      }
    }
  }

  console.log("");
  console.log("-".repeat(80));
  console.log("  Total: " + results.length + " tests  |  Passed: " + passed + "  |  Failed: " + failed);
  console.log("-".repeat(80));
  console.log("");

  if (failed > 0) {
    console.log("Some tests failed. Check output above for details.\n");
    process.exit(1);
  } else {
    console.log("All tests passed! Module is healthy.\n");
    process.exit(0);
  }
}

main().catch(function(err) {
  console.error("\nHealth check error:", err.message);
  process.exit(1);
});
