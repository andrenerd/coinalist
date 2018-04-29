import configAsset from '../asset/config';

const config = Object.assign({}, configAsset, {
  transfer: {
    type: {
      values: {
        DEPOSIT: 'deposit', // aka IN
        WITHDRAWAL: 'withdrawal', // aka OUT
      },
      labels: {
        deposit: 'deposit',
        withdrawal: 'withdrawal',
      },
      list: [
        'deposit', 'withdrawal',
      ],
    },
    status: {
      values: { // TODO: experimental / based on poloniex
        OPEN: 'open', // PENDING: 'pending',
        COMPLETED: 'completed',
        FAILED: 'failed',
      },
      labels: {
        open: 'open', // pending: 'Pending',
        completed: 'Completed',
        failed: 'Failed',
      },
      list: [
        'open', 'completed', 'failed',
      ],
    },
  },
});

export default config;
