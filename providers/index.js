const BaseProvider = require("./base");
const CoinbaseProvider = require("./coinbase");

module.exports = {
  BaseProvider: BaseProvider,
  CoinbaseProvider: CoinbaseProvider,

  createProvider: function(type) {
    switch (type) {
      case "coinbase":
        return new CoinbaseProvider();
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
