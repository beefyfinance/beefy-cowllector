const chains = require('../data/chains');

const chainIdFromName = name => {
  for (const key in chains) {
    if (chains[key].id === name) {
      return chains[key].chainId;
    }
  }
};

module.exports = chainIdFromName;
