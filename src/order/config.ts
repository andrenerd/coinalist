import configMarket from '../market/config';

const config = Object.assign({}, configMarket, {
  order: {
    status: {
      values: {
        OPEN: 'open',
        FILLED: 'filled',
        CANCELED: 'canceled', // experimental
        FAILED: 'failed',
      },
      labels: {
        open: 'Open',
        filled: 'Filled',
        canceled: 'Canceled',
        failed: 'Failed',
      },
      list: [
        'open', 'filled', 'canceled', 'failed',
      ],
    }
  },
});

export default config;
