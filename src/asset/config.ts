const config = {
  asset: {
    values: {
      BCH: 'bch', // Bitcoin Cash
      BCN: 'bcn', // Bytecoin
      BNB: 'bnb', // Binance / local
      BTC: 'btc', // Bitcoin
      DASH: 'dash', // Dash
      EOS: 'eos', // EOS
      ETC: 'etc', // Etherium Classic
      ETH: 'eth', // Etherium
      GNT: 'gnt', // Golem
      LSK: 'lsk', // Lisk
      LTC: 'ltc', // Litecoin
      MCO: 'mco', // Monaco
      NEO: 'neo', // Neo
      NXT: 'nxt', // Nxt
      OMG: 'omg', // OmiseGo
      QTUM: 'qtum', // Quantum
      STR: 'str', // Stellar
      STRAT: 'strat', // Stratis
      WTC: 'wtc', // Walton
      XDN: 'xdn', // DigitalNote
      XLM: 'xlm', // Stellar Lumens
      XMR: 'xmr', // Monero
      XRP: 'xrp', // Ripple
      ZEC: 'zec', // Zcash
      ZRX : 'zrx', // 0x

      CNY: 'cny',
      EUR: 'eur',
      GBP: 'gbp',
      JPY: 'jpy',
      KRW: 'krw',
      USD: 'usd',
      USDT: 'usdt'
    },
    labels: <any>{
      // auto populated
      // ex. btc: 'BTC' // capitalized
    },
    list: <any>[
      // auto populated
      // ex. 'btc', ...
    ],
    quotes: [
      'btc', 'eth', 'usd', 'usdt',
    ],
  },
};

let asset = config.asset;

Object.keys(asset.values).forEach(itemAssetKey => {
  let itemAsset = asset.values[itemAssetKey];
  asset.labels[itemAsset] = itemAsset.toUpperCase();
  asset.list.push(itemAsset)
});

export default config;
