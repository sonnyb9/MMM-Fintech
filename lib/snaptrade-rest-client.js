"use strict";

const crypto = require("crypto");

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function stableJsonStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableJsonStringify(v)).join(",")}]`;
  }
  if (isPlainObject(value)) {
    const keys = Object.keys(value).sort();
    const body = keys
      .map((k) => `${JSON.stringify(k)}:${stableJsonStringify(value[k])}`)
      .join(",");
    return `{${body}}`;
  }
  return JSON.stringify(value);
}

function buildQuery(params) {
  const entries = Object.entries(params || {})
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => [k, String(v)])
    .sort(([a], [b]) => a.localeCompare(b));

  return entries
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

class SnapTradeRestClient {
  constructor(opts) {
    this.clientId = opts.clientId;
    this.consumerKey = opts.consumerKey;
    this.baseUrl = opts.baseUrl || "https://api.snaptrade.com";
    this.apiVersionPath = opts.apiVersionPath || "/api/v1";
  }

  #sign({ path, query, content }) {
    const requestPath = `${this.apiVersionPath}${path}`;
    const sigObject = { content: content || {}, path: requestPath, query };
    const sigContent = stableJsonStringify(sigObject);
    return crypto
      .createHmac("sha256", Buffer.from(this.consumerKey, "utf8"))
      .update(sigContent, "utf8")
      .digest("base64");
  }

  async request({ method, path, queryParams, body }) {
    const timestamp = Math.floor(Date.now() / 1000);

    const query = buildQuery({
      ...(queryParams || {}),
      clientId: this.clientId,
      timestamp,
    });

    const signature = this.#sign({
      path,
      query,
      content: body || {},
    });

    const url = `${this.baseUrl}${this.apiVersionPath}${path}?${query}`;

    const res = await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Signature: signature,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    if (!res.ok) {
      const detail =
        (json && (json.detail || json.message || json.error)) || text || `HTTP ${res.status}`;
      const err = new Error(detail);
      err.status = res.status;
      err.url = url;
      err.body = json;
      throw err;
    }

    return json;
  }

  async listAccounts({ userId, userSecret }) {
    return this.request({
      method: "GET",
      path: "/accounts",
      queryParams: { userId, userSecret },
    });
  }

  async listPositions({ userId, userSecret, accountId }) {
    return this.request({
      method: "GET",
      path: `/accounts/${encodeURIComponent(accountId)}/positions`,
      queryParams: { userId, userSecret },
    });
  }
}

module.exports = { SnapTradeRestClient, stableJsonStringify, buildQuery };
