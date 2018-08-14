import { Observable, ReplaySubject, Subscription } from 'rxjs';

import { TAsset } from '../asset/interfaces';
import { TMarketType, TMarketSide, TMarketBookOrder } from './interfaces';
import { IMarket, IMarketBooks, IMarketBook } from './interfaces';

import config from './config';

const { BUY, SELL } = config.side.values;
const { RATE, AMOUNT } = config.book.order;

export class Market implements IMarket {
  type: TMarketType;
  books: IMarketBooks; // book of orders

  private _observable: ReplaySubject<Market>; // not in use

  constructor(type: TMarketType, ...props) {
    this['type'] = type;
    this['books'] = <any> { // IMarketBooks
      [BUY]: new MarketBook(BUY),
      [SELL]: new MarketBook(SELL),
    };

    this['_observable'] = new ReplaySubject(1); // buffer last value

    // set observables
    [BUY, SELL].forEach((itemSide: TMarketSide) => {
      this.books[itemSide].subscribe(() => {
        this._observable.next(this);
      });
    });
  }

  // not in use
  subscribe(onNext: Function, ...props): Subscription {
    return this._observable.subscribe(<any>onNext.bind(this));
  }

  assets(): TAsset[] {
    return Market.assets(this.type);
  }

  assetSource(side: TMarketSide): TAsset {
    return Market.assetSource(this.type, side);
  }

  assetTarget(side: TMarketSide): TAsset {
    return Market.assetTarget(this.type, side);
  }

  // experimental / percentage
  spread(): number {
    return Market.spread(this.books[SELL][0], this.books[BUY][0]);
  }

  spreadPercent(): number {
    return Market.spreadPercent(this.books[SELL][0], this.books[BUY][0]);
  }

  static assets(type: TMarketType): TAsset[] {
    let assetQuote = config.asset.quotes.find(itemQuote => type.endsWith(itemQuote));
    let assetBase = type.substr(0, type.length - assetQuote.length);

    return [assetBase, assetQuote];
  }

  static assetSource(type: TMarketType, side: TMarketSide): TAsset {
    let assets = Market.assets(type);
    return side == BUY ? assets[1] : assets[0];
  }

  static assetTarget(type: TMarketType, side: TMarketSide): TAsset {
    let assets = Market.assets(type);
    return side == BUY ? assets[0] : assets[1];
  }

  static spread(orderA: TMarketBookOrder, orderB: TMarketBookOrder): number {
    if (!orderA || !orderB) { return 0; }
    return orderB[RATE] - orderA[RATE];
  }

  static spreadPercent(orderA: TMarketBookOrder, orderB: TMarketBookOrder): number {
    if (!orderA || !orderB) { return 0; }

    const average = (orderB[RATE] + orderA[RATE]) / 2;
    return average ? Market.spread(orderB, orderA) / average : 0;
  }
}

export class MarketBook implements IMarketBook {
  side: TMarketSide;
  orders: TMarketBookOrder[];

  private _observable: ReplaySubject<MarketBook>;

  constructor(side: TMarketSide, ...props) {
    this['side'] = side;
    this['orders'] = [];
    this['_observable'] = new ReplaySubject(1); // buffer last value
  }

  subscribe(onNext: Function, ...props) {
    return this._observable.subscribe(<any>onNext.bind(this));
  }

  add(order: TMarketBookOrder): MarketBook {
    let orders = [].concat(this.orders);
    let index = orders.findIndex((item: TMarketBookOrder) =>
      Rate.tip(this.side, item[RATE], order[RATE]) == order[RATE]
    );

    index == -1 && orders.push(order);
    index > -1 && orders[index][RATE] != order[RATE] && orders.splice(index, 0, order);
    this.orders = orders.slice(0, config.book.depth);

    this.orders[0] == order && this._observable.next(this); // temporal
    return this;
  }

  remove(order: TMarketBookOrder): MarketBook {
    let orders = [].concat(this.orders);

    this.orders = orders.filter((item: TMarketBookOrder) => item[RATE] != order[RATE]);

    // TODO: temp temp temp / trigger only on non empty book 
    // if book's empty or invalid market should be marked as "closed"?
    // !this.orders[0] && this._observable.next(this); // temporal
    this.orders[0] != orders[0] && this._observable.next(this); // temporal
    return this;
  }

  reset(orders: TMarketBookOrder | TMarketBookOrder[]): MarketBook {
    orders = Array.isArray(orders) ? [orders] : orders;

    const isNext = (
      orders[0][RATE] == this.orders[0][RATE] &&
      orders[0][AMOUNT] == this.orders[0][AMOUNT]
    )

    this.orders = [].concat(orders);
    isNext && this._observable.next(this); // temporal
    return this;
  }
}

export class Rate extends Number {
  side: TMarketSide;

  constructor(side: TMarketSide, value: number) {
    super(value);
    this.side = side;
  }

  static create(side: TMarketSide, value: number): Rate {
    return new Rate(side, value);
  }

  // a-la "tipper" for order book
  static tip(side: TMarketSide, valueA: number, valueB: number): number {
    return (
      side == BUY && Math.max(valueA, valueB)
      ||
      side == SELL && Math.min(valueA, valueB)
    );
  }

  // a-la "deeper" for order book
  static dip(side: TMarketSide, valueA: number, valueB: number): number {
    return (
      side == BUY && Math.min(valueA, valueB)
      ||
      side == SELL && Math.max(valueA, valueB)
    );
  }

  // a-la "add" for order book
  static up(side: TMarketSide, valueA: number, valueB: number): number {
    return (
      side == BUY && (valueA + valueB)
      ||
      side == SELL && (valueA - valueB)
    );
  }

  // a-la "substract" for order book
  static down(side: TMarketSide, valueA: number, valueB: number): number {
    return (
      side == BUY && (valueA - valueB)
      ||
      side == SELL && (valueA + valueB)
    );
  }

  tip(value: number): Rate {
    return new Rate(this.side, Rate.tip(this.side, this.valueOf(), value));
  }

  dip(value: number): Rate {
    return new Rate(this.side, Rate.dip(this.side, this.valueOf(), value));
  }

  up(value: number): Rate {
    return new Rate(this.side, Rate.up(this.side, this.valueOf(), value));
  }

  down(value: number): Rate {
    return new Rate(this.side, Rate.down(this.side, this.valueOf(), value));
  }

  upPercentage(value: number): Rate {
    value = value * this.valueOf();
    return new Rate(this.side, Rate.up(this.side, this.valueOf(), value));
  }

  downPercentage(value: number): Rate {
    value = value * this.valueOf();
    return new Rate(this.side, Rate.down(this.side, this.valueOf(), value));
  }
}

