import { Observable } from 'rxjs';

import { TAccountType } from '../account/interfaces';
import { TMarketType, TMarketSide, TMarketBookOrder } from '../market/interfaces';
import { TOrderId, TOrderOriginId } from '../order/interfaces';
import { Account, Transfer } from '../account';
import { Market } from '../market';
import { Order } from '../order';

export type TExchangeName = string; // enum

export interface IExchange {
  name: TExchangeName;
  options: any; // TODO: specify
  settings: any; // object

  accounts: Account[];
  markets: Market[];

  transfers: Transfer[]; // experimental
  orders: Order[]; // experimental

  init(marketTypes?: TMarketType | TMarketType[], options?: any): Observable<Market[]>;

  findAccount(type: TAccountType): Account;
  findMarket(type: TMarketType): Market;
  findOrder(idOrOriginId: TOrderId | TOrderOriginId): Order;

  // // experimental
  findOrderByBookOrder(side: TMarketSide, bookOrder: TMarketBookOrder): Order;

  buy(market: Market, rate: number, amount: number): Observable<Order>;
  sell(market: Market, rate: number, amount: number): Observable<Order>;
  cancel(market: Market, order: Order): Observable<Order>;
  move(market: Market, order: Order, rate?: number, amount?: number): Observable<Order>;
  order(side: TMarketSide, market: Market, rate: number, amount: number): Observable<Order>;
  transfer(account: Account, amount: number): Observable<Transfer>;

  // experimental
  orderObserve(order: Order);
  transferObserve(transfer: Transfer);

  // experimental
  getRate(market: Market): number;
  getMinimum(market: Market): number;
  getStep(marketType?: TMarketType): number;

  _getAssetSymbol(accountType: TAccountType): string;
  _getAccountType(assetSymbol: string): TAccountType;
  _getAssetPairSymbol(marketType: TMarketType): string;
  _getMarketType(curencyPairSymbol: string): TMarketType;
}

export interface IExchangeConstructor {
  new(settings?: object, ...props: any[]): IExchange;
}
