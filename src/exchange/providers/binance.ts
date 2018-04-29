const crypto = require('crypto');
const WebSocket = require('ws');
const request = require('request');
const querystring = require('querystring'); // replace URLSearchParams

import { Observable, ReplaySubject } from 'rxjs';

import { TMarketType, TMarketSide, TMarketBookOrder } from '../../market/interfaces';
import { TExchangeName, IExchange, IExchangeConstructor } from '../interfaces';

import config from '../config';
import { Account, Transfer } from '../../account';
import { Market } from '../../market';
import { Order } from '../../order';

const { BUY, SELL } = config.side.values;
const { RATE, AMOUNT } = config.book.order;
const { OPEN, FILLED, CANCELED, FAILED } = config.order.status.values;
const { asset: {values: A}, market: {values: M} } = config;

// https://github.com/binance-exchange/binance-official-api-docs
// https://www.binance.com/restapipub.html
export const ExchangeBinanceProvider = (Exchange: IExchangeConstructor) => class ExchangeKraken extends Exchange {
  name = config.exchange.values.BINANCE;

  _api = {
    url: 'https://api.binance.com/api/v1/',
    urlNew: 'https://api.binance.com/api/v3/',
    urlWithdrawal: 'https://api.binance.com/wapi/v3/',
    stream: 'wss://stream.binance.com:9443/ws/',
    streamDepth: (assetPairSymbol: string) => 'wss://stream.binance.com:9443/ws/' + assetPairSymbol.toLowerCase() + '@depth',
    streamTrade: (assetPairSymbol: string) => 'wss://stream.binance.com:9443/ws/' + assetPairSymbol.toLowerCase() + '@aggTrade',
    streamAccount: (listenKey: string) => 'wss://stream.binance.com:9443/ws/' + listenKey,
    key: null,
    secret: null,
  };

  // OBSOLETED
  // _wsMarket: any;
  _wsAccount: any;

  // OBSOLETED
  _observables: {
    // market: Observable<any>,
    // trading: Observable<any>,
    account: Observable<any>,
  } = {
    // market: null,
    // trading: null,
    account: null,
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

          subject.next(markets);
          subject.complete();
        });
      }
    );

    // https://www.binance.com/restapipub.html#user-content-user-data-stream-endpoints
    this._request('POST', 'userDataStream').subscribe(data => {
      let listenKey = data['listenKey'];

      let ws = new WebSocket(this._api.streamAccount(listenKey));
      this._wsAccount = ws;

      this._wsAccount.onopen = session => {
        const subjectAccount = new ReplaySubject();
        this._observables.account = <Observable<any>> subjectAccount;

        this._on(this._wsAccount, 'message', data => {
          subjectAccount['next'](data);
        });

        // experimental / keep stream alive
        // https://www.binance.com/restapipub.html#user-content-user-data-stream-endpoints
        setInterval(() => {
          this._request('PUT', 'userDataStream', {listenKey: listenKey});
        }, 10000);

        this._subscribeOrders();
      }

      this._wsAccount.onclose = () => {
        // pass / temporal
      }
    });

    return subject.asObservable();
  }

  buy(market: Market, rate: number, amount: number, timeInForce: string = 'GTC'): Observable<Order> {
    const subject: ReplaySubject<Order> = new ReplaySubject();
    const settings = this.settings.extra[market.type];

    let order = new Order(BUY, rate, amount);
    super.orderObserve(order);

    // response
    // {
    //   "symbol":"LTCBTC",
    //   "orderId": 1,
    //   "clientOrderId": "myOrder1" // Will be newClientOrderId
    //   "transactTime": 1499827319559
    // }
    this._request('POST', 'order', {
      symbol: this._getAssetPairSymbol(market.type),
      side: 'BUY',
      price: rate.toFixed(settings['rateDecimals']),
      quantity: amount.toFixed(6),
      type: 'LIMIT', // LIMIT, MARKET
      timeInForce: 'GTC', // GTC - Good-Til-Canceled, IOC - Immediate-Or-Cancel
      // stopPrice
      // icebergQty
    }).subscribe(data => {
      order.update({
        originId: data['orderId'],
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

  sell(market: Market, rate: number, amount: number, timeInForce: string = 'GTC'): Observable<Order> {
    const subject: ReplaySubject<Order> = new ReplaySubject();
    const settings = this.settings.extra[market.type];

    let order = new Order(SELL, rate, amount);
    this.orderObserve(order);

    // response
    // - no response in case of success
    this._request('POST', 'order', {
      symbol: this._getAssetPairSymbol(market.type),
      side: 'SELL',
      price: rate.toFixed(settings['rateDecimals']),
      quantity: amount.toFixed(6),
      type: 'LIMIT', // LIMIT, MARKET
      timeInForce: 'GTC', // GTC - Good-Til-Canceled, IOC - Immediate-Or-Cancel
      // stopPrice
      // icebergQty
    }).subscribe(data => {
      order.update({
        originId: data['orderId'],
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
    //   "symbol":"LTCBTC",
    //   "orderId": 1,
    //   "clientOrderId": "myOrder1" // Will be newClientOrderId
    //   "transactTime": 1499827319559
    // }
    this._request('DELETE', 'order', {
      orderId: order.originId,
      symbol: this._getAssetPairSymbol(market.type),
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

    // response:
    // { 
    // "address": "0x6915f16f8791d0a1cc2bf47c13a6b2a92000504b",
    // "success": true,
    // "addressTag": "1231212",
    // "asset": "BNB"
    // }
    this._request('GET', 'depositAddress.html', {
      asset: this._getAssetSymbol(account.type),
      timestamp: Date.now(),
    }).subscribe(data => {
      account.address = data['address'];
      subject.next(account);
      subject.complete();

    }, err => {
      subject.error(account);
      subject.complete();
    });

    return subject.asObservable();
  }

  balance(account: Account): Observable<Account> {
    const subject: ReplaySubject<Account> = new ReplaySubject(1);

    // response:
    // "balance": [
    //   { 
    //     "currency_code" : "BTC",
    //     "cash" : 1.000,
    //     "reserved" : 0.000,
    //   },
    //   ...
    // ]
    this._request('GET', 'account').subscribe(data => { // _requestPayment
      let assetSymbol = this._getAssetSymbol(account.type);

      let assetBalance = data['balances'].find((itemBalance) =>
        itemBalance['asset'] == assetSymbol
      ) || {};

      // RESERVED / account.amount = assetBalance['free'] || 0;
      account.amount = (assetBalance['free'] || 0) - (assetBalance['reserved'] || 0);

      subject.next(account);
      subject.complete();

    }, err => {
      subject.error(account);
      subject.complete();
    });

    subject.next(account);
    subject.complete();

    return subject.asObservable();
  }

  getMinimum(market: Market): number {
    let assets = market.assets();
    let assetQuote = assets[1];
    let rate = this.getRate(market);

    return rate ? this.settings.minimum[assetQuote] / rate : 0;
  }

  getStep(marketType: TMarketType): number {
    return this.settings.extra[marketType].step || this.settings.step;
  }

  _initSettings() {
    const subject = new ReplaySubject(1);

    // response:
    // [
    //   {
    //     "symbol": "LTCBTC",
    //     "price": "4.00000200"
    //   },
    //   {
    //     "symbol": "ETHBTC",
    //     "price": "0.07946600"
    //   }
    //   ...
    // ]
    this._request('GET', 'ticker/price').subscribe(data => {

      let extra = data['reduce']((output, dataItem) => {
        let assetPair = this._getMarketType(dataItem['symbol']);
        let step = this.__getStep(parseFloat(dataItem['price'])); // temporal / weak

        assetPair && (output[assetPair] = {
          step: step,
          rateDecimals: (step.toString().split('.')[1] || '').length, // trim tailing zeros in advance
          // RESERVED / amountDecimals: ...,
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

  _request(method: string, path: string, data?: any) {
    let nonce = Date.now();
    let params = Object.assign({}, data);

    let isSigned = (
      // OBSOLETED / method == 'POST' && path == 'userDataStream' ||
      path == 'order' ||
      path == 'openOrders' ||
      path == 'allOrders' ||
      path == 'account' ||
      path == 'myTrades' ||
      path == 'depositAddress' ||

      path == 'depositAddress.html' || // yes, with "html"
      path == 'accountStatus.html' ||
      path == 'withdraw.html'
    );

    let isApiNew = (
      path == 'account' ||
      path == 'openOrders' ||
      path == 'allOrders' ||
      path == 'myTrades'
    );

    let isApiWithdrawal = (
      path == 'depositAddress.html' || // yes, with "html"
      path == 'accountStatus.html' ||
      path == 'systemStatus.html' ||
      path == 'withdraw.html'
    );

    // set path
    path = (
      isApiNew ? this._api.urlNew :
      isApiWithdrawal ? this._api.urlWithdrawal :
      this._api.url
    ) + path;

    // set service params
    isSigned && (params['timestamp'] = nonce);
    // isSigned && (params['recvWindow'] = ...); // number of milliseconds after timestamp the request is valid for

    // set signature param
    params = querystring.stringify(params);
    isSigned && (params += '&signature=' + this._getSignature(params));

    const subject = new ReplaySubject(1); // buffer last value

    request({
      method: method || 'GET',
      url: path + (params ? '?' + params : ''),
      headers: {
        'X-MBX-APIKEY': this._api.key,
        'Content-type': 'application/x-www-form-urlencoded',
      }
    }, (err, res, body) => {
      try {
        body = JSON.parse(body || '{}');
      } catch(e) {
        console.error('ERROR', config.exchange.labels[this.name], path, body);
      }

      if (body && body.msg) {
        // TODO: refactor "Nonce" handler later
        if (body.msg.includes('Nonce')) { // repeat request in case of "nonce" issue
          this._request(method, path, data).subscribe(
            (data) => { subject.next(data) },
            (err) => { subject.error(err) },
            () => { subject.complete() }
          );
        } else {
          subject.error(body);
          console.error('ERROR', config.exchange.labels[this.name], path, body.msg);
        }
      } else {
        subject.next(body);
      }

      subject.complete();
    });

    return subject;
  }

  _subscribeMarket(assetPairSymbol: string, e?: string) {
    const subject = new ReplaySubject();

    let ws = new WebSocket(this._api.streamDepth(assetPairSymbol));

    ws.onopen = session => {
      this._on(ws, 'message', data => {
        // RESERVED / data['e'] == 'depthUpdate' && data['s'] == assetPairSymbol
        subject['next'](data);
      });
    }

    return subject;
  }

  _subscribeAccount(e?: string) {
    const subject = new ReplaySubject();

    this._observables['account'].subscribe(data => {
      data['e'] == e && subject.next(data);
    });

    return subject;
  }

  _subscribeBooks(market: Market) {
    const { BUY, SELL } = config.side.values;
    const pair = this._getAssetPairSymbol(market.type);

    // get full order book
    // {
    //   "lastUpdateId": 1027024,
    //   "bids": [
    //     [
    //       "4.00000000",     // PRICE
    //       "431.00000000",   // QTY
    //       []                // Can be ignored
    //     ]
    //   ],
    //   "asks": [
    //     [
    //       "4.00000200",
    //       "12.00000000",
    //       []
    //     ]
    //   ]
    // }
    this._request('GET', 'depth', {
      symbol: pair,
      limit: config.book.depth,
    }).subscribe(data => {
      let dataOrders = [];

      data['bids'] && data['bids'].forEach(dataOrder => dataOrders.push({
        side: BUY,
        data: [dataOrder[0], dataOrder[1]],
      }));

      data['asks'] && data['asks'].forEach(dataOrder => dataOrders.push({
        side: SELL,
        data: [dataOrder[0], dataOrder[1]],
      }));

      dataOrders.forEach(item => {
        let book = market.books[item.side];
        let bookOrder: TMarketBookOrder = [parseFloat(item.data[RATE]), parseFloat(item.data[AMOUNT])];

        book.add(bookOrder);
      });

      // response:
      // {
      //   "snapshotSeqNo": 899009,
      //   "symbol": "BTCUSD",
      //   "exchangeStatus": "working",
      //   "ask": [
      //     {
      //         "price": 101.42,
      //         "size": 7
      //     },
      //     ...
      //   ],
      //   "bid": [
      //     {
      //         "price": 89.72,
      //         "size": 79
      //     },
      //     ...
      //   ]
      // }
      this._subscribeMarket(pair).subscribe(data => {
        let dataOrders = [];

        // add orders conditionally (updats for book orders could be empty)
        data['b'].forEach(dataOrder => dataOrders.push({
          side: BUY,
          data: [dataOrder[0], dataOrder[1]],
        }));

        data['a'].forEach(dataOrder => dataOrders.push({
          side: SELL,
          data: [dataOrder[0], dataOrder[1]],
        }));

        dataOrders.forEach(item => {
          let book = market.books[item.side];
          let bookOrder: TMarketBookOrder = [parseFloat(item.data[RATE]), parseFloat(item.data[AMOUNT])];

          // TEMP TEMP TEMP
          // TODO: response has no infromation about removed orders
          // the only way to compare new and old books to remove absent orders manually

          // filter out "self" orders from the market order books
          if (market.type == 'ethbtc' && item.side == 'sell' && this.findOrderByBookOrder(item.side, bookOrder)) { return; }

          // get order with 0.0 amount to remove it from the list
          bookOrder[AMOUNT] ? book.add(bookOrder) : book.remove(bookOrder);
        });
      });
    });
  }

  _subscribeOrders() {

    // response (ExecutionReport):
    // {
    //    "e": "executionReport",      // order or trade report
    //    "E": 1499405658658,        // event time
    //    "s": "ETHBTC",          // symbol
    //    "c": "mUvoqJxFIILMdfAW5iGSOW",  // newClientOrderId
    //    "S": "BUY",            // side: buy or sell
    //    "o": "LIMIT",          // order type LIMIT, MARKET
    //    "f": "GTC",            // time in force, GTC: Good Till Cancel, IOC: Immediate or Cancel
    //    "q": "1.00000000",         // original quantity
    //    "p": "0.10264410",        // price
    //    "P": "0.00000000", 
    //    "F": "0.00000000",
    //    "g": -1,
    //    "C": "null",
    //    "x": "NEW",             // executionType NEW, CANCELED, REPLACED, REJECTED, TRADE,EXPIRED
    //    "X": "NEW",             // orderStatus NEW, PARTIALLY_FILLED, FILLED, CANCELED，PENDING_CANCEL, REJECTED, EXPIRED
    //    "r": "NONE",           // orderRejectReason，NONE, UNKNOWN_INSTRUMENT, MARKET_CLOSED, PRICE_QTY_EXCEED_HARD_LIMITS, UNKNOWN_ORDER, DUPLICATE_ORDER, UNKNOWN_ACCOUNT, INSUFFICIENT_BALANCE, ACCOUNT_INACTIVE, ACCOUNT_CANNOT_SETTLE
    //    "i": 4293153,          // order id
    //    "l": "0.00000000",      // quantity of last filled trade
    //    "z": "0.00000000",      // accumulated quantity of filled trades on this order
    //    "L": "0.00000000",      // price of last filled trade
    //    "n": "0",              // commission (fee)
    //    "N": "ETH",             // asset on which commission is taken
    //    "T": 1499405658657,        // order/trade time
    //    "t": -1,               // trade id
    //    "I": 8641984,          // can be ignored
    //    "w": true,             // can be ignored
    //    "m": false,            // is buyer maker
    //    "M": false             // can be ignored
    // }
    this._subscribeAccount('executionReport').subscribe(data => {
      let order = this.findOrder(data['i'] || data['orderId']);
      if (!order) { return; }

      if (data['x'] == 'TRADE') {
        let type = this._getMarketType(data['s'] || data['symbol']);
        let assetTarget = Market.assetTarget(type, order.side);

        let assetFee = this._getAccountType(data['N']);
        let amountFee = assetFee == assetTarget ? parseFloat(data['n']) || 0.0 : 0.0;

        let amountFilled = parseFloat(data['z']);
        let amountFunded = order.side == BUY ?
          parseFloat(data['l']) // what?: parseFloat(data['l'])
          :
          parseFloat(data['l']) - amountFee;  // what?: * parseFloat(data['l']) 

        order.update({
          amountFilled: amountFilled,
          amountFunded: order.amountFunded + amountFunded,
          amountFee: order.amountFee + amountFee,
          assetFee: assetFee,
        });
      }

      if (order.isOpen) {
        data['X'] == 'FILLED' && order.close();
        data['X'] == 'REJECTED' && order.close();
        data['X'] == 'EXPIRED' && order.close(CANCELED); // experimental
        data['X'] == 'CANCELED' && order.close(CANCELED); // experimental
      }
    });
  }

  _on(socket: WebSocket, e: string, callback?: Function) {
    socket['on'](e, data => {
      try {
        data = JSON.parse(data || '{}');
      } catch(e) {
        // pass
      }

      callback && callback(data);
    });
  }

  _send(socket: WebSocket, e: string, data: any = {}): Observable<any> {
    const subject: ReplaySubject<any> = new ReplaySubject(1);

    let nonce = Date.now();
    let body = {
      message: {
        nonce: nonce,
        payload: {
          [e]: data,
        },
      },
    };

    body['apikey'] = this._api.key;
    body['signature'] = this._getSignature(JSON.stringify(body.message));

    let socketAny = <any>socket; // workaround / sorry, typescript
    <any>socketAny.send(JSON.stringify(body), err => {
      err ? subject.error(err) : subject.next(undefined);
      subject.complete();
    });

    return subject;
  }

  _getSignature(body: string = ''): string {
    // OBSOLETED
    // const hmac = crypto.createHash('sha256');
    // return hmac.update(this._api.secret + '|' + body).digest('hex'); // .toUpperCase();

    const hmac = crypto.createHmac('sha256', this._api.secret);
    return hmac.update(body).digest('hex');
  }

  // temporal
  // till the exchange provides "step" size settings via api
  __getStep(rate: number) {
    let stepMax = rate > 0.001 ? 0.000001 : 0.00000001;
    let stepMin = parseFloat(rate.toString().replace(/[0-9]/g, '0').replace(/.$/, '1')); // 123.456 -> 0.001
    return Math.min(stepMax, stepMin);
  }
}

const settings = {
  accounts: {
    [A.BCH]: 'BCC',
    [A.BTC]: 'BTC',
    [A.EOS]: 'EOS',
    [A.ETH]: 'ETH',
    [A.MCO]: 'MCO',
    [A.LTC]: 'LTC',
    [A.NEO]: 'NEO',
    [A.OMG]: 'OMG',
    [A.QTUM]: 'QTUM',
    [A.USDT]: 'USDT',
    [A.STRAT]: 'STRAT',
    [A.WTC]: 'WTC',
    //[A.XMR]: 'XMR',
    //[A.XRP]: 'XRP',
    [A.ZRX]: 'ZRX',
    [A.ZEC]: 'ZEC',
  },
  markets: {
    [M.BCHBTC]: 'BCCBTC',
    [M.EOSBTC]: 'EOSBTC',
    [M.ETHBTC]: 'ETHBTC',
    [M.MCOBTC]: 'MCOBTC',
    [M.LTCBTC]: 'LTCBTC',
    [M.MCOBTC]: 'MCOBTC',
    [M.NEOBTC]: 'NEOBTC',
    [M.OMGBTC]: 'OMGBTC',
    [M.QTUMBTC]: 'QTUMBTC',
    [M.STRATBTC]: 'STRATBTC',
    [M.WTCBTC]: 'WTCBTC',
    [M.XMRBTC]: 'XMRBTC',
    [M.XRPBTC]: 'XRPBTC',
    [M.ZRXBTC]: 'ZRXBTC',
    [M.ZECBTC]: 'ZECBTC',
    //[M.DNTETH]: 'DNTETH',
    [M.EOSETH]: 'EOSETH',
    //[M.MCOETH]: 'MCOETH',
    //[M.OMGETH]: 'OMGETH',
    [M.BTCUSDT]: 'BTCUSDT',
    [M.ETHUSDT]: 'ETHUSDT',
  },
  minimum: {
    // per quote asset
    [A.BTC]: 0.001,
    [A.ETH]: 0.01,
    [A.USDT]: 1,
  },
  fees: {
    make: 0.001, // fraction / get a 50%- discount with BNB
    take: 0.001,
  },
};
