/**
 * MMM-Fintech: Coinbase API Debug Script
 * 
 * Shows raw account data to understand the response structure.
 * Run with: node debug-accounts.js
 */

const { CBAdvancedTradeClient } = require("coinbase-api");
const fs = require("fs");
const path = require("path");

const CDP_KEY_PATH = path.join(__dirname, "cdp_api_key.json");

async function debugAccounts() {
  const cdpKey = JSON.parse(fs.readFileSync(CDP_KEY_PATH, "utf8"));
  
  const client = new CBAdvancedTradeClient({
    apiKey: cdpKey.name,
    apiSecret: cdpKey.privateKey,
  });

  const response = await client.getAccounts({ limit: 250 });
  const accounts = response.accounts || [];

  // Show all accounts that might have any balance
  const relevant = accounts.filter((acct) => {
    const available = parseFloat(acct.available_balance?.value || "0");
    const hold = parseFloat(acct.hold?.value || "0");
    return available > 0 || hold > 0;
  });

  console.log("=== Raw Account Data ===\n");
  
  relevant.forEach((acct) => {
    console.log(`--- ${acct.currency} (${acct.name}) ---`);
    console.log(JSON.stringify(acct, null, 2));
    console.log("");
  });

  console.log(`\nTotal accounts with any balance: ${relevant.length}`);
}

debugAccounts().catch(console.error);
