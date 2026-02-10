"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const readline = require("readline/promises");

const KEY_PATH = path.join(process.env.HOME || process.env.USERPROFILE, ".mmm-fintech-key");

function loadOrCreateKey() {
  if (fs.existsSync(KEY_PATH)) {
    console.log("Using existing encryption key: " + KEY_PATH);
    const rawStr = fs.readFileSync(KEY_PATH, "utf8").trim();
    
    if (/^[0-9a-fA-F]{64}$/.test(rawStr)) {
      return Buffer.from(rawStr, "hex");
    }
    
    try {
      const b64 = Buffer.from(rawStr, "base64");
      if (b64.length === 32) return b64;
    } catch (_) {}
    
    const rawBuf = fs.readFileSync(KEY_PATH);
    if (rawBuf.length === 32) return rawBuf;
    
    throw new Error("Invalid encryption key format. Expected 32-byte key as 64-char hex.");
  }
  
  console.log("Creating new encryption key: " + KEY_PATH);
  const key = crypto.randomBytes(32);
  fs.writeFileSync(KEY_PATH, key.toString("hex") + "\n", { encoding: "utf8", mode: 0o600 });
  return key;
}

function encrypt(data, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(data), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    v: 1,
    alg: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: authTag.toString("base64"),
    data: encrypted.toString("base64")
  };
}

function encryptLegacy(text, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]);
}

