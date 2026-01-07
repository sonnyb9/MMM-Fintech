"use strict";

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { SnapTradeRestClient } = require("./lib/snaptrade-rest-client");

function loadKey(keyPath) {
  if (!fs.existsSync(keyPath)) throw new Error(`Missing key file: ${keyPath}`);

  const rawBuf = fs.readFileSync(keyPath);
  const rawStr = rawBuf.toString("utf8").trim();

  if (/^[0-9a-fA-F]{64}$/.test(rawStr)) return Buffer.from(rawStr, "hex");

  try {
    const b64 = Buffer.from(rawStr, "base64");
    if (b64.length === 32) return b64;
  } catch (_) {}

  if (rawBuf.length === 32) return rawBuf;

  throw new Error(`Invalid key in ${keyPath}. Expected 64-hex, base64(32B), or raw 32 bytes.`);
}

function decryptEncFile(encPath, key) {
  if (!fs.existsSync(encPath)) throw new Error(`Missing encrypted credentials file: ${encPath}`);

  const payload = JSON.parse(fs.readFileSync(encPath, "utf8"));
  const iv = Buffer.from(payload.iv, "base64");
  const tag = Buffer.from(payload.tag, "base64");
  const data = Buffer.from(payload.data, "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(plain.toString("utf8"));
}

function extractPositions(resp) {
  if (Array.isArray(resp)) return resp;
  if (resp && Array.isArray(resp.positions)) return resp.positions;
  if (resp && Array.isArray(resp.data)) return resp.data;
  return [];
}

function normalizePositionsToHoldings(positions) {
  const out = [];
  for (const p of positions || []) {
    const sym =
      (p && p.symbol && (p.symbol.symbol || p.symbol.ticker)) ||
      (p && p.symbol && typeof p.symbol === "string" ? p.symbol : null);
    const unitsRaw = p && (p.units ?? p.quantity ?? p.total_quantity);
    const units = Number(unitsRaw);
    if (!sym || !Number.isFinite(units) || units === 0) continue;
    out.push({ symbol: sym, quantity: units, source: "snaptrade" });
  }
  return out;
}

function aggregateHoldings(holdings) {
  const map = new Map();
  for (const h of holdings) map.set(h.symbol, (map.get(h.symbol) || 0) + h.quantity);
  return Array.from(map.entries())
    .map(([symbol, quantity]) => ({ symbol, quantity, source: "snaptrade" }))
    .sort((a, b) => a.symbol.localeCompare(b.symbol));
}

async function main() {
  const encPath = path.join(__dirname, "snaptrade-credentials.enc");
  const keyPath = path.join(os.homedir(), ".mmm-fintech-key");

  const key = loadKey(keyPath);
  const creds = decryptEncFile(encPath, key);

  const { clientId, consumerKey, userId, userSecret } = creds || {};
  if (!clientId || !consumerKey || !userId || !userSecret) {
    throw new Error("Decrypted credentials missing required fields.");
  }

  const client = new SnapTradeRestClient({ clientId, consumerKey });

  const accounts = await client.listAccounts({ userId, userSecret });
  const all = [];

  for (const acct of accounts || []) {
    const accountId = acct && acct.id;
    if (!accountId) continue;
    const resp = await client.listPositions({ userId, userSecret, accountId });
    const positions = extractPositions(resp);
    all.push(...normalizePositionsToHoldings(positions));
  }

  process.stdout.write(`${JSON.stringify(aggregateHoldings(all), null, 2)}\n`);
}

main().catch((err) => {
  process.stderr.write(`SnapTrade fetch failed: ${err && err.message ? err.message : String(err)}\n`);
  if (err && err.status) process.stderr.write(`HTTP: ${err.status}\n`);
  if (err && err.url) process.stderr.write(`URL: ${err.url}\n`);
  process.exitCode = 1;
});
