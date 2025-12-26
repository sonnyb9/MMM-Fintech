const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const KEY_PATH = path.join(process.env.HOME || process.env.USERPROFILE, ".mmm-fintech-key");
const SOURCE_PATH = path.join(__dirname, "cdp_api_key.json");
const ENCRYPTED_PATH = path.join(__dirname, "cdp-credentials.enc");

function generateKey() {
  return crypto.randomBytes(32);
}

function encrypt(data, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(data, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]);
}

function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function main() {
  console.log("=== MMM-Fintech Credential Encryption Setup ===\n");

  if (!fs.existsSync(SOURCE_PATH)) {
    console.error("Error: cdp_api_key.json not found in module directory.");
    console.error("Place your CDP API key JSON file here first.");
    process.exit(1);
  }

  let key;
  if (fs.existsSync(KEY_PATH)) {
    console.log("Using existing encryption key at " + KEY_PATH);
    key = fs.readFileSync(KEY_PATH);
  } else {
    console.log("Generating new encryption key...");
    key = generateKey();
    fs.writeFileSync(KEY_PATH, key, { mode: 0o600 });
    console.log("Key saved to " + KEY_PATH);
  }

  console.log("Reading credentials from cdp_api_key.json...");
  const credentials = fs.readFileSync(SOURCE_PATH, "utf8");

  console.log("Encrypting...");
  const encrypted = encrypt(credentials, key);

  fs.writeFileSync(ENCRYPTED_PATH, encrypted);
  console.log("Encrypted credentials saved to cdp-credentials.enc\n");

  const answer = await prompt("Delete the original cdp_api_key.json? (yes/no): ");
  if (answer === "yes" || answer === "y") {
    fs.unlinkSync(SOURCE_PATH);
    console.log("Original file deleted.");
  } else {
    console.log("Original file kept. Remember to delete it manually for security.");
  }

  console.log("\nSetup complete.");
}

main().catch(console.error);
