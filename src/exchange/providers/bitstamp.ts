const crypto = require('crypto');
const Pusher = require('pusher-js');
const request = require('request');
import { Observable, ReplaySubject } from 'rxjs';

import { TMarketType, TMarketSide, TMarketBookOrder, IMarket } from '../../market/interfaces';
import { TExchangeName, IExchange, IExchangeConstructor } from '../interfaces';

import config from '../config';
import { Market } from '../../market';
import { Order } from '../../order';

const { BUY, SELL } = config.side.values;
const { RATE, AMOUNT } = config.book.order;
const { OPEN, FILLED, CANCELED, FAILED } = config.order.status.values;
const { asset: {values: A}, market: {values: M} } = config;

// https://www.bitstamp.net/api/
// https://www.bitstamp.net/websocket/
export const ExchangeBinanceProvider = (Exchange: IExchangeConstructor) => class ExchangeKraken extends Exchange implements IExchange {
  name = config.exchange.values.BITSTAMP;

  _api = {
    url: 'https://www.bitstamp.net/api/v2/',
    pusher: 'de504dc5763aeef9ff52',
    customerId: null,
    key: null,
    secret: null,
  };

  _pusher: any;

  constructor(key?: string, secret?: string, customerId?: string, ...props) {
    super(settings, ...props);
    this._api['key'] = key;
    this._api['secret'] = secret;
    this._api['customerId'] = customerId;

    // bootstrap services
    let pusher = new Pusher(this._api.pusher);
    this._pusher = pusher;
  }

  init(marketTypes?: TMarketType | TMarketType[], options?: any): Observable<Market[]> {
    let observable = super.init(marketTypes, options);

    observable.subscribe((markets: Market[]) => {
      markets.forEach((market: Market) => {
        this._subscribeBooks(market);
        this._subscribeOrders(market);
      });
    });

    return observable;
  }

  buy(market: Market, rate: number, amount: number): Observable<Order> {
    const subject: ReplaySubject<Order> = new ReplaySubject();

    let order = new Order(BUY, rate, amount);
    this.orderObserve(order);

    // response:
    // { 
    //   id: '38297301',
    //   type: '1',
    //   price: '0.01530000',
    //   amount: '0.20000000',
    //   datetime: '2017-06-29 11:57:57.808037'
    // }
    this._request('POST', 'buy/' + this._getAssetPairSymbol(market.type) + '/', {
      price: rate.toString(),
      amount: amount.toString(),
    }).subscribe(data => {
      order.update({
        originId: data['id'],
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

  sell(market: Market, rate: number, amount: number): Observable<Order> {
    const subject: ReplaySubject<Order> = new ReplaySubject();

    let order = new Order(SELL, rate, amount);
    this.orderObserve(order);

    // response:
    // { 
    //   id: '38297301',
    //   type: '1',
    //   price: '0.01530000',
    //   amount: '0.20000000',
    //   datetime: '2017-06-29 11:57:57.808037'
    // }
    this._request('POST', 'sell/' + this._getAssetPairSymbol(market.type) + '/', {
      price: rate.toString(),
      amount: amount.toString(),
    }).subscribe(data => {
      order.update({
        originId: data['id'],
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

  getMinimum(market: Market): number {
    let assets = market.assets();
    let assetQuote = assets[1];
    let rate = this.getRate(market);

    return rate ? this.settings.minimum[assetQuote] / rate : 0;
  }

  _request(method: string, path: string, data?: any) {
    let nonce = Date.now();
    let form = Object.assign({}, data, {
      key: this._api.key,
      signature: this._getSignature(nonce),
      nonce: nonce,
    });

    const subject = new ReplaySubject(1); // buffer last value

    request({
      method: method || 'POST',
      url: this._api.url + path,
      form: form,
    }, (err, res, body) => {
      body = JSON.parse(body || '{}');

      if (body && body.status == 'error') {
        subject.error(body);
        console.error('ERROR', config.exchange.labels[this.name], path, body.reason);
      } else {
        subject.next(body);
      }

      subject.complete();
    });

    return subject;
  }

  _subscribeBooks(market: Market) {
    const { BUY, SELL } = config.side.values;
    const channel = 'diff_order_book_' + this._getAssetPairSymbol(market.type);

    this._pusher.subscribe(channel).bind('data', data => {

      [].concat(
        data.bids.map(item => ({side: BUY, data: item})),
        data.asks.map(item => ({side: SELL, data: item}))
      ).forEach(item => {
        let book = market.books[item.side];
        let bookOrder: TMarketBookOrder = [parseFloat(item.data[RATE]), parseFloat(item.data[AMOUNT])];

        // filter out "self" orders from the market order books
        if (this.findOrderByBookOrder(item.side, bookOrder)) { return; }

        // notes:
        // get order with 0.0 amount to remove it from the list
        bookOrder[1] ? book.add(bookOrder) : book.remove(bookOrder);
      });
    });
  }

  // temporal 
  // refactor to fetch "personal" endpoint
  _subscribeOrders(market: Market) {
    const { CANCELED, FILLED } = config.order.status.values;
    const channel = 'live_orders_' + this._getAssetPairSymbol(market.type);
    const subscription = this._pusher.subscribe(channel);

    // response
    // { 
    //   id: 37959576,
    //   order_type: 0,
    //   price: 0.01460001,
    //   amount: 952.12076439,
    //   datetime: '1498710530'
    // }
    subscription.bind('order_deleted', data => { // 'order_changed', 'order_created'
      const order = this.findOrder(data.id);

      // amount = 0 - for filled orders, amount > 0 - for canceled orders
      order && order.update({status: data.amount ? CANCELED : FILLED}); // experimental
    });
  }

  // RESERVED
  // _subscribeTrades(market) { // string
  //   const channel = 'live_trades_' + this._getAssetPairSymbol(market.type);

  //   const subject = new ReplaySubject(1); // buffer last value

  //   this._pusher.subscribe(channel).bind('data', data => {
  //     subject.next();
  //   });

  //   return subject;
  // }

  _getSignature(nonce: number): string {
    const hmac = crypto.createHmac('sha256', this._api.secret);
    const body = nonce.toString() + this._api.customerId + this._api.key;
    return hmac.update(body).digest('hex').toUpperCase();
  }
}

const settings = {
  accounts: {
    [A.BTC]: 'btc',
    [A.LTC]: 'ltc',
    [A.XRP]: 'xrp',
  },
  markets: {
    [M.LTCBTC]: 'ltcbtc',
    [M.XRPBTC]: 'xrpbtc',
  },
  minimum: {
    // per quote asset
    [A.EUR]: 5,
    [A.USD]: 5,
    [A.GBP]: 5,
  },
  frequency: 6, // requests per second
  fees: {
    make: 0.0015, // fraction / or even 0.12% or less
    take: 0.0015,
  },
};
