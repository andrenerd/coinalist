import { Observable, ReplaySubject } from 'rxjs';
// import 'rxjs/add/operator/filter'; // declare
// import 'rxjs/add/operator/share'; // declare

import { TAccountType, TTransferId, TTransferType, TTransferStatus } from '../account/interfaces';
import { TMarketType, TMarketSide, TMarketBookOrder } from '../market/interfaces';
import { TOrderId, TOrderOriginId } from '../order/interfaces';
import { Account, Transfer } from '../account';
import { Market } from '../market';
import { Order } from '../order';

import { TExchangeName, IExchange } from './interfaces';
import config from './config';

const { BUY, SELL } = config.side.values;
const { RATE, AMOUNT } = config.book.order;

export class Exchange implements IExchange {
  name: TExchangeName;
  settings = config.exchange.settings;

  options: any = {
    trade: false,
  };

  // experimental
  observables: {
    transfers: ReplaySubject<any>,
    orders: ReplaySubject<any>,
  } = {
    transfers: new ReplaySubject(1),
    orders: new ReplaySubject(1),
  };

  accounts: Account[] = [];
  markets: Market[] = [];

  transfers: Transfer[] = []; // experimental
  orders: Order[] = []; // experimental

  private _accountsAssetSymbols: {[key: string]: string}; // for caching // key: TAccountType
  private _assetSymbolsAccounts: {[key: string]: TAccountType}; // for caching

  private _marketsAssetPairSymbols: {[key: string]: string}; // for caching // key: TMarketType
  private _assetPairSymbolsMarkets: {[key: string]: TMarketType}; // for caching

  constructor(settings?: object, ...props) {
    this.settings = Object.assign({}, this.settings, settings);

    // RESERVED / what was that for?
    // autoset reversed config for exchanges
    // Object.keys(settings['markets']).forEach((itemMarket: TMarketType) => {
    //   config.market.exchanges[itemMarket] = config.market.exchanges[itemMarket] || [];
    //   config.market.exchanges[itemMarket].push(itemExchange);
    // });
  }

  init(marketTypes?: TMarketType | TMarketType[], options?: any): Observable<Market[]> {
    const subject: ReplaySubject<Market[]> = new ReplaySubject(1); // buffer last value

    // init settings and options
    this.settings = Object.assign(this.settings, config.exchange.settings[this.name]);
    this.options = Object.assign(this.options, options);

    // init service variables
    this._accountsAssetSymbols = this.settings.accounts; // accountTypes
    this._assetSymbolsAccounts = Object.keys(this._accountsAssetSymbols).reduce((output: any, item: TAccountType) => {
      output[this._accountsAssetSymbols[item]] = item;
      return output;
    }, {});

    this._marketsAssetPairSymbols = this.settings.markets; // marketTypes
    this._assetPairSymbolsMarkets = Object.keys(this._marketsAssetPairSymbols).reduce((output: any, item: TMarketType) => {
      output[this._marketsAssetPairSymbols[item]] = item;
      return output;
    }, {});

    // init background processes
    marketTypes = <TMarketType[]> (marketTypes ? [].concat(marketTypes) : Object.keys(this._marketsAssetPairSymbols));
    marketTypes.forEach((itemMarketType, indexMarketType) => {
      let market: Market = new Market(itemMarketType);
      this.markets.push(market);

      // RESERVED
      // init accounts (in trade mode only)
      // this.options['trade'] && market.assets().forEach((item, index) => {
      //   if (!this.findAccount(item)) {
      //     let account = new Account(item);
      //     this.accounts.push(account);

      //     setTimeout(() => {
      //       // experimental
      //       // init in async mode
      //       this.address(account).subscribe(() => {
      //         this.balance(account).subscribe(() => {
      //           // pass
      //         });
      //       });
      //     }, 111 * indexMarketType + 33 * index); // to not overcome api limits

      //   }
      // });

      subject.next(this.markets);
      subject.complete();
    });

    return subject.asObservable();
  }

  findAccount(type: TAccountType): Account {
    return this.accounts.find((item: Account) => item.type == type);
  }

  findMarket(type: TMarketType): Market {
    return this.markets.find((item: Market) => item.type == type);
  }

  findOrder(idOrOriginId: TOrderId | TOrderOriginId): Order {
    return this.orders.find((item: Order) => idOrOriginId == item.id || idOrOriginId == item.originId);
  }

  // experimental
  findOrderByBookOrder(side: TMarketSide, bookOrder: TMarketBookOrder): Order {
    return this.orders.find(itemOrder =>
      itemOrder.side == side
        && itemOrder.rate == bookOrder[RATE]
        && itemOrder.amount == bookOrder[AMOUNT]
    );
  }

