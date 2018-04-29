import { TAsset } from '../asset/interfaces';
import { TMarketSide } from '../market/interfaces';

export type TOrderId = string;
export type TOrderOriginId = any; // or string?
export type TOrderStatus = string; // enum

export interface IOrder {
  id?: TOrderId;
  originId: TOrderOriginId;
  originIds?: TOrderOriginId[]; // experimental / for specific exchanges
  status?: TOrderStatus;

  side: TMarketSide;
  amount: number;
  rate: number;

  // RESERVED / rateFilled: number;
  amountFilled: number; // experimental
  amountFunded: number; // experimental

  assetFee: TAsset;
  amountFee: number; // experimental

  subscribe(onNext: Function, onError?: Function, onComplete?: Function, ...props);

  update(data: any): IOrder;
  close(status?: TOrderStatus): IOrder;

  isOpen: boolean;
  isFilled: boolean;
  isFailed: boolean;
  isClosed: boolean;
}
