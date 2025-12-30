const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const keyPath = path.join(process.env.HOME || process.env.USERPROFILE, ".mmm-fintech-key");
const credentialsPath = path.join(__dirname, "twelvedata-credentials.enc");

function encrypt(text, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]);
}

function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(function(resolve) {
    rl.question(question, function(answer) {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  console.log("\n=== Twelve Data API Key Setup ===\n");

  if (!fs.existsSync(keyPath)) {
    console.log("Encryption key not found at " + keyPath);
    console.log("Please run setup-credentials.js first to create the encryption key.\n");
    process.exit(1);
  }

  console.log("This will encrypt your Twelve Data API key for secure storage.");
  console.log("Get your API key from: https://twelvedata.com/account/api-keys\n");

  const apiKey = await prompt("Enter your Twelve Data API key: ");

  if (!apiKey || apiKey.trim().length === 0) {
    console.log("\nError: API key cannot be empty.");
    process.exit(1);
  }

  const credentials = {
    apiKey: apiKey.trim()
  };

  try {
    const encKey = fs.readFileSync(keyPath, "utf8").trim();
    const keyBuffer = Buffer.from(encKey, "hex");

    const encrypted = encrypt(JSON.stringify(credentials), keyBuffer);
    fs.writeFileSync(credentialsPath, encrypted);

    console.log("\n✓ Twelve Data credentials encrypted and saved to:");
    console.log("  " + credentialsPath);
    console.log("\nSetup complete. The module will now be able to fetch stock/ETF/forex data.\n");
  } catch (error) {
    console.error("\nError encrypting credentials:", error.message);
    process.exit(1);
  }
}

main();
