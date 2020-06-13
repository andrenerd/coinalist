const crypto = require('crypto');
const request = require('request');
const querystring = require('querystring'); // replace URLSearchParams

import { Observable, ReplaySubject } from 'rxjs';

import { TMarketType, TMarketSide, TMarketBookOrder, } from '../../market/interfaces';
import { TExchangeName, IExchange, IExchangeConstructor } from '../interfaces';

import config from '../config';
import { Account, Transfer } from '../../account';
import { Market } from '../../market';
import { Order } from '../../order';

const { BUY, SELL } = config.side.values;
const { RATE, AMOUNT } = config.book.order;
const { OPEN, FILLED, CANCELED, FAILED } = config.order.status.values;
const { asset: {values: A}, market: {values: M} } = config;

// https://www.kraken.com/help/api
// https://support.kraken.com/hc/en-us/articles/205893708-What-is-the-minimum-order-size-
export const ExchangeKrakenProvider = (Exchange: IExchangeConstructor) => class ExchangeKraken extends Exchange implements IExchange {
  name = config.exchange.values.KRAKEN;

  _api = {
    url: 'https://api.kraken.com/',
    urlVersion: '0/',
    key: null,
    secret: null,
  };

  constructor(key?: string, secret?: string, ...props) {
    super(settings, ...props);
    this._api['key'] = key;
    this._api['secret'] = secret;
  }

  init(marketTypes?: TMarketType | TMarketType[], options?: any): Observable<Market[]> {
    const subject: ReplaySubject<Market[]> = new ReplaySubject();

    super.init(marketTypes, options).subscribe(
      (markets: Market[]) => {
        this._initSettings().subscribe(() => {
          markets.forEach((market: Market, index) => {
            setTimeout(() => {
              this._subscribeBooks(market);
            }, 111 * index); // to not overcome api limits
          });

          this._subscribeOrders();

          subject.next(markets);
          subject.complete();
        });
      }
    );

    return subject.asObservable();
  }

  buy(market: Market, rate: number, amount: number, options = {}): Observable<Order> {
    const subject: ReplaySubject<Order> = new ReplaySubject();
    const settings = this.settings.extra[market.type];

    let order = new Order(BUY, rate, amount);
    this.orderObserve(order);

    // response
    // {
    //   "descr":"...",
    //   "txid": [...],
    // }
    this._requestPrivate('POST', 'AddOrder', {
      // userref: order.id, // should be 32-bit signed number
      pair: this._getAssetPairSymbol(market.type),
      type: 'buy',
      ordertype: options['ordertype'] || 'limit',
      price: rate.toFixed(settings['rateDecimals']),
      volume: (amount / settings['amountLots']).toFixed(settings['amountDecimals']), // in lots
      timeInForce: 'GTC', // GTC - Good-Til-Canceled, IOC - Immediate-Or-Cancel
      // leverage: options['leverage'] || undefined,
      // price2: options['price2'] || undefined,
      // oflags: options['oflags'] || undefined,
      // starttm: options['starttm'] || undefined,
      // expiretm: options['expiretm'] || undefined,
    }).subscribe(data => {
      order.update({
        originId: data['txid'][0],
        originIds: data['txid'], // not in use
      });

      subject.next(order);
      subject.complete();

    }, err => {
      order.close(FAILED);
      subject.error(order);
      subject.complete();
    });

    return subject.asObservable();
  }

  sell(market: Market, rate: number, amount: number, options = {}): Observable<Order> {
    const subject: ReplaySubject<Order> = new ReplaySubject();
    const settings = this.settings.extra[market.type];

    let order = new Order(BUY, rate, amount);
    this.orderObserve(order);

    // response
    // {
    //   "descr":"...",
    //   "txid": [...],
    // }
    this._requestPrivate('POST', 'AddOrder', {
      // userref: order.id, // should be 32-bit signed number
      pair: this._getAssetPairSymbol(market.type),
      type: 'sell',
      ordertype: options['ordertype'] || 'limit',
      price: rate.toFixed(settings['rateDecimals']),
      volume: (amount / settings['amountLots']).toFixed(settings['amountDecimals']), // in lots
      timeInForce: 'GTC', // GTC - Good-Til-Canceled, IOC - Immediate-Or-Cancel
      // leverage: options['leverage'] || undefined,
      // price2: options['price2'] || undefined,
      // oflags: options['oflags'] || undefined,
      // starttm: options['starttm'] || undefined,
      // expiretm: options['expiretm'] || undefined,
    }).subscribe(data => {
      order.update({
        originId: data['txid'][0],
        originIds: data['txid'], // not in use
      });

      subject.next(order);
      subject.complete();

    }, err => {
      order.close(FAILED);
      subject.error(order);
      subject.complete();
    });

    return subject.asObservable();
  }

  cancel(market: Market, order: Order): Observable<Order> {
    const subject: ReplaySubject<Order> = new ReplaySubject();

    // response
    // {
    //   count = number of orders canceled
    //   pending = if set, order(s) is/are pending cancellation
    // }
    this._requestPrivate('POST', 'CancelOrder', {
      txid: order.originId,
    }).subscribe(data => {
      order.close(CANCELED);
      subject.next(order);
      subject.complete();

    }, err => {
      subject.error(order);
      subject.complete();
    });

    return subject.asObservable();
  }

  address(account: Account): Observable<Account> {
    const subject: ReplaySubject<Account> = new ReplaySubject(1);

    this._getDepositMethod(account).subscribe((depositMethod) => {
      // response:
      // { 
      //   "address" : "Vy5SKeKGXUHKS2WVpJ76HYuKAu3URastUo"
      // }
      this._requestPrivate('POST', 'DepositAddresses', {
        asset: this._getAssetSymbol(account.type),
        method: depositMethod, // yeah, just that
      }).subscribe(data => {
        account.address = data['address'];
        subject.next(account);
        subject.complete();

      }, err => {
        subject.error(account);
        subject.complete();
      });
    });

    return subject.asObservable();
  }

  balance(account: Account): Observable<Account> {
    const subject: ReplaySubject<Account> = new ReplaySubject(1);

    // response:
    // "ledger": {
    // { 'LDTPDA-R4MSY-O4ODL7': 
    //   { refid: 'TJKI4P-O2TMJ-ZC23HF',
    //     time: 1518584070.5594,
    //     type: 'trade',
    //     aclass: 'currency',
    //     asset: 'XXBT',
    //     amount: '-0.0098120000',
    //     fee: '0.0000260000',
    //     balance: '0.0901660000'
    //   },
    //   ...
    // }
    this._requestPrivate('POST', 'Ledgers', {
      asset: this._getAssetSymbol(account.type),
    }).subscribe(data => {
      let dataLedger = data['ledger'];
      let transaction = dataLedger[Object.keys(dataLedger)[0]]; // weak

      account.amount = transaction && transaction['balance'] || 0;

      subject.next(account);
      subject.complete();

    }, err => {
      subject.error(account);
      subject.complete();
    });

    return subject.asObservable();
  }

  getMinimum(market: Market): number {
    let assets = market.assets();
    let assetBase = assets[0];

    return this.options.minimum[assetBase] || 0;
  }

  getStep(marketType: TMarketType): number {
    // TODO: 
    return this.settings.extra[marketType].step || this.settings.step;
  }

  _initSettings() {
    const subject = new ReplaySubject(1);

    // response:
    // [
    // {
    // altname: 'ZECUSD',
    // aclass_base: 'currency',
    // base: 'XZEC',
    // aclass_quote: 'currency',
    // quote: 'ZUSD',
    // lot: 'unit',
    // pair_decimals: 2,
    // lot_decimals: 8,
    // lot_multiplier: 1,
    // leverage_buy: [],
    // leverage_sell: [],
    // fees: [],
    // fees_maker: [],
    // fee_volume_currency: 'ZUSD',
    // margin_call: 80,
    // margin_stop: 40 
    // },
    //   ...
    // ]
    this._requestPublic('GET', 'AssetPairs').subscribe(data => {
      let extra = Object.keys(data).reduce((output, key) => {
        let dataItem = data[key];

        let type = this._getMarketType(key);
        let rateDecimals = dataItem['pair_decimals'];

        type && (output[type] = {
          step: 1 / Math.pow(10, rateDecimals),
          rateDecimals: rateDecimals,
          amountLots: dataItem['lot_multiplier'],
          amountDecimals: dataItem['lot_decimals'],
          // RESERVED / assetFee: dataItem['feeAsset'],
        });

        return output;
      }, {});

      this.settings.extra = extra;
      subject.next(this.settings);
      subject.complete();

    }, err => {
      subject.error(err);
      subject.complete();
    });

    return subject;
  }

  // _initSettingsAccount(market: Market): Observable<any> {
  //   const subject = new ReplaySubject(1);

  //   let assets = 

  //   // response:
  //   // [
  //   // {
  //   //   method: 'Bitcoin',
  //   //   limit: false,
  //   //   fee: '0.0000000000',
  //   //   'gen-address': true
  //   // }
  //   //   ...
  //   // ]
  //   this._requestPrivate('POST', 'DepositMethods', {
  //     asset: this._getAssetSymbol(account.type),
  //   }).subscribe(data => {

  //     let dataDepositMethod = data[0]; // experimental / just take the first one


  //     let extra = data['reduce']((output, dataItem) => {
  //       let assetPair = this._getMarketType(dataItem['symbol']);
  //       let step = this.__getStep(parseFloat(dataItem['price'])); // temporal / weak

  //       assetPair && (output[assetPair] = {
  //         step: step,
  //         rateDecimals: (step.toString().split('.')[1] || '').length, // trim tailing zeros in advance
  //         // RESERVED / amountDecimals: ...,
  //         // RESERVED / assetFee: dataItem['feeAsset'],
  //       });

  //       return output;
  //     }, {});

  //     this.settings.extra = extra;
  //     subject.next(this.settings);
  //     subject.complete();

  //   }, err => {
  //     subject.error(err);
  //     subject.complete();
  //   });

  //   return subject;
  // }

  _subscribeBooks(market: Market) {
    const subject = new ReplaySubject(1); // buffer last value

    this.__subscribeBooks(market).subscribe(data => {
      if (!data) { return; } // is it in use?

      data['bids'] && market.books[BUY].reset(
        data['bids']
          .map(itemData => <TMarketBookOrder>
            // parse orders
            [parseFloat(itemData[0]), parseFloat(itemData[1])]
          ).filter(itemBookOrder =>
            // filter out "self" orders from the market order books
            !this.findOrderByBookOrder(BUY, itemBookOrder)
          )
      );

      data['asks'] && market.books[SELL].reset(
        data['asks']
          .map(itemData => <TMarketBookOrder>
            // parse orders
            [parseFloat(itemData[0]), parseFloat(itemData[1])]
          ).filter(itemBookOrder =>
            // filter out "self" orders from the market order books
            !this.findOrderByBookOrder(SELL, itemBookOrder)
          )
      );
    }, err => {});

    return subject;
  }

  _subscribeOrders() {
    const subject = new ReplaySubject(1); // buffer last value

    this.__subscribeOrders().subscribe(data => {
      if (!data) { return; } // is it in use?

      this.orders.forEach(order => {
        let orderData = data[order.originId];
        if (!orderData) { return; } // what??

        // RESERVED
        // let assetFee = this._getAccountType(data['N']);
        // let amountFee = assetFee == assetTarget ? parseFloat(data['n']) || 0.0 : 0.0;

        let amountFee = parseFloat(orderData['fee']);
        let amountFilled = parseFloat(orderData['vol_exec']);
        let amountFunded = order.side == BUY ?
          amountFilled
          :
          amountFilled - amountFee; // weak / assumption

        order.update({
          amountFilled: amountFilled,
          amountFunded: amountFunded,
          amountFee: amountFee,
          // RESERVED / assetFee: assetFee,
        });

        if (order.isOpen) {
          orderData['status'] == 'canceled' && order.close(CANCELED);
          orderData['status'] == 'expired' && order.close(CANCELED);
          orderData['status'] == 'closed' && order.close();
        }
      });

    }, err => {});

    return subject;
  }

  _request(method: string, path: string, data: any = {}) {
    let nonce = Date.now() * 1000;

    data = Object.assign({}, data, {
      nonce: nonce,
    });

    let params = querystring.stringify(data);

    const subject = new ReplaySubject(1); // buffer last value

    request({
      method: method,
      url: this._api.url + this._api.urlVersion + path,
      qs: method == 'GET' ? data : undefined,
      body: method == 'GET' ? undefined : params,
      headers: {
        'API-Key': this._api.key,
        'API-Sign': this._getSignature('/' + this._api.urlVersion + path, params, nonce),
        'Content-type': 'application/x-www-form-urlencoded',
      }
    }, (err, res, body) => {
      try {
        body = JSON.parse(body || '{}');
      } catch(e) {
        // pass
        // sometimes "cloudflare" error is returned
        return;
      }

      if (body && body.error && body.error.length) {
        // Patch "nonce" issue
        let isNonce = body.error.reduce((output, item) =>
          output || item.includes('Invalid nonce')
        , false);

        if (isNonce) { // repeat request in case of "nonce" issue
          this._request(method, path, data).subscribe(
            (data) => { subject.next(data) },
            (err) => { subject.error(err) },
            () => { subject.complete() }
          );
        } else {
          subject.error(body);
          console.error('ERROR', config.exchange.labels[this.name], path, body.error);
        }

      } else {
        subject.next(body && body.result || body);
      }

      subject.complete();
    });

    return subject;
  }

  _requestPublic(method: string, path: string, data: any = {}) {
    return this._request(method, 'public/' + path, data);
  }

  _requestPrivate(method: string, path: string, data: any = {}) {
    return this._request('POST', 'private/' + path, data); // always "post"
  }

  __subscribeBooks(market: Market) {
    const subject = new ReplaySubject(1); // buffer last value

    const pair = this._getAssetPairSymbol(market.type);

    // workaround to mimic push channel
    setInterval(() => {

      // response
      // {
      //     "timestamp": 1409921408869,
      //     "asks": [
      //         [
      //             "400.00000000",
      //             "5.00000000"
      //             1508356993 // timestamp
      //         ],
      //         ...
      //     ],
      //     "bids": [
      //         [
      //             "350.00000000",
      //             "0.57142858"
      //             1508356993 // timestamp
      //         ],
      //         ...
      //     ]
      // }
      this._requestPublic('GET', 'Depth', {
        pair: pair,
        count: config.book.depth,
      }).subscribe(data => {
        subject.next(data[pair]);
      });
    }, 2000); // every 2 seconds

    return subject;
  }

  __subscribeOrders() {
    const subject = new ReplaySubject(1); // buffer last value

    // workaround to mimic push channel
    setInterval(() => {

      let txid = this.orders.reduce((output, item: Order) =>
        output.concat(item.originIds) // or originId?
      , []);

      if (!txid.length) { return; }

      // response
      // { 
      //  'OTJO56-6R4QN-RJMWYI': // txid
      //    { refid: null,
      //      userref: 0,
      //      status: 'open',
      //      opentm: 1521842807.2742,
      //      starttm: 0,
      //      expiretm: 0,
      //      descr: 
      //       { pair: 'ETHXBT',
      //         type: 'buy',
      //         ordertype: 'limit',
      //         price: '0.06086',
      //         price2: '0',
      //         leverage: 'none',
      //         order: 'buy 0.03000000 ETHXBT @ limit 0.06086',
      //         close: '' },
      //      vol: '0.03000000',
      //      vol_exec: '0.00000000',
      //      cost: '0.000000',
      //      fee: '0.000000',
      //      price: '0.000000',
      //      stopprice: '0.000000',
      //      limitprice: '0.000000',
      //      misc: '',
      //      oflags: 'fciq' 
      //    }
      // }
      //
      // refid = Referral order transaction id that created this order
      // userref = user reference id
      // status = status of order:
      //     pending = order pending book entry
      //     open = open order
      //     closed = closed order
      //     canceled = order canceled
      //     expired = order expired
      // opentm = unix timestamp of when order was placed
      // starttm = unix timestamp of order start time (or 0 if not set)
      // expiretm = unix timestamp of order end time (or 0 if not set)
      // descr = order description info
      //     pair = asset pair
      //     type = type of order (buy/sell)
      //     ordertype = order type (See Add standard order)
      //     price = primary price
      //     price2 = secondary price
      //     leverage = amount of leverage
      //     order = order description
      //     close = conditional close order description (if conditional close set)
      // vol = volume of order (base currency unless viqc set in oflags)
      // vol_exec = volume executed (base currency unless viqc set in oflags)
      // cost = total cost (quote currency unless unless viqc set in oflags)
      // fee = total fee (quote currency)
      // price = average price (quote currency unless viqc set in oflags)
      // stopprice = stop price (quote currency, for trailing stops)
      // limitprice = triggered limit price (quote currency, when limit based order type triggered)
      // misc = comma delimited list of miscellaneous info
      //     stopped = triggered by stop price
      //     touched = triggered by touch price
      //     liquidated = liquidation
      //     partial = partial fill
      // oflags = comma delimited list of order flags
      //     viqc = volume in quote currency
      //     fcib = prefer fee in base currency (default if selling)
      //     fciq = prefer fee in quote currency (default if buying)
      //     nompp = no market price protection
      // trades = array of trade ids related to order (if trades info requested and data available)
      //
      this._requestPrivate('POST', 'QueryOrders', {
        txid: txid.join(','), // comma separted list
      }).subscribe(data => {
        subject.next(data);
      });
    }, 2000); // every 2 seconds

    return subject;
  }

  // Message signature using HMAC-SHA512 of (URI path + SHA256(nonce + POST data)) and base64 decoded secret API key
  _getSignature(url: string, body: string = '', nonce: number): string {
    // https://github.com/nothingisdead/npm-kraken-api/blob/master/kraken.js#L19
    const hash= crypto.createHash('sha256');
    const hmac = crypto.createHmac('sha512', new Buffer(this._api.secret || '', 'base64'));

    let hashBody = hash.update(nonce + body).digest('binary');
    return hmac.update(url + hashBody, 'binary').digest('base64');
  }

  _getDepositMethod(account: Account) {
    const subject = new ReplaySubject(1); // buffer last value

    let settingsAccount = (this.settings.extra || {})[account.type] || {};
    let depositMethod = settingsAccount ? settingsAccount['method'] : null;

    if (depositMethod) {
      subject.next(depositMethod);
      subject.complete();

    }  else {
      // response:
      // [
      // {
      //   method: 'Bitcoin',
      //   limit: false,
      //   fee: '0.0000000000',
      //   'gen-address': true
      // }
      //   ...
      // ]
      this._requestPrivate('POST', 'DepositMethods', {
        asset: this._getAssetSymbol(account.type),
      }).subscribe(data => {

        let dataDeposit = data[0]; // experimental / just take the first one

        this.settings.extra = this.settings.extra || {};
        this.settings.extra[account.type] = dataDeposit;

        subject.next(dataDeposit['method']);
        subject.complete();

      }, err => {
        subject.error(err);
        subject.complete();
      });
    }

    return subject;
  }
}

