const getChainBlockTime = chainId => {
  switch (chainId) {
    case 56:
      return 3;
    case 128:
      return 3;
    case 43114:
      return 5;
    default:
      throw new Error(`Chain ID ${chainId} is not valid.`);
  }
};

const getChainRpc = chainId => {
  switch (chainId) {
    case 56:
      return process.env.BSC_RPC;
    case 128:
      return process.env.HECO_RPC;
    case 43114:
      return process.env.AVAX_RPC;
    default:
      throw new Error(`Chain ID ${chainId} is not valid.`);
  }
};

module.exports = { getChainRpc, getChainBlockTime };
