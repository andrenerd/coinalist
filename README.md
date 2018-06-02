# Coinalist
High level cryptocurrency exchange-agnostic framework for real time monitoring, trading and analytics. Based on easy to use "streams" and "observables" paradigm, as specified and implemented by [ReactiveX](https://github.com/ReactiveX/rxjs).


Status: alpha


```
const coinalist = require('coinalist');
const { config, exchange: { ExchangeBinance } } = coinalist;
const { BTCUSD, BTCUSDT } = config.market.values;
const { BUY, SELL } = config.side.values;

const exchange = new ExchangeBinance();
exchange.init([BTCUSDT,]);

const marketBook = exchange.markets[0].books[BUY];
marketBook.subscribe(marketBook => {
  console.log('Order book (top etries):\n', marketBook.orders);
});
```

Expected output on the order book updates:

```
...
Order book (top etries):
 [ [ 7628, 4.238912 ],
  [ 7627, 27.943388 ],
  [ 7626.33, 0.07916 ],
  [ 7626.2, 0.655634 ],
  [ 7625.55, 0.001312 ],
  [ 7625.07, 0.011624 ],
  [ 7625.02, 0.0014 ],
  [ 7625, 0.334699 ] ]
Order book (top etries):
 [ [ 7628.34, 1 ],
  [ 7628, 4.238912 ],
  [ 7627, 27.943388 ],
  [ 7626.33, 0.07916 ],
  [ 7626.2, 0.655634 ],
  [ 7625.55, 0.001312 ],
  [ 7625.07, 0.011624 ],
  [ 7625.02, 0.0014 ],
  [ 7625, 0.334699 ],
  [ 7612.41, 1.5 ] ]
...
```
