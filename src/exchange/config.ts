import { TMarketType } from '../market/interfaces';
import { TExchangeName } from './interfaces';

import configAsset from '../asset/config';
import configAccount from '../account/config';
import configMarket from '../market/config';
import configOrder from '../order/config';

const config = Object.assign({}, configAsset, configAccount, configMarket, configOrder, {
  exchange: {
    values: {
      BINANCE: 'binance',
      BITSTAMP: 'bitstamp',
      BITTREX: 'bittrex',
      KRAKEN: 'kraken',
      POLONIEX: 'poloniex',
    },
    labels: {
      binance: 'Binance',
      bitstamp: 'Bitstamp',
      bittrex: 'Bittrex',
      kraken: 'Kraken',
      poloniex: 'Poloniex',
    },
    list: [
      'bittrex', 'binance', 'bitstamp', 'kraken', 'poloniex',
    ],

    settings: {
      step: 0.00000001, // one satoshi
      fees: {
        take: 0.2, // default value
        make: 0.2, // default value
      }
    },
  }
});

export default config;
