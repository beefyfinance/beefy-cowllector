const CHAINS = require('../data/chains');

module.exports = chainId => {
  console.log = function (d) {
    process.stdout.write(`== ${CHAINS[chainId].id} ==> ${d}` + '\n');
  };
};