async function setupSnapTrade(rl, key) {
  console.log("\n" + "=".repeat(80));
  console.log("SnapTrade Setup");
  console.log("=".repeat(80));
  console.log("\nSnapTrade provides unified access to multiple brokerages (Fidelity, Coinbase, etc.)");
  console.log("Get credentials from: https://dashboard.snaptrade.com/\n");
  
  const clientId = (await rl.question("SnapTrade clientId: ")).trim();
  if (!clientId) {
    console.log("Skipped (empty input)");
    return;
  }
  
  const consumerKey = (await rl.question("SnapTrade consumerKey: ")).trim();
  const userId = (await rl.question("SnapTrade userId: ")).trim();
  const userSecret = (await rl.question("SnapTrade userSecret: ")).trim();
  
  if (!consumerKey || !userId || !userSecret) {
    console.log("\nError: All fields required. Setup cancelled.");
    return;
  }
  
  const payload = {
    provider: "snaptrade",
    clientId,
    consumerKey,
    userId,
    userSecret,
    createdAt: new Date().toISOString()
  };
  
  const encrypted = encrypt(payload, key);
  const outPath = path.join(__dirname, "snaptrade-credentials.enc");
  fs.writeFileSync(outPath, JSON.stringify(encrypted, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
  
  console.log("\n✓ SnapTrade credentials saved to: " + outPath);
  console.log("\nNext step: Connect brokerages by running:");
  console.log("  node snaptrade-connect.js");
}

async function setupCoinbase(rl, key) {
  console.log("\n" + "=".repeat(80));
  console.log("Coinbase CDP API Setup");
  console.log("=".repeat(80));
  console.log("\nCoinbase CDP API provides crypto holdings and pricing.");
  console.log("⚠️  Limitation: Does NOT include staked assets (use SnapTrade for complete holdings)");
  console.log("\nGet credentials from: https://portal.cdp.coinbase.com/projects/api-keys\n");
  
  const sourcePath = path.join(__dirname, "cdp_api_key.json");
  
  if (!fs.existsSync(sourcePath)) {
    console.log("Error: cdp_api_key.json not found in module directory.");
    console.log("Place your CDP API key JSON file here first, then re-run this setup.\n");
    return;
  }
  
  console.log("Found: cdp_api_key.json");
  const credentials = fs.readFileSync(sourcePath, "utf8");
  
  const encrypted = encryptLegacy(credentials, key);
  const outPath = path.join(__dirname, "cdp-credentials.enc");
  fs.writeFileSync(outPath, encrypted);
  
  console.log("✓ Coinbase credentials encrypted and saved to: " + outPath);
  
  const answer = (await rl.question("\nDelete the original cdp_api_key.json? (yes/no): ")).trim().toLowerCase();
  if (answer === "yes" || answer === "y") {
    fs.unlinkSync(sourcePath);
    console.log("✓ Original file deleted.");
  } else {
    console.log("⚠️  Remember to delete cdp_api_key.json manually for security.");
  }
}

async function setupTwelveData(rl, key) {
  console.log("\n" + "=".repeat(80));
  console.log("Twelve Data API Setup");
  console.log("=".repeat(80));
  console.log("\nTwelve Data provides stock, ETF, mutual fund, and forex pricing.");
  console.log("Get your API key from: https://twelvedata.com/account/api-keys");
  console.log("Free tier: 800 calls/day (sufficient for default polling intervals)\n");
  
  const apiKey = (await rl.question("Enter your Twelve Data API key: ")).trim();
  
  if (!apiKey) {
    console.log("Skipped (empty input)");
    return;
  }
  
  const credentials = { apiKey };
  const encrypted = encryptLegacy(JSON.stringify(credentials), key);
  const outPath = path.join(__dirname, "twelvedata-credentials.enc");
  fs.writeFileSync(outPath, encrypted);
  
  console.log("\n✓ Twelve Data credentials saved to: " + outPath);
}

function showManualHoldingsInfo() {
  console.log("\n" + "=".repeat(80));
  console.log("Manual Holdings Setup");
  console.log("=".repeat(80));
  console.log("\nManual holdings allow you to track positions without API integrations.");
  console.log("\nTo use manual holdings:");
  console.log("  1. Create or edit: manual-holdings.json");
  console.log("  2. See README section '5. Add Manual Holdings (Optional)' for JSON format");
  console.log("  3. Update the file whenever your holdings change");
  console.log("\nNote: You'll still need Twelve Data API (option 3) for pricing,");
  console.log("      unless using only 'cash' type holdings (fixed $1.00 price).\n");
}

async function main() {
  console.log("\n");
  console.log("╔" + "═".repeat(78) + "╗");
  console.log("║" + " ".repeat(25) + "MMM-Fintech Setup Wizard" + " ".repeat(29) + "║");
  console.log("╚" + "═".repeat(78) + "╝");
  console.log("");
  
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  
  try {
    const key = loadOrCreateKey();
    console.log("");
    
    while (true) {
      console.log("\nWhich providers would you like to configure?\n");
      console.log("  [1] SnapTrade (brokerage holdings - recommended, includes staked crypto)");
      console.log("  [2] Coinbase CDP API (crypto holdings & pricing, excludes staked assets)");
      console.log("  [3] Twelve Data (stock/ETF/forex pricing)");
      console.log("  [4] Manual Holdings (edit manual-holdings.json - see README section 5)");
      console.log("  [5] Configure all automated providers (SnapTrade + Twelve Data)");
      console.log("  [0] Exit\n");
      
      const choice = (await rl.question("Your choice: ")).trim();
      
      if (choice === "0") {
        console.log("\nExiting setup. Run 'node setup.js' again to configure more providers.\n");
        break;
      } else if (choice === "1") {
        await setupSnapTrade(rl, key);
      } else if (choice === "2") {
        await setupCoinbase(rl, key);
      } else if (choice === "3") {
        await setupTwelveData(rl, key);
      } else if (choice === "4") {
        showManualHoldingsInfo();
      } else if (choice === "5") {
        await setupSnapTrade(rl, key);
        await setupTwelveData(rl, key);
        console.log("\n✓ All automated providers configured.");
        console.log("\nNext step: Connect brokerages by running:");
        console.log("  node snaptrade-connect.js");
      } else {
        console.log("\nInvalid choice. Please enter a number 0-5.");
      }
      
      if (choice !== "0") {
        const another = (await rl.question("\nConfigure another provider? (yes/no): ")).trim().toLowerCase();
        if (another !== "yes" && another !== "y") {
          console.log("\nSetup complete. Run 'node setup.js' again to configure more providers.\n");
          break;
        }
      }
    }
  } finally {
    rl.close();
  }
}

main().catch(function(err) {
  console.error("\nSetup error:", err.message);
  process.exit(1);
});
