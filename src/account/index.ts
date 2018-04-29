import { Observable, ReplaySubject } from 'rxjs';

import { TAccountType, TAccountAddress, TTransferId, TTransferType, TTransferStatus } from './interfaces';
import { IAccount, ITransfer } from './interfaces';

import config from './config';

const { DEPOSIT, WITHDRAWAL } = config.transfer.type.values;
const { OPEN, COMPLETED, FAILED } = config.transfer.status.values;

export class Account implements IAccount {
  type: TAccountType;
  address: TAccountAddress; // aka deposit address
  amount: number = 0;

  private _observable: ReplaySubject<Account>; // not in use

  constructor(type: TAccountType, ...props) {
    this['type'] = type;

    this['_observable'] = new ReplaySubject(1); // buffer last value
  }

  // not in use
  subscribe(onNext: Function, ...props) {
    return this._observable.subscribe(<any>onNext.bind(this));
  }
}

export class Transfer implements ITransfer {
  id: TTransferId
  type: TTransferType;
  status: TTransferStatus;
  amount: number;

  private _observable: ReplaySubject<Transfer>;

  constructor(
    id: TTransferId = null,
    // type: TTransferType,
    account: Account,
    amount: number = 0.0,
    status: TTransferStatus = config.transfer.status.values.OPEN,
    ...props
  ) {
    this['id'] = id;
    // this['type'] = type;
    this['account'] = account;
    this['amount'] = amount;
    this['status'] = status;

    this['_observable'] = new ReplaySubject(1); // buffer last value
  }

  subscribe(onNext: Function, ...props) {
    return this._observable.subscribe(<any>onNext.bind(this));
  }

  get isOpen(): boolean {
    return this.status == OPEN;
  }

  get isCompleted(): boolean {
    return this.status == COMPLETED;
  }

  get isFailed(): boolean {
    return this.status == FAILED; // || this.status == CANCELED;
  }

  get isClosed(): boolean {
    return this.status == COMPLETED || this.status == FAILED; // || this.status == CANCELED;
  }
}
