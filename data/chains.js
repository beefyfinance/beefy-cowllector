const chains = [
  {
    id: 'bsc',
    wrappedToken: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
    rewardPool: '0x453D4Ba9a2D594314DF88564248497F7D74d6b2C',
    beefyFeeRecipient: '0xEB41298BA4Ea3865c33bDE8f60eC414421050d53',
    rpc: process.env.BSC_RPC,
    queryLimit: 1000,
    queryInterval: 100,
    firstRewardBlock: 1457038,
  },
  {
    id: 'heco',
    wrappedToken: '0x5545153CCFcA01fbd7Dd11C0b23ba694D9509A6F',
    rewardPool: '0x5f7347fedfD0b374e8CE8ed19Fc839F59FB59a3B',
    beefyFeeRecipient: null,
    rpc: process.env.HECO_RPC,
    queryLimit: 2000,
    queryInterval: 100,
    firstRewardBlock: 3850000,
  },
  {
    id: 'avax',
    wrappedToken: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
    rewardPool: null,
    beefyFeeRecipient: null,
    rpc: process.env.AVAX_RPC,
    queryLimit: 1000,
    queryInterval: 100,
    firstRewardBlock: 0,
  },
  {
    id: 'polygon',
    wrappedToken: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
    rewardPool: null,
    beefyFeeRecipient: null,
    rpc: process.env.POLYGON_RPC,
    queryLimit: 1000,
    queryInterval: 100,
    firstRewardBlock: 0,
  },
];

module.exports = chains;
