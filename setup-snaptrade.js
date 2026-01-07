"use strict";

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const readline = require("readline/promises");

const KEY_PATH = path.join(os.homedir(), ".mmm-fintech-key");
const OUT_PATH = path.join(__dirname, "snaptrade-credentials.enc");

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const v = argv[i + 1];
    if (!v || v.startsWith("--")) {
      out[key] = true;
      continue;
    }
    out[key] = v;
    i += 1;
  }
  return out;
}

function loadOrCreateKey() {
  if (fs.existsSync(KEY_PATH)) {
    const raw = fs.readFileSync(KEY_PATH, "utf8").trim();
    const key = Buffer.from(raw, "base64");
    if (key.length !== 32) {
      throw new Error(`Invalid key in ${KEY_PATH}. Expected base64-encoded 32 bytes (AES-256).`);
    }
    return key;
  }
  const key = crypto.randomBytes(32);
  fs.writeFileSync(KEY_PATH, key.toString("base64") + "\n", { encoding: "utf8", mode: 0o600 });
  return key;
}

function encryptJsonAes256Gcm(key, obj) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(obj), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    v: 1,
    alg: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: ciphertext.toString("base64"),
  };
}

async function promptIfMissing(rl, label, value) {
  if (value && String(value).trim().length > 0) return String(value).trim();
  const v = await rl.question(label);
  return String(v).trim();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const force = !!args["force"];

  if (fs.existsSync(OUT_PATH) && !force) {
    process.stderr.write(`Refusing to overwrite ${OUT_PATH}. Re-run with --force to overwrite.\n`);
    process.exit(2);
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const clientId = await promptIfMissing(rl, "SnapTrade clientId: ", args["client-id"] || process.env.SNAPTRADE_CLIENT_ID);
    const consumerKey = await promptIfMissing(rl, "SnapTrade consumerKey: ", args["consumer-key"] || process.env.SNAPTRADE_CONSUMER_KEY);
    const userId = await promptIfMissing(rl, "SnapTrade userId: ", args["user-id"] || process.env.SNAPTRADE_USER_ID);
    const userSecret = await promptIfMissing(rl, "SnapTrade userSecret: ", args["user-secret"] || process.env.SNAPTRADE_USER_SECRET);

    if (!clientId || !consumerKey || !userId || !userSecret) {
      throw new Error("All fields are required (clientId, consumerKey, userId, userSecret).");
    }

    const payload = {
      provider: "snaptrade",
      clientId,
      consumerKey,
      userId,
      userSecret,
      createdAt: new Date().toISOString(),
    };

    const key = loadOrCreateKey();
    const enc = encryptJsonAes256Gcm(key, payload);

    fs.writeFileSync(OUT_PATH, JSON.stringify(enc, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
    process.stdout.write(`Wrote ${OUT_PATH}\n`);
    process.stdout.write(`Key file: ${KEY_PATH}\n`);
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  process.stderr.write(String(err && err.stack ? err.stack : err) + "\n");
  process.exit(1);
});
