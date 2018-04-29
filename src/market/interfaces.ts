export type TMarketType = string; // enum
export type TMarketSide = string; // enum
export type TMarketBookOrder = number[]; // [rate, value] // temporal

export interface IMarket {
  type: TMarketType;
  books: IMarketBooks; // book of orders
}

export interface IMarketBooks {
  buy: IMarketBook;
  sell: IMarketBook;
}

export interface IMarketBook {
  orders: TMarketBookOrder[];

  subscribe(onNext: Function, ...props);
}
