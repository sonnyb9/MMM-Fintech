"use strict";

class SnapTradeProvider {
  constructor(opts = {}) {
    this.clientId = opts.clientId;
    this.consumerKey = opts.consumerKey;
    this.userId = opts.userId;
    this.userSecret = opts.userSecret;
    this.basePath = opts.basePath;
  }

  static id() {
    return "snaptrade";
  }
}

module.exports = {
  SnapTradeProvider,
};

