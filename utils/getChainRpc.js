const getChainRcp = chainId => {
  switch (chainId) {
    case 56:
      return process.env.BSC_RPC;
      break;
    case 128:
      return process.env.HECO_RPC;
      break;
    default:
      throw new Error(`Chain ID ${chainId} is not valid.`);
  }
};

module.exports = getChainRcp;
