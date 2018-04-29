import configAsset from '../asset/config';

const config = Object.assign({}, configAsset, {
  market: {
    values: {
      // auto populated
      // examples:
      // BTCUSDT: 'btcusdt,
      // ETHBTC: 'ethbtc',
    },
    labels: {
      // auto populated
      // examples:
      // btcusdt: 'BTC:USDT',
      // ethbtc: 'ETH:BTC',
    },
    exchanges: {
      // auto populated
      // example: / ethbtc: ['kraken', 'bittrex', 'poloniex'],
    },
  },

  side: {
    values: {
      BUY: 'buy',
      SELL: 'sell',
    },
    labels: {
      buy: 'Buy',
      sell: 'Sell',
    },
    list: [
      'buy', 'sell',
    ],
  },

  book: {
    depth: 10,
    order: {
      RATE: 0,
      AMOUNT: 1,
    }
  }
});

// auto populate config for markets (asset pairs)
const configMarkets = config.market;
const configAssets = configAsset.asset.values;
const configAssetsQuotes = configAsset.asset.quotes;
const configAssetsQuotesKeys = configAssetsQuotes.map(item =>
  Object.keys(configAssets).find(itemKey => configAssets[itemKey] == item)
);

Object.keys(configAssets).forEach(itemAssetKey => {
  let itemAsset = configAssets[itemAssetKey];

  configAssetsQuotes.forEach((itemAssetQuote, index) => {
    if (itemAssetQuote == itemAsset) { return; }
    configMarkets.values[itemAssetKey + configAssetsQuotesKeys[index]] = itemAsset + itemAssetQuote;
    configMarkets.labels[itemAsset + itemAssetQuote] = itemAssetKey + ':' + configAssetsQuotesKeys[index];
  });
});

export default config;
