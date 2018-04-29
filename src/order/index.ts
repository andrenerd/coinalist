import { Observable, ReplaySubject } from 'rxjs';

import { TAsset } from '../asset/interfaces';
import { TMarketType, TMarketSide } from '../market/interfaces';
import { TOrderId, TOrderOriginId, TOrderStatus, IOrder } from './interfaces';

import config from './config';

const { BUY, SELL } = config.side.values;
const { OPEN, FILLED, CANCELED, FAILED } = config.order.status.values;
const { RATE, AMOUNT } = config.book.order;

export class Order implements IOrder {
  id: TOrderId;
  originId: TOrderOriginId;
  originIds: TOrderOriginId[];
  status: TOrderStatus; // enum

  side: TMarketSide;
  rate: number;
  amount: number;

  // RESERVED / rateFilled: number;
  amountFilled: number = 0.0; // experimental
  amountFunded: number = 0.0; // experimental

  assetFee: TAsset;
  amountFee: number = 0.0; // experimental

  private _observable: ReplaySubject<Order>;

  constructor(
    side: TMarketSide,
    rate: number = 0.0,
    amount: number = 0.0,
    status: TOrderStatus = OPEN,
    ...props
  ) {
    this['id'] = new Date().getTime().toString(36); // unique id

    this['status'] = status;

    this['side'] = side;
    this['amount'] = amount;
    this['rate'] = rate;

    this['_observable'] = new ReplaySubject(1); // buffer last value
  }

  subscribe(onNext: Function, onError?: Function, onComplete?: Function, ...props) {
    let on = Array.from(arguments).map(item => item ? item.bind(this) : item);
    return this._observable.subscribe(...on);
  }

  update(data: any): Order {
    for (let prop in data) {
      this[prop] = data[prop]; // this.hasOwnProperty(prop) && ...
    }

    if (this.isOpen) {
      if (this.amount == this.amountFilled) {
        return this.close();
      } else {
        this._observable.next(this);
      }
    }

    return this;
  }

  close(status?: TOrderStatus): Order {
    if (!this.isOpen) { return; }

    this.amount = this.amountFilled; // experimental / yes, always reset amount
    this.status = this.amountFilled ? FILLED : status || FAILED;

    this._observable.next(this);
    this._observable.complete();
    return this;
  }

  get isOpen(): boolean {
    return this.status == OPEN;
  }

  get isFilled(): boolean {
    return this.status == FILLED;
  }

  get isFailed(): boolean {
    return this.status == FAILED || this.status == CANCELED;
  }

  get isClosed(): boolean {
    return this.status == FILLED || this.status == FAILED || this.status == CANCELED;
  }

  // experimental
  static mean(orders: Order[]): number {
    let totalAmount = 0;
    let totalRate = 0;

    for (let i = orders.length - 1; i >= 0; i--) {
      totalAmount += orders[i].amount;
      totalRate += orders[i].rate * orders[i].amount;
    }

    return totalRate / totalAmount;
  }
}