const settings = {
  accounts: {
    [A.BCH]: 'BCH',
    [A.BTC]: 'XXBT',
    [A.DASH]: 'DASH',
    [A.EOS]: 'EOS',
    [A.ETC]: 'ETC',
    [A.ETH]: 'XETH',
    // [A.GNO]: 'GNO',
    // [A.ICN]: 'ICN',
    [A.LTC]: 'LTC',
    // [A.MLN]: 'MLN',
    // [A.REP]: 'REP',
    // [A.XDG]: 'XDG',
    [A.XLM]: 'XLM',
    [A.XMR]: 'XMR',
    [A.XRP]: 'XRP',
    [A.ZEC]: 'ZEC',
    [A.USDT]: 'USDT',
  },
  markets: {
    [M.BCHBTC]: 'BCHXBT',
    [M.DASHBTC]: 'DASHXBT',
    [M.EOSBTC]: 'EOSXBT',
    [M.ETCBTC]: 'XETCXXBT',
    [M.ETHBTC]: 'XETHXXBT',
    [M.LTCBTC]: 'XLTCXXBT',
    [M.XLMBTC]: 'XLMXBT',
    [M.XMRBTC]: 'XXMRXXBT',
    [M.XRPBTC]: 'XXRPXXBT',
    [M.ZECBTC]: 'XZECXXBT',
    [M.EOSETH]: 'EOSETH',
    [M.ETCETH]: 'XETCXETH',
    // [M.GNOETH]: 'GNOETH',
    // [M.LCNETH]: 'LCNETH',
    // [M.MLNETH]: 'MLNETH',
    // [M.REPETH]: 'REPETH',
    // [M.USDUSDT]: 'USDUSDT',
  },
  minimum: {
    // per base asset (not quote asset)
    // https://support.kraken.com/hc/en-us/articles/205893708-What-is-the-minimum-order-size-
    [A.BCH]: 0.002,
    [A.BTC]: 0.002,
    [A.DASH]: 0.03,
    [A.EOS]: 3,
    [A.ETH]: 0.02,
    [A.ETC]: 0.3,
    //[A.GNO]: 0.03,
    [A.LTC]: 0.1,
    //[A.MLN]: 0.1,
    //[A.REP]: 0.3,
    [A.STR]: 300,
    [A.XMR]: 0.1,
    [A.XRP]: 30,
    [A.ZEC]: 0.03,
    [A.USDT]: 5,
  },
  fees: { // TODO: clarify
    make: 0.002, // and even less
    take: 0.001, // and even less
  },
};
