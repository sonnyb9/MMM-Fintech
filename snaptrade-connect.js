"use strict";

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { Snaptrade } = require("snaptrade-typescript-sdk");

const KEY_PATH = path.join(os.homedir(), ".mmm-fintech-key");
const ENC_PATH = path.join(__dirname, "snaptrade-credentials.enc");

function loadKey(keyPath) {
  var rawStr = fs.readFileSync(keyPath, "utf8").trim();
  return Buffer.from(rawStr, "hex");
}

function decryptCredentials(encPath, key) {
  var payload = JSON.parse(fs.readFileSync(encPath, "utf8"));
  var iv = Buffer.from(payload.iv, "base64");
  var tag = Buffer.from(payload.tag, "base64");
  var data = Buffer.from(payload.data, "base64");
  var decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  var plain = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(plain.toString("utf8"));
}

async function main() {
  var key = loadKey(KEY_PATH);
  var creds = decryptCredentials(ENC_PATH, key);

  var snaptrade = new Snaptrade({
    clientId: creds.clientId,
    consumerKey: creds.consumerKey,
  });

  console.log("Generating Connection Portal URL...\n");

  var resp = await snaptrade.authentication.loginSnapTradeUser({
    userId: creds.userId,
    userSecret: creds.userSecret,
  });

  console.log("Open this URL in your browser to connect a new brokerage:\n");
  console.log(resp.data.redirectURI);
  console.log("\nSelect Coinbase from the list and complete the OAuth flow.");
}

main().catch(function(err) {
  console.error("Error:", err.message);
  process.exit(1);
});