  // experimental
  // adjust rate
  // rate(market: Market, rate: number) {
  //   market.
  //   rate
  //   market
  // }

  buy(market: Market, rate: number, amount: number): Observable<Order> {
    const subject: ReplaySubject<Order> = new ReplaySubject();

    subject.error(this.name + ': Buy method / Not implemented...');
    subject.complete();

    return subject.asObservable();
  }

  sell(market: Market, rate: number, amount: number): Observable<Order> {
    const subject: ReplaySubject<Order> = new ReplaySubject();

    subject.error(this.name + ': Sell method / Not implemented...');
    subject.complete();

    return subject.asObservable();
  }

  cancel(market: Market, order: Order): Observable<Order> {
    const subject: ReplaySubject<Order> = new ReplaySubject(1);

    subject.error(this.name + ': Cancel method / Not implemented...');
    subject.complete();

    return subject.asObservable();
  }

  // experimental
  move(market: Market, order: Order, rate?: number, amount?: number): Observable<Order> {
    const subject: ReplaySubject<Order> = new ReplaySubject(1);

    subject.error(this.name + ': Move method / Not implemented...');
    subject.complete();

    return subject.asObservable();
  }

  order(side: TMarketSide, market: Market, rate: number, amount: number): Observable<Order> {
    return this[side](market, rate, amount);
  }

  // experimental
  orderObserve(order: Order) {
    this.orders.push(order);
    this.observables.orders.next(this.orders);

    order.subscribe((order: Order) => {
      if (!order.isOpen) {
        this.orders = this.orders.filter((itemOrder: Order) => itemOrder.id != order.id); // remove order
        this.observables.orders.next(this.orders);
      }
    });
  }

  transfer(account: Account, amount: number): Observable<Transfer> {
    const subject: ReplaySubject<Transfer> = new ReplaySubject(1);

    subject.error(this.name + ': Transfer method / Not implemented...');
    subject.complete();

    return subject.asObservable();
  }

  // experimental
  transferObserve(transfer: Transfer) {
    this.transfers.push(transfer);
    this.observables.transfers.next(this.transfers);

    transfer.subscribe((order: Order) => {
      if (!transfer.isOpen) {
        this.transfers = this.transfers.filter((itemTransfer: Transfer) => itemTransfer.id != transfer.id); // remove transfer
        this.observables.transfers.next(this.transfers);
      }
    });
  }

  // experimental
  // get deposit address
  address(account: Account): Observable<Account> {
    const subject: ReplaySubject<Account> = new ReplaySubject(1);

    subject.error(this.name + ': Address method / Not implemented...');
    subject.complete();

    return subject.asObservable();
  }

  // experimental
  // get account state
  balance(account: Account): Observable<Account> {
    const subject: ReplaySubject<Account> = new ReplaySubject(1);

    console.log();
    subject.error(this.name + ': Balance method / Not implemented...');
    subject.complete();

    return subject.asObservable();
  }

  // experimental
  // current rate
  getRate(market: Market): number {
    let books = market.books;
    return (
      ((books[BUY].orders[0] || [])[RATE] || 0)
      +
      ((books[SELL].orders[0] || [])[RATE] || 0)
    ) / 2;
  }

  // experimental
  // trade minimum
  getMinimum(market: Market): number {
    // pass, not implemented
    return 0;
  }

  // trade rate step
  getStep(marketType?: TMarketType): number {
    return this.settings.step;
  }

  _getAssetSymbol(accountType: TAccountType): string {
    return this._accountsAssetSymbols[accountType];
  }

  _getAccountType(assetSymbol: string): TAccountType {
    return this._assetSymbolsAccounts[assetSymbol];
  }

  _getAssetPairSymbol(marketType: TMarketType): string {
    return this._marketsAssetPairSymbols[marketType];
  }

  _getMarketType(curencyPairSymbol: string): TMarketType {
    return this._assetPairSymbolsMarkets[curencyPairSymbol];
  }
}

import { ExchangeBinanceProvider } from './providers/binance';
// import { ExchangeBitstampProvider } from './providers/bitstamp';
// import { ExchangeBittrexProvider } from './providers/bittrex';
// import { ExchangeKrakenProvider } from './providers/kraken';
// import { ExchangePoloniexProvider } from './providers/poloniex';

export const ExchangeBinance = ExchangeBinanceProvider(Exchange);
// export const ExchangeBitstamp = ExchangeBitstampProvider(Exchange);
// export const ExchangeBittrex = ExchangeBittrexProvider(Exchange);
// export const ExchangeKraken = ExchangeKrakenProvider(Exchange);
// export const ExchangePoloniex = ExchangePoloniexProvider(Exchange);
