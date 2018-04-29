export type TAccountType = string; // enum
export type TAccountAddress = string; // enum
export type TTransferId = string;
export type TTransferType = string; // enum
export type TTransferStatus = string; // enum

export interface IAccount {
  type: TAccountType;
  address: TAccountAddress; // aka deposit address
  amount: number;

  subscribe(onNext: Function, ...props);
}

export interface ITransfer {
  id?: TTransferId;
  type: TTransferType;
  status?: TTransferStatus;
  amount: number;

  subscribe(onNext: Function, onError?: Function, onComplete?: Function, ...props);

  isOpen: boolean;
  isCompleted: boolean;
  isFailed: boolean;
  isClosed: boolean;
}
