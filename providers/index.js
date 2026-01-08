const BaseProvider = require("./base");
const CoinbaseProvider = require("./coinbase");
const TwelveDataProvider = require("./twelvedata");
const SnapTradeProvider = require("./snaptrade");

module.exports = {
  BaseProvider: BaseProvider,
  CoinbaseProvider: CoinbaseProvider,
  TwelveDataProvider: TwelveDataProvider,
  SnapTradeProvider: SnapTradeProvider,

  createProvider: function(type) {
    switch (type) {
      case "coinbase":
        return new CoinbaseProvider();
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
      case "mutual_fund":
      case "forex":
        return "twelvedata";
      default:
        return null;
    }
  }
};
