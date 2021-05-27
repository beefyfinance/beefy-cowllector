const ethers = require('ethers');

const chains = require;
const strats = require('../data/strats.json');

const config = {
  chainId: 128,
  beefyFeeRecipient: '0x183D1aaEf1a86De6f16B2737c30eF94a6d2A9308',
};

const main = async () => {
  for (strat of strats) {
    if (strat.chainId !== config.chainId) continue;
  }
};

main();
