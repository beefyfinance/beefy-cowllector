const chains = [
  {
    id: 'bsc',
    wrappedToken: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
    rpc: process.env.BSC_RPC,
  },
  {
    id: 'heco',
    wrappedToken: '0x5545153CCFcA01fbd7Dd11C0b23ba694D9509A6F',
    rpc: process.env.HECO_RPC,
  },
  {
    id: 'avax',
    wrappedToken: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
    rpc: process.env.AVAX_RPC,
  },
];

module.exports = chains;
