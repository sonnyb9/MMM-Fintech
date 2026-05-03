const BaseProvider = require("./base");
const CoinbaseProvider = require("./coinbase");
const EODHDProvider = require("./eodhd");
const TwelveDataProvider = require("./twelvedata");
const SnapTradeProvider = require("./snaptrade");

module.exports = {
  BaseProvider: BaseProvider,
  CoinbaseProvider: CoinbaseProvider,
  EODHDProvider: EODHDProvider,
  TwelveDataProvider: TwelveDataProvider,
  SnapTradeProvider: SnapTradeProvider,

  createProvider: function(type) {
    switch (type) {
      case "coinbase":
        return new CoinbaseProvider();
      case "eodhd":
        return new EODHDProvider();
      case "twelvedata":
        return new TwelveDataProvider();
      case "snaptrade":
        return new SnapTradeProvider();
      default:
        throw new Error("Unknown provider type: " + type);
    }
  },

  getProviderForAssetType: function(assetType) {
    switch (assetType) {
      case "crypto":
        return "coinbase";
      case "stock":
      case "etf":
      case "forex":
        return "twelvedata";
      case "mutual_fund":
        return "eodhd";
      default:
        return null;
    }
  }
};
